import { Job } from 'bullmq';
import { prisma } from '../db/index.js';
import { fetchPinterestAnalytics, simulatePinterestAnalytics } from '../services/pinterest.js';
import { updateLearningData } from '../services/learning.js';
import { updateJobStatus } from '../services/queue.js';
import logger from '../utils/logger.js';

interface FetchAnalyticsData {
  userId: string;
  pinId?: string; // If not provided, fetch for all user's pins
}

export async function processFetchAnalyticsJob(job: Job): Promise<any> {
  const { userId, pinId } = job.data as FetchAnalyticsData;

  try {
    logger.info(`Processing analytics fetch job: ${job.id}`);

    await updateJobStatus(job.id, 'PROCESSING', 10);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get pins to fetch analytics for
    let pins;
    if (pinId) {
      const pin = await prisma.pin.findUnique({
        where: { id: pinId },
      });
      pins = pin ? [pin] : [];
    } else {
      // Fetch for all published pins
      pins = await prisma.pin.findMany({
        where: {
          userId,
          status: 'PUBLISHED',
          pinId: { not: null },
        },
      });
    }

    if (pins.length === 0) {
      logger.info('No pins to fetch analytics for');
      await updateJobStatus(job.id, 'COMPLETED', 100);
      return { success: true, fetched: 0 };
    }

    await updateJobStatus(job.id, 'PROCESSING', 30);

    let fetchedCount = 0;
    const totalPins = pins.length;

    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const progress = 30 + Math.round((i / totalPins) * 60);
      await updateJobStatus(job.id, 'PROCESSING', progress);

      try {
        let analytics;

        if (user.pinterestToken) {
          // Fetch from Pinterest API
          analytics = await fetchPinterestAnalytics(user.pinterestToken, pin.pinId!);
        } else {
          // Simulate analytics for demo
          analytics = simulatePinterestAnalytics();
        }

        if (analytics) {
          // Upsert analytics record
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
              userId,
              ...analytics,
            },
          });

          fetchedCount++;
        }
      } catch (error) {
        logger.warn(`Failed to fetch analytics for pin ${pin.id}:`, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await updateJobStatus(job.id, 'PROCESSING', 95);

    // Update learning data with new analytics
    await updateLearningData(userId);

    await updateJobStatus(job.id, 'PROCESSING', 100);

    logger.info(`Analytics fetch completed: ${fetchedCount}/${totalPins} pins`);

    return {
      success: true,
      fetched: fetchedCount,
      total: totalPins,
    };
  } catch (error: any) {
    logger.error('Fetch analytics job error:', error);
    throw error;
  }
}
