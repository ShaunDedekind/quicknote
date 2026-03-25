'use client';

import { useState, useRef } from 'react';
import type { LocalNote, NoteCategory } from '@/lib/types';

interface Props {
  note: LocalNote;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  onTap: (note: LocalNote) => void;
  // Drag-to-pull-forward
  onLongPress?: (id: string, clientY: number) => void;
  isDraggable?: boolean;
  isDragging?: boolean; // ghost is showing — render this card transparent
}

const CATEGORY_TEXT: Record<NoteCategory, string> = {
  WORK:     'text-[#4b7fd4]',
  PERSONAL: 'text-[#9265cc]',
  HEALTH:   'text-[#38b089]',
  FINANCE:  'text-[#c89b3c]',
  OTHER:    'text-[#5c5572]',
};

// Left border: red = urgent/overdue, teal = has a due time, grey = no date
function getLeftBorderColor(note: LocalNote): string {
  if (!note.dueDate) return '#3d3a5a';
  const diffHours = (note.dueDate.getTime() - Date.now()) / 3_600_000;
  if (diffHours < 24) return '#c94e3b';
  return '#38b089';
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

// Show "due Thu" label when a card has been pinned to Today from a future date
function getDueDayLabel(note: LocalNote): string | null {
  if (!note.pinnedToToday || !note.dueDate) return null;
  const today = new Date();
  if (note.dueDate.toDateString() === today.toDateString()) return null;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (note.dueDate.toDateString() === tomorrow.toDateString()) return 'due tomorrow';
  return `due ${note.dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

export default function NoteCard({
  note, onDelete, onMarkDone, onTap,
  onLongPress, isDraggable = false, isDragging = false,
}: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const wasSwipingRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    wasSwipingRef.current = false;
    longPressTriggered.current = false;
    setIsSwiping(true);

    if (isDraggable && onLongPress) {
      const clientY = e.touches[0].clientY;
      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        onLongPress(note.id, clientY);
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 8) {
      wasSwipingRef.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    if (!longPressTriggered.current) {
      setSwipeX(Math.max(-130, Math.min(130, delta)));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressTriggered.current) {
      setSwipeX(0);
      return;
    }
    if (swipeX < -80) {
      setExitDir('left');
      setTimeout(() => onDelete(note.id), 280);
    } else if (swipeX > 80) {
      setExitDir('right');
      setTimeout(() => onMarkDone(note.id), 280);
    } else {
      // Treat as a tap if the finger barely moved
      if (!wasSwipingRef.current && note.status === 'EXPANDED') {
        onTap(note);
      }
      setSwipeX(0);
    }
  };

  // Fallback for mouse clicks on desktop (touch devices use handleTouchEnd above)
  const handleClick = (e: React.MouseEvent) => {
    if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return;
    if (!wasSwipingRef.current && note.status === 'EXPANDED') {
      onTap(note);
    }
  };

  const borderColor = note.status === 'EXPANDED' ? getLeftBorderColor(note) : 'transparent';
  const dueDayLabel = getDueDayLabel(note);

  const cardTransform =
    exitDir === 'left' ? 'translateX(-110%)' :
    exitDir === 'right' ? 'translateX(110%)' :
    `translateX(${swipeX}px)`;

  const cardTransition =
    exitDir || !isSwiping
      ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';

  return (
    <div
      className="relative mb-2 overflow-hidden rounded-xl"
      style={{
        animation: 'card-enter 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        opacity: isDragging ? 0.15 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Swipe backgrounds */}
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

      {/* Card face */}
      <div
        style={{
          transform: cardTransform,
          transition: cardTransition,
          borderLeft: `2px solid ${borderColor}`,
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
          <div className="flex items-start gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="text-[14px] font-semibold leading-snug text-[#e8dfc8] truncate">
                {note.title ?? note.rawContent}
              </p>
              <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                {note.category && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_TEXT[note.category]}`}>
                    {note.category.charAt(0) + note.category.slice(1).toLowerCase()}
                  </span>
                )}
                {note.dueDate && (
                  <>
                    {note.category && <span className="text-[#5c5572] text-[10px]">·</span>}
                    <span className="text-[11px] text-[#877fa0]">{formatDate(note.dueDate)}</span>
                  </>
                )}
                {dueDayLabel && (
                  <>
                    <span className="text-[#5c5572] text-[10px]">·</span>
                    <span className="text-[10px] font-medium text-[#38b089]">{dueDayLabel}</span>
                  </>
                )}
              </div>
            </div>

            {/* Checkbox */}
            <button
              className="shrink-0 mt-0.5 h-[18px] w-[18px] rounded-full border border-[#3d3a5a] hover:border-[#38b089] active:border-[#38b089] transition-colors"
              onClick={(e) => { e.stopPropagation(); onMarkDone(note.id); }}
              aria-label="Mark done"
            />
          </div>
        )}
      </div>
    </div>
  );
}
