import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import AuthSession from '../models/session.model.js';
import { env } from '../config/env.js';
import { hashTokenId } from '../utils/token.js';

export type AuthenticatedRequest = Request & {
  user?: {
    _id: string;
    email: string;
    fullName: string;
    role?: string;
  };
};

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[env.COOKIE_NAME] ?? null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required.', errors: [] });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.jti !== 'string') {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.', errors: [] });
    }

    const session = await AuthSession.findOne({
      user: decoded.sub,
      tokenHash: hashTokenId(decoded.jti),
      expiresAt: { $gt: new Date() }
    }).select('_id');
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.', errors: [] });
    }

    const user = await User.findById(decoded.sub).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Session is invalid or user was not found.', errors: [] });
    }

    req.user = {
      _id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      role: 'member'
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.', errors: [] });
    }
    return next(error);
  }
};
