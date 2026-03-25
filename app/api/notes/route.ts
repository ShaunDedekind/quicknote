import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expandNote, NoteExpansionError } from '@/lib/ai/expand';
import { ExpansionParseError } from '@/lib/ai/parse';
import type { LocalNote, NoteSource, NoteType, NoteCategory } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLocalNote(
  note: {
    id: string;
    rawContent: string;
    source: string;
    status: string;
    createdAt: Date;
    title: string | null;
    description: string | null;
    type: string | null;
    category: string | null;
    dueDate: Date | null;
    reminderAt: Date | null;
    nudgeSchedule: { scheduledAt: Date }[];
    calendarWorthy: boolean;
    suggestedEventTitle: string | null;
    suggestedDuration: number | null;
    calendarEventId: string | null;
  },
): LocalNote {
  return {
    id: note.id,
    rawContent: note.rawContent,
    source: note.source as NoteSource,
    status: note.status as 'PENDING' | 'EXPANDED' | 'ERROR',
    createdAt: note.createdAt,
    title: note.title ?? undefined,
    description: note.description ?? undefined,
    type: (note.type as NoteType) ?? undefined,
    category: (note.category as NoteCategory) ?? undefined,
    dueDate: note.dueDate ?? undefined,
    reminderAt: note.reminderAt ?? undefined,
    nudgeDates: note.nudgeSchedule.map(n => n.scheduledAt),
    calendarWorthy: note.calendarWorthy,
    suggestedEventTitle: note.suggestedEventTitle,
    suggestedDuration: note.suggestedDuration,
    calendarEventId: note.calendarEventId,
  };
}

// ---------------------------------------------------------------------------
// GET /api/notes — return all notes ordered newest first
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notes = await prisma.note.findMany({
    where: { userId: session.user.id, status: { notIn: ['DONE', 'DISMISSED'] } },
    orderBy: { createdAt: 'desc' },
    include: { nudgeSchedule: true },
  });

  return NextResponse.json({ notes: notes.map(toLocalNote) });
}

// ---------------------------------------------------------------------------
// POST /api/notes — save raw note, expand via AI, return expanded note
// ---------------------------------------------------------------------------

const postSchema = z.object({
  rawContent: z.string().min(1, 'Note content is required').max(5000),
  source: z.enum(['TEXT', 'AUDIO']),
  timezone: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { rawContent, source, timezone } = parsed.data;

  // Save raw note immediately as PENDING
  const note = await prisma.note.create({
    data: { rawContent, source, status: 'PENDING', userId: session.user.id },
    include: { nudgeSchedule: true },
  });

  // Expand via AI
  let expanded;
  try {
    expanded = await expandNote(rawContent, source, new Date(), timezone);
  } catch (error) {
    await prisma.note.update({ where: { id: note.id }, data: { status: 'ERROR' } });
    if (error instanceof NoteExpansionError || error instanceof ExpansionParseError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error('[POST /api/notes] Expansion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Persist expanded fields + nudge schedule + calendar fields
  const updatedNote = await prisma.note.update({
    where: { id: note.id },
    data: {
      status: 'EXPANDED',
      title: expanded.title,
      description: expanded.description,
      type: expanded.type,
      category: expanded.category,
      dueDate: expanded.dueDate,
      reminderAt: expanded.reminderAt,
      nudgeSchedule: {
        create: expanded.nudgeDates.map(d => ({ scheduledAt: d })),
      },
      calendarWorthy: expanded.calendarWorthy,
      suggestedEventTitle: expanded.suggestedEventTitle,
      suggestedDuration: expanded.suggestedDuration,
      suggestedAttendees: expanded.suggestedAttendees
        ? JSON.stringify(expanded.suggestedAttendees)
        : null,
    },
    include: { nudgeSchedule: true },
  });

  return NextResponse.json({ note: toLocalNote(updatedNote) }, { status: 201 });
}
