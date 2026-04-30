import { Router } from 'express';
import { prisma } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { fetchPinterestAnalytics } from '../services/pinterest.js';
import { updateLearningData } from '../services/learning.js';
import logger from '../utils/logger.js';

const router = Router();

// Get overall analytics summary
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const analytics = await prisma.analytics.findMany({
      where: { userId: req.user!.id },
    });

    const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
    const totalClicks = analytics.reduce((sum, a) => sum + a.clicks, 0);
    const totalSaves = analytics.reduce((sum, a) => sum + a.saves, 0);
    const avgCTR = analytics.length > 0 
      ? analytics.reduce((sum, a) => sum + a.ctr, 0) / analytics.length 
      : 0;

    const pinCount = await prisma.pin.count({
      where: { userId: req.user!.id },
    });

    const publishedCount = await prisma.pin.count({
      where: { userId: req.user!.id, status: 'PUBLISHED' },
    });

    res.json({
      summary: {
        totalPins: pinCount,
        publishedPins: publishedCount,
        totalImpressions,
        totalClicks,
        totalSaves,
        avgCTR: Math.round(avgCTR * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Get analytics summary error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get analytics over time
router.get('/timeline', async (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const analytics = await prisma.analytics.findMany({
      where: {
        userId: req.user!.id,
        fetchedAt: { gte: startDate },
      },
      include: {
        pin: {
          select: {
            title: true,
            publishedAt: true,
            topic: true,
          },
        },
      },
      orderBy: { fetchedAt: 'desc' },
    });

    // Group by date for timeline
    const timeline: { [key: string]: any } = {};
    analytics.forEach(a => {
      const date = a.fetchedAt.toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = {
          date,
          impressions: 0,
          clicks: 0,
          saves: 0,
          pins: 0,
        };
      }
      timeline[date].impressions += a.impressions;
      timeline[date].clicks += a.clicks;
      timeline[date].saves += a.saves;
      timeline[date].pins += 1;
    });

    res.json({
      timeline: Object.values(timeline).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    });
  } catch (error) {
    logger.error('Get analytics timeline error:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// Get top performing pins
router.get('/top-pins', async (req: AuthRequest, res) => {
  try {
    const { limit = '10', metric = 'impressions' } = req.query;

    const analytics = await prisma.analytics.findMany({
      where: { userId: req.user!.id },
      include: {
        pin: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            topic: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { [metric as string]: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({
      topPins: analytics.map(a => ({
        ...a,
        performance: {
          impressions: a.impressions,
          clicks: a.clicks,
          saves: a.saves,
          ctr: a.ctr,
        },
      })),
    });
  } catch (error) {
    logger.error('Get top pins error:', error);
    res.status(500).json({ error: 'Failed to get top pins' });
  }
});

// Get learning insights
router.get('/insights', async (req: AuthRequest, res) => {
  try {
    const learningData = await prisma.learningData.findUnique({
      where: { userId: req.user!.id },
    });

    if (!learningData) {
      return res.json({
        insights: {
          topKeywords: [],
          topTags: [],
          bestTitles: [],
          avgCTR: 0,
          avgSaves: 0,
          totalPins: 0,
          successfulPins: 0,
          successRate: 0,
        },
      });
    }

    const successRate = learningData.totalPins > 0
      ? Math.round((learningData.successfulPins / learningData.totalPins) * 100)
      : 0;

    res.json({
      insights: {
        topKeywords: learningData.topKeywords,
        topTags: learningData.topTags,
        bestTitles: learningData.bestTitles,
        avgCTR: Math.round(learningData.avgCTR * 100) / 100,
        avgSaves: Math.round(learningData.avgSaves * 100) / 100,
        totalPins: learningData.totalPins,
        successfulPins: learningData.successfulPins,
        successRate,
        lastUpdated: learningData.lastUpdated,
      },
    });
  } catch (error) {
    logger.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// Manually fetch analytics for a pin
router.post('/fetch/:pinId', async (req: AuthRequest, res) => {
  try {
    const pin = await prisma.pin.findFirst({
      where: {
        id: req.params.pinId,
        userId: req.user!.id,
      },
    });

    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    if (!pin.pinId) {
      return res.status(400).json({ error: 'Pin not published yet' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user?.pinterestToken) {
      return res.status(400).json({ error: 'Pinterest token not configured' });
    }

    const analytics = await fetchPinterestAnalytics(user.pinterestToken, pin.pinId);

    if (analytics) {
      await prisma.analytics.upsert({
        where: { pinId: pin.id },
        update: {
          impressions: analytics.impressions,
          clicks: analytics.clicks,
          saves: analytics.saves,
          ctr: analytics.ctr,
          outbound: analytics.outbound,
          fetchedAt: new Date(),
        },
        create: {
          pinId: pin.id,
          userId: req.user!.id,
          ...analytics,
        },
      });

      // Update learning data
      await updateLearningData(req.user!.id);
    }

    res.json({ message: 'Analytics fetched successfully', analytics });
  } catch (error) {
    logger.error('Fetch analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get pin-specific analytics
router.get('/pin/:pinId', async (req: AuthRequest, res) => {
  try {
    const analytics = await prisma.analytics.findFirst({
      where: {
        pinId: req.params.pinId,
        pin: { userId: req.user!.id },
      },
      include: {
        pin: {
          select: {
            id: true,
            title: true,
            description: true,
            tags: true,
            keywords: true,
            imageUrl: true,
            status: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!analytics) {
      return res.status(404).json({ error: 'Analytics not found' });
    }

    res.json({ analytics });
  } catch (error) {
    logger.error('Get pin analytics error:', error);
    res.status(500).json({ error: 'Failed to get pin analytics' });
  }
});

export default router;
