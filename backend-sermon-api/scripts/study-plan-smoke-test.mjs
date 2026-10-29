// Run against a development API with seeded admin credentials in the environment.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.BASE_URL ?? 'http://localhost:3000';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function call(method, path, token, body, status = 200) {
  const response = await fetch(`${base}/api/v1${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = response.status === 204 ? null : await response.json();
  check(response.status === status, `${method} ${path}: expected ${status}, got ${response.status}: ${JSON.stringify(json)}`);
  return json?.data;
}
const admin = (await call('POST', '/auth/login', null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
const createdUsers = [];
for (const name of ['StudyMember', 'StudyOther']) {
  createdUsers.push(await call('POST', '/auth/register', null, { name, email: `${name}.${randomUUID()}@example.com`, password: 'StudyPass123!' }, 201));
}
const [member, other] = createdUsers.map(user => user.token);
let sermon, plan;
try {
  sermon = await call('POST', '/sermons', admin, { title: 'Study plan smoke test', preacher: 'Test', passage: 'John 1', sermonDate: '2026-10-29' }, 201);
  const body = { title: 'Weekly growth', dailyLessons: [{ day: 2, title: 'Reflect', content: 'Apply the passage.' }, { day: 1, title: 'Read', passage: 'John 1:1', content: 'Read and pray.' }] };
  await call('POST', '/study-plans', null, body, 401);
  await call('POST', '/study-plans', member, body, 403);
  for (const dailyLessons of [[], [{ ...body.dailyLessons[0], day: 0 }], [{ ...body.dailyLessons[0], day: 8 }], [body.dailyLessons[0], body.dailyLessons[0]]]) {
    await call('POST', '/study-plans', admin, { ...body, dailyLessons }, 400);
  }
  await call('POST', '/study-plans', admin, { ...body, sermonId: randomUUID() }, 404);
  plan = await call('POST', '/study-plans', admin, body, 201);
  check(plan.sermonId === null && plan.dailyLessons.map(l => l.day).join() === '1,2', 'Plan lessons are ordered and attachment is optional');
  await call('PUT', `/study-plans/${plan.id}/sermon`, member, { sermonId: sermon.id }, 403);
  await call('PUT', `/study-plans/${plan.id}/sermon`, admin, { sermonId: randomUUID() }, 404);
  await call('PUT', `/study-plans/${plan.id}/sermon`, admin, { sermonId: sermon.id });
  check((await call('GET', `/sermons/${sermon.id}/study-plans`, member)).some(p => p.id === plan.id), 'Attached plan can be found by sermon');
  check((await call('GET', `/study-plans/${plan.id}`, member)).dailyLessons.length === 2, 'Fetch includes lessons');
  const lesson = await call('GET', `/study-plans/${plan.id}/daily-lessons/1`, member);
  check(lesson.title === 'Read', 'Fetch lesson by day');
  await call('GET', `/study-plans/${plan.id}/daily-lessons/8`, member, undefined, 400);
  await call('GET', `/study-plans/${plan.id}/daily-lessons/3`, member, undefined, 404);
  await call('GET', `/study-plans/not-a-uuid`, member, undefined, 400);
  await call('GET', `/study-plans/${randomUUID()}`, member, undefined, 404);
  const progressPath = `/daily-lessons/${lesson.id}/progress`;
  await call('PUT', progressPath, null, { completed: true }, 401);
  await call('PUT', progressPath, member, { completed: 'true' }, 400);
  await call('PUT', progressPath, member, { completed: true, userId: createdUsers[1].user.id }, 400);
  await call('PUT', `/daily-lessons/${randomUUID()}/progress`, member, { completed: true }, 404);
  const initial = await call('GET', `/study-plans/${plan.id}/progress`, member);
  check(initial.completedLessons === 0 && initial.dailyLessons.every(l => !l.completed && l.completedAt === null), 'Missing progress is incomplete');
  const completed = await call('PUT', progressPath, member, { completed: true });
  const repeated = await call('PUT', progressPath, member, { completed: true });
  check(completed.id === repeated.id && completed.completedAt === repeated.completedAt, 'Repeated completion is idempotent');
  const summary = await call('GET', `/study-plans/${plan.id}/progress`, member);
  check(summary.completedLessons === 1 && summary.completionPercentage === 50, 'Progress summary counts completed lessons');
  check((await call('GET', `/study-plans/${plan.id}/progress`, other)).completedLessons === 0, 'Progress is private to each user');
  const reset = await call('PUT', progressPath, member, { completed: false });
  check(!reset.completed && reset.completedAt === null, 'Reset clears completion timestamp');
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => call('PUT', progressPath, other, { completed: true })));
  check(new Set(concurrent.map(p => p.id)).size === 1 && new Set(concurrent.map(p => p.completedAt)).size === 1, 'Concurrent completion creates one stable progress row');
  const spec = await (await fetch(`${base}/docs.json`)).json();
  for (const tag of ['StudyPlans', 'DailyLessons', 'LessonProgress']) check(spec.tags.some(t => t.name === tag), `${tag} is documented`);
  check(!!spec.paths['/daily-lessons/{dailyLessonId}/progress'].put.requestBody && !!spec.components.schemas.StudyPlanProgress, 'Progress request and response documented');
  console.log(`${checks} study plan checks passed`);
} finally {
  // Remove only this run's fixtures, including private progress via database cascades.
  const { sequelize } = await import('../dist/config/database.js');
  const { StudyPlan, User } = await import('../dist/models/index.js');
  try {
    if (plan) await StudyPlan.destroy({ where: { id: plan.id } });
    if (sermon) await call('DELETE', `/sermons/${sermon.id}`, admin, undefined, 204);
    await User.destroy({ where: { id: createdUsers.map(u => u.user.id) } });
  } finally { await sequelize.close(); }
}
