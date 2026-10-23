import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJSDoc from 'swagger-jsdoc';
import { responses, schemas, securitySchemes } from '../docs/components.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both `src/` (tsx) and `dist/` (compiled JS): JSDoc blocks live in the route files.
const routeGlob = path.join(here, '../routes/*.{ts,js}').replace(/\\/g, '/');

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Sermon Library & Fellowship API',
      version: '1.0.0',
      description: [
        'Sermon library, private journaling, bookmarks and fellowship group discussions.',
        '',
        '**Authentication:** JWT bearer. Register or log in, then click **Authorize** and paste the token.',
        '',
        '**Roles:** `member` (default), `leader` (can create fellowship groups) and `admin` (manages sermons and roles).',
        'Group-level moderation belongs to the group’s leader and to admins.',
        '',
        '**Pagination:** list endpoints accept `page` (default 1) and `limit` (default 20, max 100) and return `{ data, meta }`.',
        '',
        '**Errors:** every error uses `{ status: "error", message, errors? }`.',
      ].join('\n'),
    },
    servers: [{ url: '/api/v1', description: 'Current server' }],
    tags: [
      { name: 'Auth', description: 'Register and log in' },
      { name: 'Users', description: 'Current user and role management' },
      { name: 'Sermons', description: 'Sermon library' },
      { name: 'Bookmarks', description: 'Saved sermons' },
      { name: 'Journal', description: 'Private journal entries (shareable with a group)' },
      { name: 'Groups', description: 'Fellowship groups and membership' },
      { name: 'Discussions', description: 'Group discussion posts, replies and moderation' },
    ],
    components: {
      securitySchemes,
      schemas,
      responses,
      parameters: {
        Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        Id: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        SermonId: { name: 'sermonId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        GroupId: { name: 'groupId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      },
    },
  },
  apis: [routeGlob],
});
