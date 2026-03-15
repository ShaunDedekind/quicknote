'use client';

export type Tab = 'record' | 'list' | 'settings';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  noteCount: number;
}

export default function BottomTabBar({ activeTab, onTabChange, noteCount }: Props) {
  return (
    <nav className="flex items-center justify-around bg-[#141328] border-t border-white/[0.04] px-4 pt-3 pb-7">
      {/* Record tab */}
      <button
        onClick={() => onTabChange('record')}
        aria-label="Record"
        className="relative flex flex-col items-center gap-1.5 px-4 pb-2"
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={activeTab === 'record' ? '#e8dfc8' : '#5c5572'}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          className="transition-colors duration-200"
        >
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
        </svg>
        <span
          className={`text-[10px] font-medium transition-colors duration-200 ${
            activeTab === 'record' ? 'text-[#e8dfc8]' : 'text-[#5c5572]'
          }`}
        >
          Record
        </span>
        {activeTab === 'record' && (
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-[#e8dfc8]"
            style={{ animation: 'fade-in 0.15s ease both' }}
          />
        )}
      </button>

      {/* Notes tab */}
      <button
        onClick={() => onTabChange('list')}
        aria-label="Notes"
        className="relative flex flex-col items-center gap-1.5 px-4 pb-2"
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={activeTab === 'list' ? '#e8dfc8' : '#5c5572'}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          className="transition-colors duration-200"
        >
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        {noteCount > 0 && (
          <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#c94e3b] text-[9px] font-bold text-white">
            {noteCount > 9 ? '9+' : noteCount}
          </span>
        )}
        <span
          className={`text-[10px] font-medium transition-colors duration-200 ${
            activeTab === 'list' ? 'text-[#e8dfc8]' : 'text-[#5c5572]'
          }`}
        >
          Notes
        </span>
        {activeTab === 'list' && (
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-[#e8dfc8]"
            style={{ animation: 'fade-in 0.15s ease both' }}
          />
        )}
      </button>

      {/* Settings tab */}
      <button
        onClick={() => onTabChange('settings')}
        aria-label="Settings"
        className="relative flex flex-col items-center gap-1.5 px-4 pb-2"
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={activeTab === 'settings' ? '#e8dfc8' : '#5c5572'}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          className="transition-colors duration-200"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span
          className={`text-[10px] font-medium transition-colors duration-200 ${
            activeTab === 'settings' ? 'text-[#e8dfc8]' : 'text-[#5c5572]'
          }`}
        >
          Settings
        </span>
        {activeTab === 'settings' && (
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-[#e8dfc8]"
            style={{ animation: 'fade-in 0.15s ease both' }}
          />
        )}
      </button>
    </nav>
  );
}
