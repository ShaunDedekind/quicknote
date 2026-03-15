'use client';

import type { LocalNote, NoteCategory } from '@/lib/types';

interface Props {
  note: LocalNote | null;
  onClose: () => void;
}

const CATEGORY_COLOR: Record<NoteCategory, string> = {
  WORK:     '#4b7fd4',
  PERSONAL: '#9265cc',
  HEALTH:   '#38b089',
  FINANCE:  '#c89b3c',
  OTHER:    '#5c5572',
};

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function NoteDetailPanel({ note, onClose }: Props) {
  const isOpen = note !== null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-[#1b1a2e]"
      style={{
        transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-hidden={!isOpen}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-5">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#252340] text-[#877fa0] transition-colors hover:text-[#e8dfc8] active:scale-[0.92]"
          aria-label="Go back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#5c5572] uppercase">
          Note
        </span>
      </div>

      {note && (
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          {/* Category + type */}
          {(note.category || note.type) && (
            <div className="mb-4 flex items-center gap-2">
              {note.category && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: CATEGORY_COLOR[note.category] }}
                >
                  {note.category.charAt(0) + note.category.slice(1).toLowerCase()}
                </span>
              )}
              {note.category && note.type && (
                <span className="text-[#3d3a5a]">·</span>
              )}
              {note.type && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#5c5572]">
                  {note.type.toLowerCase()}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h1
            className="mb-5 text-[26px] font-semibold leading-tight text-[#e8dfc8]"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            {note.title ?? note.rawContent}
          </h1>

          {/* Description */}
          {note.description && note.description !== note.title && (
            <p className="mb-7 text-[14px] leading-relaxed text-[#877fa0]">
              {note.description}
            </p>
          )}

          {/* Date / time metadata */}
          {(note.dueDate || note.reminderAt) && (
            <div className="flex flex-col gap-4 rounded-xl bg-[#252340] p-4">
              {note.dueDate && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2e2b4a]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#877fa0" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">Due</p>
                    <p className="text-[13px] text-[#e8dfc8]">{formatFullDate(note.dueDate)}</p>
                  </div>
                </div>
              )}

              {note.reminderAt && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2e2b4a]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#877fa0" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">Reminder</p>
                    <p className="text-[13px] text-[#e8dfc8]">{formatFullDate(note.reminderAt)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
