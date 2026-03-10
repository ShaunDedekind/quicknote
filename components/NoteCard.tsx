'use client';

import { useState, useRef } from 'react';
import type { LocalNote, NoteCategory } from '@/lib/types';

interface Props {
  note: LocalNote;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
}

const CATEGORY_PILL: Record<NoteCategory, string> = {
  WORK:     'bg-blue-50 text-blue-500',
  PERSONAL: 'bg-violet-50 text-violet-500',
  HEALTH:   'bg-emerald-50 text-emerald-500',
  FINANCE:  'bg-amber-50 text-amber-500',
  OTHER:    'bg-stone-100 text-stone-400',
};

const CATEGORY_BORDER: Record<NoteCategory, string> = {
  WORK:     'border-l-blue-300',
  PERSONAL: 'border-l-violet-300',
  HEALTH:   'border-l-emerald-300',
  FINANCE:  'border-l-amber-300',
  OTHER:    'border-l-stone-200',
};

type Urgency = 'high' | 'medium' | 'low';

const URGENCY_DOT: Record<Urgency, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-emerald-400',
};

function getUrgency(dueDate?: Date | null): Urgency | null {
  if (!dueDate) return null;
  const diffHours = (dueDate.getTime() - Date.now()) / 3_600_000;
  if (diffHours < 24) return 'high';   // overdue or due today
  if (diffHours < 168) return 'medium'; // within 7 days
  return 'low';
}

function formatDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return (
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ` · ${time}`
  );
}

export default function NoteCard({ note, onDelete, onMarkDone }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartX.current;
    setSwipeX(Math.max(-130, Math.min(130, delta)));
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX < -80) {
      setExitDir('left');
      setTimeout(() => onDelete(note.id), 280);
    } else if (swipeX > 80) {
      setExitDir('right');
      setTimeout(() => onMarkDone(note.id), 280);
    } else {
      setSwipeX(0);
    }
  };

  const urgency = getUrgency(note.dueDate);
  const category = note.category;
  const categoryBorder = category ? CATEGORY_BORDER[category] : 'border-l-stone-100';

  const cardTransform =
    exitDir === 'left'
      ? 'translateX(-110%)'
      : exitDir === 'right'
        ? 'translateX(110%)'
        : `translateX(${swipeX}px)`;

  const cardTransition =
    exitDir || !isSwiping
      ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';

  return (
    <div className="relative mb-2.5 overflow-hidden rounded-2xl">
      {/* Swipe action backgrounds — revealed as the card slides */}
      <div className="absolute inset-0 flex items-stretch rounded-2xl">
        {/* Left: swipe right = mark done (green) */}
        <div className="flex flex-1 items-center pl-5 rounded-l-2xl bg-emerald-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        {/* Right: swipe left = delete (red) */}
        <div className="flex flex-1 items-center justify-end pr-5 rounded-r-2xl bg-red-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        style={{ transform: cardTransform, transition: cardTransition }}
        className={`relative border-l-[3px] ${categoryBorder} bg-white rounded-2xl px-4 py-3.5 select-none shadow-[0_1px_4px_rgba(0,0,0,0.06)]`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {note.status === 'PENDING' ? (
          <div className="flex flex-col gap-2.5">
            <div className="h-3 w-16 rounded-full bg-stone-100 animate-pulse" />
            <div className="h-4 w-3/4 rounded-lg bg-stone-100 animate-pulse" />
            <div className="h-3 w-1/2 rounded-lg bg-stone-100 animate-pulse" />
          </div>
        ) : note.status === 'ERROR' ? (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50">
              <span className="text-[10px] font-bold text-red-400">!</span>
            </div>
            <div>
              <p className="text-sm text-stone-500 line-clamp-2">{note.rawContent}</p>
              <p className="mt-0.5 text-xs text-red-400">Couldn&apos;t process this note</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Top row: category pill + urgency dot */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {category && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_PILL[category]}`}
                  >
                    {category.charAt(0) + category.slice(1).toLowerCase()}
                  </span>
                )}
                {note.type && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-stone-300">
                    {note.type.toLowerCase()}
                  </span>
                )}
              </div>
              {urgency && (
                <span className={`h-2 w-2 shrink-0 rounded-full ${URGENCY_DOT[urgency]}`} />
              )}
            </div>

            {/* Title */}
            <p className="text-[15px] font-semibold leading-snug text-stone-800 line-clamp-2">
              {note.title ?? note.rawContent}
            </p>

            {/* Due date */}
            {note.dueDate && (
              <p className="text-xs text-stone-400">{formatDate(note.dueDate)}</p>
            )}

            {/* Description (only if distinct from title) */}
            {note.description && note.description !== note.title && (
              <p className="text-xs leading-relaxed text-stone-400 line-clamp-2">
                {note.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
