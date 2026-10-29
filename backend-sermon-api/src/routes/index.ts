import { studyPlanRouter } from './studyPlan.routes.js';
import { Router } from 'express';
import { authRouter, usersRouter } from './auth.routes.js';
import { sermonRouter } from './sermon.routes.js';
import { bookmarkRouter } from './bookmark.routes.js';
import { journalRouter } from './journal.routes.js';
import { groupRouter } from './group.routes.js';
import { discussionRouter } from './discussion.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/sermons', sermonRouter);
apiRouter.use('/bookmarks', bookmarkRouter);
apiRouter.use('/journal', journalRouter);
apiRouter.use('/groups', groupRouter);
apiRouter.use(discussionRouter); // /groups/:groupId/posts, /sermons/:sermonId/posts, /posts/:id

apiRouter.use(studyPlanRouter);
