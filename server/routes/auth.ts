import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
      },
    });

    // Create API usage record
    await prisma.apiUsage.create({
      data: { userId: user.id },
    });

    // Create learning data record
    await prisma.learningData.create({
      data: {
        userId: user.id,
        topKeywords: [],
        topTags: [],
        bestTitles: [],
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      id: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        niche: true,
        postsPerDay: true,
        scheduleStart: true,
        scheduleEnd: true,
        aiProvider: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
