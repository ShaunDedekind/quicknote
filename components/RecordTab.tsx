'use client';

import { useState, useCallback, useRef } from 'react';
import type { NoteSource } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

type MicStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

interface WindowWithSpeech extends Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}

const SPEECH_ERRORS: Record<string, string> = {
  'audio-capture':          'Microphone not accessible. Check it is connected and not in use.',
  'not-allowed':            'Microphone access was blocked.',
  'no-speech':              'No speech detected. Try speaking clearly.',
  'network':                'Network error during recognition. Check your connection.',
  'service-not-allowed':    'Speech recognition unavailable in this context.',
  'bad-grammar':            'Speech recognition grammar error.',
  'language-not-supported': 'Language not supported by your browser.',
};

function getSpeechAPI(): typeof SpeechRecognition | null {
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function MicIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onNoteSubmit: (content: string, source: NoteSource) => void;
}

export default function RecordTab({ onNoteSubmit }: Props) {
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');

  const updateTranscript = useCallback((t: string) => {
    transcriptRef.current = t;
    setTranscript(t);
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    (content: string, source: NoteSource) => {
      if (!content.trim()) return;
      onNoteSubmit(content.trim(), source);
      setShowDone(true);
      setTimeout(() => {
        setShowDone(false);
        updateTranscript('');
        setTextInput('');
        setErrorMsg(null);
      }, 1800);
    },
    [onNoteSubmit, updateTranscript],
  );

  // ---------------------------------------------------------------------------
  // Audio recording
  // ---------------------------------------------------------------------------

  const beginRecognition = useCallback(
    (SpeechAPI: typeof SpeechRecognition) => {
      const recognition = new SpeechAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += chunk;
          else interim += chunk;
        }
        const t = final || interim;
        transcriptRef.current = t;
        setTranscript(t);
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted') return;
        if (e.error === 'not-allowed') setMicStatus('denied');
        setErrorMsg(SPEECH_ERRORS[e.error] ?? `Microphone error: ${e.error}`);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (transcriptRef.current.trim()) {
          handleSubmit(transcriptRef.current, 'AUDIO');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      updateTranscript('');
      setErrorMsg(null);
    },
    [handleSubmit, updateTranscript],
  );

  const startRecording = useCallback(async () => {
    const SpeechAPI = getSpeechAPI();
    if (!SpeechAPI) {
      setMicStatus('unavailable');
      return;
    }

    if (micStatus === 'granted') {
      beginRecognition(SpeechAPI);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('unavailable');
      setErrorMsg('Microphone requires a secure connection (HTTPS).');
      return;
    }

    setMicStatus('requesting');
    setErrorMsg(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setMicStatus('denied');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setMicStatus('unavailable');
        setErrorMsg('No microphone found. Plug one in and try again.');
      } else {
        setMicStatus('idle');
        setErrorMsg('Could not access the microphone. Try refreshing.');
      }
      return;
    }

    stream.getTracks().forEach(t => t.stop());
    setMicStatus('granted');
    beginRecognition(SpeechAPI);
  }, [micStatus, beginRecognition]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="absolute inset-0 flex flex-col items-center px-6 pt-10 pb-4 overflow-hidden">
      {/* Wordmark */}
      <p className="text-[11px] font-bold tracking-[0.28em] text-neutral-600 uppercase select-none">
        QuickNote
      </p>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 w-full">

        {/* ── Captured confirmation ── */}
        {showDone && (
          <div
            className="flex flex-col items-center gap-4"
            style={{ animation: 'fade-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
          >
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-emerald-500/10">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[15px] font-semibold text-neutral-100">Captured</p>
              <p className="text-xs text-neutral-600">AI is expanding your note</p>
            </div>
          </div>
        )}

        {/* ── Normal UI ── */}
        {!showDone && (
          <>
            {/* Mic / unavailable / denied */}
            {micStatus === 'unavailable' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#1a1a1a]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#404040" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
                    <line x1="3" y1="3" x2="21" y2="21" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-400">Speech recognition unavailable</p>
                <p className="text-xs text-neutral-600 max-w-[200px] leading-relaxed">
                  Try Chrome or Edge. Use text mode below.
                </p>
              </div>
            ) : micStatus === 'denied' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#1a1a1a]">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#404040" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-300">Microphone blocked</p>
                <p className="text-xs text-neutral-600 max-w-[220px] leading-relaxed">
                  Allow microphone access in your browser&apos;s site settings, then refresh.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                {/* Mic button + ambient glow */}
                <div className="relative flex items-center justify-center">
                  {/* Ambient glow pool — sits below the button */}
                  <div
                    className={`absolute w-[200px] h-[60px] rounded-full blur-[64px] pointer-events-none transition-colors duration-700 ${
                      isRecording ? 'bg-amber-500' : 'bg-white'
                    }`}
                    style={{
                      animation: isRecording ? 'glow-pulse 2s ease-in-out infinite' : 'none',
                      opacity: isRecording ? undefined : 0.04,
                    }}
                  />

                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={micStatus === 'requesting'}
                    className={`relative z-10 flex h-[104px] w-[104px] items-center justify-center rounded-full transition-all duration-200 active:scale-[0.92] ${
                      isRecording
                        ? 'bg-amber-500 text-white'
                        : micStatus === 'requesting'
                          ? 'bg-[#1a1a1a] text-neutral-700 cursor-wait'
                          : 'bg-[#1a1a1a] text-neutral-400 hover:text-neutral-200'
                    }`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    {micStatus === 'requesting' ? (
                      <SpinnerIcon />
                    ) : isRecording ? (
                      <StopIcon />
                    ) : (
                      <MicIcon />
                    )}
                  </button>
                </div>

                {/* Status / transcript */}
                <div className="flex min-h-[48px] flex-col items-center justify-center gap-1.5">
                  {micStatus === 'requesting' && (
                    <p className="text-sm text-neutral-600">Waiting for permission…</p>
                  )}
                  {isRecording && !transcript && (
                    <p className="text-sm text-neutral-600 animate-pulse">Listening…</p>
                  )}
                  {transcript ? (
                    <p className="max-w-[260px] text-center text-sm leading-relaxed text-neutral-300">
                      {transcript}
                    </p>
                  ) : !isRecording && micStatus !== 'requesting' ? (
                    <p className="text-sm text-neutral-700">Tap to capture</p>
                  ) : null}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex w-full max-w-[300px] items-center gap-3">
              <div className="h-px flex-1 bg-neutral-800" />
              <span className="text-[11px] tracking-wide text-neutral-700">or type</span>
              <div className="h-px flex-1 bg-neutral-800" />
            </div>

            {/* Text input */}
            <div className="w-full max-w-[320px]">
              <div className="flex items-end gap-2">
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmit(textInput, 'TEXT');
                    }
                  }}
                  placeholder="Remind me to…"
                  rows={2}
                  disabled={isRecording}
                  className="flex-1 resize-none rounded-2xl border border-neutral-800 bg-[#1a1a1a] px-4 py-3 text-sm leading-relaxed text-neutral-200 placeholder:text-neutral-700 outline-none transition-colors focus:border-neutral-700 disabled:opacity-30"
                />
                {textInput.trim() && !isRecording && (
                  <button
                    onClick={() => handleSubmit(textInput, 'TEXT')}
                    className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-neutral-500 transition-all hover:text-neutral-200 active:scale-[0.92] border border-neutral-800"
                    aria-label="Submit note"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
              {textInput.trim() && !isRecording && (
                <p className="mt-1.5 text-right text-[10px] text-neutral-700">⌘ Enter</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {errorMsg && !showDone && (
        <div className="mb-2">
          <p className="max-w-[260px] text-center text-xs text-red-500">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
