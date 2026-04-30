import { Job } from 'bullmq';
import { prisma } from '../db/index.js';
import { generateTopics as generateAITopics } from '../services/ai.js';
import { updateJobStatus } from '../services/queue.js';
import logger from '../utils/logger.js';

interface GenerateTopicsData {
  userId: string;
  count?: number;
}

export async function processGenerateTopicsJob(job: Job): Promise<any> {
  const { userId, count = 10 } = job.data as GenerateTopicsData;

  try {
    logger.info(`Processing topic generation job: ${job.id}`);

    await updateJobStatus(job.id, 'PROCESSING', 20);

    // Get user's niche
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { niche: true },
    });

    if (!user?.niche) {
      throw new Error('User niche not set');
    }

    await updateJobStatus(job.id, 'PROCESSING', 40);

    // Generate topics using AI
    const topics = await generateAITopics(user.niche, count);

    await updateJobStatus(job.id, 'PROCESSING', 70);

    // Get previously used topics to avoid duplicates
    const usedTopics = await prisma.topic.findMany({
      where: {
        userId,
        isUsed: true,
      },
      select: { title: true },
    });

    const usedTitles = new Set(usedTopics.map(t => t.title));

    // Filter out used topics and save new ones
    const newTopics = topics.filter(t => !usedTitles.has(t));

    await updateJobStatus(job.id, 'PROCESSING', 85);

    // Save topics to database
    for (const topic of newTopics) {
      await prisma.topic.create({
        data: {
          userId,
          title: topic,
          keywords: topic.toLowerCase().split(' '),
          score: Math.random() * 100, // Initial score
        },
      });
    }

    await updateJobStatus(job.id, 'PROCESSING', 100);

    logger.info(`Generated ${newTopics.length} new topics for user ${userId}`);

    return {
      success: true,
      topics: newTopics,
      count: newTopics.length,
    };
  } catch (error: any) {
    logger.error('Generate topics job error:', error);
    throw error;
  }
}
