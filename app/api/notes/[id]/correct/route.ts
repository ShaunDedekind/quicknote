import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expandNoteWithCorrection, NoteExpansionError } from '@/lib/ai/expand';
import { ExpansionParseError } from '@/lib/ai/parse';
import type { ExpandedNoteFields, LocalNote, NoteSource, NoteType, NoteCategory } from '@/lib/types';

const postSchema = z.object({
  correctionText: z.string().min(1, 'Correction text is required').max(2000),
  timezone: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { correctionText, timezone } = parsed.data;

  // Fetch note, verify ownership, and ensure it's in an expandable state
  const note = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    include: { nudgeSchedule: true },
  });

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  if (note.status !== 'EXPANDED') {
    return NextResponse.json({ error: 'Note is not yet expanded' }, { status: 409 });
  }

  // Reconstruct previousExpansion from DB fields
  const previousExpansion: ExpandedNoteFields = {
    type: note.type as NoteType,
    category: note.category as NoteCategory,
    title: note.title ?? '',
    description: note.description ?? '',
    dueDate: note.dueDate ?? null,
    reminderAt: note.reminderAt ?? null,
    nudgeDates: note.nudgeSchedule.map(n => n.scheduledAt),
    calendarWorthy: note.calendarWorthy,
    suggestedEventTitle: note.suggestedEventTitle,
    suggestedDuration: note.suggestedDuration,
    suggestedAttendees: note.suggestedAttendees
      ? (JSON.parse(note.suggestedAttendees) as string[])
      : null,
  };

  // Re-expand with correction
  let corrected: ExpandedNoteFields;
  try {
    corrected = await expandNoteWithCorrection(
      note.rawContent,
      note.source as NoteSource,
      previousExpansion,
      correctionText,
      new Date(),
      timezone,
    );
  } catch (error) {
    if (error instanceof NoteExpansionError || error instanceof ExpansionParseError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[POST /api/notes/[id]/correct] Expansion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Diff old vs new fields to write Correction rows
  const fields: Array<{ key: string; old: string; new: string }> = [];
  const compare = (key: string, oldVal: unknown, newVal: unknown) => {
    const o = oldVal == null ? '' : String(oldVal);
    const n = newVal == null ? '' : String(newVal);
    if (o !== n) fields.push({ key, old: o, new: n });
  };
  compare('type', previousExpansion.type, corrected.type);
  compare('category', previousExpansion.category, corrected.category);
  compare('title', previousExpansion.title, corrected.title);
  compare('description', previousExpansion.description, corrected.description);
  compare('dueDate', previousExpansion.dueDate?.toISOString(), corrected.dueDate?.toISOString());
  compare('reminderAt', previousExpansion.reminderAt?.toISOString(), corrected.reminderAt?.toISOString());
  compare('calendarWorthy', previousExpansion.calendarWorthy, corrected.calendarWorthy);

  // Persist corrected fields + log corrections in a transaction
  const updatedNote = await prisma.$transaction(async tx => {
    // Delete old nudge schedule rows
    await tx.nudgeSchedule.deleteMany({ where: { noteId: id } });

    const updated = await tx.note.update({
      where: { id },
      data: {
        title: corrected.title,
        description: corrected.description,
        type: corrected.type,
        category: corrected.category,
        dueDate: corrected.dueDate,
        reminderAt: corrected.reminderAt,
        nudgeSchedule: {
          create: corrected.nudgeDates.map(d => ({ scheduledAt: d })),
        },
        calendarWorthy: corrected.calendarWorthy,
        suggestedEventTitle: corrected.suggestedEventTitle,
        suggestedDuration: corrected.suggestedDuration,
        suggestedAttendees: corrected.suggestedAttendees
          ? JSON.stringify(corrected.suggestedAttendees)
          : null,
      },
      include: { nudgeSchedule: true },
    });

    // Log each changed field
    if (fields.length > 0) {
      await tx.correction.createMany({
        data: fields.map(f => ({
          noteId: id,
          correctionText,
          rawInput: note.rawContent,
          fieldChanged: f.key,
          oldValue: f.old,
          newValue: f.new,
        })),
      });
    }

    return updated;
  });

  const localNote: LocalNote = {
    id: updatedNote.id,
    rawContent: updatedNote.rawContent,
    source: updatedNote.source as NoteSource,
    status: updatedNote.status as 'PENDING' | 'EXPANDED' | 'ERROR',
    createdAt: updatedNote.createdAt,
    title: updatedNote.title ?? undefined,
    description: updatedNote.description ?? undefined,
    type: (updatedNote.type as NoteType) ?? undefined,
    category: (updatedNote.category as NoteCategory) ?? undefined,
    dueDate: updatedNote.dueDate ?? undefined,
    reminderAt: updatedNote.reminderAt ?? undefined,
    nudgeDates: updatedNote.nudgeSchedule.map(n => n.scheduledAt),
    calendarWorthy: updatedNote.calendarWorthy,
    suggestedEventTitle: updatedNote.suggestedEventTitle,
    suggestedDuration: updatedNote.suggestedDuration,
    suggestedAttendees: updatedNote.suggestedAttendees
      ? (JSON.parse(updatedNote.suggestedAttendees) as string[])
      : null,
    calendarEventId: updatedNote.calendarEventId,
    pinnedToToday: updatedNote.pinnedToToday,
  };

  return NextResponse.json({ note: localNote });
}
