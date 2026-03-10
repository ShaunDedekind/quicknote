// NOTE: requires `npm install zod` — Zod is the project-standard validation library.
import { z } from 'zod';
import type { ExpandedNoteFields } from '@/lib/types';

// ---------------------------------------------------------------------------
// Zod schema for Claude's raw JSON response
// Dates arrive as ISO 8601 strings; we coerce them to Date objects.
// ---------------------------------------------------------------------------

const isoDateSchema = z
  .string()
  .refine((s) => !isNaN(Date.parse(s)), 'Expected a valid ISO 8601 datetime string')
  .transform((s) => new Date(s));

const expansionResponseSchema = z.object({
  type: z.enum(['TASK', 'REMINDER', 'EVENT', 'INFO']),
  category: z.enum(['WORK', 'PERSONAL', 'HEALTH', 'FINANCE', 'OTHER']),
  title: z.string().min(1).max(60),
  description: z.string().min(1),
  dueDate: z.union([isoDateSchema, z.null()]),
  reminderAt: z.union([isoDateSchema, z.null()]),
  nudgeDates: z
    .array(isoDateSchema)
    .max(3, 'Claude returned more than 3 nudge dates'),
});

// ---------------------------------------------------------------------------
// Parse error — thrown when Claude's response is malformed or invalid
// ---------------------------------------------------------------------------

export class ExpansionParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExpansionParseError';
  }
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseExpansionResponse(raw: string): ExpandedNoteFields {
  // Claude occasionally wraps JSON in markdown fences despite instructions.
  // Strip them defensively before parsing.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new ExpansionParseError(
      'Claude response was not valid JSON',
      raw,
      err,
    );
  }

  const result = expansionResponseSchema.safeParse(parsed);

  if (!result.success) {
    throw new ExpansionParseError(
      `Claude response failed validation: ${result.error.message}`,
      raw,
      result.error,
    );
  }

  const { type, category, title, description, dueDate, reminderAt, nudgeDates } =
    result.data;

  return {
    type,
    category,
    title,
    description,
    dueDate,
    reminderAt,
    nudgeDates,
  };
}
