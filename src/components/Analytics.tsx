import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Tag, TrendingUp, Users } from 'lucide-react';

export default function Analytics() {
  const userId = 'user_1';
  
  const { data: stats } = useQuery({
    queryKey: ['analytics-stats', userId],
    queryFn: () => api.analytics.getStats(userId)
  });

  const { data: topTags } = useQuery({
    queryKey: ['analytics-tags', userId],
    queryFn: () => api.analytics.getTopTags(userId)
  });

  const metrics = [
    { title: 'Total Pins', value: stats?.total_pins || 0, icon: BarChart3, color: 'text-blue-600' },
    { title: 'Published', value: stats?.published || 0, icon: TrendingUp, color: 'text-green-600' },
    { title: 'Errors', value: stats?.errors || 0, icon: Tag, color: 'text-red-600' },
    { title: 'Engagement Rate', value: '12.5%', icon: Users, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500">Performance insights and SEO tracking</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.title} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${metric.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Tags */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Top Performing Tags</h2>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {(topTags || []).map((tag: any, index: number) => (
              <div key={tag.tag} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    #{index + 1}
                  </span>
                  <span className="text-gray-900">{tag.tag}</span>
                </div>
                <span className="text-sm text-gray-500">{tag.count} uses</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEO Analysis */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SEO Recommendations</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="font-medium text-blue-900">Keyword Optimization</p>
              <p className="text-sm text-blue-700 mt-1">
                Add more long-tail keywords to improve discoverability
              </p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="font-medium text-green-900">Image Alt Text</p>
              <p className="text-sm text-green-700 mt-1">
                All pins should have descriptive alt text for accessibility
              </p>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-medium text-yellow-900">Description Length</p>
              <p className="text-sm text-yellow-700 mt-1">
                Keep descriptions between 200-300 characters for optimal engagement
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}