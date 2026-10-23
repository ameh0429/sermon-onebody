import { Router } from 'express';
import {
  createGroup,
  deleteGroup,
  getGroup,
  joinGroup,
  leaveGroup,
  listGroups,
  listMembers,
  updateGroup,
} from '../controllers/group.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { groupBody, groupListQuery, groupUpdateBody, idParam, paginationQuery } from '../validators/index.js';

export const groupRouter = Router();

groupRouter.use(authenticate);

/**
 * @openapi
 * /groups:
 *   get:
 *     tags: [Groups]
 *     summary: List fellowship groups
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *       - { name: q, in: query, description: Search by group name, schema: { type: string } }
 *       - { name: mine, in: query, description: 'Only groups I belong to', schema: { type: string, enum: ['true', 'false'] } }
 *     responses:
 *       200:
 *         description: A page of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/FellowshipGroup' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, name: Tuesday Night Fellowship, leader: { id: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, name: Pastor John } }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
groupRouter.get('/', validate({ query: groupListQuery }), listGroups);

/**
 * @openapi
 * /groups:
 *   post:
 *     tags: [Groups]
 *     summary: Create a fellowship group (leader or admin)
 *     description: The creator becomes the group leader and is enrolled as its first member.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GroupInput' }
 *     responses:
 *       201:
 *         description: Group created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/FellowshipGroup' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
groupRouter.post('/', authorize('leader', 'admin'), validate({ body: groupBody }), createGroup);

/**
 * @openapi
 * /groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: Get a group
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         description: The group, with its member count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/FellowshipGroup' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
groupRouter.get('/:id', validate({ params: idParam }), getGroup);

/**
 * @openapi
 * /groups/{id}:
 *   patch:
 *     tags: [Groups]
 *     summary: Edit a group (group leader or admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GroupInput' }
 *           example: { description: 'Now meeting on Wednesdays.' }
 *     responses:
 *       200:
 *         description: Group updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/FellowshipGroup' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
groupRouter.patch('/:id', validate({ params: idParam, body: groupUpdateBody }), updateGroup);

/**
 * @openapi
 * /groups/{id}:
 *   delete:
 *     tags: [Groups]
 *     summary: Delete a group and all its discussions (group leader or admin)
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
groupRouter.delete('/:id', validate({ params: idParam }), deleteGroup);

/**
 * @openapi
 * /groups/{id}/join:
 *   post:
 *     tags: [Groups]
 *     summary: Join a group
 *     description: Idempotent. 201 when newly joined, 200 if already a member.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         description: Already a member
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/GroupMember' }
 *       201:
 *         description: Joined
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/GroupMember' }
 *             example:
 *               status: success
 *               data: { groupId: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, userId: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, role: member }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
groupRouter.post('/:id/join', validate({ params: idParam }), joinGroup);

/**
 * @openapi
 * /groups/{id}/leave:
 *   delete:
 *     tags: [Groups]
 *     summary: Leave a group
 *     description: The group's leader cannot leave; delete the group or have an admin reassign it.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     responses:
 *       204: { description: Left the group (no body) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
groupRouter.delete('/:id/leave', validate({ params: idParam }), leaveGroup);

/**
 * @openapi
 * /groups/{id}/members:
 *   get:
 *     tags: [Groups]
 *     summary: List group members (members, leader and admins only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: A page of members, leaders first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/GroupMember' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { groupId: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, userId: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, role: leader, user: { id: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, name: Pastor John } }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
groupRouter.get('/:id/members', validate({ params: idParam, query: paginationQuery }), listMembers);
