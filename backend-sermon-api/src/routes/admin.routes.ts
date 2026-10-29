import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as admin from '../controllers/admin.controller.js';
import { updateRole } from '../controllers/auth.controller.js';
import { idParam, roleBody, paginationQuery, accountStatusBody, engagementBody, studyPlanIdParam, studyPlanUpdateBody, dailyLessonIdParam, dailyLessonBody, dailyLessonUpdateBody } from '../validators/index.js';

export const adminRouter = Router();
adminRouter.use(authenticate);

/**
 * @openapi
 * /sermons/{id}/archive:
 *   post:
 *     tags:
 *     - Admin
 *     summary: Archive a sermon
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Sermon'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
adminRouter.post('/sermons/:id/archive', authorize('leader', 'admin'), validate({ params: idParam }), admin.archiveSermon);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags:
 *     - Admin
 *     summary: List accounts (admin only)
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
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 */
adminRouter.get('/admin/users', authorize('admin'), validate({ query: paginationQuery }), admin.listUsers);

/**
 * @openapi
 * /admin/users/{id}/status:
 *   patch:
 *     tags:
 *     - Admin
 *     summary: Deactivate or reactivate an account (admin only)
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - name: id
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
 *             $ref: '#/components/schemas/AccountStatusInput'
 */
adminRouter.patch('/admin/users/:id/status', authorize('admin'), validate({ params: idParam, body: accountStatusBody }), admin.setAccountStatus);

/**
 * @openapi
 * /admin/users/{id}/role:
 *   patch:
 *     tags:
 *     - Admin
 *     summary: Assign a role (admin only)
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - name: id
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
 *             $ref: '#/components/schemas/RoleInput'
 */
adminRouter.patch('/admin/users/:id/role', authorize('admin'), validate({ params: idParam, body: roleBody }), updateRole);

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     tags:
 *     - Admin
 *     summary: Aggregate lifetime content and engagement statistics
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/AdminAnalytics'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 */
adminRouter.get('/admin/analytics', authorize('leader', 'admin'), admin.analytics);

/**
 * @openapi
 * /sermons/{id}/engagement:
 *   post:
 *     tags:
 *     - Sermons
 *     summary: Record a unique view or listen (any signed-in user)
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Success
 *         content: &id001
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/SermonEngagement'
 *       '200':
 *         description: Previously recorded engagement (idempotent)
 *         content: *id001
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     description: One record per user, sermon and event type. Records only published sermons; repeated events do
 *       not inflate totals. This records engagement, not playback duration.
 *     parameters:
 *     - name: id
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
 *             $ref: '#/components/schemas/EngagementInput'
 */
adminRouter.post('/sermons/:id/engagement', validate({ params: idParam, body: engagementBody }), admin.trackEngagement);

/**
 * @openapi
 * /study-plans/{studyPlanId}:
 *   patch:
 *     tags:
 *     - Admin
 *     summary: Edit a weekly plan
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/StudyPlan'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
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
 *             $ref: '#/components/schemas/StudyPlanUpdateInput'
 */
adminRouter.patch('/study-plans/:studyPlanId', authorize('leader', 'admin'), validate({ params: studyPlanIdParam, body: studyPlanUpdateBody }), admin.updateStudyPlan);

/**
 * @openapi
 * /study-plans/{studyPlanId}:
 *   delete:
 *     tags:
 *     - Admin
 *     summary: Delete a weekly plan and its lessons/progress
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '204':
 *         description: Success
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - name: studyPlanId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
adminRouter.delete('/study-plans/:studyPlanId', authorize('leader', 'admin'), validate({ params: studyPlanIdParam }), admin.deleteStudyPlan);

/**
 * @openapi
 * /study-plans/{studyPlanId}/daily-lessons:
 *   post:
 *     tags:
 *     - Admin
 *     summary: "Add a daily lesson (unique day 1\u20137)"
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DailyLesson'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
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
 *             $ref: '#/components/schemas/DailyLessonInput'
 */
adminRouter.post('/study-plans/:studyPlanId/daily-lessons', authorize('leader', 'admin'), validate({ params: studyPlanIdParam, body: dailyLessonBody }), admin.addDailyLesson);

/**
 * @openapi
 * /daily-lessons/{dailyLessonId}:
 *   patch:
 *     tags:
 *     - Admin
 *     summary: Edit a daily lesson
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DailyLesson'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
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
 *             $ref: '#/components/schemas/DailyLessonUpdateInput'
 */
adminRouter.patch('/daily-lessons/:dailyLessonId', authorize('leader', 'admin'), validate({ params: dailyLessonIdParam, body: dailyLessonUpdateBody }), admin.updateDailyLesson);

/**
 * @openapi
 * /daily-lessons/{dailyLessonId}:
 *   delete:
 *     tags:
 *     - Admin
 *     summary: Delete a daily lesson and its progress
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       '204':
 *         description: Success
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *     parameters:
 *     - name: dailyLessonId
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 */
adminRouter.delete('/daily-lessons/:dailyLessonId', authorize('leader', 'admin'), validate({ params: dailyLessonIdParam }), admin.deleteDailyLesson);
