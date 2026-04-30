import axios from 'axios';
import { prisma } from '../db/index.js';
import logger from '../utils/logger.js';

interface PinterestPin {
  board_id: string;
  title: string;
  description: string;
  media_source: {
    source_type: string;
    url?: string;
    content_type?: string;
  };
}

interface PinterestAnalytics {
  impressions: number;
  clicks: number;
  saves: number;
  ctr: number;
  outbound: number;
}

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

// Publish pin to Pinterest
export async function publishPinToPinterest(
  token: string,
  pinData: {
    title: string;
    description: string;
    imageUrl: string;
    boardId?: string;
  }
): Promise<{ pinId: string; link: string } | null> {
  try {
    // Get user's boards if no board specified
    let boardId = pinData.boardId;
    if (!boardId) {
      const boards = await getUserBoards(token);
      if (boards.length === 0) {
        throw new Error('No boards available. Please create a board on Pinterest first.');
      }
      boardId = boards[0].id;
    }

    const payload: PinterestPin = {
      board_id: boardId,
      title: pinData.title.slice(0, 100),
      description: pinData.description.slice(0, 500),
      media_source: {
        source_type: 'image_url',
        url: pinData.imageUrl,
        content_type: 'image/jpeg',
      },
    };

    const response = await axios.post(`${PINTEREST_API_BASE}/pins`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      pinId: response.data.id,
      link: response.data.link || `https://pinterest.com/pin/${response.data.id}`,
    };
  } catch (error: any) {
    logger.error('Pinterest publish error:', error.response?.data || error.message);
    throw new Error(`Failed to publish: ${error.response?.data?.message || error.message}`);
  }
}

// Get user's Pinterest boards
export async function getUserBoards(token: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await axios.get(`${PINTEREST_API_BASE}/boards`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: { page_size: 100 },
    });

    return response.data.items?.map((board: any) => ({
      id: board.id,
      name: board.name,
    })) || [];
  } catch (error: any) {
    logger.error('Get boards error:', error.response?.data || error.message);
    return [];
  }
}

// Fetch analytics for a pin
export async function fetchPinterestAnalytics(
  token: string,
  pinId: string
): Promise<PinterestAnalytics | null> {
  try {
    const response = await axios.get(
      `${PINTEREST_API_BASE}/pins/${pinId}/analytics`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          metric_types: ['IMPRESSION', 'CLICK', 'SAVE', 'OUTBOUND'],
          time_range: 'lifetime',
        },
      }
    );

    const data = response.data;
    
    const impressions = data?.IMPRESSION?.SUM?.[0]?.value || 0;
    const clicks = data?.CLICK?.SUM?.[0]?.value || 0;
    const saves = data?.SAVE?.SUM?.[0]?.value || 0;
    const outbound = data?.OUTBOUND?.SUM?.[0]?.value || 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      impressions,
      clicks,
      saves,
      ctr,
      outbound,
    };
  } catch (error: any) {
    logger.error('Fetch analytics error:', error.response?.data || error.message);
    return null;
  }
}

// Fetch analytics for multiple pins
export async function fetchBatchAnalytics(
  token: string,
  pinIds: string[]
): Promise<{ [key: string]: PinterestAnalytics }> {
  const results: { [key: string]: PinterestAnalytics } = {};

  for (const pinId of pinIds) {
    try {
      const analytics = await fetchPinterestAnalytics(token, pinId);
      if (analytics) {
        results[pinId] = analytics;
      }
    } catch (error) {
      logger.warn(`Failed to fetch analytics for pin ${pinId}:`, error);
    }

    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

// Simulate Pinterest API for demo/testing
export function simulatePinterestPublish(
  pinData: { title: string; description: string; imageUrl: string }
): { pinId: string; link: string } {
  const pinId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    pinId,
    link: `https://pinterest.com/pin/${pinId}`,
  };
}

export function simulatePinterestAnalytics(): PinterestAnalytics {
  // Generate realistic simulated analytics
  const impressions = Math.floor(Math.random() * 10000) + 100;
  const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
  const saves = Math.floor(clicks * (Math.random() * 0.5 + 0.2));
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  return {
    impressions,
    clicks,
    saves,
    ctr: Math.round(ctr * 100) / 100,
    outbound: Math.floor(clicks * 0.8),
  };
}

// Check if Pinterest token is valid
export async function validatePinterestToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get(`${PINTEREST_API_BASE}/user_account`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.status === 200;
  } catch (error) {
    logger.error('Token validation error:', error);
    return false;
  }
}
