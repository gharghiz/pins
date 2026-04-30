import { BarChart3, Lightbulb, Calendar, FileStack, LayoutDashboard, RefreshCw } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const navItems = [
  { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create' as ActiveTab, label: 'Create Pin', icon: Lightbulb },
  { id: 'bulk' as ActiveTab, label: 'Bulk Posting', icon: FileStack },
  { id: 'scheduler' as ActiveTab, label: 'Scheduler', icon: Calendar },
  { id: 'jobs' as ActiveTab, label: 'Jobs', icon: RefreshCw },
  { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}