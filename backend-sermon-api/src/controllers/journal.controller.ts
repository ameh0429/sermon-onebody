import type { Request, Response } from 'express';
import { JournalEntry, Sermon, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, paginate, paginated, param } from '../utils/helpers.js';
import { getMembership, requireGroup } from '../services/access.js';

interface JournalInput {
  title?: string;
  content?: string;
  sermonId?: string | null;
  isShared?: boolean;
  sharedWithGroupId?: string | null;
}

/**
 * Entries are private by default. Sharing needs an explicit group and the owner must belong to it.
 * Turning sharing off always clears the group so nothing stays exposed by accident.
 */
async function resolveSharing(userId: string, isShared: boolean, groupId: string | null | undefined) {
  if (!isShared) return { isShared: false, sharedWithGroupId: null };
  if (!groupId) throw AppError.badRequest('sharedWithGroupId is required when isShared is true');

  const group = await requireGroup(groupId);
  if (group.leaderId !== userId && !(await getMembership(groupId, userId))) {
    throw AppError.forbidden('You can only share entries with groups you belong to');
  }
  return { isShared: true, sharedWithGroupId: groupId };
}

async function assertSermonExists(sermonId: string | null | undefined) {
  if (sermonId && !(await Sermon.findByPk(sermonId, { attributes: ['id'] }))) throw AppError.notFound('Sermon not found');
}

export async function createEntry(req: Request, res: Response) {
  const userId = currentUser(req).id;
  const input = req.body as Required<Pick<JournalInput, 'title' | 'content'>> & JournalInput;

  await assertSermonExists(input.sermonId);
  const sharing = await resolveSharing(userId, input.isShared ?? false, input.sharedWithGroupId);

  const entry = await JournalEntry.create({
    userId,
    title: input.title,
    content: input.content,
    sermonId: input.sermonId ?? null,
    ...sharing,
  });
  res.status(201).json({ status: 'success', data: entry });
}

export async function listEntries(req: Request, res: Response) {
  const { page, limit, sermonId } = req.query as unknown as { page: number; limit: number; sermonId?: string };

  const { rows, count } = await JournalEntry.findAndCountAll({
    where: { userId: currentUser(req).id, ...(sermonId ? { sermonId } : {}) },
    order: [['createdAt', 'DESC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}

/** Entries other members have shared with a group the caller belongs to. */
export async function listSharedEntries(req: Request, res: Response) {
  const user = currentUser(req);
  const { page, limit, groupId } = req.query as unknown as { page: number; limit: number; groupId: string };

  const group = await requireGroup(groupId);
  if (user.role !== 'admin' && group.leaderId !== user.id && !(await getMembership(groupId, user.id))) {
    throw AppError.forbidden('You must be a member of this group');
  }

  const { rows, count } = await JournalEntry.findAndCountAll({
    where: { sharedWithGroupId: groupId, isShared: true },
    include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}

export async function getEntry(req: Request, res: Response) {
  const user = currentUser(req);
  const entry = await JournalEntry.findByPk(param(req, 'id'));

  let allowed = entry?.userId === user.id;
  if (entry && !allowed && entry.isShared && entry.sharedWithGroupId) {
    allowed = !!(await getMembership(entry.sharedWithGroupId, user.id));
  }
  // 404 (not 403) so the existence of someone else's private entry is never revealed.
  if (!entry || !allowed) throw AppError.notFound('Journal entry not found');

  res.json({ status: 'success', data: entry });
}

export async function updateEntry(req: Request, res: Response) {
  const userId = currentUser(req).id;
  const entry = await JournalEntry.findOne({ where: { id: param(req, 'id'), userId } });
  if (!entry) throw AppError.notFound('Journal entry not found');

  const input = req.body as JournalInput;
  if (input.sermonId !== undefined) await assertSermonExists(input.sermonId);

  const touchesSharing = input.isShared !== undefined || input.sharedWithGroupId !== undefined;
  const sharing = touchesSharing
    ? await resolveSharing(userId, input.isShared ?? entry.isShared, input.sharedWithGroupId ?? entry.sharedWithGroupId)
    : {};

  await entry.update({
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.sermonId !== undefined ? { sermonId: input.sermonId } : {}),
    ...sharing,
  });
  res.json({ status: 'success', data: entry });
}

export async function deleteEntry(req: Request, res: Response) {
  const deleted = await JournalEntry.destroy({ where: { id: param(req, 'id'), userId: currentUser(req).id } });
  if (!deleted) throw AppError.notFound('Journal entry not found');
  res.status(204).send();
}
