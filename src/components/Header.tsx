import { Globe, Settings, UserCircle } from 'lucide-react';

interface HeaderProps {
  rtl: boolean;
  setRtl: (rtl: boolean) => void;
}

export default function Header({ rtl, setRtl }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PinterestAI SaaS</h1>
            <p className="text-sm text-gray-500">AI-Powered Pinterest Automation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setRtl(!rtl)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {rtl ? 'LTR' : 'RTL'}
          </button>
          <Settings className="h-5 w-5 text-gray-600 cursor-pointer" />
          <UserCircle className="h-8 w-8 text-gray-600 cursor-pointer" />
        </div>
      </div>
    </header>
  );
}