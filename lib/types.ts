// Shared TypeScript types for QuickNote
// All domain types live here — never use `any`

export type NoteType = 'task' | 'reminder' | 'event' | 'info';

export type NoteCategory =
  | 'work'
  | 'personal'
  | 'health'
  | 'finance'
  | 'other';

export type NoteStatus = 'pending' | 'expanded' | 'dismissed' | 'done';

export type NoteSource = 'text' | 'audio';

export interface RawNote {
  content: string;
  source: NoteSource;
  createdAt: Date;
}

export interface ExpandedNote {
  title: string;
  description: string;
  type: NoteType;
  category: NoteCategory;
  dueDate: Date | null;
  reminderAt: Date | null;
  nudgeSchedule: Date[];
}

export interface Note extends RawNote, ExpandedNote {
  id: string;
  userId: string;
  status: NoteStatus;
  calendarEventId: string | null;
  updatedAt: Date;
}

export interface NoteCreateInput {
  content: string;
  source: NoteSource;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  calendarId: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}
