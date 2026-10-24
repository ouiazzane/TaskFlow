import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import { getDatabaseHealth } from './config/database.js';
import { protect, type AuthenticatedRequest } from './middleware/auth.js';
import { successResponse, errorResponse } from './utils/response.js';
import User from './models/user.model.js';
import Project from './models/project.model.js';
import Task from './models/task.model.js';
import Comment from './models/comment.model.js';
import Notification from './models/notification.model.js';
import ActivityLog from './models/activity.model.js';
import AuthSession from './models/session.model.js';
import ProjectInvitation from './models/project-invitation.model.js';
import { hashTokenId } from './utils/token.js';

const app = express();
const dateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date.');

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.', errors: [] }
});

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const issueToken = async (userId: string) => {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_SECRET as jwt.Secret, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
  const payload = jwt.decode(token);
  if (!payload || typeof payload === 'string' || typeof payload.exp !== 'number') {
    throw new Error('Authentication token expiration could not be determined.');
  }

  const expiresAt = new Date(payload.exp * 1000);
  await AuthSession.create({ user: userId, tokenHash: hashTokenId(jti), expiresAt });
  return { token, expiresAt };
};

const setAuthCookie = (res: Response, token: string, expiresAt: Date) =>
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.max(0, expiresAt.getTime() - Date.now())
  });

const clearAuthCookie = (res: Response) =>
  res.clearCookie(env.COOKIE_NAME, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' });

const sanitizeUser = (user: any) => ({
  _id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  avatarUrl: user.avatarUrl || '',
  jobTitle: user.jobTitle || '',
  bio: user.bio || '',
  preferences: user.preferences || { theme: 'system', notifications: true }
});

const projectMemberRole = (project: any, userId: string) => {
  const member = project.members?.find((entry: any) => String(entry.user) === String(userId));
  return member?.role ?? null;
};

const canManageProject = (project: any, userId: string) => {
  const role = projectMemberRole(project, userId);
  return role === 'owner' || role === 'admin';
};

const addProjectMember = async (projectId: mongoose.Types.ObjectId, req: AuthenticatedRequest) => {
  const result = await Project.updateOne(
    { _id: projectId, 'members.user': { $ne: new mongoose.Types.ObjectId(req.user!._id) } },
    { $push: { members: { user: new mongoose.Types.ObjectId(req.user!._id), role: 'member', joinedAt: new Date() } } }
  );
  if (result.modifiedCount > 0) {
    await ActivityLog.create({
      project: projectId,
      actor: req.user!._id,
      action: 'member_joined',
      description: `${req.user!.fullName} joined the project.`
    });
  }
};

const noAuthResponse = (res: Response, message: string) =>
  res.status(401).json({ success: false, message, errors: [] });

app.get('/api/v1/health', (_req, res) => {
  const db = getDatabaseHealth();
  const healthy = db.status === 'connected';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'API is operational.' : 'Database unavailable.',
    data: {
      app: 'TaskFlow API',
      status: healthy ? 'ok' : 'degraded',
      database: db
    }
  });
});

app.post('/api/v1/auth/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const registerSchema = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128)
  });

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('Invalid data.', parsed.error.issues.map((issue) => issue.message)));
  }

  const { fullName, email, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) {
    return res.status(400).json(errorResponse('Passwords do not match.'));
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json(errorResponse('This email address is already in use.'));
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    passwordHash,
    preferences: { theme: 'system', notifications: true }
  });

  let session: Awaited<ReturnType<typeof issueToken>>;
  try {
    session = await issueToken(String(user._id));
  } catch (error) {
    return next(error);
  }
  setAuthCookie(res, session.token, session.expiresAt);

  const responseUser = sanitizeUser(user);
  return res.status(201).json(successResponse('Account created successfully.', { user: responseUser }));
});

app.post('/api/v1/auth/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128)
  });

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('Invalid credentials.', parsed.error.issues.map((issue) => issue.message)));
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json(errorResponse('Identifiants incorrects.'));
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json(errorResponse('Identifiants incorrects.'));
  }

  let session: Awaited<ReturnType<typeof issueToken>>;
  try {
    session = await issueToken(String(user._id));
  } catch (error) {
    return next(error);
  }
  setAuthCookie(res, session.token, session.expiresAt);

  return res.json(successResponse('Signed in successfully.', { user: sanitizeUser(user) }));
});

