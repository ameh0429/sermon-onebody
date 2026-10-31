import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { User } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { currentUser } from '../utils/helpers.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { cloudinaryAvatarStorage, type AvatarStorage } from '../services/avatarStorage.js';

const MAX_BYTES = 5 * 1024 * 1024;
const mimeTypes: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
async function normalize(file: Express.Multer.File | undefined) {
  if (!file) throw AppError.badRequest('Choose a JPEG, PNG, or WebP photo.');
  try {
    const image = sharp(file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!meta.format || mimeTypes[meta.format] !== file.mimetype || (meta.pages ?? 1) > 1) throw new Error('Unsupported image');
    // Auto-orient before cropping; JPEG re-encoding strips EXIF/location and other metadata.
    return await image.rotate().resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw AppError.badRequest('Use a valid, still JPEG, PNG, or WebP photo of at most 16 megapixels.'); }
}
export function createAvatarRouter(storage: AvatarStorage = cloudinaryAvatarStorage) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1 }, fileFilter: (_req, file, callback) => {
    if (!Object.values(mimeTypes).includes(file.mimetype)) callback(AppError.badRequest('Only JPEG, PNG, and WebP photos are supported.'));
    else callback(null, true);
  } }).single('avatar');
  router.use(authenticate);
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: req => currentUser(req).id, standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ status: 'error', message: 'Too many photo changes. Please try again later.' }); },
  }));
  async function cleanup(publicId: string | null | undefined) {
    if (!publicId) return;
    // Never destroy arbitrary media: only our server-generated avatar namespace is managed here.
    if (!/^onebody\/avatars\/[0-9a-f-]+\/[0-9a-f-]+$/.test(publicId)) {
      logger.warn('Skipped cleanup of an unmanaged avatar resource'); return;
    }
    try { await storage.destroy(publicId); }
    catch { logger.warn(`Avatar cleanup requires retry for managed resource ${publicId}`); }
  }

  /**
   * @openapi
   * /users/me/avatar:
   *   put:
   *     tags: [Users]
   *     summary: Upload or replace your profile photo
   *     description: 'JPEG, PNG, or WebP, up to 5 MiB and 16 megapixels. Still images only. Re-encoded to a 400x400 JPEG without metadata. Account is always taken from the bearer token. Limited to 10 photo changes per 15 minutes per account.'
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [avatar]
   *             additionalProperties: false
   *             properties:
   *               avatar: { type: string, format: binary }
   *     responses:
   *       200:
   *         description: Updated account (including avatarUrl; storage identifiers are private)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: success }
   *                 data: { $ref: '#/components/schemas/User' }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       413: { description: File exceeds 5 MiB }
   *       429: { $ref: '#/components/responses/TooManyRequests' }
   *       502: { description: Image storage unavailable; previous photo retained }
   *       503: { description: Cloudinary credentials have not been configured }
   *   delete:
   *     tags: [Users]
   *     summary: Remove your profile photo
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Updated account with avatarUrl null (also succeeds if no photo exists)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: success }
   *                 data: { $ref: '#/components/schemas/User' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       429: { $ref: '#/components/responses/TooManyRequests' }
   *       503: { description: Image storage is not configured }
   */
  router.put('/', (req, res, next) => {
    upload(req, res, error => {
      if (error instanceof multer.MulterError) next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5 MiB or smaller.' : 'Send exactly one photo in the avatar field, with no other fields.'));
      else if (error instanceof AppError) next(error);
      else if (error) next(AppError.badRequest('Could not read the photo upload. Send a valid multipart form.'));
      else next();
    });
  }, async (req, res) => {
    const image = await normalize(req.file);
    storage.assertConfigured();
    const id = currentUser(req).id;
    const publicId = `onebody/avatars/${id}/${randomUUID()}`;
    let uploaded;
    try { uploaded = await storage.upload(image, publicId); }
    catch (error) { await cleanup(publicId); throw error; }
    let previous: string | null = null;
    let user: User;
    try {
      user = await sequelize.transaction(async transaction => {
        const account = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!account || !account.isActive) throw AppError.unauthorized('Account is no longer active');
        previous = account.avatarPublicId;
        return account.update({ avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId }, { transaction });
      });
    } catch (error) { await cleanup(uploaded.publicId); throw error; }
    // Only retire the old resource after the database commit. Unique IDs + row locks make replacements concurrent-safe.
    await cleanup(previous);
    res.json({ status: 'success', data: user });
  });
  router.delete('/', async (req, res) => {
    let previous: string | null = null;
    const user = await sequelize.transaction(async transaction => {
      const account = await User.findByPk(currentUser(req).id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!account || !account.isActive) throw AppError.unauthorized();
      if (account.avatarPublicId) storage.assertConfigured();
      previous = account.avatarPublicId;
      return account.update({ avatarUrl: null, avatarPublicId: null }, { transaction });
    });
    await cleanup(previous);
    res.json({ status: 'success', data: user });
  });
  return router;
}
