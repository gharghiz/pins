import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Dashboard from './components/Dashboard';
import CreatePin from './components/CreatePin';
import BulkPosting from './components/BulkPosting';
import Scheduler from './components/Scheduler';
import Jobs from './components/Jobs';
import Analytics from './components/Analytics';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { useState } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

export type ActiveTab = 'dashboard' | 'create' | 'bulk' | 'scheduler' | 'jobs' | 'analytics';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [rtl, setRtl] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={rtl ? 'rtl' : ''} dir={rtl ? 'rtl' : 'ltr'}>
        <div className="min-h-screen bg-gray-100">
          <Header rtl={rtl} setRtl={setRtl} />
          <div className="flex">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 p-6">
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
              {activeTab === 'create' && <CreatePin />}
              {activeTab === 'bulk' && <BulkPosting />}
              {activeTab === 'scheduler' && <Scheduler />}
              {activeTab === 'jobs' && <Jobs />}
              {activeTab === 'analytics' && <Analytics />}
            </main>
          </div>
        </div>
        <Toaster position="top-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </div>
    </QueryClientProvider>
  );
}

export default App;