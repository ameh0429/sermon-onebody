import type { Request, Response } from 'express';
import { User, Sermon, StudyPlan, DailyLesson, LessonProgress, SermonEngagement, Bookmark, JournalEntry, FellowshipGroup, DiscussionPost } from '../models/index.js';
import { currentUser, paginate, paginated, param } from '../utils/helpers.js';
import { AppError } from '../utils/AppError.js';
import { invalidateSermonCache } from '../services/sermonCache.js';

export async function archiveSermon(req: Request, res: Response) {
  const sermon = await Sermon.findByPk(param(req, 'id'));
  if (!sermon) throw AppError.notFound('Sermon not found');
  await sermon.update({ status: 'archived' });
  invalidateSermonCache();
  res.json({ status: 'success', data: sermon });
}
export async function setAccountStatus(req: Request, res: Response) {
  const user = await User.findByPk(param(req, 'id'));
  if (!user) throw AppError.notFound('User not found');
  if (user.id === currentUser(req).id && !req.body.isActive) throw AppError.badRequest('Admins cannot deactivate themselves');
  await user.update({ isActive: req.body.isActive });
  res.json({ status: 'success', data: user });
}
export async function listUsers(req: Request, res: Response) {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { rows, count } = await User.findAndCountAll({ attributes: { exclude: ['passwordHash'] }, order: [['createdAt', 'DESC']], ...paginate(page, limit) });
  res.json({ status: 'success', ...paginated(rows, count, page, limit) });
}
export async function trackEngagement(req: Request, res: Response) {
  const sermonId = param(req, 'id');
  const sermon = await Sermon.findByPk(sermonId);
  if (!sermon || sermon.status !== 'published') throw AppError.notFound('Published sermon not found');
  const fields = { userId: currentUser(req).id, sermonId, event: req.body.event as 'view' | 'listen' };
  const [engagement, created] = await SermonEngagement.findOrCreate({ where: fields, defaults: fields });
  res.status(created ? 201 : 200).json({ status: 'success', data: engagement });
}
export async function updateStudyPlan(req: Request, res: Response) {
  const plan = await StudyPlan.findByPk(param(req, 'studyPlanId'));
  if (!plan) throw AppError.notFound('Study plan not found');
  await plan.update(req.body);
  res.json({ status: 'success', data: plan });
}
export async function deleteStudyPlan(req: Request, res: Response) {
  if (!await StudyPlan.destroy({ where: { id: param(req, 'studyPlanId') } })) throw AppError.notFound('Study plan not found');
  res.status(204).send();
}
export async function addDailyLesson(req: Request, res: Response) {
  const studyPlanId = param(req, 'studyPlanId');
  if (!await StudyPlan.findByPk(studyPlanId)) throw AppError.notFound('Study plan not found');
  const lesson = await DailyLesson.create({ ...req.body, studyPlanId });
  res.status(201).json({ status: 'success', data: lesson });
}
export async function updateDailyLesson(req: Request, res: Response) {
  const lesson = await DailyLesson.findByPk(param(req, 'dailyLessonId'));
  if (!lesson) throw AppError.notFound('Daily lesson not found');
  await lesson.update(req.body);
  res.json({ status: 'success', data: lesson });
}
export async function deleteDailyLesson(req: Request, res: Response) {
  if (!await DailyLesson.destroy({ where: { id: param(req, 'dailyLessonId') } })) throw AppError.notFound('Daily lesson not found');
  res.status(204).send();
}
export async function analytics(_req: Request, res: Response) {
  const [users, activeUsers, drafts, published, archived, plans, lessons, completedLessons, views, listens, bookmarks, journalEntries, groups, posts] = await Promise.all([
    User.count(), User.count({ where: { isActive: true } }),
    Sermon.count({ where: { status: 'draft' } }), Sermon.count({ where: { status: 'published' } }), Sermon.count({ where: { status: 'archived' } }),
    StudyPlan.count(), DailyLesson.count(), LessonProgress.count({ where: { completed: true } }),
    SermonEngagement.count({ where: { event: 'view' } }), SermonEngagement.count({ where: { event: 'listen' } }),
    Bookmark.count(), JournalEntry.count(), FellowshipGroup.count(), DiscussionPost.count(),
  ]);
  res.json({ status: 'success', data: {
    users: { total: users, active: activeUsers, inactive: users - activeUsers },
    sermons: { total: drafts + published + archived, draft: drafts, published, archived },
    studyPlans: { total: plans, dailyLessons: lessons, completedLessons },
    engagement: { uniqueViews: views, uniqueListens: listens, bookmarks, journalEntries, groups, discussionPosts: posts },
  } });
}
