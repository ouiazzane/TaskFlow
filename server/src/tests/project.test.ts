import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { env } from '../config/env.js';
import ProjectInvitation from '../models/project-invitation.model.js';

let mongoServer: MongoMemoryServer;
let ownerCookie = '';
let outsiderCookie = '';
let memberCookie = '';
let memberEmail = '';
let projectId = '';
let taskId = '';
let otherProjectId = '';
let otherTaskId = '';
let commentId = '';
let notificationId = '';

describe('Project and task API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(env.MONGODB_URI, { dbName: 'taskflow-project-test' });
    await ProjectInvitation.createIndexes();

    const owner = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Project Owner',
      email: 'owner@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });
    const outsider = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Project Outsider',
      email: 'outsider@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });
    memberEmail = 'project-member@example.com';
    const member = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Project Member',
      email: memberEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });
    ownerCookie = owner.headers['set-cookie'][0].split(';')[0];
    outsiderCookie = outsider.headers['set-cookie'][0].split(';')[0];
    memberCookie = member.headers['set-cookie'][0].split(';')[0];

    const project = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', ownerCookie)
      .send({ name: 'Sprint planning', description: 'Objective team sprint' });
    projectId = project.body.data.project._id;

    await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', ownerCookie)
      .send({ email: memberEmail, role: 'member' });

    const task = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Prepare sprint', description: 'Create the sprint plan', assignee: member.body.data.user._id });
    taskId = task.body.data.task._id;

    const otherProject = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', ownerCookie)
      .send({ name: 'Second project', description: 'Separate task scope' });
    otherProjectId = otherProject.body.data.project._id;

    const otherTask = await request(app)
      .post(`/api/v1/projects/${otherProjectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Other project task' });
    otherTaskId = otherTask.body.data.task._id;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });

  it('creates a project and task for an authenticated member', async () => {
    const [project, task] = await Promise.all([
      request(app).get(`/api/v1/projects/${projectId}`).set('Cookie', ownerCookie),
      request(app).get(`/api/v1/projects/${projectId}/tasks/${taskId}`).set('Cookie', ownerCookie)
    ]);

    expect(project.status).toBe(200);
    expect(project.body.data.project.name).toBe('Sprint planning');
    expect(task.status).toBe(200);
    expect(task.body.data.task.title).toBe('Prepare sprint');
  });

  it('does not expose a task through a different project URL', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks/${otherTaskId}`)
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(404);
  });

  it('blocks non-members from reading or changing project tasks', async () => {
    const [read, update, changeStatus, remove] = await Promise.all([
      request(app).get(`/api/v1/projects/${projectId}/tasks/${taskId}`).set('Cookie', outsiderCookie),
      request(app).patch(`/api/v1/projects/${projectId}/tasks/${taskId}`).set('Cookie', outsiderCookie).send({ title: 'Unauthorized change' }),
      request(app).patch(`/api/v1/projects/${projectId}/tasks/${taskId}/status`).set('Cookie', outsiderCookie).send({ status: 'done' }),
      request(app).delete(`/api/v1/projects/${projectId}/tasks/${taskId}`).set('Cookie', outsiderCookie)
    ]);

    expect(read.status).toBe(403);
    expect(update.status).toBe(403);
    expect(changeStatus.status).toBe(403);
    expect(remove.status).toBe(403);
  });

  it('invites a registered user by email and grants project access only after acceptance', async () => {
    const invitation = await request(app)
      .post(`/api/v1/projects/${projectId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: 'outsider@example.com' });
    expect(invitation.status).toBe(201);
    expect(invitation.body.data.inviteUrl).toMatch(/^http:\/\/localhost:5173\/invite\//);
    const inviteToken = invitation.body.data.inviteUrl.split('/').pop();
    const storedInvite = await ProjectInvitation.findById(invitation.body.data.invitation._id);
    expect(storedInvite?.tokenHash).not.toBe(inviteToken);

    const forbiddenPreview = await request(app)
      .post('/api/v1/invitations/link-preview')
      .set('Cookie', memberCookie)
      .send({ token: inviteToken });
    expect(forbiddenPreview.status).toBe(404);
    const forbiddenAccept = await request(app)
      .post('/api/v1/invitations/accept-link')
      .set('Cookie', memberCookie)
      .send({ token: inviteToken });
    expect(forbiddenAccept.status).toBe(404);
    const validPreview = await request(app)
      .post('/api/v1/invitations/link-preview')
      .set('Cookie', outsiderCookie)
      .send({ token: inviteToken });
    expect(validPreview.status).toBe(200);
    expect(validPreview.body.data.project.name).toBe('Sprint planning');

    const pending = await request(app).get('/api/v1/invitations/pending').set('Cookie', outsiderCookie);
    expect(pending.status).toBe(200);
    expect(pending.body.data.invitations).toHaveLength(1);
    expect(pending.body.data.invitations[0].project.name).toBe('Sprint planning');

    const notYetMember = await request(app).get(`/api/v1/projects/${projectId}`).set('Cookie', outsiderCookie);
    expect(notYetMember.status).toBe(403);

    const accepted = await request(app)
      .post(`/api/v1/invitations/${pending.body.data.invitations[0]._id}/accept`)
      .set('Cookie', outsiderCookie);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.projectId).toBe(projectId);

    const projectAccess = await request(app).get(`/api/v1/projects/${projectId}`).set('Cookie', outsiderCookie);
    expect(projectAccess.status).toBe(200);
  });

  it('creates a reusable seven-day invite link that accepts multiple project members', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${otherProjectId}/invitation-link`)
      .set('Cookie', ownerCookie);
    expect(response.status).toBe(201);
    const token = response.body.data.inviteUrl.split('/').pop();
    const invitation = await ProjectInvitation.findOne({ project: otherProjectId, invitedEmail: { $exists: false } });
    expect(invitation?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(invitation?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(invitation?.tokenHash).not.toBe(token);

    const [memberJoin, outsiderJoin] = await Promise.all([
      request(app).post('/api/v1/invitations/accept-link').set('Cookie', memberCookie).send({ token }),
      request(app).post('/api/v1/invitations/accept-link').set('Cookie', outsiderCookie).send({ token })
    ]);
    expect(memberJoin.status).toBe(200);
    expect(outsiderJoin.status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${otherProjectId}`).set('Cookie', memberCookie)).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${otherProjectId}`).set('Cookie', outsiderCookie)).status).toBe(200);
  });

  it('revokes previous share links when a new project link is created', async () => {
    const first = await request(app).post(`/api/v1/projects/${projectId}/invitation-link`).set('Cookie', ownerCookie);
    const firstToken = first.body.data.inviteUrl.split('/').pop();
    const second = await request(app).post(`/api/v1/projects/${projectId}/invitation-link`).set('Cookie', ownerCookie);
    const firstPreview = await request(app)
      .post('/api/v1/invitations/link-preview')
      .set('Cookie', outsiderCookie)
      .send({ token: firstToken });
    const secondPreview = await request(app)
      .post('/api/v1/invitations/link-preview')
      .set('Cookie', outsiderCookie)
      .send({ token: second.body.data.inviteUrl.split('/').pop() });

    expect(firstPreview.status).toBe(404);
    expect(secondPreview.status).toBe(200);
  });

  it('does not allow non-admin project members to create invitations', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/invitation-link`)
      .set('Cookie', memberCookie);
    expect(response.status).toBe(403);
  });

  it('rejects invalid task input', async () => {
    const [invalidTask, invalidDate] = await Promise.all([
      request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({ title: 'x', status: 'invalid' }),
      request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Cookie', ownerCookie)
        .send({ title: 'Date validation task', dueDate: 'not-a-date' })
    ]);

    expect(invalidTask.status).toBe(400);
    expect(invalidDate.status).toBe(400);
  });

  it('allows authorized project and task updates', async () => {
    const project = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .send({ description: 'Updated project description' });
    const task = await request(app)
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Prepare sprint review' });

    expect(project.status).toBe(200);
    expect(project.body.data.project.description).toBe('Updated project description');
    expect(task.status).toBe(200);
    expect(task.body.data.task.title).toBe('Prepare sprint review');
  });

  it('prevents non-assignees from changing task status through either update route', async () => {
    const [directStatusChange, generalTaskUpdate] = await Promise.all([
      request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}/status`)
        .set('Cookie', ownerCookie)
        .send({ status: 'done' }),
      request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', ownerCookie)
        .send({ status: 'done' })
    ]);
    const task = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', ownerCookie);

    expect(directStatusChange.status).toBe(403);
    expect(generalTaskUpdate.status).toBe(403);
    expect(task.body.data.task.status).toBe('todo');
  });

  it('allows only the assigned member to change task status and lets members collaborate through comments', async () => {
    const status = await request(app)
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}/status`)
      .set('Cookie', memberCookie)
      .send({ status: 'in_progress' });
    const comment = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
      .set('Cookie', memberCookie)
      .send({ content: 'Sprint preparation is underway.' });
    const comments = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`)
      .set('Cookie', ownerCookie);
    const notifications = await request(app).get('/api/v1/notifications').set('Cookie', memberCookie);
    const activity = await request(app).get(`/api/v1/projects/${projectId}/activity`).set('Cookie', memberCookie);
    commentId = comment.body.data.comment._id;
    notificationId = notifications.body.data.notifications[0]._id;

    expect(status.status).toBe(200);
    expect(status.body.data.task.status).toBe('in_progress');
    expect(comment.status).toBe(201);
    expect(comments.status).toBe(200);
    expect(comments.body.data.comments).toHaveLength(1);
    expect(notifications.status).toBe(200);
    expect(notifications.body.data.notifications.some((item: { type: string }) => item.type === 'task_assigned')).toBe(true);
    expect(activity.status).toBe(200);
    expect(activity.body.data.activities.length).toBeGreaterThan(0);
  });

  it('allows authors to edit and delete comments and recipients to read notifications', async () => {
    const updateComment = await request(app)
      .patch(`/api/v1/comments/${commentId}`)
      .set('Cookie', memberCookie)
      .send({ content: 'Updated sprint comment.' });
    const markRead = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Cookie', memberCookie);
    const deleteComment = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set('Cookie', memberCookie);

    expect(updateComment.status).toBe(200);
    expect(updateComment.body.data.comment.content).toBe('Updated sprint comment.');
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.notification.isRead).toBe(true);
    expect(deleteComment.status).toBe(200);
  });

  it('does not update a task when its route project does not match', async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${projectId}/tasks/${otherTaskId}`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Cross-project change' });

    expect(response.status).toBe(404);
  });
});
