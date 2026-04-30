import { ActiveTab } from '../types';
import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileStack, RefreshCw, TrendingUp } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const userId = 'user_1'; // Mock user ID
  
  const { data: stats } = useQuery({
    queryKey: ['stats', userId],
    queryFn: () => api.analytics.getStats(userId)
  });

  const { data: recentJobs } = useQuery({
    queryKey: ['jobs', userId],
    queryFn: () => api.jobs.getAll(userId)
  });

  const statCards = [
    { title: 'Total Pins', value: stats?.total_pins || 0, icon: FileStack, color: 'text-blue-600' },
    { title: 'Published', value: stats?.published || 0, icon: BarChart3, color: 'text-green-600' },
    { title: 'Errors', value: stats?.errors || 0, icon: RefreshCw, color: 'text-red-600' },
    { title: 'Today Activity', value: stats?.today_activity || 0, icon: TrendingUp, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your Pinterest automation</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {(recentJobs || []).slice(0, 5).map((job: any) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">{job.type} job</p>
                  <p className="text-sm text-gray-500">Status: {job.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{job.progress}%</p>
                  <button 
                    onClick={() => setActiveTab('jobs')}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}