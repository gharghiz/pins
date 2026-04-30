import OpenAI from 'openai';
import { prisma } from '../db/index.js';
import { LearningData } from '@prisma/client';
import logger from '../utils/logger.js';

interface GeneratePinContentParams {
  topic: string;
  userId: string;
  learningData?: LearningData | null;
}

interface GeneratedContent {
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  imageUrl?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-demo-key',
});

// Generate pin content using AI
export async function generatePinContent(params: GeneratePinContentParams): Promise<GeneratedContent> {
  const { topic, userId, learningData } = params;

  try {
    // Get user's AI provider preference
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, openaiKey: true, geminiKey: true },
    });

    // Build optimization context from learning data
    let optimizationContext = '';
    if (learningData && learningData.topKeywords.length > 0) {
      optimizationContext = `
      
Based on your successful pins, incorporate these high-performing elements:
- Top Keywords: ${learningData.topKeywords.slice(0, 10).join(', ')}
- Top Tags: ${learningData.topTags.slice(0, 10).join(', ')}
- Best Title Patterns: ${learningData.bestTitles.slice(0, 3).join(' | ')}
- Average CTR of successful pins: ${(learningData.avgCTR * 100).toFixed(1)}%
`;
    }

    const prompt = `
You are a Pinterest content expert. Generate an optimized Pinterest pin for the topic: "${topic}"

Create content that:
1. Has a catchy, click-worthy title (under 60 characters)
2. Has a detailed, keyword-rich description (150-300 characters)
3. Includes 10-15 relevant hashtags
4. Includes 10-15 SEO keywords

${optimizationContext}

Format your response as JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["#tag1", "#tag2", ...],
  "keywords": ["keyword1", "keyword2", ...]
}

Make it engaging, actionable, and optimized for Pinterest's algorithm.
`;

    let content: GeneratedContent;

    // Try OpenAI first
    if (user?.aiProvider === 'OPENAI' || !user?.aiProvider) {
      try {
        const apiKey = user?.openaiKey || process.env.OPENAI_API_KEY;
        if (apiKey && apiKey !== 'sk-demo-key') {
          const customOpenAI = new OpenAI({ apiKey });
          const response = await customOpenAI.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          });

          const responseText = response.choices[0]?.message?.content || '';
          content = parseAIResponse(responseText);
        } else {
          content = generateFallbackContent(topic, learningData);
        }
      } catch (error) {
        logger.warn('OpenAI failed, using fallback:', error);
        content = generateFallbackContent(topic, learningData);
      }
    } else {
      content = generateFallbackContent(topic, learningData);
    }

    // Update API usage
    await prisma.apiUsage.update({
      where: { userId },
      data: { aiCalls: { increment: 1 }, pinGenerations: { increment: 1 } },
    });

    return content;
  } catch (error) {
    logger.error('Generate content error:', error);
    return generateFallbackContent(params.topic, params.learningData);
  }
}

// Generate image prompt for AI image generation
export function generateImagePrompt(title: string, description: string): string {
  return `
Create a Pinterest-optimized vertical image (2:3 aspect ratio) for: "${title}"

Style requirements:
- Bright, eye-catching colors
- Clean, modern design
- Text overlay with the title
- High contrast for mobile viewing
- Professional, polished look
- Include relevant visual elements related to the topic

Description context: ${description.substring(0, 200)}

The image should be scroll-stopping and encourage clicks.
`;
}

