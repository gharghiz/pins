import { Queue } from 'bullmq';
import { AIService } from '../services/aiService.js';
import { PinterestService } from '../services/pinterestService.js';
import { Pin } from '../models/index.js';

const AI_SERVICE = new AIService();
const PINTEREST_SERVICE = new PinterestService();
const PIN_MODEL = new Pin(null); // Will be initialized with DB connection

// Create queues
export const pinQueue = new Queue('pins', {
  connection: { host: 'localhost', port: 6379 }
});

export const imageQueue = new Queue('images', {
  connection: { host: 'localhost', port: 6379 }
});

// Worker process for pin generation and posting
export async function processPinJob(job) {
  const { userId, topic, boardId, count = 1 } = job.data;
  
  try {
    // Update progress
    await job.updateProgress(25);
    
    // Generate pin content
    const pinData = await AI_SERVICE.generatePinContent(topic);
    await job.updateProgress(50);
    
    // Generate image (placeholder for now)
    const imageUrl = `https://placehold.co/1000x1500/0077cc/white?text=${encodeURIComponent(pinData.title)}`;
    await job.updateProgress(75);
    
    // Create pin on Pinterest
    const result = await PINTEREST_SERVICE.createPin({
      ...pinData,
      boardId,
      imageUrl
    });
    await job.updateProgress(100);
    
    return { success: true, pin: result };
  } catch (error) {
    throw new Error(`Pin job failed: ${error.message}`);
  }
}

// Worker process for bulk jobs
export async function processBulkJob(job) {
  const { topics, boardId, userId, delayMs = 30000 } = job.data;
  
  try {
    const results = [];
    
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      await job.updateProgress(Math.round((i / topics.length) * 100));
      
      try {
        const pinData = await AI_SERVICE.generatePinContent(topic);
        const imageUrl = `https://placehold.co/1000x1500/0077cc/white?text=${encodeURIComponent(pinData.title)}`;
        
        const result = await PINTEREST_SERVICE.createPin({
          ...pinData,
          boardId,
          imageUrl
        });
        
        results.push({ topic, success: true, pin: result });
      } catch (error) {
        results.push({ topic, success: false, error: error.message });
      }
      
      // Delay between posts
      if (i < topics.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return { success: true, results };
  } catch (error) {
    throw new Error(`Bulk job failed: ${error.message}`);
  }
}

// Worker process for image generation
export async function processImageJob(job) {
  const { prompt, width = 1000, height = 1500 } = job.data;
  
  try {
    // In production, call DALL-E or similar API
    // For now, return a placeholder
    const imageUrl = `https://placehold.co/${width}x${height}/0077cc/white?text=${encodeURIComponent(prompt.substring(0, 50))}`;
    return { success: true, imageUrl };
  } catch (error) {
    throw new Error(`Image generation failed: ${error.message}`);
  }
}