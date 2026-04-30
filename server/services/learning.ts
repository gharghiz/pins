import { prisma } from '../db/index.js';
import logger from '../utils/logger.js';

interface PinPerformance {
  pinId: string;
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  impressions: number;
  clicks: number;
  saves: number;
  ctr: number;
}

// CTR threshold for considering a pin "successful"
const SUCCESS_CTR_THRESHOLD = 2.0; // 2%
const SUCCESS_SAVES_THRESHOLD = 50;

// Update learning data based on pin performance
export async function updateLearningData(userId: string): Promise<void> {
  try {
    // Get all pins with analytics for this user
    const pinsWithAnalytics = await prisma.pin.findMany({
      where: {
        userId,
        status: 'PUBLISHED',
      },
      include: {
        analytics: true,
      },
    });

    if (pinsWithAnalytics.length === 0) {
      return;
    }

    // Analyze performance
    const performances: PinPerformance[] = pinsWithAnalytics
      .filter(p => p.analytics)
      .map(p => ({
        pinId: p.id,
        title: p.title,
        description: p.description,
        tags: p.tags,
        keywords: p.keywords,
        impressions: p.analytics!.impressions,
        clicks: p.analytics!.clicks,
        saves: p.analytics!.saves,
        ctr: p.analytics!.ctr,
      }));

    // Identify successful pins
    const successfulPins = performances.filter(
      p => p.ctr >= SUCCESS_CTR_THRESHOLD || p.saves >= SUCCESS_SAVES_THRESHOLD
    );

    if (successfulPins.length === 0) {
      // Update with current stats but no insights yet
      await updateLearningDataStats(userId, performances, successfulPins.length);
      return;
    }

    // Extract patterns from successful pins
    const insights = extractInsights(successfulPins, performances);

    // Update learning data
    await prisma.learningData.upsert({
      where: { userId },
      update: {
        topKeywords: insights.topKeywords,
        topTags: insights.topTags,
        bestTitles: insights.bestTitles,
        avgCTR: insights.avgCTR,
        avgSaves: insights.avgSaves,
        totalPins: performances.length,
        successfulPins: successfulPins.length,
        lastUpdated: new Date(),
      },
      create: {
        userId,
        topKeywords: insights.topKeywords,
        topTags: insights.topTags,
        bestTitles: insights.bestTitles,
        avgCTR: insights.avgCTR,
        avgSaves: insights.avgSaves,
        totalPins: performances.length,
        successfulPins: successfulPins.length,
      },
    });

    logger.info(`Updated learning data for user ${userId}: ${successfulPins.length}/${performances.length} successful pins`);
  } catch (error) {
    logger.error('Update learning data error:', error);
  }
}

// Extract insights from successful pins
function extractInsights(
  successfulPins: PinPerformance[],
  allPins: PinPerformance[]
) {
  // Count keyword frequency in successful pins
  const keywordScores: { [key: string]: number } = {};
  successfulPins.forEach(pin => {
    pin.keywords.forEach(kw => {
      keywordScores[kw] = (keywordScores[kw] || 0) + pin.ctr + (pin.saves / 100);
    });
  });

  // Count tag frequency in successful pins
  const tagScores: { [key: string]: number } = {};
  successfulPins.forEach(pin => {
    pin.tags.forEach(tag => {
      tagScores[tag] = (tagScores[tag] || 0) + pin.ctr + (pin.saves / 100);
    });
  });

  // Analyze title patterns
  const titlePatterns = analyzeTitlePatterns(successfulPins);

  // Calculate averages
  const avgCTR = successfulPins.reduce((sum, p) => sum + p.ctr, 0) / successfulPins.length;
  const avgSaves = successfulPins.reduce((sum, p) => sum + p.saves, 0) / successfulPins.length;

  return {
    topKeywords: Object.entries(keywordScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([kw]) => kw),
    topTags: Object.entries(tagScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag),
    bestTitles: titlePatterns,
    avgCTR,
    avgSaves,
  };
}

