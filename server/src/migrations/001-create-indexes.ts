import mongoose from 'mongoose';

export default async function createIndexes() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No MongoDB connection for migration.');
  }

  const userCollection = db.collection('users');
  await userCollection.createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });

  const projectCollection = db.collection('projects');
  await projectCollection.createIndex({ owner: 1, status: 1 }, { name: 'projects_owner_status' });
  await projectCollection.createIndex({ 'members.user': 1, status: 1 }, { name: 'projects_member_status' });

  const taskCollection = db.collection('tasks');
  await taskCollection.createIndex({ project: 1, status: 1, dueDate: 1 }, { name: 'tasks_project_status_due' });
  await taskCollection.createIndex({ assignee: 1, status: 1 }, { name: 'tasks_assignee_status' });

  const notificationCollection = db.collection('notifications');
  await notificationCollection.createIndex({ recipient: 1, isRead: 1, createdAt: -1 }, { name: 'notifications_recipient_read' });

  const activityCollection = db.collection('activitylogs');
  await activityCollection.createIndex({ project: 1, createdAt: -1 }, { name: 'activity_project_created' });

  console.log('Indexes created successfully.');
}
