import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { env } from '../config/env.js';
import AuthSession from '../models/session.model.js';
import { hashTokenId } from '../utils/token.js';

let mongoServer: MongoMemoryServer;
const authAgent = request.agent(app);
const credentials = {
  fullName: 'Alice Dupont',
  email: 'alice@example.com',
  password: 'Password123!',
  confirmPassword: 'Password123!'
};

describe('Auth API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(env.MONGODB_URI, { dbName: 'taskflow-auth-test' });
    await AuthSession.createIndexes();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });

  it('registers a user and sets an HTTP-only cookie', async () => {
    const response = await authAgent.post('/api/v1/auth/register').send(credentials);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(credentials.email);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);

    const token = response.headers['set-cookie'][0].split(';')[0].split('=').slice(1).join('=');
    const decoded = jwt.verify(token, env.JWT_SECRET);
    expect(typeof decoded).not.toBe('string');
    if (typeof decoded === 'string') throw new Error('Expected a JWT payload.');
    const session = await AuthSession.findOne({ tokenHash: hashTokenId(String(decoded.jti)) });
    expect(session).not.toBeNull();
    expect(session?.tokenHash).not.toBe(token);
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects invalid registration fields and mismatched passwords', async () => {
    const invalidEmail = await request(app).post('/api/v1/auth/register').send({
      ...credentials,
      email: 'invalid-email'
    });
    const missingName = await request(app).post('/api/v1/auth/register').send({
      ...credentials,
      fullName: ''
    });
    const mismatchedPassword = await request(app).post('/api/v1/auth/register').send({
      ...credentials,
      confirmPassword: 'Different123!'
    });

    expect(invalidEmail.status).toBe(400);
    expect(missingName.status).toBe(400);
    expect(mismatchedPassword.status).toBe(400);
  });

  it('rejects duplicate email addresses', async () => {
    const response = await request(app).post('/api/v1/auth/register').send(credentials);
    expect(response.status).toBe(409);
  });

  it('rejects invalid credentials and protects private routes', async () => {
    const invalidLogin = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: 'WrongPassword123!'
    });
    const unauthenticatedProfile = await request(app).get('/api/v1/auth/me');

    expect(invalidLogin.status).toBe(401);
    expect(unauthenticatedProfile.status).toBe(401);
  });

  it('loads the authenticated user and clears the cookie on logout', async () => {
    const login = await authAgent.post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const sessionCookie = login.headers['set-cookie'][0].split(';')[0];
    const profile = await authAgent.get('/api/v1/auth/me');
    const logout = await authAgent.post('/api/v1/auth/logout');
    const profileAfterLogout = await authAgent.get('/api/v1/auth/me');
    const replayedSession = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe(credentials.email);
    expect(logout.status).toBe(200);
    expect(profileAfterLogout.status).toBe(401);
    expect(replayedSession.status).toBe(401);
  });

  it('saves supported profile photos and rejects unsafe avatar URLs', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const avatarUrl = 'data:image/jpeg;base64,/9j/2Q==';
    const update = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl });
    const profile = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    const rejectedSvg = await request(app)
      .patch('/api/v1/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: 'data:image/svg+xml;base64,PHN2Zy8+' });

    expect(update.status).toBe(200);
    expect(profile.body.data.user.avatarUrl).toBe(avatarUrl);
    expect(rejectedSvg.status).toBe(400);
  });

  it('revokes only the session that logs out', async () => {
    const firstLogin = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const secondLogin = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const firstCookie = firstLogin.headers['set-cookie'][0].split(';')[0];
    const secondCookie = secondLogin.headers['set-cookie'][0].split(';')[0];

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', firstCookie);
    const revokedSession = await request(app).get('/api/v1/auth/me').set('Cookie', firstCookie);
    const otherSession = await request(app).get('/api/v1/auth/me').set('Cookie', secondCookie);

    expect(logout.status).toBe(200);
    expect(revokedSession.status).toBe(401);
    expect(otherSession.status).toBe(200);
  });

  it('creates an expiry index for stored sessions', async () => {
    const indexes = await AuthSession.collection.indexes();
    expect(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
  });

  it('revokes all existing sessions after a password change', async () => {
    const firstLogin = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const secondLogin = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: credentials.password
    });
    const firstCookie = firstLogin.headers['set-cookie'][0].split(';')[0];
    const secondCookie = secondLogin.headers['set-cookie'][0].split(';')[0];
    const passwordChange = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Cookie', firstCookie)
      .send({ currentPassword: credentials.password, newPassword: 'NewPassword123!' });

    const revokedFirst = await request(app).get('/api/v1/auth/me').set('Cookie', firstCookie);
    const revokedSecond = await request(app).get('/api/v1/auth/me').set('Cookie', secondCookie);
    const loginWithNewPassword = await request(app).post('/api/v1/auth/login').send({
      email: credentials.email,
      password: 'NewPassword123!'
    });

    expect(passwordChange.status).toBe(200);
    expect(revokedFirst.status).toBe(401);
    expect(revokedSecond.status).toBe(401);
    expect(loginWithNewPassword.status).toBe(200);
  }, 15_000);

  it('reports database readiness from the health check', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.database.status).toBe('connected');
  });
});
