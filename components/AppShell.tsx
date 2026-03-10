'use client';

import { useState, useCallback } from 'react';
import RecordTab from './RecordTab';
import ListTab from './ListTab';
import BottomTabBar, { type Tab } from './BottomTabBar';
import type { LocalNote, NoteSource, NoteType, NoteCategory } from '@/lib/types';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [notes, setNotes] = useState<LocalNote[]>([]);

  // Called by RecordTab immediately on submit — fires API in background.
  const addNote = useCallback(async (content: string, source: NoteSource) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setNotes(prev => [
      {
        id,
        rawContent: content,
        source,
        status: 'PENDING',
        createdAt: new Date(),
      },
      ...prev,
    ]);

    try {
      const res = await fetch('/api/notes/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent: content, source }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        console.error('[addNote] API error', res.status, errorBody);
        throw new Error(`HTTP ${res.status}`);
      }

      const { expanded } = (await res.json()) as {
        expanded: {
          title: string;
          description: string;
          type: string;
          category: string;
          dueDate: string | null;
          reminderAt: string | null;
          nudgeDates: string[];
        };
      };

      setNotes(prev =>
        prev.map(n =>
          n.id === id
            ? {
                ...n,
                status: 'EXPANDED' as const,
                title: expanded.title,
                description: expanded.description,
                type: expanded.type as NoteType,
                category: expanded.category as NoteCategory,
                dueDate: expanded.dueDate ? new Date(expanded.dueDate) : null,
                reminderAt: expanded.reminderAt ? new Date(expanded.reminderAt) : null,
                nudgeDates: expanded.nudgeDates.map(d => new Date(d)),
              }
            : n,
        ),
      );
    } catch (err) {
      console.error('[addNote] Failed to expand note:', err);
      setNotes(prev =>
        prev.map(n => (n.id === id ? { ...n, status: 'ERROR' as const } : n)),
      );
    }
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const markNoteDone = useCallback((id: string) => {
    // Brief pause to let swipe animation complete, then remove
    setTimeout(() => {
      setNotes(prev => prev.filter(n => n.id !== id));
    }, 300);
  }, []);

  return (
    <div className="flex justify-center bg-stone-100 h-dvh">
      <div className="relative flex flex-col bg-white w-full max-w-[390px] h-dvh shadow-[0_0_60px_rgba(0,0,0,0.07)]">
        {/* Tab content area — both tabs use absolute positioning to fill this */}
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
