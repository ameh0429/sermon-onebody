import type { Request, Response } from 'express';
import { Op, type WhereOptions } from 'sequelize';
import { Sermon } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, escapeLike, paginate, paginated, param } from '../utils/helpers.js';
import { invalidateSermonCache, sermonCache, sermonListKey } from '../services/sermonCache.js';

interface ListQuery {
  status?: 'draft' | 'published' | 'archived';
  page: number;
  limit: number;
  q?: string;
  preacher?: string;
  passage?: string;
  tag?: string;
  from?: string;
  to?: string;
  sort: 'date' | 'title';
  order: 'asc' | 'desc';
}

export async function listSermons(req: Request, res: Response) {
  const query = req.query as unknown as ListQuery;
  const staff = currentUser(req).role !== 'member';
  if (!staff && query.status && query.status !== 'published') throw AppError.forbidden();
  const key = sermonListKey({ ...query, staff });

  const cached = sermonCache.get(key);
  if (cached) {
    res.set('X-Cache', 'HIT').json({ status: 'success', ...(cached as object) });
    return;
  }

  const where: WhereOptions<Sermon>[] = [];
  if (!staff) where.push({ status: 'published' });
  else if (query.status) where.push({ status: query.status });
  const like = (value: string) => ({ [Op.iLike]: `%${escapeLike(value)}%` });

  if (query.q) where.push({ [Op.or]: [{ title: like(query.q) }, { summary: like(query.q) }, { passage: like(query.q) }] });
  if (query.preacher) where.push({ preacher: like(query.preacher) });
  if (query.passage) where.push({ passage: like(query.passage) });
  if (query.tag) where.push({ tags: { [Op.contains]: [query.tag] } });
  if (query.from) where.push({ sermonDate: { [Op.gte]: query.from } });
  if (query.to) where.push({ sermonDate: { [Op.lte]: query.to } });

  const direction = query.order.toUpperCase();
  const order: [string, string][] =
    query.sort === 'title' ? [['title', direction]] : [['sermonDate', direction], ['createdAt', 'DESC']];

  const { rows, count } = await Sermon.findAndCountAll({
    where: { [Op.and]: where },
    // The list view skips the heavy `content` column; fetch a sermon by id for the full text.
    attributes: { exclude: ['content'] },
    order,
    ...paginate(query.page, query.limit),
  });

  const payload = paginated(rows, count, query.page, query.limit);
  sermonCache.set(key, payload);
  res.set('X-Cache', 'MISS').json({ status: 'success', ...payload });
}

export async function getSermon(req: Request, res: Response) {
  const sermon = await Sermon.findByPk(param(req, 'id'));
  if (!sermon || (sermon.status !== 'published' && currentUser(req).role === 'member')) throw AppError.notFound('Sermon not found');
  res.json({ status: 'success', data: sermon });
}

export async function createSermon(req: Request, res: Response) {
  const sermon = await Sermon.create(req.body);
  invalidateSermonCache();
  res.status(201).json({ status: 'success', data: sermon });
}

export async function updateSermon(req: Request, res: Response) {
  const sermon = await Sermon.findByPk(param(req, 'id'));
  if (!sermon) throw AppError.notFound('Sermon not found');
  await sermon.update(req.body);
  invalidateSermonCache();
  res.json({ status: 'success', data: sermon });
}

export async function deleteSermon(req: Request, res: Response) {
  const deleted = await Sermon.destroy({ where: { id: param(req, 'id') } });
  if (!deleted) throw AppError.notFound('Sermon not found');
  invalidateSermonCache();
  res.status(204).send();
}
