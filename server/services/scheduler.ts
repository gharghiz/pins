import cron from 'node-cron';
import { prisma } from '../db/index.js';
import { queuePinJob } from '../services/queue.js';
import { updateLearningData } from '../services/learning.js';
import logger from '../utils/logger.js';

// Initialize scheduled tasks
export function initScheduler(): void {
  logger.info('Initializing scheduler...');

  // Task 1: Generate daily topics for active users (every day at 6 AM)
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running daily topic generation...');
    await generateDailyTopics();
  });

  // Task 2: Fetch analytics for all users (every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running analytics fetch...');
    await fetchAllAnalytics();
  });

  // Task 3: Auto-generate pins for active users (every hour during schedule window)
  cron.schedule('0 * * * *', async () => {
    logger.info('Running auto pin generation...');
    await autoGeneratePins();
  });

  // Task 4: Update learning data (every 12 hours)
  cron.schedule('0 */12 * * *', async () => {
    logger.info('Running learning data update...');
    await updateAllLearningData();
  });

  // Task 5: Clean up old jobs (every day at 3 AM)
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running cleanup...');
    await cleanupOldJobs();
  });

  logger.info('Scheduler initialized');
}

// Generate daily topics for all active users
async function generateDailyTopics(): Promise<void> {
  try {
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        niche: { not: null },
      },
      select: { id: true, niche: true },
    });

    for (const user of activeUsers) {
      try {
        await queuePinJob(user.id, '', 'GENERATE_TOPICS');
        logger.info(`Queued topic generation for user ${user.id}`);
      } catch (error) {
        logger.error(`Failed to queue topics for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Daily topic generation error:', error);
  }
}

// Fetch analytics for all users
async function fetchAllAnalytics(): Promise<void> {
  try {
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const user of activeUsers) {
      try {
        await queuePinJob(user.id, '', 'FETCH_ANALYTICS');
        logger.info(`Queued analytics fetch for user ${user.id}`);
      } catch (error) {
        logger.error(`Failed to queue analytics for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Fetch all analytics error:', error);
  }
}

// Auto-generate pins based on user settings
async function autoGeneratePins(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        niche: { not: null },
        scheduleStart: { lte: currentHour },
        scheduleEnd: { gt: currentHour },
      },
      select: {
        id: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
      },
    });

    for (const user of activeUsers) {
      try {
        // Check how many pins user has generated today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayPins = await prisma.pin.count({
          where: {
            userId: user.id,
            createdAt: { gte: today },
          },
        });

        // Calculate how many pins to generate this hour
        const scheduleHours = user.scheduleEnd - user.scheduleStart;
        const pinsPerHour = Math.ceil(user.postsPerDay / scheduleHours);
        const pinsToGenerate = Math.max(0, pinsPerHour - (todayPins % pinsPerHour));

        if (pinsToGenerate > 0) {
          // Get available topics
          const availableTopics = await prisma.topic.findMany({
            where: {
              userId: user.id,
              isUsed: false,
            },
            take: pinsToGenerate,
          });

          for (const topic of availableTopics) {
            // Create pin
            const pin = await prisma.pin.create({
              data: {
                userId: user.id,
                title: `Generating: ${topic.title}`,
                description: 'Content being generated...',
                tags: [],
                keywords: [],
                status: 'PENDING',
                topic: topic.title,
              },
            });

            // Mark topic as used
            await prisma.topic.update({
              where: { id: topic.id },
              data: { isUsed: true, usedAt: new Date() },
            });

            // Queue pin generation with random delay (anti-spam)
            const delay = Math.floor(Math.random() * 30 * 60 * 1000); // 0-30 minutes
            setTimeout(async () => {
              await queuePinJob(user.id, pin.id, 'GENERATE_PIN');
            }, delay);

            logger.info(`Queued pin generation for topic: ${topic.title}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to auto-generate pins for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Auto generate pins error:', error);
  }
}

// Update learning data for all users
async function updateAllLearningData(): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await updateLearningData(user.id);
      } catch (error) {
        logger.error(`Failed to update learning data for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Update all learning data error:', error);
  }
}

// Clean up old completed jobs
async function cleanupOldJobs(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.job.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        completedAt: { lt: thirtyDaysAgo },
      },
    });

    logger.info(`Cleaned up ${result.count} old jobs`);
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}
