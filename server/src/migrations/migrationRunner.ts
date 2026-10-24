import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';

const migrationHistory = 'migration_history';

async function ensureHistoryCollection() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not available for migrations.');
  }

  const collections = await db.listCollections({ name: migrationHistory }).toArray();
  if (!collections.length) {
    await db.createCollection(migrationHistory, {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['version', 'name', 'appliedAt'],
          properties: {
            version: { bsonType: 'string' },
            name: { bsonType: 'string' },
            appliedAt: { bsonType: 'date' }
          }
        }
      }
    });
  }
}

async function runMigrations() {
  await connectDatabase();
  await ensureHistoryCollection();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not available for migrations.');
  }

  const history = db.collection(migrationHistory);
  const applied = await history.find({}).toArray();
  const appliedVersions = new Set(applied.map((entry) => entry.version));

  const files = ['001-create-indexes.ts'];
  for (const file of files) {
    const version = file.replace(/\.ts$/, '').split('-')[0];
    if (appliedVersions.has(version)) {
      console.log(`Migration ${version} already applied.`);
      continue;
    }

    try {
      const migration = await import(`./${file}`);
      await migration.default();
      await history.insertOne({ version, name: file, appliedAt: new Date() });
      console.log(`Migration ${version} applied successfully.`);
    } catch (error) {
      console.error(`Migration ${version} failed:`, (error as Error).message);
      throw error;
    }
  }

  console.log('Migration run complete.');
  await mongoose.disconnect();
}

runMigrations().catch((error) => {
  console.error('Fatal migration error:', error);
  process.exit(1);
});
