export interface User {
  id: string;
  email: string;
  name?: string;
  plan: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  niche?: string;
  postsPerDay: number;
  scheduleStart: number;
  scheduleEnd: number;
  aiProvider: 'OPENAI' | 'GEMINI' | 'CLAUDE';
  isActive: boolean;
  createdAt: string;
}

export interface Pin {
  id: string;
  userId: string;
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  imageUrl?: string;
  pinId?: string;
  boardId?: string;
  status: 'PENDING' | 'GENERATING' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED';
  scheduledAt?: string;
  publishedAt?: string;
  topic?: string;
  createdAt: string;
  analytics?: Analytics;
}

export interface Analytics {
  id: string;
  pinId: string;
  userId: string;
  impressions: number;
  clicks: number;
  saves: number;
  ctr: number;
  outbound: number;
  fetchedAt: string;
}

export interface Job {
  id: string;
  userId: string;
  pinId?: string;
  type: 'GENERATE_PIN' | 'PUBLISH_PIN' | 'FETCH_ANALYTICS' | 'OPTIMIZE_CONTENT' | 'GENERATE_TOPICS';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRY' | 'CANCELLED';
  priority: number;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: any;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  pin?: Pin;
}

export interface LearningData {
  id: string;
  userId: string;
  topKeywords: string[];
  topTags: string[];
  bestTitles: string[];
  avgCTR: number;
  avgSaves: number;
  totalPins: number;
  successfulPins: number;
  lastUpdated: string;
}

export interface APIUsage {
  id: string;
  userId: string;
  aiCalls: number;
  pinGenerations: number;
  imageGenerations: number;
  apiCalls: number;
  lastReset: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export interface DashboardStats {
  totalPins: number;
  publishedPins: number;
  totalImpressions: number;
  totalClicks: number;
  totalSaves: number;
  avgCTR: number;
  pendingJobs: number;
  processingJobs: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
