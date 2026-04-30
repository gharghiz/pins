import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/index.js';
import logger from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      id: string;
      email: string;
      plan: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, plan: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const checkPlanLimit = (requiredPlan: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const planOrder = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };
    const userPlanLevel = planOrder[req.user.plan as keyof typeof planOrder] || 0;
    const requiredLevel = Math.max(...requiredPlan.map(p => planOrder[p as keyof typeof planOrder] || 0));

    if (userPlanLevel < requiredLevel) {
      return res.status(403).json({ 
        error: 'Upgrade required',
        message: `This feature requires ${requiredPlan.join(' or ')} plan`
      });
    }

    next();
  };
};
