import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Scheduler() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [postedTimes, setPostedTimes] = useState<string[]>(['9:00', '12:00', '15:00', '18:00']);
  const [newTime, setNewTime] = useState('');

  const addTime = () => {
    if (newTime && !postedTimes.includes(newTime)) {
      setPostedTimes([...postedTimes, newTime].sort());
      setNewTime('');
    }
  };

  const removeTime = (time: string) => {
    setPostedTimes(postedTimes.filter(t => t !== time));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduler</h1>
        <p className="text-gray-500">Configure posting schedules for automated pins</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Posting Schedule</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selected Date
              </label>
              <div className="flex items-center gap-2">
                <button className="p-1 hover:bg-gray-100 rounded">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium">
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posting Hours
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  onClick={addTime}
                  disabled={!newTime}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Scheduled Times</label>
              <div className="flex flex-wrap gap-2">
                {postedTimes.map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {time}
                    <button
                      onClick={() => removeTime(time)}
                      className="text-purple-500 hover:text-purple-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => toast.success('Schedule saved!')}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save Schedule
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule Preview</h2>
          
          <div className="space-y-4">
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Posts will be published at these times:</p>
            </div>

            <div className="space-y-2">
              {postedTimes.map((time) => (
                <div
                  key={time}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <span>{time}</span>
                  <span className="text-sm text-gray-500">Today</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}