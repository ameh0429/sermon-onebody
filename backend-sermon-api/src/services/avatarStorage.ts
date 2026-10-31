import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/AppError.js';

export interface StoredAvatar { url: string; publicId: string }
export interface AvatarStorage {
  assertConfigured(): void;
  upload(image: Buffer, publicId: string): Promise<StoredAvatar>;
  destroy(publicId: string): Promise<void>;
}
function options() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new AppError(503, 'Profile photo storage is not configured. Please contact your administrator.');
  return { cloud_name, api_key, api_secret, secure: true };
}
// Explicit per-call credentials avoid global SDK state and remain entirely on the backend.
export const cloudinaryAvatarStorage: AvatarStorage = {
  assertConfigured() { options(); },
  upload(image, publicId) {
    const config = options();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        ...config, public_id: publicId, resource_type: 'image', type: 'upload',
        overwrite: false, format: 'jpg', timeout: 30_000,
      }, (error, result) => {
        if (error || !result || result.public_id !== publicId || !result.secure_url?.startsWith('https://')) {
          reject(new AppError(502, 'Could not store your photo. Your previous photo has been kept. Please try again.'));
        } else resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.on('error', () => reject(new AppError(502, 'Could not store your photo. Please try again.')));
      stream.end(image);
    });
  },
  async destroy(publicId) {
    const requestOptions = { ...options(), resource_type: 'image' as const, type: 'upload' as const, invalidate: true, timeout: 30_000 };
    const result = await cloudinary.uploader.destroy(publicId, requestOptions);
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Photo cleanup failed');
  },
};
