import { useState } from 'react';
import { api } from '../lib/api';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Play, Pause, SkipForward } from 'lucide-react';

export default function BulkPosting() {
  const [topics, setTopics] = useState('');
  const [category, setCategory] = useState('Business');
  const [count, setCount] = useState(5);
  const [delayMs, setDelayMs] = useState(30000);
  const [isRunning, setIsRunning] = useState(false);

  const generateTopicsMutation = useMutation({
    mutationFn: (data: any) => api.ai.topics(data),
  });

  const bulkJobMutation = useMutation({
    mutationFn: (data: any) => api.jobs.createBulk(data),
    onSuccess: () => {
      toast.success('Bulk job created successfully!');
      setIsRunning(false);
    },
    onError: () => {
      toast.error('Failed to create bulk job');
      setIsRunning(false);
    }
  });

  const handleGenerateTopics = async () => {
    const result = await generateTopicsMutation.mutateAsync({ category, count });
    setTopics((result || []).map((t: any) => t.topic).join('\n'));
  };

  const handleStartJob = () => {
    const topicList = topics.split('\n').map(t => t.trim()).filter(Boolean);
    if (topicList.length === 0) return;
    
    setIsRunning(true);
    bulkJobMutation.mutate({
      userId: 'user_1',
      topics: topicList,
      boardId: 'board_1',
      delayMs
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Posting</h1>
        <p className="text-gray-500">Generate and schedule multiple pins at once</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Business">Business</option>
                <option value="Travel">Travel</option>
                <option value="Food">Food</option>
                <option value="Fashion">Fashion</option>
                <option value="Technology">Technology</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Topics</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay Between Posts (ms)</label>
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value))}
                min="5000"
                step="5000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleGenerateTopics}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Generate Topics
            </button>
          </div>
        </div>

        {/* Topics Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics</h2>
          
          <div className="space-y-4">
            <textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Enter topics (one per line)..."
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleStartJob}
                disabled={isRunning || !topics.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Job
                  </>
                )}
              </button>
              
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}