// Parse AI response to extract structured content
function parseAIResponse(responseText: string): GeneratedContent {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || 'Untitled Pin',
        description: parsed.description || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    }
  } catch (error) {
    logger.warn('Failed to parse AI response:', error);
  }

  // Fallback parsing
  const lines = responseText.split('\n');
  return {
    title: lines[0]?.replace(/["#]/g, '').trim() || 'Amazing Pin',
    description: lines.slice(1, 4).join(' ').trim(),
    tags: extractTags(responseText),
    keywords: extractKeywords(responseText),
  };
}

// Extract tags from text
function extractTags(text: string): string[] {
  const tagRegex = /#(\w+)/g;
  const matches = text.match(tagRegex) || [];
  return matches.slice(0, 15);
}

// Extract keywords from text
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const wordCount: { [key: string]: number } = {};
  words.forEach(w => {
    wordCount[w] = (wordCount[w] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// Fallback content generator (when AI is unavailable)
function generateFallbackContent(topic: string, learningData?: LearningData | null): GeneratedContent {
  const titleTemplates = [
    `${topic}: The Ultimate Guide`,
    `10 Best ${topic} Ideas for 2024`,
    `${topic} Tips You Need to Know`,
    `How to Master ${topic} in 30 Days`,
    `${topic} Inspiration & Ideas`,
    `The Complete ${topic} Handbook`,
    `${topic}: Everything You Need`,
    `Top ${topic} Trends Right Now`,
  ];

  const title = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

  const descriptions = [
    `Discover amazing ${topic} ideas and inspiration. Save this pin for later and follow for more ${topic.toLowerCase()} content!`,
    `Your go-to resource for ${topic}. Packed with tips, tricks, and inspiration. Don't forget to save!`,
    `Everything you need to know about ${topic}. Click to learn more and save for future reference.`,
    `Level up your ${topic} game with these proven strategies. Save this pin and share with friends!`,
  ];

  const description = descriptions[Math.floor(Math.random() * descriptions.length)];

  // Generate relevant tags based on topic
  const baseTags = [
    `#${topic.replace(/\s+/g, '')}`,
    `#${topic.replace(/\s+/g, '')}Tips`,
    `#${topic.replace(/\s+/g, '')}Ideas`,
    '#Inspiration',
    '#Tips',
    '#Guide',
    '#HowTo',
    '#Tutorial',
    '#DIY',
    '#Ideas',
    '#Trends2024',
    '#MustTry',
    '#LifeHacks',
    '#Creative',
    '#Inspo',
  ];

  // Add learning data tags if available
  const tags = learningData?.topTags?.length 
    ? [...learningData.topTags.slice(0, 5), ...baseTags.slice(0, 10)]
    : baseTags;

  // Generate keywords
  const topicWords = topic.toLowerCase().split(' ');
  const keywords = [
    topic.toLowerCase(),
    ...topicWords,
    'tips',
    'ideas',
    'guide',
    'tutorial',
    'inspiration',
    'how to',
    'best',
    'easy',
    'simple',
    'creative',
    'trends',
    '2024',
  ];

  return {
    title,
    description,
    tags: [...new Set(tags)],
    keywords: [...new Set(keywords)],
  };
}

// Generate topics based on niche
export async function generateTopics(niche: string, count: number = 10): Promise<string[]> {
  const topicCategories: { [key: string]: string[] } = {
    fitness: ['workout', 'nutrition', 'weight loss', 'muscle building', 'cardio', 'yoga', 'pilates', 'home gym'],
    food: ['recipes', 'meal prep', 'healthy eating', 'desserts', 'quick meals', 'cooking tips', 'baking'],
    fashion: ['outfit ideas', 'style tips', 'trends', 'wardrobe', 'accessories', 'seasonal fashion'],
    travel: ['destinations', 'travel tips', 'packing', 'budget travel', 'adventures', 'photography'],
    home: ['decor', 'organization', 'diy', 'gardening', 'cleaning', 'renovation', 'interior design'],
    business: ['marketing', 'entrepreneurship', 'productivity', 'finance', 'leadership', 'growth'],
    beauty: ['skincare', 'makeup', 'haircare', 'nails', 'wellness', 'self-care'],
    technology: ['gadgets', 'software', 'coding', 'ai', 'apps', 'reviews', 'tutorials'],
  };

  const categories = topicCategories[niche.toLowerCase()] || ['tips', 'ideas', 'guide', 'trends'];
  const modifiers = [
    'Best', 'Top 10', 'Ultimate', 'Easy', 'Quick', 'Simple', 
    'Advanced', 'Beginner', 'Professional', 'Creative',
    'Affordable', 'Luxury', 'Modern', 'Classic', 'Trending',
  ];

  const topics: string[] = [];
  while (topics.length < count) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    const topic = `${modifier} ${niche} ${category}`;
    if (!topics.includes(topic)) {
      topics.push(topic);
    }
  }

  return topics;
}