app.post('/api/v1/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (token) {
    try {
      let decoded: string | jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET);
      } catch (error) {
        if (!(error instanceof jwt.JsonWebTokenError)) throw error;
        decoded = '';
      }

      if (typeof decoded !== 'string' && typeof decoded.sub === 'string' && typeof decoded.jti === 'string') {
        await AuthSession.deleteOne({ user: decoded.sub, tokenHash: hashTokenId(decoded.jti) });
      }
    } catch (error) {
      return next(error);
    }
  }

  clearAuthCookie(res);
  return res.json(successResponse('Signed out successfully.', null));
});

app.get('/api/v1/auth/me', protect, async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user!._id).select('-passwordHash');
  if (!user) {
    return noAuthResponse(res, 'User not found.');
  }
  return res.json(successResponse('Profile loaded.', { user: sanitizeUser(user) }));
});

app.patch('/api/v1/auth/me', protect, async (req: AuthenticatedRequest, res: Response) => {
  const updateSchema = z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    jobTitle: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(1000).optional(),
    avatarUrl: z.string().max(90_000).refine((value) => {
      if (!value) return true;
      if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return true;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    }, 'The photo must be a supported image or an HTTPS URL.').optional(),
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        notifications: z.boolean().optional()
      })
      .optional()
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('Invalid profile.', parsed.error.issues.map((issue) => issue.message)));
  }

  const user = await User.findById(req.user!._id);
  if (!user) {
    return res.status(404).json(errorResponse('User not found.'));
  }

  if (parsed.data.fullName) user.fullName = parsed.data.fullName;
  if (parsed.data.jobTitle !== undefined) user.jobTitle = parsed.data.jobTitle;
  if (parsed.data.bio !== undefined) user.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) user.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.preferences) {
    user.preferences = { ...user.preferences, ...parsed.data.preferences };
  }

  await user.save();
  return res.json(successResponse('Profile updated.', { user: sanitizeUser(user) }));
});

app.patch('/api/v1/auth/change-password', protect, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('Invalid password.', parsed.error.issues.map((issue) => issue.message)));
  }

  const user = await User.findById(req.user!._id);
  if (!user) {
    return res.status(404).json(errorResponse('User not found.'));
  }

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) {
    return res.status(400).json(errorResponse('The current password is incorrect.'));
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await user.save();
  try {
    await AuthSession.deleteMany({ user: user._id });
  } catch (error) {
    return next(error);
  }
  clearAuthCookie(res);
  return res.json(successResponse('Password changed successfully.', null));
});

app.get('/api/v1/projects', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projects = await Project.find({ 'members.user': req.user!._id })
    .populate('owner', 'fullName email avatarUrl')
    .populate('members.user', 'fullName email avatarUrl')
    .sort({ updatedAt: -1 });

  return res.json(successResponse('Projects loaded.', { projects }));
});

app.post('/api/v1/projects', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projectSchema = z.object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).default(''),
    status: z.enum(['active', 'completed', 'archived']).default('active'),
    startDate: dateString.optional(),
    dueDate: dateString.optional(),
    color: z.string().trim().max(20).optional()
  });

  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('Invalid project.', parsed.error.issues.map((issue) => issue.message)));
  }

  const payload = parsed.data;
  const project = await Project.create({
    name: payload.name,
    description: payload.description,
    owner: req.user!._id,
    status: payload.status,
    startDate: payload.startDate ? new Date(payload.startDate) : undefined,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    color: payload.color ?? '#4f46e5',
    members: [{ user: req.user!._id, role: 'owner', joinedAt: new Date() }]
  });

  await ActivityLog.create({
    project: project._id,
    actor: req.user!._id,
    action: 'project_created',
    description: `${req.user!.fullName} created the project.`
  });

  return res.status(201).json(successResponse('Project created.', { project }));
});

app.get('/api/v1/projects/:projectId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId)
    .populate('owner', 'fullName email avatarUrl')
    .populate('members.user', 'fullName email avatarUrl');

  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user._id ?? member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You are not a member of this project.'));
  }

  const totalTasks = await Task.countDocuments({ project: project._id });
  const completedTasks = await Task.countDocuments({ project: project._id, status: 'done' });
  const overdueTasks = await Task.countDocuments({
    project: project._id,
    status: { $ne: 'done' },
    dueDate: { $lt: new Date() }
  });

  return res.json(successResponse('Project details loaded.', {
    project,
    metrics: { totalTasks, completedTasks, overdueTasks, progress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0 }
  }));
});

