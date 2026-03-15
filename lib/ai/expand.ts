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
