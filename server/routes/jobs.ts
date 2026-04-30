import { Router } from 'express';
import { prisma } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { queuePinJob, cancelJob } from '../services/queue.js';
import logger from '../utils/logger.js';

const router = Router();

// Get all jobs for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, type, page = '1', limit = '20' } = req.query;

    const jobs = await prisma.job.findMany({
      where: {
        userId: req.user!.id,
        status: status as any || undefined,
        type: type as any || undefined,
      },
      include: {
        pin: {
          select: {
            id: true,
            title: true,
            status: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const total = await prisma.job.count({
      where: {
        userId: req.user!.id,
        status: status as any || undefined,
        type: type as any || undefined,
      },
    });

    res.json({
      jobs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Get single job
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        pin: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    logger.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// Get active jobs summary
router.get('/summary/active', async (req: AuthRequest, res) => {
  try {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.job.count({
        where: { userId: req.user!.id, status: 'PENDING' },
      }),
      prisma.job.count({
        where: { userId: req.user!.id, status: 'PROCESSING' },
      }),
      prisma.job.count({
        where: { userId: req.user!.id, status: 'COMPLETED' },
      }),
      prisma.job.count({
        where: { userId: req.user!.id, status: 'FAILED' },
      }),
    ]);

    res.json({
      summary: {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed,
      },
    });
  } catch (error) {
    logger.error('Get jobs summary error:', error);
    res.status(500).json({ error: 'Failed to get jobs summary' });
  }
});

// Retry failed job
router.post('/:id/retry', async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Can only retry failed or cancelled jobs' });
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        error: null,
        scheduledAt: new Date(),
      },
    });

    // Re-queue the job
    await queuePinJob(req.user!.id, job.pinId || '', job.type);

    logger.info(`Job retried: ${job.id}`);
    res.json({ message: 'Job queued for retry' });
  } catch (error) {
    logger.error('Retry job error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

// Cancel job
router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel completed job' });
    }

    await cancelJob(job.id);

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'CANCELLED' },
    });

    logger.info(`Job cancelled: ${job.id}`);
    res.json({ message: 'Job cancelled' });
  } catch (error) {
    logger.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Trigger manual pin generation
router.post('/generate-pins', async (req: AuthRequest, res) => {
  try {
    const { count = 1 } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.niche) {
      return res.status(400).json({ 
        error: 'Niche not set',
        message: 'Please set your niche in settings first' 
      });
    }

    // Generate topics based on niche
    const topics = await generateTopicsForNiche(user.niche, count);

    const jobs = [];
    for (const topic of topics) {
      const pin = await prisma.pin.create({
        data: {
          userId: req.user!.id,
          title: `Generating: ${topic}`,
          description: 'Content being generated...',
          tags: [],
          keywords: [],
          status: 'PENDING',
          topic,
        },
      });

      const job = await queuePinJob(req.user!.id, pin.id, 'GENERATE_PIN');
      jobs.push({ pin, job });
    }

    logger.info(`Triggered generation of ${jobs.length} pins`);
    res.json({
      message: `Queued ${jobs.length} pins for generation`,
      jobs: jobs.map(j => ({ pinId: j.pin.id, jobId: j.job.id })),
    });
  } catch (error) {
    logger.error('Trigger generate error:', error);
    res.status(500).json({ error: 'Failed to trigger generation' });
  }
});

// Helper function to generate topics
async function generateTopicsForNiche(niche: string, count: number): Promise<string[]> {
  const topicTemplates: { [key: string]: string[] } = {
    fitness: [
      '10 Minute Home Workout',
      'Healthy Meal Prep Ideas',
      'Yoga for Beginners',
      'Weight Loss Tips',
      'Strength Training Guide',
    ],
    food: [
      'Easy Dinner Recipes',
      'Healthy Breakfast Ideas',
      'Quick Snack Recipes',
      'Dessert Recipes',
      'Meal Planning Tips',
    ],
    fashion: [
      'Summer Outfit Ideas',
      'Capsule Wardrobe Essentials',
      'Street Style Inspiration',
      'Budget Fashion Tips',
      'Accessory Styling Guide',
    ],
    travel: [
      'Budget Travel Tips',
      'Hidden Gem Destinations',
      'Packing Hacks',
      'Solo Travel Guide',
      'Weekend Getaway Ideas',
    ],
    home: [
      'Home Decor Ideas',
      'Organization Hacks',
      'DIY Home Projects',
      'Small Space Solutions',
      'Gardening Tips',
    ],
    business: [
      'Social Media Marketing',
      'Entrepreneur Tips',
      'Productivity Hacks',
      'Side Hustle Ideas',
      'Business Growth Strategies',
    ],
  };

  const nicheTopics = topicTemplates[niche.toLowerCase()] || [
    `${niche} Tips and Tricks`,
    `Best ${niche} Ideas for 2024`,
    `${niche} Inspiration`,
    `Ultimate ${niche} Guide`,
    `${niche} Trends`,
  ];

  // Return random selection
  const shuffled = nicheTopics.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default router;
