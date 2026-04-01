'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import RecordTab from './RecordTab';
import ListTab from './ListTab';
import SettingsTab from './SettingsTab';
import BottomTabBar, { type Tab } from './BottomTabBar';
import NoteDetailPanel from './NoteDetailPanel';
import type { LocalNote, NoteSource } from '@/lib/types';

function parseNotes(fetched: LocalNote[]): LocalNote[] {
  return fetched.map(n => ({
    ...n,
    createdAt: new Date(n.createdAt),
    dueDate: n.dueDate ? new Date(n.dueDate) : null,
    reminderAt: n.reminderAt ? new Date(n.reminderAt) : null,
    nudgeDates: n.nudgeDates?.map(d => new Date(d)),
  }));
}

export default function AppShell() {
  const { status: sessionStatus } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<LocalNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<LocalNote | null>(null);
  const [highlightGoogleAccount, setHighlightGoogleAccount] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes whenever the user becomes authenticated
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/notes')
      .then(res => {
        if (!res.ok) return;
        return res.json().then(({ notes: fetched, recentlyCompleted: fetchedCompleted }: { notes: LocalNote[]; recentlyCompleted: LocalNote[] }) => {
          setNotes(parseNotes(fetched));
          setRecentlyCompleted(parseNotes(fetchedCompleted ?? []));
        });
      })
      .catch(err => console.error('[AppShell] Failed to load notes:', err));
  }, [sessionStatus]);

  // Navigate to Settings and briefly highlight the Google Account section
  const handleOpenSettings = useCallback(() => {
    setActiveTab('settings');
    setHighlightGoogleAccount(true);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightGoogleAccount(false), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const addNote = useCallback(async (content: string, source: NoteSource) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setNotes(prev => [
      { id: tempId, rawContent: content, source, status: 'PENDING', createdAt: new Date() },
      ...prev,
    ]);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: content,
          source,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        console.error('[addNote] API error', res.status, errorBody);
        throw new Error(`HTTP ${res.status}`);
      }

      const { note } = (await res.json()) as { note: LocalNote };

      setNotes(prev =>
        prev.map(n =>
          n.id === tempId
            ? {
                ...note,
                createdAt: new Date(note.createdAt),
                dueDate: note.dueDate ? new Date(note.dueDate) : null,
                reminderAt: note.reminderAt ? new Date(note.reminderAt) : null,
                nudgeDates: note.nudgeDates?.map(d => new Date(d)),
              }
            : n,
        ),
      );
    } catch (err) {
      console.error('[addNote] Failed:', err);
      setNotes(prev =>
        prev.map(n => (n.id === tempId ? { ...n, status: 'ERROR' as const } : n)),
      );
    }
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setSelectedNote(prev => (prev?.id === id ? null : prev));
    // Only persist real DB notes (temp IDs start with "local-")
    if (!id.startsWith('local-')) {
      fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED' }),
      }).catch(err => console.error('[deleteNote] Failed to persist:', err));
    }
  }, []);

  const markNoteDone = useCallback((id: string) => {
    setTimeout(() => {
      setNotes(prev => prev.filter(n => n.id !== id));
      setSelectedNote(prev => (prev?.id === id ? null : prev));
    }, 300);
    if (!id.startsWith('local-')) {
      fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      }).catch(err => console.error('[markNoteDone] Failed to persist:', err));
    }
  }, []);

  const handleCalendarEventCreated = useCallback(
    (noteId: string, calendarEventId: string) => {
      setNotes(prev =>
        prev.map(n => (n.id === noteId ? { ...n, calendarEventId } : n)),
      );
    },
    [],
  );

  const handleNoteUpdated = useCallback((updated: LocalNote) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setSelectedNote(updated);
  }, []);

  const pinToToday = useCallback((id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinnedToToday: true } : n));
    fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinnedToToday: true }),
    }).catch(err => console.error('[pinToToday] Failed to persist:', err));
  }, []);

  return (
    <div className="flex justify-center bg-[#0f0e1a] h-dvh">
      <div className="relative flex flex-col bg-[#1b1a2e] w-full max-w-[390px] h-dvh border-x border-white/[0.04]">
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {activeTab === 'record' ? (
            <RecordTab onNoteSubmit={addNote} />
          ) : activeTab === 'list' ? (
            <ListTab
              notes={notes}
              recentlyCompleted={recentlyCompleted}
              onDelete={deleteNote}
              onMarkDone={markNoteDone}
              onSelect={setSelectedNote}
              onPinToToday={pinToToday}
            />
          ) : (
            <SettingsTab highlightGoogleAccount={highlightGoogleAccount} />
          )}

          {/* Slide-in detail panel — rendered over all tabs */}
          <NoteDetailPanel
            note={selectedNote}
            onClose={() => setSelectedNote(null)}
            onCalendarEventCreated={handleCalendarEventCreated}
            onOpenSettings={handleOpenSettings}
            onNoteUpdated={handleNoteUpdated}
          />
        </div>

        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          noteCount={notes.length}
        />
      </div>
    </div>
  );
}
