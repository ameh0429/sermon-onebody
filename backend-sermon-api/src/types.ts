export const ROLES = ['member', 'leader', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const GROUP_ROLES = ['leader', 'member'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];
