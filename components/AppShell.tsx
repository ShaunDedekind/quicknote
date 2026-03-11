'use client';

import { useState, useCallback, useEffect } from 'react';
import RecordTab from './RecordTab';
import ListTab from './ListTab';
import BottomTabBar, { type Tab } from './BottomTabBar';
import type { LocalNote, NoteSource } from '@/lib/types';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [notes, setNotes] = useState<LocalNote[]>([]);

  // Load persisted notes on mount
  useEffect(() => {
    fetch('/api/notes')
      .then(res => res.json())
      .then(({ notes: fetched }: { notes: LocalNote[] }) => {
        // Parse date strings back to Date objects
        setNotes(
          fetched.map(n => ({
            ...n,
            createdAt: new Date(n.createdAt),
            dueDate: n.dueDate ? new Date(n.dueDate) : null,
            reminderAt: n.reminderAt ? new Date(n.reminderAt) : null,
            nudgeDates: n.nudgeDates?.map(d => new Date(d)),
          })),
        );
      })
      .catch(err => console.error('[AppShell] Failed to load notes:', err));
  }, []);

  // Called by RecordTab immediately on submit — shows optimistic card, then swaps in DB note.
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
        body: JSON.stringify({ rawContent: content, source }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        console.error('[addNote] API error', res.status, errorBody);
        throw new Error(`HTTP ${res.status}`);
      }

      const { note } = (await res.json()) as { note: LocalNote };

      // Replace optimistic card with real persisted note
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
  }, []);

  const markNoteDone = useCallback((id: string) => {
    setTimeout(() => {
      setNotes(prev => prev.filter(n => n.id !== id));
    }, 300);
  }, []);

  return (
    <div className="flex justify-center bg-[#0a0a0a] h-dvh">
      <div className="relative flex flex-col bg-[#0a0a0a] w-full max-w-[390px] h-dvh border-x border-white/[0.04]">
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {activeTab === 'record' ? (
            <RecordTab onNoteSubmit={addNote} />
          ) : (
            <ListTab notes={notes} onDelete={deleteNote} onMarkDone={markNoteDone} />
          )}
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
