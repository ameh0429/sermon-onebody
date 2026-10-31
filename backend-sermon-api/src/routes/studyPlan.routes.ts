import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listStudyPlans, createStudyPlan, getStudyPlan, attachStudyPlan, getSermonStudyPlans, getDailyLesson, updateLessonProgress, getStudyPlanProgress } from '../controllers/studyPlan.controller.js';
import { studyPlanListQuery, studyPlanBody, studyPlanIdParam, attachStudyPlanBody, sermonIdParam, dailyLessonDayParam, dailyLessonIdParam, lessonProgressBody } from '../validators/index.js';

export const studyPlanRouter = Router();
studyPlanRouter.use(authenticate);

/**
 * @openapi
 * /study-plans:
 *   post:
 *     tags:
 *     - StudyPlans
 *     - Admin
 *     summary: Create a weekly study plan with daily lessons (pastor/leader or admin only)
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/StudyPlanDetail'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudyPlanInput'
 */
studyPlanRouter.post('/study-plans', authorize('leader', 'admin'), validate({ body: studyPlanBody }), createStudyPlan);

/**
 * @openapi
 * /study-plans/{studyPlanId}:
 *   get:
 *     tags:
 *     - StudyPlans
 *     summary: Fetch a study plan and its ordered lessons
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/StudyPlanDetail'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *     parameters:
 *     - name: studyPlanId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
studyPlanRouter.get('/study-plans/:studyPlanId', validate({ params: studyPlanIdParam }), getStudyPlan);

/**
 * @openapi
 * /study-plans/{studyPlanId}/sermon:
 *   put:
 *     tags:
 *     - StudyPlans
 *     - Admin
 *     summary: Attach or move a study plan to a sermon (pastor/leader or admin only)
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/StudyPlan'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *     parameters:
 *     - name: studyPlanId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttachStudyPlanInput'
 */
studyPlanRouter.put('/study-plans/:studyPlanId/sermon', authorize('leader', 'admin'), validate({ params: studyPlanIdParam, body: attachStudyPlanBody }), attachStudyPlan);

/**
 * @openapi
 * /sermons/{sermonId}/study-plans:
 *   get:
 *     tags:
 *     - StudyPlans
 *     summary: Fetch plans attached to a sermon
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudyPlan'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *     parameters:
 *     - name: sermonId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
studyPlanRouter.get('/sermons/:sermonId/study-plans', validate({ params: sermonIdParam }), getSermonStudyPlans);

/**
 * @openapi
 * /study-plans/{studyPlanId}/daily-lessons/{day}:
 *   get:
 *     tags:
 *     - DailyLessons
 *     summary: "Fetch a lesson by day (1\u20137)"
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/DailyLesson'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *     parameters:
 *     - name: studyPlanId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *     - name: day
 *       in: path
 *       required: true
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 7
 */
studyPlanRouter.get('/study-plans/:studyPlanId/daily-lessons/:day', validate({ params: dailyLessonDayParam }), getDailyLesson);

/**
 * @openapi
 * /daily-lessons/{dailyLessonId}/progress:
 *   put:
 *     tags:
 *     - LessonProgress
 *     summary: Set your completion status for a lesson
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/LessonProgress'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *     parameters:
 *     - name: dailyLessonId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LessonProgressInput'
 *     description: Only the signed-in user is updated. Send completed=true to mark complete or false to reset; resetting
 *       clears completedAt. Repeated completion preserves its timestamp.
 */
studyPlanRouter.put('/daily-lessons/:dailyLessonId/progress', validate({ params: dailyLessonIdParam, body: lessonProgressBody }), updateLessonProgress);

/**
 * @openapi
 * /study-plans/{studyPlanId}/progress:
 *   get:
 *     tags:
 *     - LessonProgress
 *     summary: Fetch your progress including incomplete lessons
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum:
 *                   - success
 *                 data:
 *                   $ref: '#/components/schemas/StudyPlanProgress'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *     parameters:
 *     - name: studyPlanId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
studyPlanRouter.get('/study-plans/:studyPlanId/progress', validate({ params: studyPlanIdParam }), getStudyPlanProgress);

/**
 * @openapi
 * /study-plans:
 *   get:
 *     tags: [StudyPlans]
 *     summary: List study plans attached to published sermons
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: q, in: query, schema: { type: string, maxLength: 200 }, description: Search plan titles }
 *     responses:
 *       200:
 *         description: Available plans with sermon summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/StudyPlan'
 *                       - type: object
 *                         properties:
 *                           sermon:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               title: { type: string }
 *                               preacher: { type: string }
 *                               passage: { type: string }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
studyPlanRouter.get('/study-plans', validate({ query: studyPlanListQuery }), listStudyPlans);
