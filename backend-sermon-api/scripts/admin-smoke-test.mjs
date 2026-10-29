// npm run build; BASE_URL=http://localhost:3000 node --env-file=.env scripts/admin-smoke-test.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sequelize } from '../dist/config/database.js';
import { User, Sermon, StudyPlan, SermonEngagement, LessonProgress } from '../dist/models/index.js';
const base = process.env.BASE_URL ?? 'http://localhost:3000';
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
async function call(method, path, token, body, status = 200) {
  const response = await fetch(`${base}/api/v1${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = response.status === 204 ? null : await response.json();
  check(response.status === status, `${method} ${path}: expected ${status}, received ${response.status}: ${JSON.stringify(json)}`);
  return json?.data;
}
const users = [], sermons = [], plans = [];
try {
  const admin = (await call('POST', '/auth/login', null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
  const password = 'AdminSmokePass123!';
  const suffix = randomUUID();
  for (const role of ['member', 'leader']) users.push(await User.create({ name: `Dashboard ${role}`, email: `${role}.${suffix}@example.com`, role, passwordHash: await bcrypt.hash(password, 12) }));
  const [member, pastor] = await Promise.all(users.map(async u => (await call('POST', '/auth/login', null, { email: u.email, password })).token));
  await call('GET', '/admin/analytics', null, undefined, 401);
  await call('GET', '/admin/analytics', member, undefined, 403);
  const baseline = await call('GET', '/admin/analytics', admin);
  await call('GET', '/admin/analytics', pastor);
  const body = { title: `Dashboard ${suffix}`, preacher: 'Pastor', passage: 'John 1', sermonDate: '2026-10-29', status: 'draft' };
  await call('POST', '/sermons', member, body, 403);
  await call('POST', '/sermons', pastor, { ...body, status: 'invalid' }, 400);
  const sermon = await call('POST', '/sermons', pastor, body, 201); sermons.push(sermon.id);
  check(sermon.status === 'draft', 'Pastor creates draft');
  const stats = await call('GET', '/admin/analytics', pastor);
  check(stats.sermons.draft === baseline.sermons.draft + 1 && stats.sermons.total === baseline.sermons.total + 1, 'Analytics aggregates sermon statuses');
  await call('GET', `/sermons/${sermon.id}`, member, undefined, 404);
  // Fill staff cache first, then ensure it cannot leak into member results.
  const staffList = await call('GET', `/sermons?q=${suffix}`, pastor);
  check(staffList.some(s => s.id === sermon.id), 'Staff sees drafts');
  check((await call('GET', `/sermons?q=${suffix}`, member)).length === 0, 'Member cache excludes drafts');
  await call('GET', '/sermons?status=draft', member, undefined, 403);
  await call('POST', `/sermons/${sermon.id}/engagement`, member, { event: 'view' }, 404);
  const plan = await call('POST', '/study-plans', pastor, { title: 'Pastor plan', sermonId: sermon.id, dailyLessons: [{ day: 1, title: 'Read', content: 'Study John 1' }] }, 201); plans.push(plan.id);
  await call('GET', `/study-plans/${plan.id}`, member, undefined, 404);
  await call('GET', `/study-plans/${plan.id}/daily-lessons/1`, member, undefined, 404);
  await call('PUT', `/daily-lessons/${plan.dailyLessons[0].id}/progress`, member, { completed: true }, 404);
  await call('PATCH', `/sermons/${sermon.id}`, pastor, { status: 'published', title: 'Published dashboard test' });
  check((await call('GET', `/sermons?q=${suffix}`, member)).length === 0, 'Cache invalidated after title edit');
  await call('GET', `/sermons/${sermon.id}`, member);
  const first = await call('POST', `/sermons/${sermon.id}/engagement`, member, { event: 'view' }, 201);
  const repeat = await call('POST', `/sermons/${sermon.id}/engagement`, member, { event: 'view' });
  check(first.id === repeat.id, 'Repeated engagement is idempotent');
  await call('POST', `/sermons/${sermon.id}/engagement`, member, { event: 'listen' }, 201);
  await call('POST', `/sermons/${sermon.id}/engagement`, member, { event: 'bad' }, 400);
  const engaged = await call('GET', '/admin/analytics', admin);
  check(engaged.engagement.uniqueViews === baseline.engagement.uniqueViews + 1 && engaged.engagement.uniqueListens === baseline.engagement.uniqueListens + 1, 'Analytics counts unique views and listens');
  await call('PATCH', `/study-plans/${plan.id}`, member, { title: 'No' }, 403);
  check((await call('PATCH', `/study-plans/${plan.id}`, pastor, { title: 'Edited plan' })).title === 'Edited plan', 'Pastor edits weekly plan');
  await call('PATCH', `/study-plans/${plan.id}`, pastor, {}, 400);
  const lesson = await call('POST', `/study-plans/${plan.id}/daily-lessons`, pastor, { day: 2, title: 'Reflect', content: 'Reflect today' }, 201);
  await call('POST', `/study-plans/${plan.id}/daily-lessons`, pastor, { day: 2, title: 'Duplicate', content: 'No' }, 409);
  check((await call('PATCH', `/daily-lessons/${lesson.id}`, pastor, { content: 'Edited lesson' })).content === 'Edited lesson', 'Pastor edits daily lesson');
  await call('PATCH', `/daily-lessons/${lesson.id}`, pastor, { day: 1 }, 409);
  await call('PUT', `/daily-lessons/${lesson.id}/progress`, member, { completed: true });
  await call('DELETE', `/daily-lessons/${lesson.id}`, pastor, undefined, 204);
  check(await LessonProgress.count({ where: { dailyLessonId: lesson.id } }) === 0, 'Lesson deletion cascades to progress');
  await call('POST', `/sermons/${sermon.id}/archive`, member, undefined, 403);
  check((await call('POST', `/sermons/${sermon.id}/archive`, pastor)).status === 'archived', 'Archive changes status');
  await call('GET', `/sermons/${sermon.id}`, member, undefined, 404);
  await call('GET', `/study-plans/${plan.id}/progress`, member, undefined, 404);
  await call('DELETE', `/study-plans/${plan.id}`, pastor, undefined, 204);
  await call('GET', `/study-plans/${plan.id}`, pastor, undefined, 404);
  await call('GET', '/admin/users', pastor, undefined, 403);
  const accounts = await call('GET', '/admin/users?limit=100', admin);
  check(accounts.every(u => !('passwordHash' in u) && typeof u.isActive === 'boolean'), 'Account listing excludes hashes and shows activation');
  await call('PATCH', `/admin/users/${users[0].id}/role`, pastor, { role: 'admin' }, 403);
  await call('PATCH', `/admin/users/${users[0].id}/role`, admin, { role: 'leader' });
  await call('GET', '/admin/analytics', member); // existing token gains current role
  await call('PATCH', `/admin/users/${users[0].id}/role`, admin, { role: 'member' });
  await call('GET', '/admin/analytics', member, undefined, 403); // stale claims grant nothing
  await call('PATCH', `/admin/users/${users[0].id}/status`, admin, { isActive: false });
  await call('GET', '/users/me', member, undefined, 401);
  await call('POST', '/auth/login', null, { email: users[0].email, password }, 401);
  await call('PATCH', `/admin/users/${users[0].id}/status`, admin, { isActive: true });
  await call('GET', '/users/me', member);
  const me = await call('GET', '/users/me', admin);
  await call('PATCH', `/admin/users/${me.id}/status`, admin, { isActive: false }, 400);
  await call('PATCH', `/admin/users/${randomUUID()}/status`, admin, { isActive: false }, 404);
  await call('PATCH', `/admin/users/${users[0].id}/status`, admin, { isActive: 'false' }, 400);
  const spec = await (await fetch(`${base}/docs.json`)).json();
  check(spec.tags.some(t => t.name === 'Admin') && !!spec.components.schemas.AdminAnalytics, 'Analytics and Admin tag documented');
  for (const [path, methods] of Object.entries(spec.paths)) for (const op of Object.values(methods)) {
    if (op.tags?.includes('Admin')) check(op.security?.some(s => 'bearerAuth' in s), `Bearer protection documented for ${path}`);
  }
  console.log(`${checks} dashboard checks passed`);
} finally {
  await StudyPlan.destroy({ where: { id: plans } });
  await Sermon.destroy({ where: { id: sermons } });
  await User.destroy({ where: { id: users.map(u => u.id) } });
  check(await SermonEngagement.count({ where: { sermonId: sermons } }) === 0, 'Sermon engagement cascades on deletion');
  await sequelize.close();
}
