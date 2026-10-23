import { Router } from 'express';
import { createSermon, deleteSermon, getSermon, listSermons, updateSermon } from '../controllers/sermon.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, sermonBody, sermonListQuery, sermonUpdateBody } from '../validators/index.js';

export const sermonRouter = Router();

sermonRouter.use(authenticate);

/**
 * @openapi
 * /sermons:
 *   get:
 *     tags: [Sermons]
 *     summary: List and filter sermons
 *     description: Responses are cached in memory for a short time (see the `X-Cache` header). The `content` field is omitted; fetch a single sermon for the full text.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: q, in: query, description: 'Search title, summary and passage', schema: { type: string } }
 *       - { name: preacher, in: query, description: 'Partial, case-insensitive match', schema: { type: string } }
 *       - { name: passage, in: query, description: 'Partial, case-insensitive match (e.g. "Ephesians")', schema: { type: string } }
 *       - { name: tag, in: query, description: Exact tag, schema: { type: string } }
 *       - { name: from, in: query, description: Sermons on or after this date, schema: { type: string, format: date } }
 *       - { name: to, in: query, description: Sermons on or before this date, schema: { type: string, format: date } }
 *       - { name: sort, in: query, schema: { type: string, enum: [date, title], default: date } }
 *       - { name: order, in: query, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200:
 *         description: A page of sermons
 *         headers:
 *           X-Cache: { description: HIT when served from cache, schema: { type: string, enum: [HIT, MISS] } }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Sermon' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, title: Walking in Grace, preacher: Pastor John Adeyemi, passage: 'Ephesians 2:1-10', sermonDate: '2026-09-27', tags: [grace, salvation] }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
sermonRouter.get('/', validate({ query: sermonListQuery }), listSermons);

/**
 * @openapi
 * /sermons/{id}:
 *   get:
 *     tags: [Sermons]
 *     summary: Get sermon details (including full content)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         description: The sermon
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Sermon' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
sermonRouter.get('/:id', validate({ params: idParam }), getSermon);

/**
 * @openapi
 * /sermons:
 *   post:
 *     tags: [Sermons]
 *     summary: Add a sermon (admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SermonInput' }
 *     responses:
 *       201:
 *         description: Sermon created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Sermon' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
sermonRouter.post('/', authorize('admin'), validate({ body: sermonBody }), createSermon);

/**
 * @openapi
 * /sermons/{id}:
 *   patch:
 *     tags: [Sermons]
 *     summary: Update a sermon (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SermonInput' }
 *           example: { title: 'Walking in Grace (Revised)', tags: [grace] }
 *     responses:
 *       200:
 *         description: Sermon updated (any subset of fields may be sent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Sermon' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
sermonRouter.patch('/:id', authorize('admin'), validate({ params: idParam, body: sermonUpdateBody }), updateSermon);

/**
 * @openapi
 * /sermons/{id}:
 *   delete:
 *     tags: [Sermons]
 *     summary: Delete a sermon (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       204: { description: Deleted (no body) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
sermonRouter.delete('/:id', authorize('admin'), validate({ params: idParam }), deleteSermon);
