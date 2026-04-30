import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../db/index.js';
import logger from '../utils/logger.js';
import { processGeneratePinJob } from '../workers/generatePin.js';
import { processPublishPinJob } from '../workers/publishPin.js';
import { processFetchAnalyticsJob } from '../workers/fetchAnalytics.js';
import { processGenerateTopicsJob } from '../workers/generateTopics.js';

let pinQueue: Queue;
let analyticsQueue: Queue;
let workers: Worker[] = [];

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Queue connection (simulated for demo without Redis)
const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// Initialize queues and workers
export async function initQueue(): Promise<void> {
  try {
    // In demo mode, we'll use in-memory simulation
    // In production, use actual Redis
    logger.info('Queue system initialized (demo mode)');
    
    // Initialize workers for different job types
    await initWorkers();
  } catch (error) {
    logger.error('Queue initialization error:', error);
    // Continue without queue in demo mode
  }
}

// Initialize workers
async function initWorkers(): Promise<void> {
  // Worker for pin generation
  const generateWorker = new Worker(
    'pin-generation',
    async (job: Job) => {
      await processGeneratePinJob(job);
    },
    { connection }
  );

  generateWorker.on('completed', async (job: Job) => {
    logger.info(`Job ${job.id} completed`);
    await updateJobStatus(job.id, 'COMPLETED', 100, job.returnvalue);
  });

  generateWorker.on('failed', async (job: Job, err: Error) => {
    logger.error(`Job ${job.id} failed:`, err);
    await handleJobFailure(job.id, err);
  });

  // Worker for pin publishing
  const publishWorker = new Worker(
    'pin-publishing',
    async (job: Job) => {
      await processPublishPinJob(job);
    },
    { connection }
  );

  publishWorker.on('completed', async (job: Job) => {
    await updateJobStatus(job.id, 'COMPLETED', 100, job.returnvalue);
  });

  publishWorker.on('failed', async (job: Job, err: Error) => {
    await handleJobFailure(job.id, err);
  });

  // Worker for analytics fetching
  const analyticsWorker = new Worker(
    'analytics-fetch',
    async (job: Job) => {
      await processFetchAnalyticsJob(job);
    },
    { connection }
  );

  analyticsWorker.on('completed', async (job: Job) => {
    await updateJobStatus(job.id, 'COMPLETED', 100, job.returnvalue);
  });

  analyticsWorker.on('failed', async (job: Job, err: Error) => {
    await handleJobFailure(job.id, err);
  });

  // Worker for topic generation
  const topicsWorker = new Worker(
    'topic-generation',
    async (job: Job) => {
      await processGenerateTopicsJob(job);
    },
    { connection }
  );

  topicsWorker.on('completed', async (job: Job) => {
    await updateJobStatus(job.id, 'COMPLETED', 100, job.returnvalue);
  });

  topicsWorker.on('failed', async (job: Job, err: Error) => {
    await handleJobFailure(job.id, err);
  });

  workers = [generateWorker, publishWorker, analyticsWorker, topicsWorker];
  logger.info('All workers initialized');
}

// Queue a pin job
export async function queuePinJob(
  userId: string,
  pinId: string,
  type: 'GENERATE_PIN' | 'PUBLISH_PIN' | 'FETCH_ANALYTICS' | 'GENERATE_TOPICS',
  scheduledAt?: string
): Promise<any> {
  try {
    // Create job record in database
    const job = await prisma.job.create({
      data: {
        userId,
        pinId,
        type,
        status: 'PENDING',
        priority: getUserPriority(userId),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      },
    });

    logger.info(`Job queued: ${job.id} (${type})`);

    // In demo mode, process immediately or schedule
    if (scheduledAt) {
      // Schedule for later
      const delay = new Date(scheduledAt).getTime() - Date.now();
      if (delay > 0) {
        setTimeout(() => processJob(job), delay);
      }
    } else {
      // Process soon with small delay to simulate queue
      setTimeout(() => processJob(job), Math.random() * 5000);
    }

    return job;
  } catch (error) {
    logger.error('Queue job error:', error);
    throw error;
  }
}

// Get user priority based on plan
function getUserPriority(userId: string): number {
  const priorities: { [key: string]: number } = {
    FREE: 0,
    BASIC: 1,
    PRO: 2,
    ENTERPRISE: 3,
  };
  // Default to 0, will be updated when job is processed
  return 0;
}

// Process a job (demo mode simulation)
async function processJob(job: any): Promise<void> {
  try {
    await updateJobStatus(job.id, 'PROCESSING', 10);

    const user = await prisma.user.findUnique({
      where: { id: job.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has required tokens
    if (job.type === 'PUBLISH_PIN' && !user.pinterestToken) {
      throw new Error('Pinterest token not configured');
    }

    // Process based on job type
    switch (job.type) {
      case 'GENERATE_PIN':
        await processGeneratePinJob(job);
        break;
      case 'PUBLISH_PIN':
        await processPublishPinJob(job);
        break;
      case 'FETCH_ANALYTICS':
        await processFetchAnalyticsJob(job);
        break;
      case 'GENERATE_TOPICS':
        await processGenerateTopicsJob(job);
        break;
    }

    await updateJobStatus(job.id, 'COMPLETED', 100);
  } catch (error: any) {
    logger.error('Process job error:', error);
    await handleJobFailure(job.id, error);
  }
}

// Update job status in database
export async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  result?: any
): Promise<void> {
  try {
    const updateData: any = {
      status,
      progress,
    };

    if (status === 'PROCESSING') {
      updateData.startedAt = new Date();
    }

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateData.completedAt = new Date();
    }

    if (result) {
      updateData.result = result;
    }

    await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });
  } catch (error) {
    logger.error('Update job status error:', error);
  }
}

// Handle job failure with retry logic
async function handleJobFailure(jobId: string, error: Error): Promise<void> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    const newAttempts = job.attempts + 1;

    if (newAttempts < job.maxAttempts) {
      // Retry with exponential backoff
      const backoffDelay = Math.min(1000 * Math.pow(2, newAttempts), 30000);
      
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'RETRY',
          attempts: newAttempts,
          error: error.message,
          scheduledAt: new Date(Date.now() + backoffDelay),
        },
      });

      logger.info(`Job ${jobId} scheduled for retry ${newAttempts}/${job.maxAttempts}`);

      // Schedule retry
      setTimeout(() => processJob(job), backoffDelay);
    } else {
      // Max attempts reached
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          attempts: newAttempts,
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Update pin status if applicable
      if (job.pinId) {
        await prisma.pin.update({
          where: { id: job.pinId },
          data: { status: 'FAILED' },
        });
      }

      logger.error(`Job ${jobId} failed after ${newAttempts} attempts`);
    }
  } catch (retryError) {
    logger.error('Handle job failure error:', retryError);
  }
}

// Cancel a job
export async function cancelJob(jobId: string): Promise<void> {
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });
    logger.info(`Job cancelled: ${jobId}`);
  } catch (error) {
    logger.error('Cancel job error:', error);
  }
}

// Get queue stats
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.job.count({ where: { status: 'PENDING' } }),
      prisma.job.count({ where: { status: 'PROCESSING' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: 'FAILED' } }),
    ]);

    return { pending, processing, completed, failed };
  } catch (error) {
    logger.error('Get queue stats error:', error);
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

// Close workers on shutdown
export async function closeQueue(): Promise<void> {
  try {
    for (const worker of workers) {
      await worker.close();
    }
    logger.info('Queue workers closed');
  } catch (error) {
    logger.error('Close queue error:', error);
  }
}
