// NOTE: requires `npm install @anthropic-ai/sdk`
import Anthropic from '@anthropic-ai/sdk';
import type { NoteSource, ExpandedNoteFields } from '@/lib/types';
import { EXPANSION_SYSTEM_PROMPT, buildExpansionUserMessage } from '@/lib/ai/prompts';
import { parseExpansionResponse } from '@/lib/ai/parse';
export { ExpansionParseError } from '@/lib/ai/parse';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';

// 1024 is ample for the JSON response shape. Raise if descriptions grow long.
const MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Singleton client
// SDK reads ANTHROPIC_API_KEY from env automatically — never pass it explicitly.
// Singleton is safe in Next.js: module is cached per worker process.
// ---------------------------------------------------------------------------

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class NoteExpansionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'NoteExpansionError';
  }
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function expandNote(
  rawContent: string,
  source: NoteSource,
  now: Date = new Date(),
  timezone?: string,
): Promise<ExpandedNoteFields> {
  const userMessage = buildExpansionUserMessage({ rawContent, source, now, timezone });

  let response: Anthropic.Message;

  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: EXPANSION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    // Use SDK typed exceptions — never string-match error messages
    if (error instanceof Anthropic.AuthenticationError) {
      throw new NoteExpansionError(
        'Invalid Anthropic API key — check ANTHROPIC_API_KEY in .env.local',
        error,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new NoteExpansionError(
        'Anthropic API rate limit reached — retry after a short delay',
        error,
      );
    }
    if (error instanceof Anthropic.InternalServerError) {
      throw new NoteExpansionError(
        'Anthropic API server error — safe to retry',
        error,
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new NoteExpansionError(
        `Anthropic API error (${error.status}): ${error.message}`,
        error,
      );
    }
    throw new NoteExpansionError('Unexpected error calling Anthropic API', error);
  }

  // Anything other than end_turn means the response is incomplete or refused
  if (response.stop_reason !== 'end_turn') {
    throw new NoteExpansionError(
      `Unexpected stop reason "${response.stop_reason}". ` +
        'If "max_tokens", increase MAX_TOKENS. If "refusal", check the prompt.',
    );
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );

  if (!textBlock) {
    throw new NoteExpansionError('Claude response contained no text block');
  }

  // parseExpansionResponse throws ExpansionParseError on invalid/malformed JSON —
  // let it bubble; callers can catch both error types separately.
  return parseExpansionResponse(textBlock.text);
}

// ---------------------------------------------------------------------------
// Correction re-expansion
// Builds its own user message (original note + previous AI output + correction).
// Reuses the same system prompt and parser — no changes to prompts.ts needed.
// ---------------------------------------------------------------------------

export async function expandNoteWithCorrection(
  rawContent: string,
  source: NoteSource,
  previousExpansion: ExpandedNoteFields,
  correctionText: string,
  now: Date = new Date(),
  timezone?: string,
): Promise<ExpandedNoteFields> {
  const localTime = (() => {
    try {
      if (timezone) {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        }).format(now);
      }
    } catch {
      // invalid timezone — fall through to UTC only
    }
    return null;
  })();

  const previousJson = JSON.stringify({
    type: previousExpansion.type,
    category: previousExpansion.category,
    title: previousExpansion.title,
    description: previousExpansion.description,
    dueDate: previousExpansion.dueDate?.toISOString() ?? null,
    reminderAt: previousExpansion.reminderAt?.toISOString() ?? null,
    nudgeDates: previousExpansion.nudgeDates.map(d => d.toISOString()),
    calendarWorthy: previousExpansion.calendarWorthy,
    suggestedEventTitle: previousExpansion.suggestedEventTitle,
    suggestedDuration: previousExpansion.suggestedDuration,
    suggestedAttendees: previousExpansion.suggestedAttendees,
  }, null, 2);

  const lines: string[] = [
    `Current UTC time: ${now.toISOString()}`,
  ];
  if (localTime) lines.push(`User's local time: ${localTime}${timezone ? ` (${timezone})` : ''}`);
  lines.push(
    `Original ${source === 'AUDIO' ? 'voice' : 'text'} note:`,
    `"""${rawContent}"""`,
    '',
    'Previous AI expansion:',
    previousJson,
    '',
    `User correction: "${correctionText}"`,
    '',
    'Re-expand the note applying this correction. Return the same JSON schema.',
  );

  const userMessage = lines.join('\n');

  let response: Anthropic.Message;

  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: EXPANSION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new NoteExpansionError('Invalid Anthropic API key — check ANTHROPIC_API_KEY in .env.local', error);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new NoteExpansionError('Anthropic API rate limit reached — retry after a short delay', error);
    }
    if (error instanceof Anthropic.InternalServerError) {
      throw new NoteExpansionError('Anthropic API server error — safe to retry', error);
    }
    if (error instanceof Anthropic.APIError) {
      throw new NoteExpansionError(`Anthropic API error (${error.status}): ${error.message}`, error);
    }
    throw new NoteExpansionError('Unexpected error calling Anthropic API', error);
  }

  if (response.stop_reason !== 'end_turn') {
    throw new NoteExpansionError(
      `Unexpected stop reason "${response.stop_reason}". If "max_tokens", increase MAX_TOKENS.`,
    );
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );

  if (!textBlock) {
    throw new NoteExpansionError('Claude response contained no text block');
  }

  return parseExpansionResponse(textBlock.text);
}
