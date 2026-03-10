// Shared TypeScript types for QuickNote
// All domain types live here — never use `any`
// Enum string values match Prisma schema exactly so Prisma's generated types are assignable here.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type NoteSource = 'TEXT' | 'AUDIO';

export type NoteType = 'TASK' | 'REMINDER' | 'EVENT' | 'INFO';

export type NoteCategory = 'WORK' | 'PERSONAL' | 'HEALTH' | 'FINANCE' | 'OTHER';

export type NoteStatus = 'PENDING' | 'EXPANDED' | 'DISMISSED' | 'DONE';

// ---------------------------------------------------------------------------
// Nudge schedule
// Stored as a separate table; each entry is one scheduled nudge datetime.
// ---------------------------------------------------------------------------

export interface NudgeScheduleEntry {
  id: string;
  noteId: string;
  scheduledAt: Date;
}

// ---------------------------------------------------------------------------
// Note
// Expanded fields are nullable — they are null while status === 'PENDING'.
// ---------------------------------------------------------------------------

export interface Note {
  id: string;
  userId: string;

  // Raw input
  rawContent: string;
  source: NoteSource;

  // AI-expanded fields (null until EXPANDED)
  title: string | null;
  description: string | null;
  type: NoteType | null;
  category: NoteCategory | null;
  dueDate: Date | null;
  reminderAt: Date | null;

  // Nudge schedule entries for this note
  nudgeSchedule: NudgeScheduleEntry[];

  // Integration
  calendarEventId: string | null;

  // Lifecycle
  status: NoteStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface NoteCreateInput {
  rawContent: string;
  source: NoteSource;
}

// Returned by the AI expansion step before the DB write
export interface ExpandedNoteFields {
  title: string;
  description: string;
  type: NoteType;
  category: NoteCategory;
  dueDate: Date | null;
  reminderAt: Date | null;
  nudgeDates: Date[]; // flat list; stored as NudgeScheduleEntry rows
}

// ---------------------------------------------------------------------------
// Client-side in-memory note (used before DB is wired)
// Mirrors the DB shape but lives in React state; dates are real Date objects.
// ---------------------------------------------------------------------------

export interface LocalNote {
  id: string;
  rawContent: string;
  source: NoteSource;
  status: 'PENDING' | 'EXPANDED' | 'ERROR';
  createdAt: Date;
  // Filled after AI expansion:
  title?: string;
  description?: string;
  type?: NoteType;
  category?: NoteCategory;
  dueDate?: Date | null;
  reminderAt?: Date | null;
  nudgeDates?: Date[];
}

// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  calendarId: string;
}
