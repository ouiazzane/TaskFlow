import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import AuthSession from './models/session.model.js';
import ProjectInvitation from './models/project-invitation.model.js';

const startServer = async () => {
  await connectDatabase();
  await AuthSession.createIndexes();
  await ProjectInvitation.createIndexes();

  app.listen(env.PORT, () => {
    console.log(`TaskFlow server listening on port ${env.PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
