import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { expandNote, NoteExpansionError } from '@/lib/ai/expand';
import { ExpansionParseError } from '@/lib/ai/parse';

// ---------------------------------------------------------------------------
// Request schema
// Accepts raw content directly — DB persist step added once Prisma is wired.
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  rawContent: z.string().min(1, 'Note content is required').max(5000),
  source: z.enum(['TEXT', 'AUDIO']),
});

// ---------------------------------------------------------------------------
// POST /api/notes/expand
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { rawContent, source } = parsed.data;

  let expanded;
  try {
    expanded = await expandNote(rawContent, source);
  } catch (error) {
    if (error instanceof NoteExpansionError || error instanceof ExpansionParseError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[POST /api/notes/expand] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // TODO: once Prisma is wired, persist note + nudgeSchedule rows, return noteId
  return NextResponse.json({ expanded }, { status: 200 });
}
