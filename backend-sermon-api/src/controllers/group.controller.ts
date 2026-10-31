import type { Request, Response } from 'express';
import { Op, type WhereOptions } from 'sequelize';
import { FellowshipGroup, GroupMember, User } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, escapeLike, paginate, paginated, param } from '../utils/helpers.js';
import { canModerate, requireGroup, requireGroupAccess } from '../services/access.js';

export async function createGroup(req: Request, res: Response) {
  const user = currentUser(req);
  const { name, description } = req.body as { name: string; description?: string };

  // Create the group and enrol its leader atomically.
  const group = await sequelize.transaction(async (transaction) => {
    const created = await FellowshipGroup.create({ name, description: description ?? null, leaderId: user.id }, { transaction });
    await GroupMember.create({ groupId: created.id, userId: user.id, role: 'leader' }, { transaction });
    return created;
  });
  res.status(201).json({ status: 'success', data: group });
}

export async function listGroups(req: Request, res: Response) {
  const user = currentUser(req);
  const { page, limit, q, mine } = req.query as unknown as { page: number; limit: number; q?: string; mine?: 'true' | 'false' };

  const where: WhereOptions<FellowshipGroup>[] = [];
  if (q) where.push({ name: { [Op.iLike]: `%${escapeLike(q)}%` } });
  if (mine === 'true') {
    const memberships = await GroupMember.findAll({ where: { userId: user.id }, attributes: ['groupId'] });
    where.push({ id: { [Op.in]: memberships.map((m) => m.groupId) } });
  }

  const { rows, count } = await FellowshipGroup.findAndCountAll({
    where: { [Op.and]: where },
    include: [{ model: User, as: 'leader', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}

export async function getGroup(req: Request, res: Response) {
  const group = await FellowshipGroup.findByPk(param(req, 'id'), {
    include: [{ model: User, as: 'leader', attributes: ['id', 'name'] }],
  });
  if (!group) throw AppError.notFound('Group not found');

  const [memberCount, membership] = await Promise.all([
    GroupMember.count({ where: { groupId: group.id } }),
    GroupMember.findOne({ where: { groupId: group.id, userId: currentUser(req).id }, attributes: ['userId'] }),
  ]);
  res.json({ status: 'success', data: { ...group.toJSON(), memberCount, isMember: !!membership } });
}

export async function updateGroup(req: Request, res: Response) {
  const group = await requireGroup(param(req, 'id'));
  if (!canModerate(currentUser(req), group)) throw AppError.forbidden('Only the group leader or an admin can edit this group');
  await group.update(req.body);
  res.json({ status: 'success', data: group });
}

export async function deleteGroup(req: Request, res: Response) {
  const group = await requireGroup(param(req, 'id'));
  if (!canModerate(currentUser(req), group)) throw AppError.forbidden('Only the group leader or an admin can delete this group');
  await group.destroy();
  res.status(204).send();
}

export async function joinGroup(req: Request, res: Response) {
  const group = await requireGroup(param(req, 'id'));
  const userId = currentUser(req).id;

  const [membership, created] = await GroupMember.findOrCreate({
    where: { groupId: group.id, userId },
    defaults: { groupId: group.id, userId, role: 'member' },
  });
  res.status(created ? 201 : 200).json({ status: 'success', data: membership });
}

export async function leaveGroup(req: Request, res: Response) {
  const group = await requireGroup(param(req, 'id'));
  const userId = currentUser(req).id;

  if (group.leaderId === userId) {
    throw AppError.badRequest('The group leader cannot leave. Delete the group or ask an admin to reassign it.');
  }
  const removed = await GroupMember.destroy({ where: { groupId: group.id, userId } });
  if (!removed) throw AppError.notFound('You are not a member of this group');
  res.status(204).send();
}

export async function listMembers(req: Request, res: Response) {
  const user = currentUser(req);
  const group = await requireGroupAccess(param(req, 'id'), user);
  const { page, limit } = req.query as unknown as { page: number; limit: number };

  const { rows, count } = await GroupMember.findAndCountAll({
    where: { groupId: group.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
    order: [['role', 'ASC'], ['createdAt', 'ASC']],
    ...paginate(page, limit),
  });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}
