import express from 'express';
import { createAvatarRouter } from './routes/avatar.routes.js';
import type { AvatarStorage } from './services/avatarStorage.js';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { sequelize } from './config/database.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { sanitizeBody } from './middleware/sanitize.js';

export function createApp(options: { avatarStorage?: AvatarStorage } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs for rate limiting behind one reverse proxy

  app.use(requestLogger);

  // Swagger UI needs inline scripts, so it is mounted before helmet's strict CSP is applied.
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Sermon API Docs', swaggerOptions: { persistAuthorization: true } }));

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(globalLimiter);
  app.use(express.json({ limit: '200kb' }));
  app.use(sanitizeBody);

  app.get('/health', async (_req, res) => {
    try {
      await sequelize.authenticate();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/v1/users/me/avatar', createAvatarRouter(options.avatarStorage));
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
