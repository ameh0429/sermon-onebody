import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signToken } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, param } from '../utils/helpers.js';

const BCRYPT_ROUNDS = 12;
// Pre-computed hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  if (await User.findOne({ where: { email }, attributes: ['id'] })) throw AppError.conflict('Email is already registered');

  // Role is always `member` on self-registration; admins promote users via PATCH /users/:id/role.
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  const token = signToken({ id: user.id, role: user.role });

  res.status(201).json({ status: 'success', data: { user, token } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !valid) throw AppError.unauthorized('Invalid email or password');

  res.json({ status: 'success', data: { user, token: signToken({ id: user.id, role: user.role }) } });
}

export async function me(req: Request, res: Response) {
  const user = await User.findByPk(currentUser(req).id);
  if (!user) throw AppError.unauthorized('Account no longer exists');
  res.json({ status: 'success', data: user });
}

export async function updateRole(req: Request, res: Response) {
  const user = await User.findByPk(param(req, 'id'));
  if (!user) throw AppError.notFound('User not found');

  const { role } = req.body as { role: User['role'] };
  if (user.id === currentUser(req).id && role !== 'admin') {
    throw AppError.badRequest('Admins cannot demote themselves');
  }
  await user.update({ role });
  res.json({ status: 'success', data: user });
}
