import { studyPlanSchemas } from './studyPlans.js';
/** Reusable OpenAPI components: security scheme, schemas (with examples) and error responses. */

const uuid = (example: string) => ({ type: 'string', format: 'uuid', example });
const ts = (example: string) => ({ type: 'string', format: 'date-time', example });

const ID1 = '3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10';
const ID2 = '9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4';
const ID3 = 'c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f';

const errorExample = (message: string) => ({ status: 'error', message });
const errorResponse = (description: string, message: string, extra: object = {}) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { ...errorExample(message), ...extra } },
  },
});

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Obtain a token from `POST /auth/login` (or `/auth/register`) and send it as `Authorization: Bearer <token>`.',
  },
};

export const schemas = {
  ...studyPlanSchemas,
  // ---------------------------------------------------------------- core
  User: {
    type: 'object',
    properties: {
      id: uuid(ID1),
      name: { type: 'string', example: 'Grace Okafor' },
      email: { type: 'string', format: 'email', example: 'grace@example.com' },
      role: { type: 'string', enum: ['member', 'leader', 'admin'], example: 'member' },
      createdAt: ts('2026-10-01T09:00:00.000Z'),
      updatedAt: ts('2026-10-01T09:00:00.000Z'),
    },
  },
  Sermon: {
    type: 'object',
    properties: {
      id: uuid(ID2),
      title: { type: 'string', example: 'Walking in Grace' },
      preacher: { type: 'string', example: 'Pastor John Adeyemi' },
      passage: { type: 'string', example: 'Ephesians 2:1-10' },
      sermonDate: { type: 'string', format: 'date', example: '2026-09-27' },
      summary: { type: 'string', nullable: true, example: 'Grace is a gift, not a wage.' },
      content: { type: 'string', nullable: true, description: 'Full text. Omitted from list responses.', example: 'Full sermon text…' },
      audioUrl: { type: 'string', format: 'uri', nullable: true, example: 'https://cdn.example.com/sermons/walking-in-grace.mp3' },
      videoUrl: { type: 'string', format: 'uri', nullable: true, example: null },
      tags: { type: 'array', items: { type: 'string' }, example: ['grace', 'salvation'] },
      createdAt: ts('2026-09-28T08:00:00.000Z'),
      updatedAt: ts('2026-09-28T08:00:00.000Z'),
    },
  },
  JournalEntry: {
    type: 'object',
    description: 'Private to its owner unless `isShared` is true and `sharedWithGroupId` is set.',
    properties: {
      id: uuid(ID3),
      userId: uuid(ID1),
      sermonId: { ...uuid(ID2), nullable: true },
      title: { type: 'string', example: 'Reflections on grace' },
      content: { type: 'string', example: 'What stood out to me today was…' },
      isShared: { type: 'boolean', example: false },
      sharedWithGroupId: { ...uuid(ID1), nullable: true, example: null },
      createdAt: ts('2026-10-02T19:30:00.000Z'),
      updatedAt: ts('2026-10-02T19:30:00.000Z'),
    },
  },
  Bookmark: {
    type: 'object',
    properties: {
      id: uuid(ID3),
      userId: uuid(ID1),
      sermonId: uuid(ID2),
      sermon: { $ref: '#/components/schemas/Sermon' },
      createdAt: ts('2026-10-02T10:00:00.000Z'),
      updatedAt: ts('2026-10-02T10:00:00.000Z'),
    },
  },

  // ---------------------------------------------------------- fellowship
  FellowshipGroup: {
    type: 'object',
    properties: {
      id: uuid(ID1),
      name: { type: 'string', example: 'Tuesday Night Fellowship' },
      description: { type: 'string', nullable: true, example: 'We meet weekly to discuss Sunday’s sermon.' },
      leaderId: uuid(ID2),
      leader: { type: 'object', properties: { id: uuid(ID2), name: { type: 'string', example: 'Pastor John' } } },
      memberCount: { type: 'integer', description: 'Only on GET /groups/{id}.', example: 12 },
      createdAt: ts('2026-10-01T09:00:00.000Z'),
      updatedAt: ts('2026-10-01T09:00:00.000Z'),
    },
  },
  GroupMember: {
    type: 'object',
    properties: {
      groupId: uuid(ID1),
      userId: uuid(ID2),
      role: { type: 'string', enum: ['leader', 'member'], example: 'member' },
      user: { type: 'object', properties: { id: uuid(ID2), name: { type: 'string', example: 'Grace Okafor' } } },
      createdAt: { ...ts('2026-10-03T12:00:00.000Z'), description: 'Join date' },
      updatedAt: ts('2026-10-03T12:00:00.000Z'),
    },
  },
  DiscussionPost: {
    type: 'object',
    description:
      'A post in a group. Top-level posts have `parentPostId: null` and carry their `replies`; replies point at their parent via `parentPostId` (one level deep).',
    properties: {
      id: uuid(ID3),
      groupId: uuid(ID1),
      sermonId: { ...uuid(ID2), nullable: true },
      authorId: uuid(ID1),
      author: { type: 'object', properties: { id: uuid(ID1), name: { type: 'string', example: 'Grace Okafor' } } },
      parentPostId: { ...uuid(ID2), nullable: true, example: null },
      content: { type: 'string', example: 'How do we balance grace and obedience?' },
      isFlagged: { type: 'boolean', example: false },
      flagReason: { type: 'string', nullable: true, example: null },
      replies: {
        type: 'array',
        description: 'Replies to this post (only present on top-level posts in list responses).',
        items: { $ref: '#/components/schemas/DiscussionPost' },
        example: [],
      },
      createdAt: ts('2026-10-05T18:00:00.000Z'),
      updatedAt: ts('2026-10-05T18:00:00.000Z'),
    },
  },

  // ------------------------------------------------------------- inputs
  RegisterInput: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128 },
    },
    example: { name: 'Grace Okafor', email: 'grace@example.com', password: 'S3cure-passw0rd' },
  },
  LoginInput: {
    type: 'object',
    required: ['email', 'password'],
    properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
    example: { email: 'grace@example.com', password: 'S3cure-passw0rd' },
  },
  RoleInput: {
    type: 'object',
    required: ['role'],
    properties: { role: { type: 'string', enum: ['member', 'leader', 'admin'] } },
    example: { role: 'leader' },
  },
  SermonInput: {
    type: 'object',
    required: ['title', 'preacher', 'passage', 'sermonDate'],
    properties: {
      title: { type: 'string', maxLength: 255 },
      preacher: { type: 'string', maxLength: 150 },
      passage: { type: 'string', maxLength: 150 },
      sermonDate: { type: 'string', format: 'date' },
      summary: { type: 'string', maxLength: 5000 },
      content: { type: 'string' },
      audioUrl: { type: 'string', format: 'uri' },
      videoUrl: { type: 'string', format: 'uri' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    },
    example: {
      title: 'Walking in Grace',
      preacher: 'Pastor John Adeyemi',
      passage: 'Ephesians 2:1-10',
      sermonDate: '2026-09-27',
      summary: 'Grace is a gift, not a wage.',
      audioUrl: 'https://cdn.example.com/sermons/walking-in-grace.mp3',
      tags: ['grace', 'salvation'],
    },
  },
  BookmarkInput: {
    type: 'object',
    required: ['sermonId'],
    properties: { sermonId: uuid(ID2) },
    example: { sermonId: ID2 },
  },
  JournalInput: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', maxLength: 255 },
      content: { type: 'string', maxLength: 50000 },
      sermonId: { ...uuid(ID2), nullable: true },
      isShared: { type: 'boolean', default: false },
      sharedWithGroupId: { ...uuid(ID1), nullable: true, description: 'Required when `isShared` is true. You must belong to the group.' },
    },
    example: { title: 'Reflections on grace', content: 'What stood out to me today was…', sermonId: ID2, isShared: false },
  },
  GroupInput: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', minLength: 3, maxLength: 120 }, description: { type: 'string', maxLength: 2000 } },
    example: { name: 'Tuesday Night Fellowship', description: 'We meet weekly to discuss Sunday’s sermon.' },
  },
  PostInput: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', maxLength: 5000 },
      sermonId: { ...uuid(ID2), description: 'Sermon this thread is about (ignored for replies; they inherit it).' },
      parentPostId: { ...uuid(ID3), description: 'Set to reply to a top-level post in the same group.' },
    },
    example: { content: 'How do we balance grace and obedience?', sermonId: ID2 },
  },
  FlagInput: {
    type: 'object',
    required: ['reason'],
    properties: { reason: { type: 'string', maxLength: 500 } },
    example: { reason: 'Contains personal attacks' },
  },

  // ----------------------------------------------------------- envelopes
  AuthResult: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'success' },
      data: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' },
        },
      },
    },
  },
  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 42 },
      totalPages: { type: 'integer', example: 3 },
    },
  },
  Error: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'error' },
      message: { type: 'string', example: 'Something went wrong' },
      errors: {
        type: 'array',
        description: 'Present on validation errors (400).',
        items: {
          type: 'object',
          properties: {
            location: { type: 'string', enum: ['body', 'query', 'params'] },
            path: { type: 'string', example: 'email' },
            message: { type: 'string', example: 'Invalid email address' },
          },
        },
      },
    },
  },
};

export const responses = {
  BadRequest: errorResponse('Validation failed or the request is invalid', 'Validation failed', {
    errors: [{ location: 'body', path: 'email', message: 'Invalid email address' }],
  }),
  Unauthorized: errorResponse('Missing, invalid or expired JWT', 'Missing or malformed Authorization header'),
  Forbidden: errorResponse('Authenticated but not allowed to do this', 'You do not have permission to perform this action'),
  NotFound: errorResponse('Resource not found', 'Resource not found'),
  Conflict: errorResponse('Resource already exists', 'Email is already registered'),
  TooManyRequests: errorResponse('Rate limit exceeded', 'Too many requests, please try again later.'),
};
