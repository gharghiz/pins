import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { AuthRequest } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

const apiKeysSchema = z.object({
  pinterestToken: z.string().optional(),
  openaiKey: z.string().optional(),
  geminiKey: z.string().optional(),
  aiProvider: z.enum(['OPENAI', 'GEMINI', 'CLAUDE']).optional(),
});

// Get API keys status (not the actual keys for security)
router.get('/api-keys', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        pinterestToken: true,
        openaiKey: true,
        geminiKey: true,
        aiProvider: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      hasPinterestToken: !!user.pinterestToken,
      hasOpenaiKey: !!user.openaiKey,
      hasGeminiKey: !!user.geminiKey,
      aiProvider: user.aiProvider,
    });
  } catch (error) {
    logger.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

// Update API keys
router.put('/api-keys', validate(apiKeysSchema), async (req: AuthRequest, res) => {
  try {
    const { pinterestToken, openaiKey, geminiKey, aiProvider } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        pinterestToken,
        openaiKey,
        geminiKey,
        aiProvider,
      },
      select: {
        id: true,
        aiProvider: true,
      },
    });

    logger.info(`User ${req.user!.id} updated API keys`);
    res.json({
      message: 'API keys updated successfully',
      aiProvider: user.aiProvider,
    });
  } catch (error) {
    logger.error('Update API keys error:', error);
    res.status(500).json({ error: 'Failed to update API keys' });
  }
});

// Validate Pinterest token
router.post('/validate-pinterest', async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // In production, this would validate against Pinterest API
    // For now, we'll do a basic format check
    const isValid = token && token.length > 10;

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    res.json({ valid: true, message: 'Token appears valid' });
  } catch (error) {
    logger.error('Validate Pinterest error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// Get automation settings
router.get('/automation', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        niche: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      automation: {
        enabled: user.isActive,
        niche: user.niche,
        postsPerDay: user.postsPerDay,
        scheduleStart: user.scheduleStart,
        scheduleEnd: user.scheduleEnd,
      },
    });
  } catch (error) {
    logger.error('Get automation error:', error);
    res.status(500).json({ error: 'Failed to get automation settings' });
  }
});

// Update automation settings
router.put('/automation', async (req: AuthRequest, res) => {
  try {
    const { niche, postsPerDay, scheduleStart, scheduleEnd, enabled } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        niche,
        postsPerDay,
        scheduleStart,
        scheduleEnd,
        isActive: enabled !== undefined ? enabled : undefined,
      },
      select: {
        niche: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
        isActive: true,
      },
    });

    logger.info(`User ${req.user!.id} updated automation settings`);
    res.json({
      message: 'Automation settings updated',
      automation: user,
    });
  } catch (error) {
    logger.error('Update automation error:', error);
    res.status(500).json({ error: 'Failed to update automation settings' });
  }
});

export default router;
