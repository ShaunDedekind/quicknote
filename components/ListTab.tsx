'use client';

import type { LocalNote } from '@/lib/types';
import NoteCard from './NoteCard';

interface Props {
  notes: LocalNote[];
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSelect: (note: LocalNote) => void;
}

export default function ListTab({ notes, onDelete, onMarkDone, onSelect }: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <h2
          className="text-xl font-semibold text-[#e8dfc8]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          Notes
        </h2>
        {notes.length > 0 && (
          <p className="mt-0.5 text-sm text-[#5c5572]">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 pb-20 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#252340]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5c5572" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#877fa0]">No notes yet</p>
          <p className="max-w-[180px] text-xs leading-relaxed text-[#5c5572]">
            Tap the mic button to capture your first thought
          </p>
        </div>
      ) : (
        <div className="px-4 pb-4">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={onDelete}
              onMarkDone={onMarkDone}
              onTap={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
