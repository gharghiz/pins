import { config } from 'dotenv';

config();

export const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Keys (backend only - NEVER expose to frontend)
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  pinterestClientId: process.env.PINTEREST_CLIENT_ID,
  pinterestClientSecret: process.env.PINTEREST_CLIENT_SECRET,
  pinterestAccessToken: process.env.PINTEREST_ACCESS_TOKEN,
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/pinterest_ai',
  
  // Redis for BullMQ
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};