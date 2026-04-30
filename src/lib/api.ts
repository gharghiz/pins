// @ts-ignore
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = {
  // Pins
  pins: {
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    getAll: async (userId: string) => {
      const res = await fetch(`${API_BASE}/pins?userId=${userId}`);
      return res.json();
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE}/pins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/pins/${id}`, { method: 'DELETE' });
      return res.json();
    }
  },

  // Jobs
  jobs: {
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/jobs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    createBulk: async (data: any) => {
      const res = await fetch(`${API_BASE}/jobs/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    getById: async (id: string) => {
      const res = await fetch(`${API_BASE}/jobs/${id}`);
      return res.json();
    },
    getAll: async (userId: string) => {
      const res = await fetch(`${API_BASE}/jobs?userId=${userId}`);
      return res.json();
    },
    retry: async (id: string) => {
      const res = await fetch(`${API_BASE}/jobs/${id}/retry`, { method: 'POST' });
      return res.json();
    }
  },

  // AI
  ai: {
    generate: async (data: any) => {
      const res = await fetch(`${API_BASE}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    analyze: async (data: any) => {
      const res = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    topics: async (data: any) => {
      const res = await fetch(`${API_BASE}/ai/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    imagePrompt: async (data: any) => {
      const res = await fetch(`${API_BASE}/ai/image-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    }
  },

  // Pinterest
  pinterest: {
    validateToken: async () => {
      const res = await fetch(`${API_BASE}/pinterest/token/validate`);
      return res.json();
    },
    getBoards: async () => {
      const res = await fetch(`${API_BASE}/pinterest/boards`);
      return res.json();
    },
    createPin: async (data: any) => {
      const res = await fetch(`${API_BASE}/pinterest/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    }
  },

  // Analytics
  analytics: {
    getStats: async (userId: string) => {
      const res = await fetch(`${API_BASE}/analytics/stats?userId=${userId}`);
      return res.json();
    },
    getTopTags: async (userId: string) => {
      const res = await fetch(`${API_BASE}/analytics/tags?userId=${userId}`);
      return res.json();
    }
  }
};