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

// Human-readable messages for each Web Speech API error code
const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'audio-capture':      'Microphone not accessible. Check it is connected and not in use by another app.',
  'not-allowed':        'Microphone access was blocked. Allow access in your browser settings and try again.',
  'no-speech':          'No speech detected. Try speaking clearly after tapping the button.',
  'network':            'A network error occurred during recognition. Check your connection.',
  'service-not-allowed':'Speech recognition is not available in this context.',
  'bad-grammar':        'Speech recognition encountered a grammar error.',
  'language-not-supported': 'Your browser does not support the selected language.',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Tracks the microphone permission lifecycle so we can show the right UI
// without asking the browser repeatedly.
type MicStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export default function NoteInput() {
  const [mode, setMode] = useState<NoteSource>('TEXT');
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NoteApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ---------------------------------------------------------------------------
  // Audio recording
  // ---------------------------------------------------------------------------

  // Starts the SpeechRecognition session. Assumes permission is already granted
  // (micStatus === 'granted') — called only after getUserMedia resolves.
  const beginRecognition = useCallback((SpeechRecognitionAPI: typeof SpeechRecognition) => {
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
      if (event.error === 'aborted') return; // user stopped intentionally
      if (event.error === 'not-allowed') {
        setMicStatus('denied');
      }
      setError(SPEECH_ERROR_MESSAGES[event.error] ?? `Microphone error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript('');
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    // 1. Check Web Speech API support
    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) {
      setMicStatus('unavailable');
      return;
    }

    // 2. If permission already confirmed this session, go straight to recording
    if (micStatus === 'granted') {
      beginRecognition(SpeechRecognitionAPI);
      return;
    }

    // 3. Check that getUserMedia is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unavailable');
      setError('Microphone access requires a secure connection (HTTPS).');
      return;
    }

    // 4. Request microphone permission — this triggers the browser prompt
    setMicStatus('requesting');
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // User clicked Block, or the site is already blocked in browser settings
        setMicStatus('denied');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setMicStatus('unavailable');
        setError('No microphone found. Plug one in and try again.');
      } else {
        setMicStatus('idle');
        setError('Could not access the microphone. Try refreshing the page.');
      }
      return;
    }

    // 5. Release the permission-test stream — SpeechRecognition manages its own audio
    stream.getTracks().forEach((t) => t.stop());
    setMicStatus('granted');

    // 6. Now start recognition
    beginRecognition(SpeechRecognitionAPI);
  }, [micStatus, beginRecognition]);

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
              onClick={() => {
                setMode('AUDIO');
                setError(null);
                // Eagerly check for Speech API support so the UI can
                // show the unsupported state before the user taps the mic button.
                if (!getSpeechRecognition()) setMicStatus('unavailable');
              }}
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

              {micStatus === 'unavailable' ? (
                /* ── Browser doesn't support Web Speech API ── */
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <span className="text-2xl">🎙️</span>
                  <p className="text-sm font-medium text-stone-500">
                    Speech recognition not supported
                  </p>
                  <p className="max-w-[220px] text-xs text-stone-400">
                    Try Chrome or Edge on desktop. Switch to Type mode to continue.
                  </p>
                </div>
              ) : micStatus === 'denied' ? (
                /* ── User denied (or OS blocked) microphone access ── */
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <p className="text-sm font-medium text-stone-600">
                    Microphone access blocked
                  </p>
                  <p className="max-w-[240px] text-xs leading-relaxed text-stone-400">
                    Allow microphone access in your browser&apos;s site settings, then refresh and try again.
                  </p>
                </div>
              ) : (
                /* ── Normal record button ── */
                <>
                  <div className="relative">
                    {isRecording && (
                      <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25" />
                    )}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={micStatus === 'requesting'}
                      className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                        isRecording
                          ? 'bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.15)]'
                          : micStatus === 'requesting'
                          ? 'bg-stone-100 text-stone-300 cursor-wait'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'
                      }`}
                      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                      {micStatus === 'requesting' ? <IconSpinner /> : <IconMic />}
                    </button>
                  </div>

                  {/* Status text */}
                  {micStatus === 'requesting' && (
                    <p className="text-sm text-stone-400">Waiting for permission…</p>
                  )}
                  {isRecording && !transcript && (
                    <p className="text-sm text-stone-400 animate-pulse">Listening…</p>
                  )}
                  {transcript ? (
                    <p className="max-w-xs text-center text-sm leading-relaxed text-stone-600">
                      {transcript}
                    </p>
                  ) : !isRecording && micStatus !== 'requesting' ? (
                    <p className="text-sm text-stone-300">Tap to start speaking</p>
                  ) : null}
                </>
              )}

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
