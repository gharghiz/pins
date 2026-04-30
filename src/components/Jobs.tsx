import { useState } from 'react';
import { api } from '../lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function Jobs() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'processing' | 'done' | 'error'>('all');
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'user_1'],
    queryFn: () => api.jobs.getAll('user_1')
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.jobs.retry(id),
    onSuccess: () => toast.success('Job retried!'),
  });

  const filteredJobs = (jobs || []).filter(job => 
    activeFilter === 'all' || job.status === activeFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return CheckCircle;
      case 'error': return XCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="text-gray-500">Track and manage your automation jobs</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'pending', 'processing', 'done', 'error'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  className={`px-3 py-1 text-sm rounded ${
                    activeFilter === status
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-8">Loading jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No jobs found</div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job: any) => {
                const Icon = getStatusIcon(job.status);
                const color = getStatusColor(job.status);
                return (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <div>
                          <p className="font-medium text-gray-900">{job.type} job</p>
                          <p className="text-sm text-gray-500">Status: {job.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{job.progress}%</p>
                          <p className="text-xs text-gray-500">
                            {new Date(job.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        {job.status === 'error' && (
                          <button
                            onClick={() => retryMutation.mutate(job.id)}
                            className="px-3 py-1 text-sm text-purple-600 hover:text-purple-800"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {job.progress > 0 && job.progress < 100 && (
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}