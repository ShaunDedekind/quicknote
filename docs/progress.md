# QuickNote — Session Progress

> Keep this file up to date. Read it at the start of every session before touching code.
> Last updated: session 2 (mobile-first redesign + bottom tab layout)

---

## What has been built

### Project skeleton
- Full folder structure scaffolded: `/app`, `/app/api`, `/components`, `/lib`, `/lib/ai`, `/lib/integrations`, `/prisma`, `/docs`
- `.env.local.example` with all required env var slots documented
- `typecheck` script added to `package.json` (`tsc --noEmit`)
- `docs/architecture.md`, `docs/api-contracts.md`, `docs/reminders-logic.md` — placeholder stubs, not yet filled

### Dependencies installed
- `zod` ^4.3.6
- `@anthropic-ai/sdk` ^0.78.0
- `prisma` ^5.22.0 (see decision below)
- `@prisma/client` ^5.22.0

### Database schema — `prisma/schema.prisma`
- Full schema defined: `User`, `Account`, `Session`, `VerificationToken` (NextAuth), `Note`, `NudgeSchedule`
- Prisma client generated (`npx prisma generate` ✓)
- **No migrations run yet** — database does not exist; run `npx prisma migrate dev` when ready to start persisting data
- See "Important decisions" below for enum workaround

### Types — `lib/types.ts`
- All domain types defined: `NoteSource`, `NoteType`, `NoteCategory`, `NoteStatus`, `NudgeScheduleEntry`, `Note`, `NoteCreateInput`, `ExpandedNoteFields`, `CalendarEvent`
- Enum string values are uppercase (`'TEXT'`, `'AUDIO'`, etc.) to match what Prisma emits

### AI pipeline — `lib/ai/`
- `prompts.ts` — `EXPANSION_SYSTEM_PROMPT` (full system prompt) + `buildExpansionUserMessage()` (pure, injectable `now` date)
- `parse.ts` — Zod schema validating Claude's JSON response; `parseExpansionResponse()` strips markdown fences defensively; `ExpansionParseError` typed error class
- `expand.ts` — `expandNote(rawContent, source, now?)` calls Anthropic SDK, handles typed SDK errors (`AuthenticationError`, `RateLimitError`, `InternalServerError`, `APIError`), guards on `stop_reason`

### API routes — `app/api/`
- `POST /api/notes/expand` — **fully implemented and working end-to-end**; accepts `{ rawContent, source }`, validates with Zod, calls `expandNote`, returns `{ expanded }`
- `POST /api/notes` — stub (returns 501)
- `GET|POST /api/auth/[...nextauth]` — stub (returns 501)
- `GET|POST /api/integrations/calendar` — stub (returns 501)
- `POST /api/integrations/gmail` — stub (returns 501)

