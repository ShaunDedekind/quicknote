'use client';

export type Tab = 'record' | 'list';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  noteCount: number;
}

export default function BottomTabBar({ activeTab, onTabChange, noteCount }: Props) {
  return (
    <nav className="flex items-center justify-around border-t border-stone-100 bg-white/90 backdrop-blur-md px-8 py-3 pb-6">
      {/* Record tab */}
      <button
        onClick={() => onTabChange('record')}
        aria-label="Record"
        className="flex flex-col items-center gap-1.5"
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
            activeTab === 'record'
              ? 'bg-stone-900 text-white shadow-[0_4px_16px_rgba(0,0,0,0.14)]'
              : 'bg-stone-100 text-stone-400'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
          </svg>
        </div>
        <span className={`text-[10px] font-medium ${activeTab === 'record' ? 'text-stone-900' : 'text-stone-400'}`}>
          Record
        </span>
      </button>

      {/* List tab */}
      <button
        onClick={() => onTabChange('list')}
        aria-label="Notes"
        className="relative flex flex-col items-center gap-1.5"
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
            activeTab === 'list'
              ? 'bg-stone-900 text-white shadow-[0_4px_16px_rgba(0,0,0,0.14)]'
              : 'bg-stone-100 text-stone-400'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </div>
        {noteCount > 0 && (
          <span className="absolute -top-0.5 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-900 text-[9px] font-bold text-white">
            {noteCount > 9 ? '9+' : noteCount}
          </span>
        )}
        <span className={`text-[10px] font-medium ${activeTab === 'list' ? 'text-stone-900' : 'text-stone-400'}`}>
          Notes
        </span>
      </button>
    </nav>
  );
}
