import { createApp } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './config/database.js';
import './models/index.js'; // registers models and associations
import { logger } from './utils/logger.js';

async function main() {
  await sequelize.authenticate();
  logger.info('Database connection established');

  if (env.dbSync) {
    await sequelize.sync({ alter: !env.isProduction });
    logger.info('Database schema synchronised');
  }

  const server = createApp().listen(env.port, () => {
    logger.info(`API listening on :${env.port} (docs at /docs)`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason as Error));

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