app.patch('/api/v1/projects/:projectId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('You are not authorized to edit this project.'));

  const schema = z.object({
    name: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
    dueDate: dateString.optional(),
    color: z.string().trim().max(20).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid data.', parsed.error.issues.map((issue) => issue.message)));

  const updates = parsed.data;
  if (updates.name) project.name = updates.name;
  if (updates.description !== undefined) project.description = updates.description;
  if (updates.status) project.status = updates.status;
  if (updates.dueDate !== undefined) project.dueDate = updates.dueDate ? new Date(updates.dueDate) : undefined;
  if (updates.color) project.color = updates.color;

  await project.save();
  return res.json(successResponse('Project updated.', { project }));
});

app.delete('/api/v1/projects/:projectId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (project.owner.toString() !== req.user!._id) return res.status(403).json(errorResponse('Only the project owner can delete the project.'));
  await Task.deleteMany({ project: project._id });
  await Comment.deleteMany({ project: project._id });
  await Notification.deleteMany({ relatedProject: project._id });
  await ActivityLog.deleteMany({ project: project._id });
  await project.deleteOne();
  return res.json(successResponse('Project deleted.', null));
});

app.post('/api/v1/projects/:projectId/archive', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('You are not authorized to archive this project.'));
  project.status = 'archived';
  await project.save();
  return res.json(successResponse('Project archived.', { project }));
});

app.get('/api/v1/projects/:projectId/members', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId).populate('members.user', 'fullName email avatarUrl');
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user._id ?? member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('Access denied.'));
  }
  return res.json(successResponse('Members loaded.', { members: project.members }));
});

app.post('/api/v1/projects/:projectId/invitations', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('Only the owner and administrators can invite members.'));

  const schema = z.object({ email: z.string().trim().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid email address.', parsed.error.issues.map((issue) => issue.message)));

  const invitedEmail = parsed.data.email.toLowerCase();
  const invitedUser = await User.findOne({ email: invitedEmail }).select('_id');
  if (invitedUser && project.members.some((member: any) => String(member.user) === String(invitedUser._id))) {
    return res.status(409).json(errorResponse('This user is already a project member.'));
  }

  let invitation = await ProjectInvitation.findOne({
    project: project._id,
    invitedEmail,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (invitation) {
    invitation.tokenHash = hashTokenId(token);
    invitation.expiresAt = expiresAt;
    invitation.createdBy = new mongoose.Types.ObjectId(req.user!._id);
    await invitation.save();
  } else {
    invitation = await ProjectInvitation.create({
      project: project._id,
      invitedEmail,
      tokenHash: hashTokenId(token),
      createdBy: req.user!._id,
      expiresAt
    });
  }

  if (invitedUser) {
    await Notification.create({
      recipient: invitedUser._id,
      actor: req.user!._id,
      type: 'project_invite',
      title: 'Project invitation',
      message: `You have been invited to join the project "${project.name}".`,
      relatedProject: project._id
    });
  }

  return res.status(201).json(successResponse('Invitation is ready. Share the link with the invitee.', {
    invitation: { _id: invitation._id, email: invitedEmail, expiresAt },
    inviteUrl: `${env.CLIENT_URL}/invite/${token}`
  }));
});

app.post('/api/v1/projects/:projectId/invitation-link', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('Only the owner and administrators can create a link.'));

  await ProjectInvitation.updateMany(
    { project: project._id, invitedEmail: { $exists: false }, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }
  );

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await ProjectInvitation.create({
    project: project._id,
    tokenHash: hashTokenId(token),
    createdBy: req.user!._id,
    expiresAt
  });

  return res.status(201).json(successResponse('Reusable link created; it expires in 7 days.', {
    invitation: { _id: invitation._id, expiresAt },
    inviteUrl: `${env.CLIENT_URL}/invite/${token}`
  }));
});

app.get('/api/v1/invitations/pending', protect, async (req: AuthenticatedRequest, res: Response) => {
  const invitations = await ProjectInvitation.find({
    invitedEmail: req.user!.email.toLowerCase(),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  })
    .populate('project', 'name description color')
    .populate('createdBy', 'fullName email')
    .sort({ createdAt: -1 });
  return res.json(successResponse('Pending invitations loaded.', { invitations }));
});

