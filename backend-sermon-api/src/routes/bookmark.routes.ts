import { Router } from 'express';
import { addBookmark, listBookmarks, removeBookmark } from '../controllers/bookmark.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookmarkBody, bookmarkListQuery, sermonIdParam } from '../validators/index.js';

export const bookmarkRouter = Router();

bookmarkRouter.use(authenticate);

/**
 * @openapi
 * /bookmarks:
 *   get:
 *     tags: [Bookmarks]
 *     summary: List my bookmarked sermons
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: sermonId, in: query, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: A page of bookmarks, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Bookmark' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, userId: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, sermonId: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, sermon: { title: Walking in Grace, preacher: Pastor John Adeyemi } }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
bookmarkRouter.get('/', validate({ query: bookmarkListQuery }), listBookmarks);

/**
 * @openapi
 * /bookmarks:
 *   post:
 *     tags: [Bookmarks]
 *     summary: Bookmark a sermon
 *     description: Idempotent. Returns 201 for a new bookmark and 200 if the sermon was already bookmarked.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BookmarkInput' }
 *     responses:
 *       200:
 *         description: Already bookmarked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Bookmark' }
 *       201:
 *         description: Bookmark created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Bookmark' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
bookmarkRouter.post('/', validate({ body: bookmarkBody }), addBookmark);

/**
 * @openapi
 * /bookmarks/{sermonId}:
 *   delete:
 *     tags: [Bookmarks]
 *     summary: Remove a bookmark
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/SermonId'
 *     responses:
 *       204: { description: Removed (no body) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
bookmarkRouter.delete('/:sermonId', validate({ params: sermonIdParam }), removeBookmark);
