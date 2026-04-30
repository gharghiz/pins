import { config } from '../config.js';

// Pinterest API Service

export class PinterestService {
  constructor() {
    this.clientId = config.pinterestClientId;
    this.clientSecret = config.pinterestClientSecret;
    this.accessToken = config.pinterestAccessToken;
    this.baseUrl = 'https://api.pinterest.com/v1';
  }

  // Get headers with auth token
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Validate access token
  async validateToken() {
    if (!this.accessToken) {
      return { valid: false, error: 'No access token configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/people/~`, {
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid token' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Fetch user boards with retry
  async fetchBoards(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/people/~/boards`, {
          headers: this.getHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          return data.items || [];
        }
        
        if (i === maxRetries - 1) {
          throw new Error(`Failed to fetch boards: ${response.status}`);
        }
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(1000 * (i + 1));
      }
    }
  }

  // Create a pin with retry
  async createPin(pinData, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/pins/`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            board_id: pinData.boardId,
            image_url: pinData.imageUrl,
            title: pinData.title,
            note: pinData.description,
            tags: pinData.tags,
            link: pinData.link || ''
          })
        });

        if (response.ok) {
          const data = await response.json();
          return { success: true, data };
        }

        if (i === maxRetries - 1) {
          throw new Error(`Failed to create pin: ${response.status}`);
        }
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(1000 * (i + 1));
      }
    }
  }

  // Create image URL (for placeholder or generated images)
  async createImageUrl(imageData) {
    // In production, upload to cloud storage or use Pinterest's upload
    // For now, return the URL as-is or use a placeholder service
    return imageData.url || imageData;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const pinterestService = new PinterestService();