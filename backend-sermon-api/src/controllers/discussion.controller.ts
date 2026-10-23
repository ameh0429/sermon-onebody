import type { Request, Response } from 'express';
import { Op, type IncludeOptions, type WhereOptions } from 'sequelize';
import { DiscussionPost, GroupMember, Sermon, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, paginate, paginated, param } from '../utils/helpers.js';
import { canModerate, requireGroup, requireGroupAccess } from '../services/access.js';

// Factories, not shared constants: Sequelize mutates include options, so each query needs fresh objects.
const authorInclude = (): IncludeOptions => ({ model: User, as: 'author', attributes: ['id', 'name'] });

/** Top-level posts with their replies. `separate: true` runs replies as a second query so LIMIT applies to posts, not joined rows. */
const withReplies = (): IncludeOptions => ({
  model: DiscussionPost,
  as: 'replies',
  separate: true,
  order: [['createdAt', 'ASC']],
  include: [authorInclude()],
});

/**
 * Fetches one page of top-level threads. Counting is a separate plain query: Sequelize's
 * findAndCountAll would try to carry the nested `separate` include into the COUNT and generate invalid SQL.
 */
async function fetchThreads(where: WhereOptions<DiscussionPost>, page: number, limit: number) {
  const [count, rows] = await Promise.all([
    DiscussionPost.count({ where }),
    DiscussionPost.findAll({
      where,
      include: [authorInclude(), withReplies()],
      order: [['createdAt', 'DESC']],
      ...paginate(page, limit),
    }),
  ]);
  return paginated(rows, count, page, limit);
}

export async function createPost(req: Request, res: Response) {
  const user = currentUser(req);
  const groupId = param(req, 'groupId');
  const { content, sermonId, parentPostId } = req.body as { content: string; sermonId?: string; parentPostId?: string };

  const group = await requireGroupAccess(groupId, user);

  let resolvedSermonId = sermonId ?? null;
  if (parentPostId) {
    const parent = await DiscussionPost.findOne({ where: { id: parentPostId, groupId: group.id } });
    if (!parent) throw AppError.notFound('Parent post not found in this group');
    if (parent.parentPostId) throw AppError.badRequest('Replies can only be added to top-level posts');
    resolvedSermonId = parent.sermonId; // replies stay on the sermon of the thread they belong to
  } else if (resolvedSermonId && !(await Sermon.findByPk(resolvedSermonId, { attributes: ['id'] }))) {
    throw AppError.notFound('Sermon not found');
  }

  const post = await DiscussionPost.create({
    groupId: group.id,
    authorId: user.id,
    content,
    sermonId: resolvedSermonId,
    parentPostId: parentPostId ?? null,
  });
  res.status(201).json({ status: 'success', data: post });
}

export async function listGroupPosts(req: Request, res: Response) {
  const user = currentUser(req);
  const groupId = param(req, 'groupId');
  const { page, limit, sermonId } = req.query as unknown as { page: number; limit: number; sermonId?: string };
  await requireGroupAccess(groupId, user);

  const result = await fetchThreads({ groupId, parentPostId: null, ...(sermonId ? { sermonId } : {}) }, page, limit);
  res.json({ status: 'success', ...result });
}

/** Discussions about one sermon across every group the caller belongs to (optionally narrowed to one group). */
export async function listSermonPosts(req: Request, res: Response) {
  const user = currentUser(req);
  const sermonId = param(req, 'sermonId');
  const { page, limit, groupId } = req.query as unknown as { page: number; limit: number; groupId?: string };

  if (groupId) await requireGroupAccess(groupId, user);

  const where: WhereOptions<DiscussionPost>[] = [{ sermonId, parentPostId: null }];
  if (groupId) {
    where.push({ groupId });
  } else if (user.role !== 'admin') {
    const memberships = await GroupMember.findAll({ where: { userId: user.id }, attributes: ['groupId'] });
    where.push({ groupId: { [Op.in]: memberships.map((m) => m.groupId) } });
  }

  const result = await fetchThreads({ [Op.and]: where }, page, limit);
  res.json({ status: 'success', ...result });
}

export async function deletePost(req: Request, res: Response) {
  const user = currentUser(req);
  const post = await DiscussionPost.findByPk(param(req, 'id'));
  if (!post) throw AppError.notFound('Post not found');

  const group = await requireGroup(post.groupId);
  if (post.authorId !== user.id && !canModerate(user, group)) {
    throw AppError.forbidden('Only the author, the group leader or an admin can delete this post');
  }
  await post.destroy(); // replies are removed by the FK cascade
  res.status(204).send();
}

export async function flagPost(req: Request, res: Response) {
  const user = currentUser(req);
  const post = await DiscussionPost.findByPk(param(req, 'id'));
  if (!post) throw AppError.notFound('Post not found');

  await requireGroupAccess(post.groupId, user);
  if (post.authorId === user.id) throw AppError.badRequest('You cannot flag your own post');

  const { reason } = req.body as { reason: string };
  await post.update({ isFlagged: true, flagReason: reason, flaggedById: user.id });
  res.json({ status: 'success', data: post });
}

export async function listFlaggedPosts(req: Request, res: Response) {
  const user = currentUser(req);
  const group = await requireGroup(param(req, 'groupId'));
  if (!canModerate(user, group)) throw AppError.forbidden('Only the group leader or an admin can review flagged posts');

  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { rows, count } = await DiscussionPost.findAndCountAll({
    where: { groupId: group.id, isFlagged: true },
    include: [authorInclude()],
    order: [['updatedAt', 'DESC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}
