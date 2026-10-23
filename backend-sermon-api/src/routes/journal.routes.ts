import { Router } from 'express';
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  listSharedEntries,
  updateEntry,
} from '../controllers/journal.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, journalBody, journalListQuery, journalSharedQuery, journalUpdateBody } from '../validators/index.js';

export const journalRouter = Router();

journalRouter.use(authenticate);

/**
 * @openapi
 * /journal:
 *   get:
 *     tags: [Journal]
 *     summary: List my journal entries
 *     description: Only ever returns the caller's own entries.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: sermonId, in: query, description: Only entries about this sermon, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: A page of entries, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/JournalEntry' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, title: Reflections on grace, content: 'What stood out to me today was…', isShared: false, sharedWithGroupId: null }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
journalRouter.get('/', validate({ query: journalListQuery }), listEntries);

/**
 * @openapi
 * /journal/shared:
 *   get:
 *     tags: [Journal]
 *     summary: List entries shared with a group I belong to
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: groupId, in: query, required: true, schema: { type: string, format: uuid } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: A page of shared entries with their authors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/JournalEntry' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, title: Reflections on grace, isShared: true, author: { id: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, name: Grace Okafor } }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
journalRouter.get('/shared', validate({ query: journalSharedQuery }), listSharedEntries);

/**
 * @openapi
 * /journal:
 *   post:
 *     tags: [Journal]
 *     summary: Create a journal entry (private by default)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/JournalInput' }
 *     responses:
 *       201:
 *         description: Entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/JournalEntry' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
journalRouter.post('/', validate({ body: journalBody }), createEntry);

/**
 * @openapi
 * /journal/{id}:
 *   get:
 *     tags: [Journal]
 *     summary: Get a journal entry
 *     description: Visible to its owner, or to members of the group it is shared with. Anyone else gets 404.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         description: The entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/JournalEntry' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
journalRouter.get('/:id', validate({ params: idParam }), getEntry);

/**
 * @openapi
 * /journal/{id}:
 *   patch:
 *     tags: [Journal]
 *     summary: Update my journal entry
 *     description: Send `isShared` with `sharedWithGroupId` to share, or `isShared:false` to make the entry private again.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/JournalInput' }
 *           example: { isShared: true, sharedWithGroupId: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10 }
 *     responses:
 *       200:
 *         description: Entry updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/JournalEntry' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
journalRouter.patch('/:id', validate({ params: idParam, body: journalUpdateBody }), updateEntry);

/**
 * @openapi
 * /journal/{id}:
 *   delete:
 *     tags: [Journal]
 *     summary: Delete my journal entry
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       204: { description: Deleted (no body) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
journalRouter.delete('/:id', validate({ params: idParam }), deleteEntry);
