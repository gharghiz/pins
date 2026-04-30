import { useState } from 'react';
import { api } from '../lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles, Save, Send } from 'lucide-react';

export default function CreatePin() {
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [boardId, setBoardId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMutation = useMutation({
    mutationFn: (topic: string) => api.ai.generate({ topic }),
    onSuccess: (data: any) => {
      setTitle(data.title || '');
      setDescription(data.description || '');
      setTags((data.tags || []).join(', '));
      setIsGenerating(false);
      toast.success('Content generated successfully!');
    },
    onError: () => {
      setIsGenerating(false);
      toast.error('Failed to generate content');
    }
  });

  const createPinMutation = useMutation({
    mutationFn: (data: any) => api.pins.create(data),
    onSuccess: () => {
      toast.success('Pin created successfully!');
      setTitle('');
      setDescription('');
      setTags('');
    }
  });

  const handleGenerate = () => {
    if (!topic) return;
    setIsGenerating(true);
    generateMutation.mutate(topic);
  };

  const handleSave = () => {
    createPinMutation.mutate({
      userId: 'user_1',
      title,
      description,
      tags: tags.split(',').map(t => t.trim()),
      boardId,
      imageUrl: `https://placehold.co/1000x1500/0077cc/white?text=${encodeURIComponent(title)}`
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Pin</h1>
        <p className="text-gray-500">Generate and create Pinterest pins with AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Generation</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic for your pin..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pin title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pin description..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={!title || !description}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Pin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}