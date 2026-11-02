import { logger } from "../utils/logger.js";
import {
  cloudinaryAvatarStorage,
  type AvatarStorage,
} from "./avatarStorage.js";
export async function cleanupSermonImage(
  id: string | null,
  storage: AvatarStorage = cloudinaryAvatarStorage,
) {
  if (!id || !/^onebody\/sermons\/[0-9a-f-]+\/[0-9a-f-]+$/.test(id)) return;
  try {
    await storage.destroy(id);
  } catch {
    logger.warn(
      `Sermon image cleanup requires retry for managed resource ${id}`,
    );
  }
}
