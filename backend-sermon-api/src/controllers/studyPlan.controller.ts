import type { Request, Response } from 'express';
import { sequelize } from '../config/database.js';
import { StudyPlan, DailyLesson, LessonProgress, Sermon } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { currentUser, param } from '../utils/helpers.js';
import type { z } from 'zod';
import type { studyPlanBody } from '../validators/index.js';

async function requirePlan(id: string) {
  const plan = await StudyPlan.findByPk(id);
  if (!plan) throw AppError.notFound('Study plan not found');
  return plan;
}
async function requireSermon(id: string) {
  if (!(await Sermon.findByPk(id, { attributes: ['id'] }))) throw AppError.notFound('Sermon not found');
}
export async function createStudyPlan(req: Request, res: Response) {
  const { dailyLessons, ...body } = req.body as z.infer<typeof studyPlanBody>;
  if (body.sermonId) await requireSermon(body.sermonId);
  const result = await sequelize.transaction(async transaction => {
    const plan = await StudyPlan.create(body, { transaction });
    const lessons = await DailyLesson.bulkCreate(dailyLessons.map(lesson => ({ ...lesson, studyPlanId: plan.id })), { transaction });
    return { ...plan.toJSON(), dailyLessons: lessons.sort((a, b) => a.day - b.day) };
  });
  res.status(201).json({ status: 'success', data: result });
}
export async function attachStudyPlan(req: Request, res: Response) {
  const plan = await requirePlan(param(req, 'studyPlanId'));
  await requireSermon(req.body.sermonId);
  await plan.update({ sermonId: req.body.sermonId });
  res.json({ status: 'success', data: plan });
}
export async function getStudyPlan(req: Request, res: Response) {
  const plan = await requirePlan(param(req, 'studyPlanId'));
  const dailyLessons = await DailyLesson.findAll({ where: { studyPlanId: plan.id }, order: [['day', 'ASC']] });
  res.json({ status: 'success', data: { ...plan.toJSON(), dailyLessons } });
}
export async function getSermonStudyPlans(req: Request, res: Response) {
  const sermonId = param(req, 'sermonId');
  await requireSermon(sermonId);
  const plans = await StudyPlan.findAll({ where: { sermonId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  res.json({ status: 'success', data: plans });
}
export async function getDailyLesson(req: Request, res: Response) {
  const lesson = await DailyLesson.findOne({ where: { studyPlanId: param(req, 'studyPlanId'), day: Number(param(req, 'day')) } });
  if (!lesson) throw AppError.notFound('Daily lesson not found');
  res.json({ status: 'success', data: lesson });
}
export async function updateLessonProgress(req: Request, res: Response) {
  const dailyLessonId = param(req, 'dailyLessonId');
  if (!(await DailyLesson.findByPk(dailyLessonId))) throw AppError.notFound('Daily lesson not found');
  const userId = currentUser(req).id;
  const completed = req.body.completed as boolean;
  const result = await sequelize.transaction(async transaction => {
    const [row] = await LessonProgress.findOrCreate({ where: { userId, dailyLessonId }, defaults: { userId, dailyLessonId }, transaction });
    await row.reload({ transaction, lock: transaction.LOCK.UPDATE });
    return row.update({ completed, completedAt: completed ? (row.completedAt ?? new Date()) : null }, { transaction });
  });
  res.json({ status: 'success', data: result });
}
export async function getStudyPlanProgress(req: Request, res: Response) {
  const plan = await requirePlan(param(req, 'studyPlanId'));
  const lessons = await DailyLesson.findAll({ where: { studyPlanId: plan.id }, order: [['day', 'ASC']] });
  const progress = await LessonProgress.findAll({ where: { userId: currentUser(req).id, dailyLessonId: lessons.map(l => l.id) } });
  const byLesson = new Map(progress.map(p => [p.dailyLessonId, p]));
  const dailyLessons = lessons.map(l => ({ dailyLessonId: l.id, day: l.day, completed: byLesson.get(l.id)?.completed ?? false, completedAt: byLesson.get(l.id)?.completedAt ?? null }));
  const completedLessons = dailyLessons.filter(l => l.completed).length;
  res.json({ status: 'success', data: { studyPlanId: plan.id, totalLessons: lessons.length, completedLessons, completionPercentage: lessons.length ? Math.round(completedLessons / lessons.length * 100) : 0, dailyLessons } });
}
