import express from 'express';
import { AIService } from '../services/aiService.js';
import { PinterestService } from '../services/pinterestService.js';
import { Pin } from '../models/index.js';
import { pinQueue, processPinJob, processBulkJob, processImageJob } from '../workers/pinWorker.js';

const router = express.Router();
const AI_SERVICE = new AIService();
const PINTEREST_SERVICE = new PinterestService();

// ============= PINS =============
// Create a pin
router.post('/pins', async (req, res) => {
  try {
    const { userId, title, description, tags, boardId, imageUrl } = req.body;
    
    const pin = await Pin.create({
      userId, title, description, tags, boardId, imageUrl, status: 'pending'
    });
    
    res.status(201).json(pin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pins
router.get('/pins', async (req, res) => {
  try {
    const { userId } = req.query;
    const pins = await Pin.findAll(userId);
    res.json(pins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update pin
router.put('/pins/:id', async (req, res) => {
  try {
    const pin = await Pin.update(req.params.id, req.body);
    res.json(pin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete pin
router.delete('/pins/:id', async (req, res) => {
  try {
    await Pin.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= JOBS =============
// Create AI generation job
router.post('/jobs/generate', async (req, res) => {
  try {
    const { userId, topic, boardId } = req.body;
    
    const job = await Job.create({
      userId,
      type: 'generate',
      status: 'pending'
    });
    
    // Add to queue
    const queueJob = await pinQueue.add('generate', { userId, topic, boardId }, {
      jobId: `job_${Date.now()}`,
      progress: 0
    });
    
    res.status(201).json({ jobId: queueJob.id, ...job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create bulk posting job
router.post('/jobs/bulk', async (req, res) => {
  try {
    const { userId, topics, boardId, delayMs } = req.body;
    
    const job = await Job.create({
      userId,
      type: 'bulk',
      status: 'pending'
    });
    
    // Add to queue
    const queueJob = await pinQueue.add('bulk', { userId, topics, boardId, delayMs }, {
      jobId: `bulk_${Date.now()}`
    });
    
    res.status(201).json({ jobId: queueJob.id, ...job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job status
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs
router.get('/jobs', async (req, res) => {
  try {
    const { userId } = req.query;
    const jobs = await Job.findAll(userId);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry job
router.post('/jobs/:id/retry', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    // Re-add to queue
    const queueJob = await pinQueue.add(job.type, job.data, {
      jobId: `retry_${Date.now()}`
    });
    res.json({ success: true, jobId: queueJob.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= AI =============
// Generate pin content
router.post('/ai/generate', async (req, res) => {
  try {
    const { topic } = req.body;
    const content = await AI_SERVICE.generatePinContent(topic);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze SEO
router.post('/ai/analyze', async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    const analysis = await AI_SERVICE.analyzeSEO(title, description, tags);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate viral topics
router.post('/ai/topics', async (req, res) => {
  try {
    const { category, count } = req.body;
    const topics = await AI_SERVICE.generateViralTopics(category, count);
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate image prompt
router.post('/ai/image-prompt', async (req, res) => {
  try {
    const { topic, style } = req.body;
    const prompt = await AI_SERVICE.generateImagePrompt(topic, style);
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= PINTEREST =============
// Validate token
router.get('/pinterest/token/validate', async (req, res) => {
  try {
    const result = await PINTEREST_SERVICE.validateToken();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch boards
router.get('/pinterest/boards', async (req, res) => {
  try {
    const boards = await PINTEREST_SERVICE.fetchBoards();
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create pin
router.post('/pinterest/pins', async (req, res) => {
  try {
    const result = await PINTEREST_SERVICE.createPin(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= ANALYTICS =============
// Get dashboard stats
router.get('/analytics/stats', async (req, res) => {
  try {
    const { userId } = req.query;
    const stats = await Analytics.getStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top tags
router.get('/analytics/tags', async (req, res) => {
  try {
    const { userId } = req.query;
    const tags = await Analytics.getTopTags(userId);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Placeholder for Job model (in production, use proper DB)
const Job = {
  create: async (data) => ({ id: Date.now(), ...data }),
  findById: async (id) => ({ id, status: 'pending', progress: 0 }),
  findAll: async (userId) => [],
  update: async (id, data) => ({ id, ...data })
};

// Placeholder for Analytics model
const Analytics = {
  getStats: async (userId) => ({
    total_pins: 0,
    published: 0,
    errors: 0,
    today_activity: 0
  }),
  getTopTags: async (userId) => []
};

export default router;