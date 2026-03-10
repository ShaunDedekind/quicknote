'use client';

import { useState, useRef, useCallback } from 'react';
import type { NoteSource } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Dates arrive as ISO strings over JSON — separate from ExpandedNoteFields
interface NoteApiResult {
  type: string;
  category: string;
  title: string;
  description: string;
  dueDate: string | null;
  reminderAt: string | null;
  nudgeDates: string[];
}

// Extend Window to type the webkit-prefixed SpeechRecognition
interface WindowWithSpeech extends Window {
  webkitSpeechRecognition: typeof SpeechRecognition;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  WORK:     'bg-blue-50 text-blue-600',
  PERSONAL: 'bg-violet-50 text-violet-600',
  HEALTH:   'bg-emerald-50 text-emerald-600',
  FINANCE:  'bg-amber-50 text-amber-600',
  OTHER:    'bg-stone-100 text-stone-500',
};

const TYPE_LABELS: Record<string, string> = {
  TASK:     'Task',
  REMINDER: 'Reminder',
  EVENT:    'Event',
  INFO:     'Info',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  if ('SpeechRecognition' in window) return window.SpeechRecognition;
  if ('webkitSpeechRecognition' in window)
    return (window as WindowWithSpeech).webkitSpeechRecognition;
  return null;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no extra dependency)
// ---------------------------------------------------------------------------

function IconPen() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NoteInput() {
  const [mode, setMode] = useState<NoteSource>('TEXT');
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NoteApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ---------------------------------------------------------------------------
  // Audio recording
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      setTranscript(final || interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        setError(`Microphone error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript('');
    setError(null);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const rawContent = mode === 'TEXT' ? text.trim() : transcript.trim();
  const canSubmit = rawContent.length > 0 && !isLoading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/notes/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent, source: mode }),
      });

      const data: { expanded?: NoteApiResult; error?: string } = await res.json();

      if (!res.ok || !data.expanded) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data.expanded);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">

      {/* ── Input card ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white shadow-[0_2px_24px_-4px_rgba(0,0,0,0.08)] ring-1 ring-stone-100 overflow-hidden">

        {/* Mode toggle */}
        <div className="px-5 pt-5">
          <div className="inline-flex items-center rounded-full bg-stone-100 p-1 text-sm font-medium">
            <button
              onClick={() => { setMode('TEXT'); setError(null); }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all duration-200 ${
                mode === 'TEXT'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <IconPen /> Type
            </button>
            <button
              onClick={() => { setMode('AUDIO'); setError(null); }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all duration-200 ${
                mode === 'AUDIO'
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <IconMic /> Speak
            </button>
          </div>
        </div>

        {/* Input area */}
        <div className="px-5 py-4 min-h-[140px] flex flex-col justify-center">
          {mode === 'TEXT' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              placeholder="What's on your mind? Try 'remind me to call the dentist on Friday'"
              rows={4}
              className="w-full resize-none bg-transparent text-base text-stone-800 placeholder:text-stone-300 outline-none leading-relaxed"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Record button with ping animation */}
              <div className="relative">
                {isRecording && (
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25" />
                )}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.15)]'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'
                  }`}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  <IconMic />
                </button>
              </div>

              {/* Transcript / status */}
              {isRecording && !transcript && (
                <p className="text-sm text-stone-400 animate-pulse">Listening…</p>
              )}
              {transcript ? (
                <p className="max-w-xs text-center text-sm leading-relaxed text-stone-600">
                  {transcript}
                </p>
              ) : !isRecording ? (
                <p className="text-sm text-stone-300">Tap to start speaking</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-stone-50" />

        {/* Submit */}
        <div className="px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all duration-200 ${
              canSubmit
                ? 'bg-stone-900 text-white hover:bg-stone-700 active:scale-[0.99]'
                : 'bg-stone-100 text-stone-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <IconSpinner />
                <span>Expanding…</span>
              </>
            ) : (
              'Expand note →'
            )}
          </button>

          {mode === 'TEXT' && (
            <p className="mt-2 text-center text-xs text-stone-300">
              ⌘ Enter to submit
            </p>
          )}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100"
          style={{ animation: 'slide-up 0.3s ease forwards' }}>
          {error}
        </div>
      )}

      {/* ── Result card ────────────────────────────────────────────────── */}
      {result && (
        <div
          className="rounded-3xl bg-white shadow-[0_2px_24px_-4px_rgba(0,0,0,0.08)] ring-1 ring-stone-100 p-6"
          style={{ animation: 'slide-up 0.4s ease forwards' }}
        >
          {/* Header: type + category */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-stone-300">
              {TYPE_LABELS[result.type] ?? result.type}
            </span>
            <span className="text-stone-200">·</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[result.category] ?? CATEGORY_STYLES.OTHER}`}>
              {result.category.charAt(0) + result.category.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold leading-snug text-stone-900">
            {result.title}
          </h2>

          {/* Description */}
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            {result.description}
          </p>

          {/* Dates */}
          {(result.dueDate || result.reminderAt) && (
            <div className="mt-5 flex flex-col gap-2">
              {result.dueDate && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <span className="text-stone-300"><IconCalendar /></span>
                  <span className="font-medium text-stone-700">Due</span>
                  {formatDate(result.dueDate)}
                </div>
              )}
              {result.reminderAt && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <span className="text-stone-300"><IconBell /></span>
                  <span className="font-medium text-stone-700">Remind</span>
                  {formatDate(result.reminderAt)}
                </div>
              )}
            </div>
          )}

          {/* Nudge dates */}
          {result.nudgeDates.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-300">
                Nudges
              </p>
              <div className="flex flex-wrap gap-2">
                {result.nudgeDates.map((iso) => (
                  <span
                    key={iso}
                    className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-3 py-1 text-xs text-stone-500 ring-1 ring-stone-100"
                  >
                    <IconBell />
                    {formatDate(iso)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => {
              setResult(null);
              setText('');
              setTranscript('');
              setError(null);
            }}
            className="mt-6 text-xs text-stone-300 hover:text-stone-500 transition-colors"
          >
            ← Start a new note
          </button>
        </div>
      )}
    </div>
  );
}
