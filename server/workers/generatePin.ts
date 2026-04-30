import { Job } from 'bullmq';
import { prisma } from '../db/index.js';
import { generatePinContent, generateImagePrompt } from '../services/ai.js';
import { generateImage } from '../services/imageGenerator.js';
import { updateJobStatus } from '../services/queue.js';
import logger from '../utils/logger.js';

interface GeneratePinData {
  userId: string;
  pinId: string;
}

export async function processGeneratePinJob(job: Job): Promise<any> {
  const { userId, pinId } = job.data as GeneratePinData;

  try {
    logger.info(`Processing pin generation job: ${job.id}`);

    // Get pin details
    const pin = await prisma.pin.findUnique({
      where: { id: pinId },
    });

    if (!pin) {
      throw new Error('Pin not found');
    }

    await updateJobStatus(job.id, 'PROCESSING', 20);

    // Get user's learning data for optimization
    const learningData = await prisma.learningData.findUnique({
      where: { userId },
    });

    // Generate content using AI
    await updateJobStatus(job.id, 'PROCESSING', 30);
    const content = await generatePinContent({
      topic: pin.topic || pin.title,
      userId,
      learningData,
    });

    // Update pin with generated content
    await prisma.pin.update({
      where: { id: pinId },
      data: {
        title: content.title,
        description: content.description,
        tags: content.tags,
        keywords: content.keywords,
        status: 'GENERATING',
      },
    });

    await updateJobStatus(job.id, 'PROCESSING', 50);

    // Generate image
    const imagePrompt = generateImagePrompt(content.title, content.description);
    const imageUrl = await generateImage(imagePrompt, pinId);

    await updateJobStatus(job.id, 'PROCESSING', 80);

    // Update pin with image
    await prisma.pin.update({
      where: { id: pinId },
      data: {
        imageUrl,
        status: pin.scheduledAt ? 'SCHEDULED' : 'PENDING',
      },
    });

    await updateJobStatus(job.id, 'PROCESSING', 90);

    // If not scheduled, queue for publishing
    if (!pin.scheduledAt) {
      const { queuePinJob } = await import('../services/queue.js');
      await queuePinJob(userId, pinId, 'PUBLISH_PIN');
    }

    await updateJobStatus(job.id, 'PROCESSING', 100);

    logger.info(`Pin generation completed: ${pinId}`);

    return {
      success: true,
      pinId,
      title: content.title,
      imageUrl,
    };
  } catch (error: any) {
    logger.error('Generate pin job error:', error);

    // Update pin status to failed
    await prisma.pin.update({
      where: { id: pinId },
      data: { status: 'FAILED' },
    });

    throw error;
  }
}
