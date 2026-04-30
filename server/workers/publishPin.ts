import { Job } from 'bullmq';
import { prisma } from '../db/index.js';
import { publishPinToPinterest, simulatePinterestPublish } from '../services/pinterest.js';
import { updateJobStatus } from '../services/queue.js';
import { updateLearningData } from '../services/learning.js';
import logger from '../utils/logger.js';

interface PublishPinData {
  userId: string;
  pinId: string;
}

export async function processPublishPinJob(job: Job): Promise<any> {
  const { userId, pinId } = job.data as PublishPinData;

  try {
    logger.info(`Processing pin publish job: ${job.id}`);

    // Get pin details
    const pin = await prisma.pin.findUnique({
      where: { id: pinId },
      include: { user: true },
    });

    if (!pin) {
      throw new Error('Pin not found');
    }

    await updateJobStatus(job.id, 'PROCESSING', 20);

    // Check if pin has all required data
    if (!pin.imageUrl || !pin.title || !pin.description) {
      throw new Error('Pin missing required data');
    }

    // Check if user has Pinterest token
    if (!pin.user.pinterestToken) {
      // In demo mode, simulate publishing
      logger.info('No Pinterest token, using simulation');
      const result = simulatePinterestPublish({
        title: pin.title,
        description: pin.description,
        imageUrl: pin.imageUrl,
      });

      await updateJobStatus(job.id, 'PROCESSING', 60);

      // Update pin with simulated pinId
      await prisma.pin.update({
        where: { id: pinId },
        data: {
          pinId: result.pinId,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      await updateJobStatus(job.id, 'PROCESSING', 90);

      // Create initial analytics record
      await prisma.analytics.create({
        data: {
          pinId,
          userId,
          impressions: 0,
          clicks: 0,
          saves: 0,
          ctr: 0,
          outbound: 0,
        },
      });

      await updateJobStatus(job.id, 'PROCESSING', 100);

      logger.info(`Pin published (simulated): ${pinId}`);

      return {
        success: true,
        pinId,
        pinterestId: result.pinId,
        link: result.link,
        simulated: true,
      };
    }

    // Publish to Pinterest
    await updateJobStatus(job.id, 'PROCESSING', 40);

    const result = await publishPinToPinterest(pin.user.pinterestToken, {
      title: pin.title,
      description: pin.description,
      imageUrl: pin.imageUrl,
      boardId: pin.boardId || undefined,
    });

    await updateJobStatus(job.id, 'PROCESSING', 70);

    // Update pin with Pinterest pinId
    await prisma.pin.update({
      where: { id: pinId },
      data: {
        pinId: result.pinId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    await updateJobStatus(job.id, 'PROCESSING', 90);

    // Create initial analytics record
    await prisma.analytics.create({
      data: {
        pinId,
        userId,
        impressions: 0,
        clicks: 0,
        saves: 0,
        ctr: 0,
        outbound: 0,
      },
    });

    await updateJobStatus(job.id, 'PROCESSING', 100);

    logger.info(`Pin published to Pinterest: ${pinId} -> ${result.pinId}`);

    return {
      success: true,
      pinId,
      pinterestId: result.pinId,
      link: result.link,
      simulated: false,
    };
  } catch (error: any) {
    logger.error('Publish pin job error:', error);

    // Update pin status to failed
    await prisma.pin.update({
      where: { id: pinId },
      data: { status: 'FAILED' },
    });

    throw error;
  }
}
