export type ActiveTab = 'dashboard' | 'create' | 'bulk' | 'scheduler' | 'jobs' | 'analytics';

export interface Pin {
  id: string;
  userId: string;
  title: string;
  description: string;
  tags: string[];
  imageUrl: string;
  boardId: string;
  status: 'pending' | 'generating' | 'posting' | 'published' | 'error';
  seoScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  userId: string;
  type: 'generate' | 'bulk' | 'image';
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  result?: any;
  error?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  pinterestId: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Analytics {
  totalPins: number;
  published: number;
  errors: number;
  todayActivity: number;
  topTags: { tag: string; count: number }[];
}