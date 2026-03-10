import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { expandNote, NoteExpansionError } from '@/lib/ai/expand';
import { ExpansionParseError } from '@/lib/ai/parse';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  noteId: z.string().cuid('noteId must be a valid CUID'),
});

// ---------------------------------------------------------------------------
// POST /api/notes/expand
//
// Fetches a PENDING note by ID, runs AI expansion, persists the result,
// and returns the expanded fields.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  // 2. Validate with Zod
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { noteId } = parsed.data;

  // 3. Fetch note from DB
  // TODO: uncomment once Prisma is wired up
  //
  // const note = await prisma.note.findUnique({ where: { id: noteId } });
  //
  // if (!note) {
  //   return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  // }
  //
  // if (note.status !== 'PENDING') {
  //   return NextResponse.json(
  //     { error: `Note is already in status "${note.status}" — only PENDING notes can be expanded` },
  //     { status: 409 },
  //   );
  // }

  // Stub — remove once the DB fetch above is live
  const note = { rawContent: '', source: 'TEXT' as const };

  // 4. Run AI expansion
  let expanded;
  try {
    expanded = await expandNote(note.rawContent, note.source);
  } catch (error) {
    if (error instanceof NoteExpansionError || error instanceof ExpansionParseError) {
      // Surface the message to help with debugging; don't expose internals
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[POST /api/notes/expand] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // 5. Persist expanded fields
  // TODO: uncomment once Prisma is wired up
  //
  // await prisma.note.update({
  //   where: { id: noteId },
  //   data: {
  //     title:       expanded.title,
  //     description: expanded.description,
  //     type:        expanded.type,
  //     category:    expanded.category,
  //     dueDate:     expanded.dueDate,
  //     reminderAt:  expanded.reminderAt,
  //     status:      'EXPANDED',
  //     nudgeSchedule: {
  //       create: expanded.nudgeDates.map((scheduledAt) => ({ scheduledAt })),
  //     },
  //   },
  // });

  // 6. Return
  return NextResponse.json({ noteId, expanded }, { status: 200 });
}
