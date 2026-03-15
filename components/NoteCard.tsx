'use client';

import { useState, useRef } from 'react';
import type { LocalNote, NoteCategory } from '@/lib/types';

interface Props {
  note: LocalNote;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  onTap: (note: LocalNote) => void;
}

// Left-edge accent colour per category
const CATEGORY_COLOR: Record<NoteCategory, string> = {
  WORK:     '#4b7fd4',
  PERSONAL: '#9265cc',
  HEALTH:   '#38b089',
  FINANCE:  '#c89b3c',
  OTHER:    '#5c5572',
};

// Text colour for the category pill label
const CATEGORY_TEXT: Record<NoteCategory, string> = {
  WORK:     'text-[#4b7fd4]',
  PERSONAL: 'text-[#9265cc]',
  HEALTH:   'text-[#38b089]',
  FINANCE:  'text-[#c89b3c]',
  OTHER:    'text-[#5c5572]',
};

type Urgency = 'high' | 'medium' | 'low';

// Urgency dot: cinnabar red for high, muted amber/green for others
const URGENCY_DOT: Record<Urgency, { bg: string; glow: string }> = {
  high:   { bg: 'bg-[#c94e3b]', glow: '0 0 6px 1px rgba(201,78,59,0.65)'  },
  medium: { bg: 'bg-[#c89b3c]', glow: '0 0 6px 1px rgba(200,155,60,0.55)' },
  low:    { bg: 'bg-[#38b089]', glow: '0 0 6px 1px rgba(56,176,137,0.5)'  },
};

function getUrgency(dueDate?: Date | null): Urgency | null {
  if (!dueDate) return null;
  const diffHours = (dueDate.getTime() - Date.now()) / 3_600_000;
  if (diffHours < 24) return 'high';
  if (diffHours < 168) return 'medium';
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

export default function NoteCard({ note, onDelete, onMarkDone, onTap }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const wasSwipingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
    wasSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 5) wasSwipingRef.current = true;
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

  const handleClick = () => {
    if (!wasSwipingRef.current && note.status === 'EXPANDED') onTap(note);
  };

  const urgency = getUrgency(note.dueDate);
  const category = note.category ?? 'OTHER';
  const accentColor = CATEGORY_COLOR[category];

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
    <div
      className="relative mb-2 overflow-hidden rounded-xl"
      style={{ animation: 'card-enter 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
    >
      {/* Swipe action backgrounds */}
      <div className="absolute inset-0 flex items-stretch rounded-xl">
        <div className="flex flex-1 items-center pl-4 rounded-l-xl bg-[#38b089]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex flex-1 items-center justify-end pr-4 rounded-r-xl bg-[#c94e3b]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          transform: cardTransform,
          transition: cardTransition,
          borderLeft: note.status === 'EXPANDED' ? `2px solid ${accentColor}` : '2px solid transparent',
        }}
        className="relative bg-[#252340] rounded-xl px-3.5 py-3 select-none cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {note.status === 'PENDING' ? (
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-3/4 rounded-full bg-[#2e2b4a] animate-pulse" />
            <div className="h-2 w-1/2 rounded-full bg-[#2e2b4a] animate-pulse" />
          </div>
        ) : note.status === 'ERROR' ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#c94e3b]/10">
              <span className="text-[9px] font-bold text-[#c94e3b]">!</span>
            </div>
            <p className="text-sm text-[#877fa0] line-clamp-1">{note.rawContent}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Row 1: title + urgency dot */}
            <div className="flex items-center justify-between gap-2">
              <p className="flex-1 text-[14px] font-semibold leading-snug text-[#e8dfc8] truncate">
                {note.title ?? note.rawContent}
              </p>
              {urgency && (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${URGENCY_DOT[urgency].bg}`}
                  style={{ boxShadow: URGENCY_DOT[urgency].glow }}
                />
              )}
            </div>

            {/* Row 2: category + date */}
            <div className="flex items-center gap-1.5">
              {note.category && (
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_TEXT[note.category]}`}>
                  {note.category.charAt(0) + note.category.slice(1).toLowerCase()}
                </span>
              )}
              {note.category && note.dueDate && (
                <span className="text-[#5c5572] text-[10px]">·</span>
              )}
              {note.dueDate && (
                <span className="text-[11px] text-[#877fa0]">{formatDate(note.dueDate)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
