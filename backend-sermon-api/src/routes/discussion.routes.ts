import { Router } from 'express';
import {
  createPost,
  deletePost,
  flagPost,
  listFlaggedPosts,
  listGroupPosts,
  listSermonPosts,
} from '../controllers/discussion.controller.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  flagBody,
  groupIdParam,
  idParam,
  paginationQuery,
  postBody,
  postListQuery,
  sermonIdParam,
  sermonPostsQuery,
} from '../validators/index.js';

/** Mounted at the API root because it spans /groups/... , /sermons/... and /posts/... */
export const discussionRouter = Router();

// Scoped (not router-wide) so unrelated paths still fall through to the 404 handler.
discussionRouter.use(['/groups/:groupId/posts', '/sermons/:sermonId/posts', '/posts'], authenticate);

/**
 * @openapi
 * /groups/{groupId}/posts:
 *   get:
 *     tags: [Discussions]
 *     summary: List a group's discussion threads
 *     description: Returns top-level posts (newest first), each with its replies in chronological order. Group members, the group leader and admins only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/GroupId'
 *       - { name: sermonId, in: query, description: Only threads about this sermon, schema: { type: string, format: uuid } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: A page of threads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/DiscussionPost' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f
 *                   content: How do we balance grace and obedience?
 *                   parentPostId: null
 *                   author: { id: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, name: Grace Okafor }
 *                   replies:
 *                     - id: 5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e
 *                       content: Obedience flows from gratitude.
 *                       parentPostId: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f
 *                       author: { id: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4, name: Pastor John }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
discussionRouter.get(
  '/groups/:groupId/posts',
  validate({ params: groupIdParam, query: postListQuery }),
  listGroupPosts,
);

/**
 * @openapi
 * /groups/{groupId}/posts:
 *   post:
 *     tags: [Discussions]
 *     summary: Post to a group, or reply to a post
 *     description: Group members, the group leader and admins only. Set `parentPostId` to reply; replies may only target top-level posts and inherit the thread's sermon.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/GroupId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PostInput' }
 *           examples:
 *             newPost:
 *               summary: New post about a sermon
 *               value: { content: How do we balance grace and obedience?, sermonId: 9a7e4d22-0b1c-4c6f-8e3a-52d1f0c7b8a4 }
 *             reply:
 *               summary: Reply to a post
 *               value: { content: Obedience flows from gratitude., parentPostId: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f }
 *     responses:
 *       201:
 *         description: Post created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/DiscussionPost' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
discussionRouter.post(
  '/groups/:groupId/posts',
  writeLimiter,
  validate({ params: groupIdParam, body: postBody }),
  createPost,
);

/**
 * @openapi
 * /groups/{groupId}/posts/flagged:
 *   get:
 *     tags: [Discussions]
 *     summary: List flagged posts (group leader or admin)
 *     description: Moderation queue for the group.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/GroupId'
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: A page of flagged posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/DiscussionPost' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, content: '…', isFlagged: true, flagReason: Contains personal attacks }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
discussionRouter.get(
  '/groups/:groupId/posts/flagged',
  validate({ params: groupIdParam, query: paginationQuery }),
  listFlaggedPosts,
);

/**
 * @openapi
 * /sermons/{sermonId}/posts:
 *   get:
 *     tags: [Discussions]
 *     summary: List discussions about a sermon
 *     description: Searches the groups the caller belongs to (admins see all groups). Pass `groupId` to narrow to one group.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/SermonId'
 *       - { name: groupId, in: query, schema: { type: string, format: uuid } }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         description: A page of threads with replies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: array, items: { $ref: '#/components/schemas/DiscussionPost' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *             example:
 *               status: success
 *               data:
 *                 - { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, content: How do we balance grace and obedience?, groupId: 3f2b8c1e-6a4d-4e0b-9d57-1c2a7f9e5b10, replies: [] }
 *               meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
discussionRouter.get(
  '/sermons/:sermonId/posts',
  validate({ params: sermonIdParam, query: sermonPostsQuery }),
  listSermonPosts,
);

/**
 * @openapi
 * /posts/{id}/flag:
 *   post:
 *     tags: [Discussions]
 *     summary: Flag a post for moderator review
 *     description: Any member of the post's group may flag someone else's post.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/FlagInput' }
 *     responses:
 *       200:
 *         description: Post flagged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/DiscussionPost' }
 *             example:
 *               status: success
 *               data: { id: c1d5e6f7-2a3b-4c8d-9e0f-1a2b3c4d5e6f, isFlagged: true, flagReason: Contains personal attacks }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
discussionRouter.post('/posts/:id/flag', writeLimiter, validate({ params: idParam, body: flagBody }), flagPost);

/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     tags: [Discussions]
 *     summary: Delete a post
 *     description: Allowed for the author, the group's leader, and admins. Deleting a top-level post also deletes its replies.
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
discussionRouter.delete('/posts/:id', validate({ params: idParam }), deletePost);
