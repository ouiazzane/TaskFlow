import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import ActivityLog from '../models/activity.model.js';
import Comment from '../models/comment.model.js';
import Notification from '../models/notification.model.js';
import Project from '../models/project.model.js';
import Task from '../models/task.model.js';
import User from '../models/user.model.js';

const demoProjectName = 'TaskFlow - Jeu de données QA';

const taskFixtures = [
  {
    title: 'Préparer le cadrage du projet',
    description: 'Définir les objectifs et le périmètre de la démonstration.',
    status: 'todo' as const,
    priority: 'high' as const,
    position: 1,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
  },
  {
    title: 'Construire le tableau de bord',
    description: 'Mettre en place les indicateurs de suivi.',
    status: 'in_progress' as const,
    priority: 'urgent' as const,
    position: 2,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
  },
  {
    title: 'Valider le parcours de collaboration',
    description: 'Vérifier les commentaires et les notifications.',
    status: 'in_review' as const,
    priority: 'medium' as const,
    position: 3,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
  },
  {
    title: 'Créer la première version',
    description: 'Livrer une base fonctionnelle pour la démonstration.',
    status: 'done' as const,
    priority: 'low' as const,
    position: 4
  }
];

export async function seedDatabase() {
  const email = (process.env.TASKFLOW_SEED_EMAIL ?? 'taskflow.qa@taskflow.dev').trim().toLowerCase();
  const password = process.env.TASKFLOW_SEED_PASSWORD;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('TASKFLOW_SEED_EMAIL must be a valid email address.');
  }

  await connectDatabase();

  try {
    let user = await User.findOne({ email });
    if (!user) {
      if (!password || password.length < 8 || password.length > 128) {
        throw new Error('Set TASKFLOW_SEED_PASSWORD (8–128 characters) to create the QA user.');
      }

      user = await User.create({
        fullName: 'TaskFlow QA',
        email,
        passwordHash: await bcrypt.hash(password, 12),
        preferences: { theme: 'system', notifications: true }
      });
    }

    let project = await Project.findOne({ owner: user._id, name: demoProjectName });
    if (!project) {
      project = await Project.create({
        name: demoProjectName,
        description: 'Jeu de données non destructif pour valider les parcours TaskFlow.',
        owner: user._id,
        members: [{ user: user._id, role: 'owner', joinedAt: new Date() }],
        status: 'active',
        color: '#0f766e'
      });
    } else if (!project.members.some((member) => String(member.user) === String(user._id))) {
      project.members.push({ user: user._id, role: 'owner', joinedAt: new Date() });
      await project.save();
    }

    const tasks: mongoose.Types.ObjectId[] = [];
    for (const fixture of taskFixtures) {
      let task = await Task.findOne({ project: project._id, title: fixture.title });
      if (!task) {
        task = await Task.create({
          ...fixture,
          project: project._id,
          creator: user._id,
          assignee: user._id,
          labels: ['qa', 'demo']
        });
        await ActivityLog.create({
          project: project._id,
          task: task._id,
          actor: user._id,
          action: 'task_created',
          description: `La tâche "${task.title}" a été créée pour le jeu de données QA.`
        });
      }
      tasks.push(task._id);
    }

    const commentTask = await Task.findOne({ project: project._id, title: taskFixtures[1].title });
    if (!commentTask) {
      throw new Error('QA fixture task is missing.');
    }

    const commentContent = 'Données QA : le parcours de commentaire est prêt à être vérifié.';
    await Comment.findOneAndUpdate(
      { task: commentTask._id, author: user._id, content: commentContent },
      { $setOnInsert: { task: commentTask._id, project: project._id, author: user._id, content: commentContent } },
      { upsert: true, new: true }
    );

    const notificationTitle = 'Bienvenue dans le projet QA';
    await Notification.findOneAndUpdate(
      { recipient: user._id, relatedProject: project._id, title: notificationTitle },
      {
        $setOnInsert: {
          recipient: user._id,
          actor: user._id,
          type: 'task_assigned',
          title: notificationTitle,
          message: 'Le jeu de données TaskFlow est prêt pour vos vérifications.',
          relatedProject: project._id,
          relatedTask: commentTask._id,
          isRead: false
        }
      },
      { upsert: true, new: true }
    );

    await ActivityLog.findOneAndUpdate(
      { project: project._id, action: 'qa_dataset_created', description: 'Jeu de données QA préparé.' },
      {
        $setOnInsert: {
          project: project._id,
          actor: user._id,
          action: 'qa_dataset_created',
          description: 'Jeu de données QA préparé.'
        }
      },
      { upsert: true, new: true }
    );

    console.log(`QA data ready: 1 user, 1 project, ${tasks.length} tasks, comment, notification, and activity.`);
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase().catch(() => {
  console.error('Seed failed. Check the QA seed settings and MongoDB connection.');
  process.exitCode = 1;
});
