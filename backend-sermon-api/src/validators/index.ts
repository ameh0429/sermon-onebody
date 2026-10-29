import { z } from 'zod';
import { ROLES } from '../types.js';

const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format');
const text = (max: number) => z.string().trim().min(1).max(max);
const atLeastOne = (o: object) => Object.keys(o).length > 0;

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// --- Params --------------------------------------------------------------
export const idParam = z.object({ id: uuid });
export const sermonIdParam = z.object({ sermonId: uuid });
export const groupIdParam = z.object({ groupId: uuid });

// --- Auth / users --------------------------------------------------------
const email = z.string().trim().toLowerCase().email().max(255);

export const registerBody = z.object({
  name: text(100).min(2),
  email,
  password: z.string().min(8).max(128),
});
export const loginBody = z.object({ email, password: z.string().min(1).max(128) });
export const roleBody = z.object({ role: z.enum(ROLES) });

// --- Sermons -------------------------------------------------------------
export const sermonBody = z.object({
  title: text(255),
  preacher: text(150),
  passage: text(150),
  sermonDate: dateOnly,
  summary: z.string().trim().max(5000).optional(),
  content: z.string().max(100_000).optional(),
  audioUrl: z.string().url().max(2048).optional(),
  videoUrl: z.string().url().max(2048).optional(),
  tags: z.array(text(50)).max(20).optional(),
});
export const sermonUpdateBody = sermonBody.partial().refine(atLeastOne, 'At least one field is required');

export const sermonListQuery = z.object({
  ...pagination,
  q: z.string().trim().max(200).optional(),
  preacher: z.string().trim().max(150).optional(),
  passage: z.string().trim().max(150).optional(),
  tag: z.string().trim().max(50).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  sort: z.enum(['date', 'title']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// --- Bookmarks -----------------------------------------------------------
export const bookmarkBody = z.object({ sermonId: uuid });
export const paginationQuery = z.object(pagination);

// --- Journal -------------------------------------------------------------
export const journalBody = z.object({
  title: text(255),
  content: z.string().trim().min(1).max(50_000),
  sermonId: uuid.nullable().optional(),
  isShared: z.boolean().optional(),
  sharedWithGroupId: uuid.nullable().optional(),
});
export const journalUpdateBody = journalBody.partial().refine(atLeastOne, 'At least one field is required');
export const journalListQuery = z.object({ ...pagination, sermonId: uuid.optional() });
export const journalSharedQuery = z.object({ ...pagination, groupId: uuid });

// --- Groups & discussions ------------------------------------------------
export const groupBody = z.object({
  name: text(120).min(3),
  description: z.string().trim().max(2000).optional(),
});
export const groupUpdateBody = groupBody.partial().refine(atLeastOne, 'At least one field is required');
export const groupListQuery = z.object({
  ...pagination,
  q: z.string().trim().max(120).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

export const postBody = z.object({
  content: text(5000),
  sermonId: uuid.optional(),
  parentPostId: uuid.optional(),
});
export const postListQuery = z.object({ ...pagination, sermonId: uuid.optional() });
export const sermonPostsQuery = z.object({ ...pagination, groupId: uuid.optional() });
export const flagBody = z.object({ reason: text(500) });

// --- Weekly growth plans -------------------------------------------------
export const dailyLessonBody = z.object({
  day: z.number().int().min(1).max(7),
  title: text(255),
  passage: text(150).optional(),
  content: text(20_000),
}).strict();
export const studyPlanBody = z.object({
  title: text(255),
  description: text(5000).optional(),
  sermonId: uuid.optional(),
  dailyLessons: z.array(dailyLessonBody).min(1).max(7)
    .refine(lessons => new Set(lessons.map(lesson => lesson.day)).size === lessons.length, 'Lesson days must be unique'),
}).strict();
export const studyPlanIdParam = z.object({ studyPlanId: uuid });
export const dailyLessonDayParam = z.object({ studyPlanId: uuid, day: z.coerce.number().int().min(1).max(7) });
export const dailyLessonIdParam = z.object({ dailyLessonId: uuid });
export const attachStudyPlanBody = z.object({ sermonId: uuid }).strict();
export const lessonProgressBody = z.object({ completed: z.boolean() }).strict();
