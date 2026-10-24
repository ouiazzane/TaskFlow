import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME
    });

    const database = mongoose.connection.db;
    if (!database) {
      throw new Error('MongoDB connection did not expose a database handle.');
    }

    const ping = await database.command({ ping: 1 });
    if (ping.ok !== 1) {
      throw new Error('MongoDB ping did not return a positive result.');
    }

    console.log('MongoDB connected successfully.');
  } catch {
    console.error('MongoDB connection or ping failed. Check server-side configuration and network access.');
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function getDatabaseHealth() {
  const state = mongoose.connection.readyState;
  return {
    status: state === 1 ? 'connected' : state === 2 ? 'connecting' : state === 3 ? 'disconnecting' : 'disconnected',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}

mongoose.connection.on('error', (_error) => {
  console.error('MongoDB connection error.');
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
