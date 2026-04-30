import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { AuthRequest } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().optional(),
  niche: z.string().optional(),
  postsPerDay: z.number().min(1).max(50).optional(),
  scheduleStart: z.number().min(0).max(23).optional(),
  scheduleEnd: z.number().min(1).max(24).optional(),
});

// Get user profile
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        niche: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
        aiProvider: true,
        isActive: true,
        createdAt: true,
        lastActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', validate(updateProfileSchema), async (req: AuthRequest, res) => {
  try {
    const updates = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        niche: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
      },
    });

    logger.info(`User ${req.user!.id} updated profile`);
    res.json({ user });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get usage stats
router.get('/usage', async (req: AuthRequest, res) => {
  try {
    const usage = await prisma.apiUsage.findUnique({
      where: { userId: req.user!.id },
    });

    const pinCount = await prisma.pin.count({
      where: { userId: req.user!.id },
    });

    const publishedCount = await prisma.pin.count({
      where: { userId: req.user!.id, status: 'PUBLISHED' },
    });

    res.json({
      usage: usage || {
        aiCalls: 0,
        pinGenerations: 0,
        imageGenerations: 0,
        apiCalls: 0,
      },
      stats: {
        totalPins: pinCount,
        publishedPins: publishedCount,
      },
    });
  } catch (error) {
    logger.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