app.post('/api/v1/invitations/:invitationId/accept', protect, async (req: AuthenticatedRequest, res: Response) => {
  const invitation = await ProjectInvitation.findOne({
    _id: req.params.invitationId,
    invitedEmail: req.user!.email.toLowerCase(),
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
  if (!invitation) return res.status(404).json(errorResponse('Invitation not found or expired.'));

  const project = await Project.findById(invitation.project);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  await addProjectMember(project._id, req);
  invitation.acceptedAt = new Date();
  await invitation.save();
  return res.json(successResponse('Invitation accepted.', { projectId: String(project._id) }));
});

app.post('/api/v1/invitations/link-preview', protect, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({ token: z.string().min(32).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid invitation link.'));
  const invitation = await ProjectInvitation.findOne({
    tokenHash: hashTokenId(parsed.data.token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    $or: [{ invitedEmail: { $exists: false } }, { invitedEmail: req.user!.email.toLowerCase() }]
  });
  if (!invitation) return res.status(404).json(errorResponse('Invitation link is invalid, expired, or reserved for another email address.'));

  const project = await Project.findById(invitation.project).select('name description members');
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  const alreadyMember = project.members.some((member: any) => String(member.user) === String(req.user!._id));
  return res.json(successResponse('Invitation loaded.', {
    project: { _id: project._id, name: project.name, description: project.description },
    invitedEmail: invitation.invitedEmail ?? null,
    alreadyMember,
    expiresAt: invitation.expiresAt
  }));
});

app.post('/api/v1/invitations/accept-link', protect, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({ token: z.string().min(32).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid invitation link.'));
  const invitation = await ProjectInvitation.findOne({
    tokenHash: hashTokenId(parsed.data.token),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    $or: [{ invitedEmail: { $exists: false } }, { invitedEmail: req.user!.email.toLowerCase() }]
  });
  if (!invitation) return res.status(404).json(errorResponse('Invitation link is invalid, expired, or reserved for another email address.'));

  const project = await Project.findById(invitation.project);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  await addProjectMember(project._id, req);

  if (invitation.invitedEmail) {
    invitation.acceptedAt = new Date();
    await invitation.save();
  }
  return res.json(successResponse('You joined the project.', { projectId: String(project._id) }));
});

app.delete('/api/v1/projects/:projectId/invitations/:invitationId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('Only the owner and administrators can revoke invitations.'));
  const invitation = await ProjectInvitation.findOne({ _id: req.params.invitationId, project: project._id, revokedAt: null });
  if (!invitation) return res.status(404).json(errorResponse('Invitation not found.'));
  invitation.revokedAt = new Date();
  await invitation.save();
  return res.json(successResponse('Invitation revoked.', null));
});

app.post('/api/v1/projects/:projectId/members', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('You are not authorized to manage members.'));

  const schema = z.object({ email: z.string().trim().email(), role: z.enum(['admin', 'member']).default('member') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid member.', parsed.error.issues.map((issue) => issue.message)));

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) return res.status(404).json(errorResponse('User not found.'));
  if (project.members.some((member: any) => String(member.user) === String(user._id))) {
    return res.status(409).json(errorResponse('This user is already a project member.'));
  }

  project.members.push({ user: user._id, role: parsed.data.role, joinedAt: new Date() });
  await project.save();
  return res.status(201).json(successResponse('Member added.', { project }));
});

app.patch('/api/v1/projects/:projectId/members/:memberId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('Action not authorized.'));

  const member = project.members.find((entry: any) => String(entry.user) === req.params.memberId);
  if (!member) return res.status(404).json(errorResponse('Member not found.'));
  if (String(project.owner) === req.params.memberId) return res.status(400).json(errorResponse('The owner cannot be changed through this operation.'));

  const schema = z.object({ role: z.enum(['admin', 'member']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid role.', parsed.error.issues.map((issue) => issue.message)));

  member.role = parsed.data.role;
  await project.save();
  return res.json(successResponse('Role updated.', { member }));
});

app.delete('/api/v1/projects/:projectId/members/:memberId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!canManageProject(project, req.user!._id)) return res.status(403).json(errorResponse('Action not authorized.'));
  if (String(project.owner) === req.params.memberId) return res.status(400).json(errorResponse('The owner cannot be removed.'));

  project.members = project.members.filter((entry: any) => String(entry.user) !== req.params.memberId);
  await project.save();
  return res.json(successResponse('Member removed from the project.', null));
});

app.get('/api/v1/tasks', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projectIds = (await Project.find({ 'members.user': req.user!._id }).select('_id')).map((project) => project._id);
  const tasks = await Task.find({ project: { $in: projectIds } })
    .populate('project', 'name')
    .populate('assignee', 'fullName email')
    .populate('creator', 'fullName')
    .sort({ dueDate: 1, createdAt: -1 });
  return res.json(successResponse('Tasks loaded.', { tasks }));
});

app.get('/api/v1/projects/:projectId/tasks', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));

  const tasks = await Task.find({ project: project._id })
    .populate('assignee', 'fullName email avatarUrl')
    .populate('creator', 'fullName')
    .sort({ position: 1, dueDate: 1 });
  return res.json(successResponse('Project tasks loaded.', { tasks }));
});

