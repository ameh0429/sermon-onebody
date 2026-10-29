# Sermon Library & Fellowship API

Express + TypeScript (ESM) + Sequelize + PostgreSQL. Covers Stage 1 (library, journal, auth), Stage 2 (fellowship discussions) and Stage 4 (security and performance) of the roadmap. Stage 3 was not in the brief and is not included.

## Quick start

```bash
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run dev                 # http://localhost:3000, docs at /docs
npm run create-admin        # seeds an admin from ADMIN_* in .env
```

Production: `npm run build && npm start`.

`DB_SYNC=true` creates and alters tables on boot (`alter` is disabled when `NODE_ENV=production`). For production, replace it with migrations.

Swagger UI is at `/docs`; the raw spec is at `/docs.json`. All endpoints live under `/api/v1`.

## Roles

| Role | Can |
|---|---|
| `member` (default on register) | Browse sermons, bookmark, keep a journal, join groups, post, flag |
| `leader` | Everything above, plus create fellowship groups and moderate their own groups |
| `admin` | Manage sermons and user roles; moderate any group |

Roles are embedded in the JWT, so a promoted user must log in again to get the new role.

## Endpoints

| Area | Endpoints |
|---|---|
| Auth/Users | `POST /auth/register`, `POST /auth/login`, `GET /users/me`, `PATCH /users/:id/role` (admin) |
| Sermons | `GET /sermons` (filters: `q, preacher, passage, tag, from, to, sort, order`), `GET /sermons/:id`, admin `POST/PATCH/DELETE` |
| Bookmarks | `GET /bookmarks`, `POST /bookmarks`, `DELETE /bookmarks/:sermonId` |
| Journal | CRUD on `/journal`, `GET /journal/shared?groupId=` |
| Groups | `GET/POST /groups`, `GET/PATCH/DELETE /groups/:id`, `POST /groups/:id/join`, `DELETE /groups/:id/leave`, `GET /groups/:id/members` |
| Discussions | `GET/POST /groups/:groupId/posts`, `GET /groups/:groupId/posts/flagged`, `GET /sermons/:sermonId/posts`, `POST /posts/:id/flag`, `DELETE /posts/:id` |

Replies use `parentPostId` and are one level deep. Deleting a post removes its replies.

## Security

- Zod validation on every body, query and param; HTML stripped from all request strings (passwords excluded).
- Helmet, CORS allow-list, 200 KB body limit, global rate limit (300 per 15 min), strict limit on login/register (10 per 15 min), write limit on posting and flagging.
- bcrypt (12 rounds) with a constant-time dummy compare for unknown emails.
- Journal entries are private by default. Other people's private entries return 404, not 403. Sharing needs an explicit group you belong to, and turning sharing off clears the group.

## Performance

- Indexes on sermon date, preacher, passage, a GIN index on tags, and on the foreign keys used by journal, bookmarks and discussions.
- Sermon lists skip the `content` column and are cached in memory (`SERMON_CACHE_TTL`, default 60 s; see the `X-Cache` header). The cache is cleared on any sermon write. It is per-process, so use Redis if you run several instances.
- Thread lists fetch replies with a second query so pagination applies to threads, not joined rows.

## Testing

`scripts/smoke-test.mjs` is an end-to-end test (80 checks) of auth, RBAC, journal privacy, groups, threads and moderation. Run it against a live server with a seeded admin:

```bash
BASE_URL=http://localhost:3000 ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMe123!' node scripts/smoke-test.mjs
```

## Layout

```
src/
  config/       env, database, swagger setup
  docs/         reusable OpenAPI schemas and error responses
  models/       Sequelize models and associations
  validators/   Zod schemas
  middleware/   auth/RBAC, validation, sanitising, rate limits, logging, errors
  controllers/  request handlers
  services/     access checks, sermon cache
  routes/       routers with @openapi JSDoc
  scripts/      createAdmin
```

## Weekly growth plans

Admins create a plan with `POST /api/v1/study-plans`:

```json
{
  "title": "Walking in Grace: Weekly Growth",
  "sermonId": "9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4",
  "dailyLessons": [
    { "day": 1, "title": "Receive grace", "passage": "Ephesians 2:1-10", "content": "Read the passage and reflect on grace as a gift." }
  ]
}
```

A plan contains 1–7 lessons with unique day numbers from 1–7. `sermonId` is optional at creation. Admins can attach or move a plan using `PUT /study-plans/:studyPlanId/sermon` with `{ "sermonId": "..." }`. A sermon can have multiple plans; each plan belongs to at most one sermon. Creation of the plan and lessons is atomic.

All routes below require a bearer token and use the `/api/v1` prefix:

| Method | Path | Behavior |
|---|---|---|
| GET | `/sermons/:sermonId/study-plans` | Fetch attached plans |
| GET | `/study-plans/:studyPlanId` | Fetch plan with ordered lessons |
| GET | `/study-plans/:studyPlanId/daily-lessons/:day` | Fetch a lesson by day |
| PUT | `/daily-lessons/:dailyLessonId/progress` | Set your status with `{ "completed": true }` or `{ "completed": false }` |
| GET | `/study-plans/:studyPlanId/progress` | Your completed count, percentage, and status for every lesson |

Progress always belongs to the authenticated user. Missing progress counts as incomplete. Completing a lesson again preserves its original completion timestamp; resetting clears it. Deleting a sermon detaches its plans; deleting a plan or user cascades to dependent progress. Swagger includes StudyPlans, DailyLessons, and LessonProgress tags and their input/output schemas.

The existing `DB_SYNC=true` development startup creates `study_plans`, `daily_lessons`, and `lesson_progress`, including foreign keys and unique indexes. Production deployments using `DB_SYNC=false` must apply equivalent schema changes through their deployment migration process before enabling these endpoints; this repository has no migration runner.

Run the added integration checks against a development API with a seeded admin:

```bash
npm run build
BASE_URL=http://localhost:3000 node --env-file=.env scripts/study-plan-smoke-test.mjs
```

The test checks validation, admin permissions, attachment, day lookup, private progress, completion resets, concurrent completion, and Swagger documentation. It cleans up its own fixtures. Restart the development API between this and the original smoke suite to reset authentication rate limits.
