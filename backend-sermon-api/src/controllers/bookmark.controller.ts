import type { Request, Response } from 'express';
import { Bookmark, Sermon } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, paginate, paginated, param } from '../utils/helpers.js';

export async function addBookmark(req: Request, res: Response) {
  const userId = currentUser(req).id;
  const { sermonId } = req.body as { sermonId: string };

  const sermon = await Sermon.findByPk(sermonId, { attributes: ['id', 'status'] });
  if (!sermon || (currentUser(req).role === 'member' && sermon.status !== 'published')) throw AppError.notFound('Sermon not found');

  // Idempotent: bookmarking twice returns the existing bookmark.
  const [bookmark, created] = await Bookmark.findOrCreate({ where: { userId, sermonId }, defaults: { userId, sermonId } });
  res.status(created ? 201 : 200).json({ status: 'success', data: bookmark });
}

export async function removeBookmark(req: Request, res: Response) {
  const deleted = await Bookmark.destroy({ where: { userId: currentUser(req).id, sermonId: param(req, 'sermonId') } });
  if (!deleted) throw AppError.notFound('Bookmark not found');
  res.status(204).send();
}

export async function listBookmarks(req: Request, res: Response) {
  const { page, limit, sermonId } = req.query as unknown as { page: number; limit: number; sermonId?: string };

  const { rows, count } = await Bookmark.findAndCountAll({
    where: { userId: currentUser(req).id, ...(sermonId ? { sermonId } : {}) },
    include: [{ model: Sermon, as: 'sermon', attributes: { exclude: ['content'] }, ...(currentUser(req).role === 'member' ? { where: { status: 'published' }, required: true } : {}) }],
    order: [['createdAt', 'DESC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}