### UI — `app/` + `components/`
- `app/layout.tsx` — metadata updated ("QuickNote")
- `app/globals.css` — `@keyframes slide-up` + `@keyframes fade-in` added
- `app/page.tsx` — renders `<AppShell />`
- `components/AppShell.tsx` — `'use client'` shell managing tab state + in-memory `LocalNote[]` state; calls `/api/notes/expand` in background, updates note from PENDING → EXPANDED
- `components/BottomTabBar.tsx` — 2-tab bar (Record mic, Notes list) with filled circle active state + note count badge; exports `Tab` type
- `components/RecordTab.tsx` — hero mic screen: large 88px mic button, auto-submit on speech end, "Got it ✓" confirmation overlay, text fallback input, full mic permission state machine (`MicStatus`), auto-submit fires `onNoteSubmit` prop immediately (fire-and-forget)
- `components/NoteCard.tsx` — note card with swipe gestures (left = delete/red, right = done/green), urgency dot (red/amber/green based on due date), category pill + border accent, PENDING loading skeleton, ERROR state
- `components/ListTab.tsx` — scrollable notes list, empty state with document icon + hint
- `lib/speech-api.d.ts` — ambient declaration for `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` (TypeScript's lib.dom.d.ts is missing these)
- `lib/types.ts` — added `LocalNote` interface for client-side in-memory note state

### Other component stubs (not yet implemented)
- `components/AudioRecorder.tsx` — placeholder `'use client'` stub
- `components/NoteList.tsx` — placeholder (superseded by ListTab)
- `components/CategoryBadge.tsx` — placeholder

### Page stubs
- `app/notes/page.tsx` — returns `null`
- `app/notes/[id]/page.tsx` — returns `null`

### Lib stubs
- `lib/prisma.ts` — singleton client written, but **not usable until `prisma migrate dev` is run**
- `lib/auth.ts` — empty stub
- `lib/integrations/calendar.ts` — empty stub
- `lib/integrations/gmail.ts` — empty stub

---

## What is working right now

Full mobile-first UI with bottom tab navigation:

1. **Record tab (default):** Tap the large mic button → grant permission once → speak → recognition auto-submits on silence; "Got it ✓" confirmation shows immediately; or type a note in the text fallback
2. **Background expansion:** `AppShell` fires `POST /api/notes/expand` in the background, adds a PENDING card to the list, updates it to EXPANDED when Claude responds
3. **Notes tab:** Scrollable list of all captured notes; PENDING cards show a loading skeleton; EXPANDED cards show category pill, urgency dot, title, due date; swipe left to delete, swipe right to mark done

To test: `npm run dev`, open `http://localhost:3000`; the app renders in a 390px mobile frame centered on desktop.

---

## What is stubbed / not yet wired

| Area | Status | Blocker |
|---|---|---|
| Database | Schema defined, client generated, **no migrations run** | Need `DATABASE_URL` in `.env.local` + `npx prisma migrate dev` |
| Note persistence | Commented-out TODO in expand route | DB must be live first |
| Auth (NextAuth) | Stub only | `lib/auth.ts` needs Google provider config |
| Google OAuth | Not started | Need `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in env |
| Google Calendar | Stub only | Auth must work first |
| Gmail | Stub only | Auth must work first |
| `/notes` list page | Returns `null` | DB + auth first |
| `/notes/[id]` detail | Returns `null` | DB + auth first |
| `POST /api/notes` ingestion | Returns 501 | DB first (should save raw note + trigger expansion) |
| Whisper API fallback | Not started | Web Speech API is the current audio path |

---

## Important decisions

### Prisma 5 (not 6 or 7)
`npm install prisma` resolved to 7.4.2, which removed `url = env(...)` support from `schema.prisma` and requires driver adapters + `prisma.config.ts`. That was a significant migration for an early-stage project. **Pinned to Prisma 5.22.0** to keep the standard schema format. Revisit when the project is more mature or when switching to PostgreSQL.

### SQLite enums → String
SQLite does not support Prisma enums. All four enum-like fields (`source`, `type`, `category`, `status`) use `String` in the schema with inline comments documenting valid values. TypeScript union types in `lib/types.ts` enforce correctness at the app layer. **When switching to PostgreSQL for production, restore the `enum` declarations** — the column values are already correct strings.

### AI model: `claude-sonnet-4-6`
CLAUDE.md originally specified `claude-sonnet-4-20250514` (a date-suffixed legacy ID). Updated to use `claude-sonnet-4-6` (the current alias). This is set in `lib/ai/expand.ts` as `const MODEL`.

### Expand route accepts raw content directly
`POST /api/notes/expand` was designed as a "fetch note from DB, expand, persist" flow. For the MVP (before DB is live) it accepts `{ rawContent, source }` directly and skips the DB fetch/persist steps (commented TODO blocks). When Prisma is wired, the route should be updated to accept `{ noteId }`, fetch the note, expand it, and write back.

### Audio is inline in NoteInput (not in AudioRecorder component)
The `components/AudioRecorder.tsx` stub exists but recording logic is currently inside `NoteInput.tsx`. This is intentional for now — extract to `AudioRecorder` when the component grows or is needed elsewhere.

### No nudge/reminder scheduling engine yet
Claude generates nudge dates as part of the expansion, but nothing actually sends notifications. This is a future concern — will need a cron job or a background queue when the app is deployed.

### Notes are in-memory only (no persistence yet)
`AppShell` holds `notes: LocalNote[]` in React state — refreshing the page loses all notes. This is intentional until the DB is wired.

### NoteInput.tsx is superseded
The original `components/NoteInput.tsx` still exists but is no longer used (replaced by `RecordTab.tsx` + `AppShell.tsx`). It can be deleted when convenient.

---

## Next steps (in order)

1. **Wire up the database**
   - Add `DATABASE_URL=file:./dev.db` to `.env.local`
   - Run `npx prisma migrate dev --name init`
   - Verify `lib/prisma.ts` client works

2. **Wire up NextAuth + Google OAuth**
   - Fill in `lib/auth.ts` with Google provider config
   - Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` to `.env.local`
   - Update `app/api/auth/[...nextauth]/route.ts` to re-export from `lib/auth`

3. **Wire up note persistence**
   - `POST /api/notes` — validate `{ rawContent, source }`, create `Note` row (status `PENDING`), return `noteId`
   - `POST /api/notes/expand` — switch to `{ noteId }` flow: fetch note, expand, write back expanded fields + `NudgeSchedule` rows

4. **Build the `/notes` list page**
   - Fetch notes for authenticated user
   - Implement `NoteList` + `NoteCard` components
   - Add category filter / sort

5. **Build the `/notes/[id]` detail page**
   - Full expanded view
   - "Add to Calendar" button → `POST /api/integrations/calendar`

6. **Google Calendar integration**
   - Fill in `lib/integrations/calendar.ts`
   - Implement `POST /api/integrations/calendar`
   - Silent token refresh on expiry

7. **Polish & edge cases**
   - Whisper API fallback for browsers without Web Speech API
   - Extract `AudioRecorder` into its own component
   - Nudge/reminder delivery mechanism (email via Gmail, or push notifications)
   - Rate limiting on API routes
   - Error boundary in UI