// Analyze title patterns from successful pins
function analyzeTitlePatterns(pins: PinPerformance[]): string[] {
  const patterns: string[] = [];

  pins.forEach(pin => {
    const title = pin.title;
    
    // Extract pattern types
    if (title.match(/\d+/)) {
      patterns.push('Number-based titles perform well');
    }
    if (title.toLowerCase().includes('ultimate')) {
      patterns.push('"Ultimate" in title performs well');
    }
    if (title.toLowerCase().includes('best')) {
      patterns.push('"Best" in title performs well');
    }
    if (title.toLowerCase().includes('how to')) {
      patterns.push('"How to" titles perform well');
    }
    if (title.toLowerCase().includes('tips')) {
      patterns.push('"Tips" in title performs well');
    }
    if (title.includes(':')) {
      patterns.push('Colon-separated titles perform well');
    }
    if (title.length < 40) {
      patterns.push('Short titles (<40 chars) perform well');
    }
    if (title.length > 50) {
      patterns.push('Long titles (>50 chars) perform well');
    }
  });

  // Return unique patterns
  return [...new Set(patterns)].slice(0, 5);
}

// Update just the stats without full analysis
async function updateLearningDataStats(
  userId: string,
  performances: PinPerformance[],
  successfulCount: number
) {
  const avgCTR = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.ctr, 0) / performances.length
    : 0;
  const avgSaves = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.saves, 0) / performances.length
    : 0;

  await prisma.learningData.upsert({
    where: { userId },
    update: {
      avgCTR,
      avgSaves,
      totalPins: performances.length,
      successfulPins: successfulCount,
      lastUpdated: new Date(),
    },
    create: {
      userId,
      topKeywords: [],
      topTags: [],
      bestTitles: [],
      avgCTR,
      avgSaves,
      totalPins: performances.length,
      successfulPins: successfulCount,
    },
  });
}

// Get optimization suggestions for a new pin
export async function getOptimizationSuggestions(
  userId: string,
  topic: string
): Promise<{
  suggestedKeywords: string[];
  suggestedTags: string[];
  titleTips: string[];
}> {
  const learningData = await prisma.learningData.findUnique({
    where: { userId },
  });

  if (!learningData || learningData.topKeywords.length === 0) {
    return {
      suggestedKeywords: [],
      suggestedTags: [],
      titleTips: [],
    };
  }

  return {
    suggestedKeywords: learningData.topKeywords.slice(0, 10),
    suggestedTags: learningData.topTags.slice(0, 10),
    titleTips: learningData.bestTitles,
  };
}

// Identify underperforming pins that need optimization
export async function identifyUnderperformingPins(userId: string): Promise<string[]> {
  const pinsWithAnalytics = await prisma.pin.findMany({
    where: {
      userId,
      status: 'PUBLISHED',
    },
    include: {
      analytics: true,
    },
  });

  const underperforming = pinsWithAnalytics
    .filter(p => {
      if (!p.analytics) return false;
      return p.analytics.ctr < SUCCESS_CTR_THRESHOLD && p.analytics.saves < SUCCESS_SAVES_THRESHOLD;
    })
    .map(p => p.id);

  return underperforming;
}

// Generate optimization recommendations for a pin
export async function generateOptimizationRecommendations(
  pinId: string
): Promise<{
  pinId: string;
  recommendations: string[];
  suggestedChanges?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
} | null> {
  const pin = await prisma.pin.findUnique({
    where: { id: pinId },
    include: { analytics: true, user: true },
  });

  if (!pin || !pin.analytics) {
    return null;
  }

  const recommendations: string[] = [];
  const suggestedChanges: any = {};

  // Check CTR
  if (pin.analytics.ctr < 1) {
    recommendations.push('Low CTR: Consider improving title and image');
    suggestedChanges.title = `Try adding numbers or power words to: "${pin.title}"`;
  }

  // Check saves
  if (pin.analytics.saves < 10) {
    recommendations.push('Low saves: Make content more save-worthy with actionable tips');
  }

  // Check tags
  if (pin.tags.length < 10) {
    recommendations.push('Add more relevant tags for better discoverability');
  }

  // Check description length
  if (pin.description.length < 100) {
    recommendations.push('Expand description with more keywords');
  }

  if (recommendations.length === 0) {
    recommendations.push('Pin is performing well!');
  }

  return {
    pinId,
    recommendations,
    suggestedChanges: Object.keys(suggestedChanges).length > 0 ? suggestedChanges : undefined,
  };
}
