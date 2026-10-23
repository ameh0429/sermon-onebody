import { FellowshipGroup, GroupMember } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import type { AuthUser } from '../middleware/auth.js';

export async function getMembership(groupId: string, userId: string) {
  return GroupMember.findOne({ where: { groupId, userId } });
}

export async function requireGroup(groupId: string) {
  const group = await FellowshipGroup.findByPk(groupId);
  if (!group) throw AppError.notFound('Group not found');
  return group;
}

/** Group leader (the group's own leader) or a site admin may moderate. */
export function canModerate(user: AuthUser, group: Pick<FellowshipGroup, 'leaderId'>) {
  return user.role === 'admin' || group.leaderId === user.id;
}

/** Members, the group leader, and admins can read a group's discussions. */
export async function requireGroupAccess(groupId: string, user: AuthUser) {
  const group = await requireGroup(groupId);
  if (user.role === 'admin' || group.leaderId === user.id) return group;
  if (!(await getMembership(groupId, user.id))) throw AppError.forbidden('You must be a member of this group');
  return group;
}
