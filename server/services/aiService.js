import { config } from '../config.js';

// AI Service - supports OpenAI and Gemini with fallback

export class AIService {
  constructor() {
    this.openaiKey = config.openaiApiKey;
    this.geminiKey = config.geminiApiKey;
  }

  // Generate content using OpenAI
  async generateWithOpenAI(prompt, model = 'gpt-4o-mini', maxTokens = 500) {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Generate content using Gemini
  async generateWithGemini(prompt, model = 'gemini-1.5-flash') {
    if (!this.geminiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Generate pin content with fallback
  async generatePinContent(topic, options = {}) {
    const prompt = `
      Generate Pinterest pin content for the topic: "${topic}"
      
      Return JSON with:
      - title: Catchy title (max 100 chars)
      - description: Detailed description (max 500 chars)
      - tags: Array of 10 relevant hashtags/tags
      - seoKeywords: Array of 5 SEO keywords
      
      Format: Pure JSON only, no markdown
    `;

    try {
      // Try OpenAI first
      const result = await this.generateWithOpenAI(prompt);
      return JSON.parse(result);
    } catch (error) {
      console.warn('OpenAI failed, trying Gemini:', error.message);
      try {
        // Fallback to Gemini
        const result = await this.generateWithGemini(prompt);
        return JSON.parse(result);
      } catch (geminiError) {
        console.error('Both AI providers failed');
        throw new Error('AI generation failed');
      }
    }
  }

  // Generate SEO analysis
  async analyzeSEO(title, description, tags) {
    const prompt = `
      Analyze the SEO quality of this Pinterest pin content:
      Title: "${title}"
      Description: "${description}"
      Tags: ${JSON.stringify(tags)}
      
      Return JSON:
      - score: 0-100
      - suggestions: Array of improvement suggestions
      - keywordDensity: Object with keyword frequencies
    `;

    try {
      const result = await this.generateWithOpenAI(prompt);
      return JSON.parse(result);
    } catch (error) {
      try {
        const result = await this.generateWithGemini(prompt);
        return JSON.parse(result);
      } catch (e) {
        // Return basic score if AI fails
        return {
          score: 50,
          suggestions: ['Add more relevant keywords', 'Improve title length'],
          keywordDensity: {}
        };
      }
    }
  }

  // Generate image prompt for DALL-E or similar
  async generateImagePrompt(topic, style = 'modern') {
    const prompt = `
      Generate a detailed prompt for AI image generation for Pinterest:
      Topic: "${topic}"
      Style: "${style}"
      
      Return JSON:
      - prompt: Detailed image generation prompt (max 200 words)
      - width: 1000
      - height: 1500
    `;

    try {
      const result = await this.generateWithOpenAI(prompt);
      return JSON.parse(result);
    } catch (error) {
      try {
        const result = await this.generateWithGemini(prompt);
        return JSON.parse(result);
      } catch (e) {
        return {
          prompt: `Professional Pinterest pin for ${topic}, modern design, clean aesthetic, high quality`,
          width: 1000,
          height: 1500
        };
      }
    }
  }

  // Generate viral topics
  async generateViralTopics(category, count = 5) {
    const prompt = `
      Generate ${count} trending/viral topic ideas for Pinterest in category: "${category}"
      
      Return JSON array of topics with:
      - topic: The topic name
      - keywords: Array of related keywords
      - expectedEngagement: "high", "medium", or "low"
    `;

    try {
      const result = await this.generateWithOpenAI(prompt);
      return JSON.parse(result);
    } catch (error) {
      try {
        const result = await this.generateWithGemini(prompt);
        return JSON.parse(result);
      } catch (e) {
        return [
          { topic: `${category} Ideas`, keywords: [category], expectedEngagement: 'medium' }
        ];
      }
    }
  }
}

export const aiService = new AIService();