app.post('/api/v1/projects/:projectId/tasks', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));

  const taskSchema = z.object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(4000).default(''),
    status: z.enum(['todo', 'in_progress', 'in_review', 'done']).default('todo'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    assignee: z.string().optional().nullable(),
    startDate: dateString.optional(),
    dueDate: dateString.optional(),
    labels: z.array(z.string().trim().max(40)).default([])
  });

  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid task.', parsed.error.issues.map((issue) => issue.message)));

  const payload = parsed.data;
  if (payload.assignee) {
    const validMember = project.members.some((member: any) => String(member.user) === String(payload.assignee));
    if (!validMember) return res.status(400).json(errorResponse('The assignee must be a project member.'));
  }

  const task = await Task.create({
    project: project._id,
    title: payload.title,
    description: payload.description,
    status: payload.status,
    priority: payload.priority,
    creator: req.user!._id,
    assignee: payload.assignee ?? null,
    startDate: payload.startDate ? new Date(payload.startDate) : undefined,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    labels: payload.labels,
    position: 0
  });

  await ActivityLog.create({
    project: project._id,
    task: task._id,
    actor: req.user!._id,
    action: 'task_created',
    description: `Task "${task.title}" was created.`
  });

  if (task.assignee && String(task.assignee) !== String(req.user!._id)) {
    await Notification.create({
      recipient: task.assignee,
      actor: req.user!._id,
      type: 'task_assigned',
      title: 'New task assigned',
      message: `A task has been assigned to you: ${task.title}`,
      relatedProject: project._id,
      relatedTask: task._id
    });
  }

  return res.status(201).json(successResponse('Task created.', { task }));
});

app.get('/api/v1/projects/:projectId/tasks/:taskId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));
  const task = await Task.findOne({ _id: req.params.taskId, project: project._id })
    .populate('assignee', 'fullName email')
    .populate('creator', 'fullName email');
  if (!task) return res.status(404).json(errorResponse('Task not found.'));
  return res.json(successResponse('Task details loaded.', { task }));
});

app.patch('/api/v1/projects/:projectId/tasks/:taskId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You must be a project member to edit its tasks.'));
  }
  const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json(errorResponse('Task not found.'));

  const updateSchema = z.object({
    title: z.string().trim().min(3).max(180).optional(),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(['todo', 'in_progress', 'in_review', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assignee: z.string().optional().nullable(),
    dueDate: dateString.optional(),
    labels: z.array(z.string().trim().max(40)).optional()
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid data.', parsed.error.issues.map((issue) => issue.message)));

  const payload = parsed.data;
  if (payload.status !== undefined && String(task.assignee) !== req.user!._id) {
    return res.status(403).json(errorResponse('Only the assigned member can change this task status.'));
  }
  if (payload.assignee !== undefined && payload.assignee) {
    const valid = project.members.some((member: any) => String(member.user) === String(payload.assignee));
    if (!valid) return res.status(400).json(errorResponse('The assignee must be a project member.'));
  }

  if (payload.title) task.title = payload.title;
  if (payload.description !== undefined) task.description = payload.description;
  if (payload.status) task.status = payload.status;
  if (payload.priority) task.priority = payload.priority;
  if (payload.assignee !== undefined) task.assignee = payload.assignee ? new mongoose.Types.ObjectId(payload.assignee) : null;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
  if (payload.labels) task.labels = payload.labels;

  await task.save();
  await ActivityLog.create({
    project: project._id,
    task: task._id,
    actor: req.user!._id,
    action: 'task_updated',
    description: `Task "${task.title}" was updated.`
  });

  return res.json(successResponse('Task updated.', { task }));
});

app.delete('/api/v1/projects/:projectId/tasks/:taskId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You must be a project member to delete its tasks.'));
  }
  const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json(errorResponse('Task not found.'));
  if (!canManageProject(project, req.user!._id) && String(task.creator) !== String(req.user!._id)) {
    return res.status(403).json(errorResponse('Action not authorized.'));
  }
  await Comment.deleteMany({ task: task._id });
  await Notification.deleteMany({ relatedTask: task._id });
  await ActivityLog.deleteMany({ task: task._id });
  await task.deleteOne();
  return res.json(successResponse('Task deleted.', null));
});

