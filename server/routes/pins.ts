import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { AuthRequest } from '../middleware/auth.js';
import { generatePinContent } from '../services/ai.js';
import { queuePinJob } from '../services/queue.js';
import logger from '../utils/logger.js';

const router = Router();

const createPinSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  topic: z.string().optional(),
});

const generatePinSchema = z.object({
  topic: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

// Get all pins for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    
    const pins = await prisma.pin.findMany({
      where: {
        userId: req.user!.id,
        status: status as any || undefined,
      },
      include: {
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const total = await prisma.pin.count({
      where: {
        userId: req.user!.id,
        status: status as any || undefined,
      },
    });

    res.json({
      pins,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Get pins error:', error);
    res.status(500).json({ error: 'Failed to get pins' });
  }
});

// Get single pin
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const pin = await prisma.pin.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        analytics: true,
        job: true,
      },
    });

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    res.json({ pin });
  } catch (error) {
    logger.error('Get pin error:', error);
    res.status(500).json({ error: 'Failed to get pin' });
  }
});

// Create pin manually
router.post('/', validate(createPinSchema), async (req: AuthRequest, res) => {
  try {
    const { title, description, tags, keywords, imageUrl, scheduledAt, topic } = req.body;

    const pin = await prisma.pin.create({
      data: {
        userId: req.user!.id,
        title,
        description,
        tags: tags || [],
        keywords: keywords || [],
        imageUrl,
        status: scheduledAt ? 'SCHEDULED' : 'PENDING',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        topic,
      },
    });

    // Queue for publishing if scheduled
    if (scheduledAt) {
      await queuePinJob(req.user!.id, pin.id, 'PUBLISH_PIN', scheduledAt);
    }

    logger.info(`Pin created: ${pin.id}`);
    res.status(201).json({ pin });
  } catch (error) {
    logger.error('Create pin error:', error);
    res.status(500).json({ error: 'Failed to create pin' });
  }
});

// Generate pin with AI
router.post('/generate', validate(generatePinSchema), async (req: AuthRequest, res) => {
  try {
    const { topic, scheduledAt } = req.body;

    // Get user's learning data for optimization
    const learningData = await prisma.learningData.findUnique({
      where: { userId: req.user!.id },
    });

    // Generate content using AI
    const content = await generatePinContent({
      topic,
      userId: req.user!.id,
      learningData: learningData || undefined,
    });

    const pin = await prisma.pin.create({
      data: {
        userId: req.user!.id,
        title: content.title,
        description: content.description,
        tags: content.tags,
        keywords: content.keywords,
        status: 'GENERATING',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        topic,
      },
    });

    // Queue for image generation and publishing
    await queuePinJob(req.user!.id, pin.id, 'GENERATE_PIN');

    logger.info(`Pin generation queued: ${pin.id}`);
    res.status(201).json({
      pin,
      message: 'Pin generation started',
    });
  } catch (error) {
    logger.error('Generate pin error:', error);
    res.status(500).json({ error: 'Failed to generate pin' });
  }
});

// Update pin
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { title, description, tags, keywords, status } = req.body;

    const pin = await prisma.pin.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    const updated = await prisma.pin.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        tags,
        keywords,
        status,
      },
    });

    res.json({ pin: updated });
  } catch (error) {
    logger.error('Update pin error:', error);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

// Delete pin
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const pin = await prisma.pin.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    await prisma.pin.delete({
      where: { id: req.params.id },
    });

    logger.info(`Pin deleted: ${req.params.id}`);
    res.json({ message: 'Pin deleted successfully' });
  } catch (error) {
    logger.error('Delete pin error:', error);
    res.status(500).json({ error: 'Failed to delete pin' });
  }
});

// Bulk generate pins
router.post('/bulk-generate', async (req: AuthRequest, res) => {
  try {
    const { topics, count = 5 } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'Topics array required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const learningData = await prisma.learningData.findUnique({
      where: { userId: req.user!.id },
    });

    const generatedPins = [];

    for (let i = 0; i < Math.min(topics.length, count); i++) {
      const topic = topics[i];
      
      const content = await generatePinContent({
        topic,
        userId: req.user!.id,
        learningData: learningData || undefined,
      });

      const pin = await prisma.pin.create({
        data: {
          userId: req.user!.id,
          title: content.title,
          description: content.description,
          tags: content.tags,
          keywords: content.keywords,
          status: 'GENERATING',
          topic,
        },
      });

      await queuePinJob(req.user!.id, pin.id, 'GENERATE_PIN');
      generatedPins.push(pin);
    }

    logger.info(`Bulk generated ${generatedPins.length} pins`);
    res.json({
      pins: generatedPins,
      message: `${generatedPins.length} pins queued for generation`,
    });
  } catch (error) {
    logger.error('Bulk generate error:', error);
    res.status(500).json({ error: 'Failed to bulk generate pins' });
  }
});

export default router;
