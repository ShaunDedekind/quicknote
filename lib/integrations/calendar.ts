import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CalendarIntegrationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CalendarIntegrationError';
  }
}

// ---------------------------------------------------------------------------
// Token management — silent refresh on expiry
// ---------------------------------------------------------------------------

interface GoogleAccount {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null; // Unix timestamp in seconds
}

async function refreshAccessToken(account: GoogleAccount): Promise<string> {
  if (!account.refresh_token) {
    throw new CalendarIntegrationError(
      'No refresh token available. User must sign in again.',
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refresh_token,
      grant_type:    'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new CalendarIntegrationError(
      `Google token refresh failed (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Persist refreshed token back to DB
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at:   Math.floor(Date.now() / 1000) + data.expires_in,
    },
  });

  return data.access_token;
}

/** Returns a valid (non-expired) access token, refreshing silently if needed. */
export async function getValidAccessToken(account: GoogleAccount): Promise<string> {
  // Treat token as expired if it expires within the next 60 seconds
  const isExpired =
    account.expires_at !== null
      ? account.expires_at * 1000 < Date.now() + 60_000
      : !account.access_token;

  if (!isExpired && account.access_token) {
    return account.access_token;
  }

  return refreshAccessToken(account);
}

// ---------------------------------------------------------------------------
// Calendar event creation
// ---------------------------------------------------------------------------

export interface CalendarEventInput {
  title: string;
  description: string;
  startAt: Date;
  durationMinutes: number;
}

/** Creates an event in the user's primary Google Calendar. Returns the event ID. */
export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEventInput,
): Promise<string> {
  const endAt = new Date(event.startAt.getTime() + event.durationMinutes * 60_000);

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary:     event.title,
        description: event.description,
        start: { dateTime: event.startAt.toISOString() },
        end:   { dateTime: endAt.toISOString() },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new CalendarIntegrationError(
      `Google Calendar API error (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}