app.patch('/api/v1/projects/:projectId/tasks/:taskId/status', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You must be a project member to edit its tasks.'));
  }

  const schema = z.object({ status: z.enum(['todo', 'in_progress', 'in_review', 'done']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid status.', parsed.error.issues.map((issue) => issue.message)));

  const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json(errorResponse('Task not found.'));
  if (String(task.assignee) !== req.user!._id) {
    return res.status(403).json(errorResponse('Only the assigned member can change this task status.'));
  }

  task.status = parsed.data.status;
  await task.save();
  await ActivityLog.create({
    project: project._id,
    task: task._id,
    actor: req.user!._id,
    action: 'task_status_changed',
    description: `Task status changed to ${parsed.data.status}.`
  });

  return res.json(successResponse('Task status updated.', { task }));
});

app.get('/api/v1/projects/:projectId/tasks/:taskId/comments', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));

  const comments = await Comment.find({ task: req.params.taskId, project: project._id }).populate('author', 'fullName avatarUrl').sort({ createdAt: 1 });
  return res.json(successResponse('Comments loaded.', { comments }));
});

app.post('/api/v1/projects/:projectId/tasks/:taskId/comments', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));

  const schema = z.object({ content: z.string().trim().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid comment.', parsed.error.issues.map((issue) => issue.message)));

  const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
  if (!task) return res.status(404).json(errorResponse('Task not found.'));

  const comment = await Comment.create({
    task: task._id,
    project: project._id,
    author: req.user!._id,
    content: parsed.data.content
  });

  await ActivityLog.create({
    project: project._id,
    task: task._id,
    actor: req.user!._id,
    action: 'comment_added',
    description: 'A comment was added.'
  });

  const recipients = project.members.map((member: any) => String(member.user)).filter((id: string) => id !== String(req.user!._id));
  await Promise.all(
    recipients.map(async (recipientId: string) => {
      await Notification.create({
        recipient: recipientId,
        actor: req.user!._id,
        type: 'comment_added',
        title: 'New comment',
        message: `A comment was added to the task ${task.title}.`,
        relatedProject: project._id,
        relatedTask: task._id
      });
    })
  );

  return res.status(201).json(successResponse('Comment added.', { comment }));
});

app.patch('/api/v1/comments/:commentId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json(errorResponse('Comment not found.'));
  const project = await Project.findById(comment.project);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You must be a project member to edit this comment.'));
  }
  if (String(comment.author) !== String(req.user!._id)) return res.status(403).json(errorResponse('Action not authorized.'));

  const schema = z.object({ content: z.string().trim().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(errorResponse('Invalid comment.', parsed.error.issues.map((issue) => issue.message)));

  comment.content = parsed.data.content;
  await comment.save();
  return res.json(successResponse('Comment updated.', { comment }));
});

app.delete('/api/v1/comments/:commentId', protect, async (req: AuthenticatedRequest, res: Response) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json(errorResponse('Comment not found.'));
  const project = await Project.findById(comment.project);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) {
    return res.status(403).json(errorResponse('You must be a project member to delete this comment.'));
  }
  if (String(comment.author) !== String(req.user!._id)) return res.status(403).json(errorResponse('Action not authorized.'));
  await comment.deleteOne();
  return res.json(successResponse('Comment deleted.', null));
});

app.get('/api/v1/notifications', protect, async (req: AuthenticatedRequest, res: Response) => {
  const notifications = await Notification.find({ recipient: req.user!._id }).sort({ createdAt: -1 });
  return res.json(successResponse('Notifications loaded.', { notifications, unreadCount: notifications.filter((n) => !n.isRead).length }));
});

