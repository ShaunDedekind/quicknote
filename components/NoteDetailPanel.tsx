'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { LocalNote, NoteCategory } from '@/lib/types';

interface Props {
  note: LocalNote | null;
  onClose: () => void;
  onCalendarEventCreated: (noteId: string, calendarEventId: string) => void;
  onOpenSettings: () => void;
  onNoteUpdated: (note: LocalNote) => void;
}

const CATEGORY_COLOR: Record<NoteCategory, string> = {
  WORK:     '#4b7fd4',
  PERSONAL: '#9265cc',
  HEALTH:   '#38b089',
  FINANCE:  '#c89b3c',
  OTHER:    '#5c5572',
};

function getUrgency(dueDate: Date): { label: string; color: string } | null {
  const diffHours = (dueDate.getTime() - Date.now()) / 3_600_000;
  if (diffHours < 0) return { label: 'Overdue', color: '#c94e3b' };
  if (diffHours < 24) return { label: 'Urgent', color: '#c94e3b' };
  if (diffHours < 168) return { label: 'Soon', color: '#c89b3c' };
  return null;
}

function formatFullDate(date: Date): string {
  return (
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month:   'long',
      day:     'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

// ---------------------------------------------------------------------------
// Add to Calendar button — three states: idle, loading, done
// ---------------------------------------------------------------------------

function CalendarButton({
  note,
  onCreated,
  onSignInRequest,
}: {
  note: LocalNote;
  onCreated: (calendarEventId: string) => void;
  onSignInRequest: () => void;
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already added
  if (note.calendarEventId) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[#38b089]/10 px-4 py-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38b089" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm font-medium text-[#38b089]">Added to Calendar</span>
      </div>
    );
  }

  // Not signed in — direct to Settings rather than triggering inline OAuth
  if (status === 'unauthenticated') {
    return (
      <button
        onClick={onSignInRequest}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2e2b4a] bg-[#252340] px-4 py-3 text-sm font-medium text-[#877fa0] transition-colors hover:text-[#e8dfc8] active:scale-[0.98]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Connect Google in Settings to add to Calendar
      </button>
    );
  }

  // Session loading
  if (status === 'loading') {
    return (
      <div className="h-12 w-full rounded-xl bg-[#252340] animate-pulse" />
    );
  }

  // Signed in — show Add to Calendar
  const handleAdd = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const { calendarEventId } = (await res.json()) as { calendarEventId: string };
      onCreated(calendarEventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleAdd}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c94e3b] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#b84436] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
            Adding…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Add to Calendar
          </>
        )}
      </button>
      {error && (
        <p className="text-center text-[11px] text-[#c94e3b]">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function NoteDetailPanel({ note, onClose, onCalendarEventCreated, onOpenSettings, onNoteUpdated }: Props) {
  const isOpen = note !== null;

  // Local mirror of calendarEventId so the button updates immediately without
  // waiting for a parent re-render cycle
  const [localEventId, setLocalEventId] = useState<string | null>(null);

  // Correction state
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const correctionInputRef = useRef<HTMLTextAreaElement>(null);

  const handleCreated = (calendarEventId: string) => {
    setLocalEventId(calendarEventId);
    if (note) onCalendarEventCreated(note.id, calendarEventId);
  };

  // Reset local event ID when panel closes
  const handleClose = () => {
    setLocalEventId(null);
    setCorrectionOpen(false);
    setCorrectionText('');
    setCorrectionError(null);
    onClose();
  };

  const handleSubmitCorrection = async () => {
    if (!note || !correctionText.trim()) return;
    setCorrectionLoading(true);
    setCorrectionError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctionText: correctionText.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { note: updated } = (await res.json()) as { note: LocalNote };
      const parsed: LocalNote = {
        ...updated,
        createdAt: new Date(updated.createdAt),
        dueDate: updated.dueDate ? new Date(updated.dueDate) : null,
        reminderAt: updated.reminderAt ? new Date(updated.reminderAt) : null,
        nudgeDates: updated.nudgeDates?.map(d => new Date(d)),
      };
      onNoteUpdated(parsed);
      setCorrectionOpen(false);
      setCorrectionText('');
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : 'Failed to apply correction');
    } finally {
      setCorrectionLoading(false);
    }
  };

  // Close panel then navigate to Settings with Google Account highlight
  const handleGoToSettings = () => {
    handleClose();
    onOpenSettings();
  };

  // Merge parent note with local overrides
  const displayNote = note && localEventId
    ? { ...note, calendarEventId: localEventId }
    : note;

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
          onClick={handleClose}
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

      {displayNote && (
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          {/* Category + type */}
          {(displayNote.category || displayNote.type) && (
            <div className="mb-4 flex items-center gap-2">
              {displayNote.category && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: CATEGORY_COLOR[displayNote.category] }}
                >
                  {displayNote.category.charAt(0) + displayNote.category.slice(1).toLowerCase()}
                </span>
              )}
              {displayNote.category && displayNote.type && (
                <span className="text-[#3d3a5a]">·</span>
              )}
              {displayNote.type && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#5c5572]">
                  {displayNote.type.toLowerCase()}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h1
            className="mb-5 text-[26px] font-semibold leading-tight text-[#e8dfc8]"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            {displayNote.title ?? displayNote.rawContent}
          </h1>

          {/* Description */}
          {displayNote.description && displayNote.description !== displayNote.title && (
            <p className="mb-4 text-[14px] leading-relaxed text-[#877fa0]">
              {displayNote.description}
            </p>
          )}

          {/* Correct this note */}
          {displayNote.status === 'EXPANDED' && (
            <div className="mb-7">
              {!correctionOpen ? (
                <button
                  onClick={() => {
                    setCorrectionOpen(true);
                    setTimeout(() => correctionInputRef.current?.focus(), 50);
                  }}
                  className="text-[11px] font-medium text-[#5c5572] underline-offset-2 hover:text-[#877fa0] transition-colors"
                >
                  Correct this note
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl bg-[#252340] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">
                    What did the AI get wrong?
                  </p>
                  <textarea
                    ref={correctionInputRef}
                    value={correctionText}
                    onChange={e => setCorrectionText(e.target.value)}
                    placeholder='e.g. "Grace is a co-worker" or "this is next Friday not this Friday"'
                    className="min-h-[72px] w-full resize-none rounded-lg bg-[#1b1a2e] px-3 py-2 text-[13px] text-[#e8dfc8] placeholder-[#3d3a5a] outline-none focus:ring-1 focus:ring-[#38b089]/40"
                    disabled={correctionLoading}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmitCorrection}
                      disabled={correctionLoading || !correctionText.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-[#38b089] px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-[#2e9a77] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {correctionLoading ? 'Re-expanding…' : 'Apply'}
                    </button>
                    <button
                      onClick={() => { setCorrectionOpen(false); setCorrectionText(''); setCorrectionError(null); }}
                      disabled={correctionLoading}
                      className="text-[12px] text-[#5c5572] hover:text-[#877fa0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {correctionError && (
                    <p className="text-[11px] text-[#c94e3b]">{correctionError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date / time metadata */}
          {(displayNote.dueDate || displayNote.reminderAt) && (
            <div className="mb-6 flex flex-col gap-4 rounded-xl bg-[#252340] p-4">
              {displayNote.dueDate && (() => {
                const urgency = getUrgency(displayNote.dueDate);
                return (
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
                      <div className="mb-0.5 flex items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">Due</p>
                        {urgency && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: urgency.color, backgroundColor: `${urgency.color}18` }}
                          >
                            {urgency.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#e8dfc8]">{formatFullDate(displayNote.dueDate)}</p>
                    </div>
                  </div>
                );
              })()}

              {displayNote.reminderAt && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2e2b4a]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#877fa0" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">Reminder</p>
                    <p className="text-[13px] text-[#e8dfc8]">{formatFullDate(displayNote.reminderAt)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calendar event details — title, duration, attendees */}
          {(displayNote.calendarWorthy || displayNote.type === 'EVENT') && (
            displayNote.suggestedEventTitle || displayNote.suggestedDuration || displayNote.suggestedAttendees?.length
          ) && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl bg-[#252340] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5c5572]">Event details</p>
              {displayNote.suggestedEventTitle && (
                <p className="text-[13px] text-[#e8dfc8]">{displayNote.suggestedEventTitle}</p>
              )}
              {displayNote.suggestedDuration && (
                <p className="text-[12px] text-[#877fa0]">
                  {displayNote.suggestedDuration >= 60
                    ? `${Math.floor(displayNote.suggestedDuration / 60)}h${displayNote.suggestedDuration % 60 ? ` ${displayNote.suggestedDuration % 60}m` : ''}`
                    : `${displayNote.suggestedDuration} min`}
                </p>
              )}
              {displayNote.suggestedAttendees && displayNote.suggestedAttendees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {displayNote.suggestedAttendees.map(name => (
                    <span key={name} className="rounded-full bg-[#2e2b4a] px-2.5 py-1 text-[11px] text-[#877fa0]">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add to Calendar — shown for calendar-worthy or EVENT-type notes with a due date */}
          {(displayNote.calendarWorthy || displayNote.type === 'EVENT') && displayNote.dueDate && (
            <CalendarButton note={displayNote} onCreated={handleCreated} onSignInRequest={handleGoToSettings} />
          )}
        </div>
      )}
    </div>
  );
}
