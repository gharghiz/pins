import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import logger from '../utils/logger.js';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FREE_LIMIT = 100;
const BASIC_LIMIT = 500;
const PRO_LIMIT = 2000;
const ENTERPRISE_LIMIT = 10000;

export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id || req.ip || 'anonymous';
    const userPlan = (req as any).user?.plan || 'FREE';
    
    const limits: { [key: string]: number } = {
      FREE: FREE_LIMIT,
      BASIC: BASIC_LIMIT,
      PRO: PRO_LIMIT,
      ENTERPRISE: ENTERPRISE_LIMIT,
    };

    const limit = limits[userPlan] || FREE_LIMIT;
    const now = Date.now();

    if (!store[userId] || now > store[userId].resetAt) {
      store[userId] = {
        count: 0,
        resetAt: now + WINDOW_MS,
      };
    }

    store[userId].count++;

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - store[userId].count));
    res.setHeader('X-RateLimit-Reset', store[userId].resetAt);

    if (store[userId].count > limit) {
      logger.warn(`Rate limit exceeded for user ${userId}`);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${limit} per hour`,
        retryAfter: Math.ceil((store[userId].resetAt - now) / 1000),
      });
    }

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    next();
  }
};

export const apiUsageTracker = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return next();
    }

    await prisma.apiUsage.upsert({
      where: { userId },
      update: { apiCalls: { increment: 1 } },
      create: {
        userId,
        apiCalls: 1,
        aiCalls: 0,
        pinGenerations: 0,
        imageGenerations: 0,
      },
    });

    next();
  } catch (error) {
    logger.error('API usage tracking error:', error);
    next();
  }
};
