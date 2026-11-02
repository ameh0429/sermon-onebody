import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { books, chapters, passage, translations } from '../services/bible.js';
const version = z.enum(['asv','ylt']).default('asv');
const bookId = z.string().regex(/^[1-3]?[A-Z]{2,3}$/);
const passageQuery = z.object({ translationId: version, reference: z.string().trim().min(1).max(160).optional(), bookId: bookId.optional(), chapter: z.coerce.number().int().min(1).max(150).optional(), fromVerse: z.coerce.number().int().min(1).max(176).optional(), toVerse: z.coerce.number().int().min(1).max(176).optional() }).refine(q => q.reference ? !q.bookId && q.chapter === undefined && q.fromVerse === undefined && q.toVerse === undefined : !!q.bookId && q.chapter !== undefined && (q.toVerse === undefined || q.fromVerse !== undefined), 'Provide either a reference, or bookId and chapter (with an optional fromVerse/toVerse range).');
export const bibleRouter = Router();
bibleRouter.use(authenticate);
bibleRouter.use((_req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
/**
 * @openapi
 * /bible/translations:
 *   get:
 *     tags: [Bible]
 *     summary: List available public-domain Bible translations and attribution
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Translation catalog
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/BibleTranslation' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
bibleRouter.get('/translations', (_req,res) => res.json({ status:'success', data:translations }));
/**
 * @openapi
 * /bible/books:
 *   get:
 *     tags: [Bible]
 *     summary: List the 66 canonical books and chapter counts
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: translationId, in: query, schema: { type: string, enum: [asv, ylt], default: asv } }
 *     responses:
 *       200:
 *         description: Books
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 data: { type: array, items: { $ref: '#/components/schemas/BibleBook' } }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { description: Server corpus unavailable or failed integrity verification }
 */
bibleRouter.get('/books', validate({ query:z.object({ translationId:version }) }), async(req,res) => res.json({ status:'success',data:await books(String(req.query.translationId)) }));
/**
 * @openapi
 * /bible/chapters:
 *   get:
 *     tags: [Bible]
 *     summary: List chapters and verse counts for a canonical book ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: translationId, in: query, schema: { type: string, enum: [asv, ylt], default: asv } }
 *       - { name: bookId, in: query, required: true, schema: { type: string, example: JHN } }
 *     responses:
 *       200:
 *         description: Chapters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       number: { type: integer }
 *                       verses: { type: integer }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: Server corpus unavailable or failed integrity verification }
 */
bibleRouter.get('/chapters', validate({ query:z.object({ translationId:version, bookId }) }), async(req,res) => res.json({ status:'success',data:await chapters(String(req.query.translationId),String(req.query.bookId)) }));
/**
 * @openapi
 * /bible/passages:
 *   get:
 *     tags: [Bible]
 *     summary: Read a chapter or a verse range in one chapter
 *     description: 'Provide reference (e.g. John 3:16–18, Eph 2, 1 John 1:9) OR bookId/chapter with optional fromVerse/toVerse. Multiple chapters, books, and comma-separated passages require separate requests. Verse numbering follows each edition; empty source verses carry an explanatory note instead of invented text.'
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: translationId, in: query, schema: { type: string, enum: [asv, ylt], default: asv } }
 *       - { name: reference, in: query, schema: { type: string, maxLength: 160, example: 'John 3:16–18' } }
 *       - { name: bookId, in: query, schema: { type: string, example: JHN } }
 *       - { name: chapter, in: query, schema: { type: integer, minimum: 1, maximum: 150 } }
 *       - { name: fromVerse, in: query, schema: { type: integer, minimum: 1, maximum: 176 } }
 *       - { name: toVerse, in: query, schema: { type: integer, minimum: 1, maximum: 176 } }
 *     responses:
 *       200:
 *         description: Passage text with attribution and adjacent chapter links
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 data: { $ref: '#/components/schemas/BiblePassage' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: Server corpus unavailable or failed integrity verification }
 */
bibleRouter.get('/passages', validate({ query:passageQuery }), async(req,res) => res.json({ status:'success',data:await passage(req.query as unknown as z.infer<typeof passageQuery>) }));
