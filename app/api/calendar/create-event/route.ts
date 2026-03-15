import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getValidAccessToken,
  createCalendarEvent,
  CalendarIntegrationError,
} from '@/lib/integrations/calendar';

const bodySchema = z.object({
  noteId: z.string().min(1),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { noteId } = parsed.data;

  // Fetch note — verify it belongs to the current user
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id },
  });

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (!note.dueDate) {
    return NextResponse.json(
      { error: 'Note has no due date' },
      { status: 422 },
    );
  }

  // Idempotent: return existing event ID if already created
  if (note.calendarEventId) {
    return NextResponse.json({ calendarEventId: note.calendarEventId });
  }

  // Get the user's Google account (with stored tokens)
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'google' },
  });

  if (!account?.access_token && !account?.refresh_token) {
    return NextResponse.json(
      { error: 'Google account not connected. Please sign in again.' },
      { status: 401 },
    );
  }

  // Get a valid access token (refresh silently if expired)
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (err) {
    console.error('[calendar/create-event] Token refresh failed:', err);
    return NextResponse.json(
      { error: 'Failed to authenticate with Google. Please sign in again.' },
      { status: 401 },
    );
  }

  // Create the calendar event
  let calendarEventId: string;
  try {
    calendarEventId = await createCalendarEvent(accessToken, {
      title:           note.suggestedEventTitle ?? note.title ?? note.rawContent,
      description:     note.description ?? '',
      startAt:         note.dueDate,
      durationMinutes: note.suggestedDuration ?? 60,
    });
  } catch (err) {
    if (err instanceof CalendarIntegrationError) {
      console.error('[calendar/create-event] Calendar API error:', err.message);
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('[calendar/create-event] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Persist the event ID on the note so the button updates to "Added ✓"
  await prisma.note.update({
    where: { id: noteId },
    data: { calendarEventId },
  });

  return NextResponse.json({ calendarEventId }, { status: 201 });
}
