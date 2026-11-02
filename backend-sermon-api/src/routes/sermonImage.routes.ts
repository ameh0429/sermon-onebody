import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/index.js";
import { Sermon } from "../models/index.js";
import { sequelize } from "../config/database.js";
import { currentUser, param } from "../utils/helpers.js";
import { AppError } from "../utils/AppError.js";
import { cleanupSermonImage } from "../services/sermonImageStorage.js";
import {
  cloudinaryAvatarStorage,
  type AvatarStorage,
} from "../services/avatarStorage.js";
import { invalidateSermonCache } from "../services/sermonCache.js";

const types: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export function createSermonImageRouter(
  storage: AvatarStorage = cloudinaryAvatarStorage,
) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    fileFilter: (_req, file, callback) => {
      if (!Object.values(types).includes(file.mimetype))
        callback(AppError.badRequest("Choose a JPEG, PNG, or WebP image."));
      else callback(null, true);
    },
  }).single("image");
  router.use("/:id/image", authenticate, authorize("leader", "admin"));
  router.use(
    "/:id/image",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      keyGenerator: (req) => currentUser(req).id,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  router.use("/:id/image", validate({ params: idParam }));
  /**
   * @openapi
   * /sermons/{id}/image:
   *   put:
   *     tags: [Sermons, Admin]
   *     summary: Upload or replace a sermon card image (leader/admin)
   *     description: JPEG, PNG or WebP up to 5 MiB and 16 megapixels. Re-encoded without metadata; resized to at most 1600 pixels wide.
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/Id' }]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [image]
   *             properties:
   *               image: { type: string, format: binary }
   *     responses:
   *       200: { description: Updated sermon including imageUrl }
   *       400: { description: Invalid image }
   *       403: { description: Leader or admin required }
   *       413: { description: Image exceeds 5 MiB }
   *       503: { description: Image storage is not configured }
   *   delete:
   *     tags: [Sermons, Admin]
   *     summary: Remove a sermon card image (leader/admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ $ref: '#/components/parameters/Id' }]
   *     responses:
   *       200: { description: Updated sermon with imageUrl null }
   */
  router.put(
    "/:id/image",
    async (req, _res, next) => {
      try {
        if (!(await Sermon.findByPk(param(req, "id"))))
          throw AppError.notFound("Sermon not found");
        next();
      } catch (error) {
        next(error);
      }
    },
    (req, res, next) =>
      upload(req, res, (error) => {
        if (error instanceof multer.MulterError)
          next(
            new AppError(
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
              error.code === "LIMIT_FILE_SIZE"
                ? "Image must be 5 MiB or smaller."
                : "Send one image in the image field.",
            ),
          );
        else if (error)
          next(
            error instanceof AppError
              ? error
              : AppError.badRequest("Invalid image upload."),
          );
        else next();
      }),
    async (req, res) => {
      if (!req.file) throw AppError.badRequest("Choose an image.");
      let image: Buffer;
      try {
        const source = sharp(req.file.buffer, {
          limitInputPixels: 16_000_000,
          failOn: "warning",
        });
        const metadata = await source.metadata();
        if (
          !metadata.format ||
          types[metadata.format] !== req.file.mimetype ||
          (metadata.pages ?? 1) > 1
        )
          throw new Error("Invalid format");
        image = await source
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch {
        throw AppError.badRequest(
          "Use a valid, still JPEG, PNG, or WebP image of at most 16 megapixels.",
        );
      }
      storage.assertConfigured();
      const id = param(req, "id"),
        publicId = `onebody/sermons/${id}/${randomUUID()}`;
      let uploaded;
      try {
        uploaded = await storage.upload(image, publicId);
      } catch (error) {
        await cleanupSermonImage(publicId, storage);
        throw error;
      }
      let previous: string | null = null;
      let sermon: Sermon;
      try {
        sermon = await sequelize.transaction(async (transaction) => {
          const record = await Sermon.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!record) throw AppError.notFound("Sermon not found");
          previous = record.imagePublicId;
          return record.update(
            { imageUrl: uploaded.url, imagePublicId: uploaded.publicId },
            { transaction },
          );
        });
      } catch (error) {
        await cleanupSermonImage(uploaded.publicId, storage);
        throw error;
      }
      invalidateSermonCache();
      await cleanupSermonImage(previous, storage);
      res.json({ status: "success", data: sermon });
    },
  );
  router.delete("/:id/image", async (req, res) => {
    let previous: string | null = null;
    const sermon = await sequelize.transaction(async (transaction) => {
      const record = await Sermon.findByPk(param(req, "id"), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw AppError.notFound("Sermon not found");
      previous = record.imagePublicId;
      return record.update(
        { imageUrl: null, imagePublicId: null },
        { transaction },
      );
    });
    invalidateSermonCache();
    await cleanupSermonImage(previous, storage);
    res.json({ status: "success", data: sermon });
  });
  return router;
}
