'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { LocalNote } from '@/lib/types';
import NoteCard from './NoteCard';

interface Props {
  notes: LocalNote[];
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSelect: (note: LocalNote) => void;
  onPinToToday: (id: string) => void;
}

interface DayGroup {
  key: string;
  label: string;       // "Today", "Tomorrow", "Wednesday"
  subLabel: string;    // "Mar 25", "Mar 26"
  notes: LocalNote[];
  daysFromToday: number;
}

interface DragState {
  id: string;
  note: LocalNote;
  clientY: number;
  clientX: number;
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isNoteInToday(note: LocalNote): boolean {
  if (note.pinnedToToday) return true;
  if (!note.dueDate) return true; // undated notes always land in Today
  const tomorrowStart = startOfDay(new Date());
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return note.dueDate < tomorrowStart; // today's date or overdue
}

function groupNotes(notes: LocalNote[]): DayGroup[] {
  const todayStart = startOfDay(new Date());
  const todayNotes: LocalNote[] = [];
  const futureMap = new Map<number, { notes: LocalNote[]; date: Date }>();

  for (const note of notes) {
    if (isNoteInToday(note)) {
      todayNotes.push(note);
    } else if (note.dueDate) {
      const dayMs = startOfDay(note.dueDate).getTime();
      if (!futureMap.has(dayMs)) {
        futureMap.set(dayMs, { notes: [], date: startOfDay(note.dueDate) });
      }
      futureMap.get(dayMs)!.notes.push(note);
    }
  }

  const groups: DayGroup[] = [];

  if (todayNotes.length > 0) {
    groups.push({
      key: 'today',
      label: 'Today',
      subLabel: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      notes: todayNotes,
      daysFromToday: 0,
    });
  }

  const futureGroups = [...futureMap.entries()]
    .map(([dayMs, { notes, date }]) => {
      const daysFromToday = Math.round((dayMs - todayStart.getTime()) / 86_400_000);
      const label =
        daysFromToday === 1
          ? 'Tomorrow'
          : date.toLocaleDateString('en-US', { weekday: 'long' });
      const subLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { key: String(dayMs), label, subLabel, notes, daysFromToday };
    })
    .sort((a, b) => a.daysFromToday - b.daysFromToday);

  groups.push(...futureGroups);
  return groups;
}

// Progressive dimming: further into the future = more muted
function groupOpacity(daysFromToday: number): number {
  if (daysFromToday <= 0) return 1;
  if (daysFromToday === 1) return 0.75;
  if (daysFromToday === 2) return 0.6;
  return 0.45;
}

// ---------------------------------------------------------------------------
// Day group header
// ---------------------------------------------------------------------------

function DayGroupHeader({ label, subLabel, count }: { label: string; subLabel: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 px-1 pb-2 pt-1">
      <span
        className="text-[15px] font-semibold text-[#e8dfc8]"
        style={{ fontFamily: 'var(--font-fraunces)' }}
      >
        {label}
      </span>
      <span className="text-[11px] text-[#5c5572]">{subLabel}</span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">
        {count} {count === 1 ? 'task' : 'tasks'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ghost card — follows the touch during drag
// ---------------------------------------------------------------------------

function GhostCard({
  note,
  clientY,
  clientX,
  containerRef,
}: {
  note: LocalNote;
  clientY: number;
  clientX: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!containerRef.current) return null;
  const rect = containerRef.current.getBoundingClientRect();
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: rect.left + 16,
        width: rect.width - 32,
        top: clientY - 36,
        transform: 'rotate(1.5deg) scale(1.04)',
        opacity: 0.92,
        filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
      }}
    >
      <NoteCard
        note={note}
        onDelete={() => {}}
        onMarkDone={() => {}}
        onTap={() => {}}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListTab
// ---------------------------------------------------------------------------

export default function ListTab({ notes, onDelete, onMarkDone, onSelect, onPinToToday }: Props) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [isOverToday, setIsOverToday] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  // Refs so DOM listeners can read latest values without stale closures
  const draggingRef = useRef<DragState | null>(null);
  const onPinToTodayRef = useRef(onPinToToday);

  useEffect(() => { draggingRef.current = dragging; }, [dragging]);
  useEffect(() => { onPinToTodayRef.current = onPinToToday; }, [onPinToToday]);

  // Non-passive touch listeners on the container so we can preventDefault
  // during drag to block scroll, and track position/drop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const newY = touch.clientY;
      const newX = touch.clientX;

      // Check if finger is over the Today section
      if (todayRef.current) {
        const rect = todayRef.current.getBoundingClientRect();
        setIsOverToday(newY < rect.bottom + 24);
      }

      setDragging(prev => prev ? { ...prev, clientY: newY, clientX: newX } : null);
    };

    const onEnd = () => {
      const current = draggingRef.current;
      if (!current) return;

      if (todayRef.current) {
        const rect = todayRef.current.getBoundingClientRect();
        if (current.clientY < rect.bottom + 24) {
          onPinToTodayRef.current(current.id);
        }
      }

      setDragging(null);
      setIsOverToday(false);
    };

    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const handleLongPress = useCallback((id: string, clientY: number) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    setDragging({ id, note, clientY, clientX: 0 });
    setIsOverToday(false);
  }, [notes]);

  const groups = groupNotes(notes);
  const totalNotes = notes.length;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-y-auto">

      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <h2
          className="text-xl font-semibold text-[#e8dfc8]"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          Notes
        </h2>
        {totalNotes > 0 && (
          <p className="mt-0.5 text-sm text-[#5c5572]">
            {totalNotes} note{totalNotes !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {totalNotes === 0 ? (
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
        <div className="pb-4">

          {groups.map((group) => {
            const isToday = group.daysFromToday === 0;
            const opacity = groupOpacity(group.daysFromToday);

            return (
              <div
                key={group.key}
                ref={isToday ? todayRef : undefined}
                className={`px-4 mb-4 transition-all duration-200 ${
                  // Sticky Today header so it stays visible during drag
                  isToday ? 'sticky top-0 z-10 bg-[#1b1a2e] pt-1 pb-1' : ''
                }`}
                style={{ opacity }}
              >
                <DayGroupHeader
                  label={group.label}
                  subLabel={group.subLabel}
                  count={group.notes.length}
                />

                {/* Drop zone highlight when dragging over Today */}
                {isToday && dragging && (
                  <div
                    className={`mb-2 rounded-xl border-2 px-4 py-2.5 transition-all duration-150 ${
                      isOverToday
                        ? 'border-[#38b089] bg-[#38b089]/10'
                        : 'border-[#38b089]/25 bg-transparent'
                    }`}
                  >
                    <p className={`text-center text-[11px] font-medium transition-colors ${
                      isOverToday ? 'text-[#38b089]' : 'text-[#38b089]/50'
                    }`}>
                      ↑ Release to move here
                    </p>
                  </div>
                )}

                {group.notes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={onDelete}
                    onMarkDone={onMarkDone}
                    onTap={onSelect}
                    onLongPress={handleLongPress}
                    isDraggable={!isToday && note.status === 'EXPANDED'}
                    isDragging={dragging?.id === note.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Ghost card — fixed, follows the touch */}
      {dragging && (
        <GhostCard
          note={dragging.note}
          clientY={dragging.clientY}
          clientX={dragging.clientX}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}
