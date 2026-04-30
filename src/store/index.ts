import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Pin, Job, Analytics, LearningData, DashboardStats } from '../types';
import api from '../utils/api';

interface AppState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  pins: Pin[];
  jobs: Job[];
  analytics: Analytics[];
  learningData: LearningData | null;
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  fetchPins: (params?: any) => Promise<void>;
  fetchJobs: (params?: any) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchLearningData: () => Promise<void>;
  createPin: (pin: Partial<Pin>) => Promise<Pin>;
  generatePin: (topic: string, scheduledAt?: string) => Promise<Pin>;
  deletePin: (pinId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  triggerGeneratePins: (count?: number) => Promise<void>;
  updateSettings: (settings: any) => Promise<void>;
  updateApiKeys: (keys: any) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
}

const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pins: [],
      jobs: [],
      analytics: [],
      learningData: null,
      stats: null,
      isLoading: false,
      error: null,
      sidebarOpen: true,

      setToken: (token) => {
        set({ token, isAuthenticated: !!token });
        api.setToken(token);
      },
      
      setUser: (user) => set({ user }),
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
          api.setToken(token);
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Login failed', 
            isLoading: false 
          });
          throw error;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', { email, password, name });
          const { user, token } = response.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
          api.setToken(token);
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Registration failed', 
            isLoading: false 
          });
          throw error;
        }
      },

      logout: () => {
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          pins: [],
          jobs: [],
          analytics: [],
          learningData: null,
          stats: null,
        });
        api.setToken(null);
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      },

      fetchPins: async (params = {}) => {
        set({ isLoading: true });
        try {
          const response = await api.get('/pins', { params });
          set({ pins: response.data.pins, isLoading: false });
        } catch (error: any) {
          set({ error: error.response?.data?.error || 'Failed to fetch pins', isLoading: false });
        }
      },

      fetchJobs: async (params = {}) => {
        try {
          const response = await api.get('/jobs', { params });
          set({ jobs: response.data.jobs });
        } catch (error) {
          console.error('Failed to fetch jobs:', error);
        }
      },

      fetchAnalytics: async () => {
        try {
          const response = await api.get('/analytics/summary');
          set({ stats: response.data.summary });
        } catch (error) {
          console.error('Failed to fetch analytics:', error);
        }
      },

      fetchStats: async () => {
        try {
          const [analytics, jobs] = await Promise.all([
            api.get('/analytics/summary'),
            api.get('/jobs/summary/active'),
          ]);
          set({ 
            stats: { 
              ...analytics.data.summary,
              pendingJobs: jobs.data.summary.pending,
              processingJobs: jobs.data.summary.processing,
            } 
          });
        } catch (error) {
          console.error('Failed to fetch stats:', error);
        }
      },

      fetchLearningData: async () => {
        try {
          const response = await api.get('/analytics/insights');
          set({ learningData: response.data.insights });
        } catch (error) {
          console.error('Failed to fetch learning data:', error);
        }
      },

      createPin: async (pin) => {
        const response = await api.post('/pins', pin);
        const newPin = response.data.pin;
        set((state) => ({ pins: [newPin, ...state.pins] }));
        return newPin;
      },

      generatePin: async (topic, scheduledAt) => {
        const response = await api.post('/pins/generate', { topic, scheduledAt });
        const newPin = response.data.pin;
        set((state) => ({ pins: [newPin, ...state.pins] }));
        return newPin;
      },

      deletePin: async (pinId) => {
        await api.delete(`/pins/${pinId}`);
        set((state) => ({ pins: state.pins.filter((p) => p.id !== pinId) }));
      },

      retryJob: async (jobId) => {
        await api.post(`/jobs/${jobId}/retry`);
        await get().fetchJobs();
      },

      cancelJob: async (jobId) => {
        await api.post(`/jobs/${jobId}/cancel`);
        await get().fetchJobs();
      },

      triggerGeneratePins: async (count = 1) => {
        await api.post('/jobs/generate-pins', { count });
        await get().fetchJobs();
        await get().fetchPins();
      },

      updateSettings: async (settings) => {
        const response = await api.put('/settings/automation', settings);
        const currentUser = get().user;
        if (currentUser) {
          set({ 
            user: { 
              ...currentUser, 
              niche: settings.niche,
              postsPerDay: settings.postsPerDay,
              scheduleStart: settings.scheduleStart,
              scheduleEnd: settings.scheduleEnd,
              isActive: settings.enabled !== undefined ? settings.enabled : currentUser.isActive,
            } 
          });
        }
        return response.data;
      },

      updateApiKeys: async (keys) => {
        const response = await api.put('/settings/api-keys', keys);
        return response.data;
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'pinterest-automation-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useStore;