app.patch('/api/v1/notifications/:notificationId/read', protect, async (req: AuthenticatedRequest, res: Response) => {
  const notification = await Notification.findOne({ _id: req.params.notificationId, recipient: req.user!._id });
  if (!notification) return res.status(404).json(errorResponse('Notification not found.'));
  notification.isRead = true;
  await notification.save();
  return res.json(successResponse('Notification marked as read.', { notification }));
});

app.patch('/api/v1/notifications/read-all', protect, async (req: AuthenticatedRequest, res: Response) => {
  await Notification.updateMany({ recipient: req.user!._id, isRead: false }, { $set: { isRead: true } });
  return res.json(successResponse('All notifications have been marked as read.', null));
});

app.get('/api/v1/projects/:projectId/activity', protect, async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json(errorResponse('Project not found.'));
  if (!project.members.some((member: any) => String(member.user) === String(req.user!._id))) return res.status(403).json(errorResponse('Access denied.'));

  const activities = await ActivityLog.find({ project: project._id }).populate('actor', 'fullName').sort({ createdAt: -1 }).limit(50);
  return res.json(successResponse('Project activity loaded.', { activities }));
});

app.get('/api/v1/dashboard/summary', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projectIds = (await Project.find({ 'members.user': req.user!._id }).select('_id')).map((project) => project._id);
  const projects = await Project.find({ _id: { $in: projectIds } });
  const tasks = await Task.find({ project: { $in: projectIds } });

  const summary = {
    totalProjects: projects.length,
    activeProjects: projects.filter((project: any) => project.status === 'active').length,
    tasksAssignedToUser: tasks.filter((task: any) => String(task.assignee) === String(req.user!._id)).length,
    completedTasks: tasks.filter((task: any) => task.status === 'done').length,
    overdueTasks: tasks.filter((task: any) => task.status !== 'done' && task.dueDate && task.dueDate < new Date()).length,
    dueSoonTasks: tasks.filter((task: any) => task.status !== 'done' && task.dueDate && task.dueDate > new Date() && task.dueDate < new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)).length,
    recentProjects: projects.slice(0, 5),
    tasksByStatus: {
      todo: tasks.filter((task: any) => task.status === 'todo').length,
      in_progress: tasks.filter((task: any) => task.status === 'in_progress').length,
      in_review: tasks.filter((task: any) => task.status === 'in_review').length,
      done: tasks.filter((task: any) => task.status === 'done').length
    },
    tasksByPriority: {
      low: tasks.filter((task: any) => task.priority === 'low').length,
      medium: tasks.filter((task: any) => task.priority === 'medium').length,
      high: tasks.filter((task: any) => task.priority === 'high').length,
      urgent: tasks.filter((task: any) => task.priority === 'urgent').length
    }
  };

  return res.json(successResponse('Dashboard summary loaded.', { summary }));
});

app.get('/api/v1/dashboard/activity', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projectIds = (await Project.find({ 'members.user': req.user!._id }).select('_id')).map((project) => project._id);
  const activities = await ActivityLog.find({ project: { $in: projectIds } }).populate('actor', 'fullName').sort({ createdAt: -1 }).limit(20);
  return res.json(successResponse('Recent activity loaded.', { activities }));
});

app.get('/api/v1/dashboard/task-statistics', protect, async (req: AuthenticatedRequest, res: Response) => {
  const projectIds = (await Project.find({ 'members.user': req.user!._id }).select('_id')).map((project) => project._id);
  const tasks = await Task.find({ project: { $in: projectIds } });
  return res.json(successResponse('Task statistics loaded.', {
    status: {
      todo: tasks.filter((task: any) => task.status === 'todo').length,
      in_progress: tasks.filter((task: any) => task.status === 'in_progress').length,
      in_review: tasks.filter((task: any) => task.status === 'in_review').length,
      done: tasks.filter((task: any) => task.status === 'done').length
    },
    priority: {
      low: tasks.filter((task: any) => task.priority === 'low').length,
      medium: tasks.filter((task: any) => task.priority === 'medium').length,
      high: tasks.filter((task: any) => task.priority === 'high').length,
      urgent: tasks.filter((task: any) => task.priority === 'urgent').length
    }
  }));
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.', errors: [] });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', error.name);
  res.status(500).json({ success: false, message: 'Internal server error.', errors: [] });
});

export default app;
