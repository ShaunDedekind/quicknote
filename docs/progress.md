# QuickNote — Session Progress

> Keep this file up to date. Read it at the start of every session before touching code.
> Last updated: session 9 (OAuth fix; NoteDetailPanel enhancements; Recently Completed section; Correction feedback loop)

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
- `LocalNote` interface added — client-side in-memory note shape used by AppShell before DB is wired
- Enum string values are uppercase (`'TEXT'`, `'AUDIO'`, etc.) to match what Prisma emits

### AI pipeline — `lib/ai/`
- `prompts.ts` — `EXPANSION_SYSTEM_PROMPT` + `buildExpansionUserMessage()` (pure, injectable `now` date)
  - Detailed date/time default table: "tonight" → 19:00 same day, "tomorrow" → 09:00 next day, "this week" → Friday 17:00, etc.
  - Explicit UTC `Z`-suffix requirement for all output datetimes
  - `reminderAt` heuristics: same-day → 1h before; future day → 09:00 on due date; event → 1h before
- `parse.ts` — Zod schema validating Claude's JSON; date validator uses `Date.parse()` refine (robust to Z-suffix or no suffix); `ExpansionParseError` typed error class; strips markdown fences defensively
- `expand.ts` — `expandNote(rawContent, source, now?)` calls Anthropic SDK; handles typed SDK errors; guards on `stop_reason`
- `lib/speech-api.d.ts` — ambient declaration for `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` (TypeScript's `lib.dom.d.ts` doesn't include these)

### API routes — `app/api/`
- `POST /api/notes/expand` — **fully implemented and working end-to-end**; accepts `{ rawContent, source }`, validates with Zod, calls `expandNote`, returns `{ expanded }`
- `POST /api/notes` — stub (returns 501)
- `GET|POST /api/auth/[...nextauth]` — stub (returns 501)
- `GET|POST /api/integrations/calendar` — stub (returns 501)
- `POST /api/integrations/gmail` — stub (returns 501)

### UI — `app/` + `components/`
- `app/layout.tsx` — metadata: title "QuickNote", description set
- `app/globals.css` — `@keyframes slide-up` + `@keyframes fade-in`
- `app/page.tsx` — renders `<AppShell />`
- `components/AppShell.tsx` — `'use client'` shell; owns `Tab` state + `LocalNote[]` state; fires `POST /api/notes/expand` in background; logs API errors to console for debugging; updates note PENDING → EXPANDED on success, PENDING → ERROR on failure
- `components/BottomTabBar.tsx` — 2-tab bottom nav (Record, Notes); filled dark circle for active tab; note count badge; exports `Tab` type
- `components/RecordTab.tsx` — hero mic screen; 88px mic button (dark idle, red recording with dual-ring pulse); auto-submits when speech recognition ends if transcript is non-empty; "Got it ✓" fade-in confirmation (1.8s) then resets; text textarea fallback with send button + ⌘ Enter; full `MicStatus` state machine (idle/requesting/granted/denied/unavailable)
- `components/NoteCard.tsx` — touch swipe: left = delete (red bg), right = done (green bg), both with slide-out exit animation; urgency dot (red <24h, amber <7d, green otherwise); category pill + matching left border accent; PENDING shows animated loading skeleton; ERROR state
- `components/ListTab.tsx` — scrollable notes list; empty state with icon + hint text

### Superseded / unused files
- `components/NoteInput.tsx` — original single-page input, now replaced by the tab architecture. Still present, safe to delete.
- `components/AudioRecorder.tsx` — placeholder stub, never implemented
- `components/NoteList.tsx` — placeholder stub, superseded by `ListTab`
- `components/CategoryBadge.tsx` — placeholder stub

### Page stubs
- `app/notes/page.tsx` — returns `null`
- `app/notes/[id]/page.tsx` — returns `null`

### Lib stubs
- `lib/prisma.ts` — singleton client written, **not usable until `prisma migrate dev` is run**
- `lib/auth.ts` — empty stub
- `lib/integrations/calendar.ts` — empty stub
- `lib/integrations/gmail.ts` — empty stub

---

## What is working right now

End-to-end flow is confirmed working in the browser:

1. **Record tab (default view):** Tap the large mic button → browser permission prompt (once per session) → speak → recognition auto-submits on silence → "Got it ✓" confirmation → resets
2. **Text fallback:** Type in the textarea below the mic button, hit send or ⌘ Enter
3. **Background expansion:** `AppShell` fires `POST /api/notes/expand` immediately; adds a PENDING skeleton card to the Notes list; when Claude responds (2–5s) the card updates to show title, category, urgency, due date, description
4. **Notes tab:** Swipe left to delete a card, swipe right to mark done (both animate out); badge on tab shows note count

To test: `npm run dev`, open `http://localhost:3000`; the app renders in a 390px mobile frame centred on desktop.

---

## What is stubbed / not yet wired

| Area | Status | Blocker |
|---|---|---|
| Database | **Live on Neon PostgreSQL** ✓ | — |
| Note persistence | Notes saved to DB on create; delete/done persist via PATCH /api/notes/[id] ✓; notes scoped to userId ✓ | — |
| Auth (NextAuth) | Stub only | `lib/auth.ts` needs Google provider config |
| Google OAuth | Not started | Need `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in env |
| Google Calendar | Stub only | Auth must work first |
| Gmail | Stub only | Auth must work first |
| `/notes` list page | Returns `null` | DB + auth first (ListTab already built; just needs real data) |
| `/notes/[id]` detail | Returns `null` | DB + auth first |
| `POST /api/notes` ingestion | Returns 501 | DB first |
| Whisper API fallback | Not started | Web Speech API is the current audio path |
| Note detail tap | Not wired | Cards are not tappable yet |

---

## Important decisions

### Prisma 5 (not 6 or 7)
`npm install prisma` resolved to 7.4.2, which removed `url = env(...)` support from `schema.prisma` and requires driver adapters + `prisma.config.ts`. **Pinned to Prisma 5.22.0** to keep the standard schema format. Revisit when switching to PostgreSQL.

### SQLite enums → String
SQLite does not support Prisma enums. All four enum-like fields (`source`, `type`, `category`, `status`) use `String` with inline comments. TypeScript union types in `lib/types.ts` enforce correctness at app layer. **Restore `enum` declarations when switching to PostgreSQL.**

### AI model: `claude-sonnet-4-6`
Set in `lib/ai/expand.ts` as `const MODEL`. Changed from legacy date-suffixed ID.

### Prisma 5 on Neon (PostgreSQL)
Migrated from SQLite to Neon (PostgreSQL) in session 3. Schema now uses proper Prisma enums (`NoteSource`, `NoteType`, `NoteCategory`, `NoteStatus`). Two URLs in `.env` / `.env.local`:
- `DATABASE_URL`: pooled Neon URL (app runtime, PgBouncer)
- `DIRECT_URL`: direct (non-pooled) Neon URL (Prisma migrations only)
Old SQLite migrations deleted; fresh migration `20260315_init` applied.

### Vercel build configuration
`package.json` updated:
- `"build": "prisma migrate deploy && next build"` — runs schema migrations before building
- `"postinstall": "prisma generate"` — regenerates Prisma client on every `npm install`

### Wada Sanzo palette
Deep indigo-grey backgrounds (`#1b1a2e` page, `#252340` cards, `#141328` tab bar), warm sand/cream text (`#e8dfc8`), muted indigo-grey secondary (`#877fa0`, `#5c5572`), cinnabar red (`#c94e3b`) for badges/urgency/delete action.

### Typography
DM Sans (body: 400/500/600) + Fraunces (display: 600) loaded via `next/font/google`. CSS variables `--font-dm-sans` and `--font-fraunces`. Fraunces used on: wordmark, Notes header, note detail panel title.

### Note detail panel
`components/NoteDetailPanel.tsx` — slides in from right (`translateX(100%)` → `0`) over the full app frame when a note card is tapped. Shows title (Fraunces), description, due date, reminder time. Close button (back arrow) returns to list.

### Compressed NoteCard
Cards now show: title (1 line, truncated) + urgency dot on row 1; category label + formatted due date on row 2. No description visible inline. Description/detail lives in the detail panel. Tapping a card (no swipe) opens NoteDetailPanel.

### Google Calendar integration
Implemented in session 4. Full stack from AI assessment through to event creation.

**AI calendar assessment** — system prompt updated with new output fields:
- `calendarWorthy: boolean` — true for meetings, appointments, events; false for tasks/errands/info
- `suggestedEventTitle: string | null` — clean calendar event title (≤50 chars)
- `suggestedDuration: number | null` — estimated minutes (default 60)
- `suggestedAttendees: string[] | null` — names mentioned (no emails — can't invite)

**New DB fields on Note** — migration `20260315_add_calendar_fields` applied:
- `calendarWorthy Boolean @default(false)`
- `suggestedEventTitle String?`
- `suggestedDuration Int?`
- `suggestedAttendees String?` (JSON-encoded string[])
- `calendarEventId String?` (already existed, now in use)

**Auth** — `lib/auth.ts` fully implemented with NextAuth v4:
- Google provider with `calendar.events` scope + `access_type=offline` + `prompt=consent`
- Prisma adapter persists tokens in the `Account` table
- `session.user.id` exposed via session callback
- `components/Providers.tsx` wraps the app in `SessionProvider`
- `NEXTAUTH_URL` and `NEXTAUTH_SECRET` must be set in Vercel env vars

**Token refresh** — `lib/integrations/calendar.ts`:
- `getValidAccessToken(account)` — detects expiry (60s buffer), calls Google `/token` endpoint, writes refreshed token back to DB
- `createCalendarEvent(accessToken, event)` — POSTs to Google Calendar REST API, returns event ID

**API route** — `POST /api/calendar/create-event`:
- Requires auth session; looks up user's Google Account in DB
- Idempotent (returns existing eventId if already created)
- Error handling for token refresh failure and Calendar API errors

**UI** — `NoteDetailPanel` CalendarButton component:
- Not signed in → "Sign in with Google to add to Calendar" (calls `signIn('google')`)
- Signed in + calendarWorthy + no eventId → cinnabar "Add to Calendar" button
- After creation → green "Added to Calendar ✓"
- Local state `localEventId` gives instant UI update; callback propagates to AppShell notes array

### Expand route accepts raw content directly
`POST /api/notes/expand` accepts `{ rawContent, source }` (not `{ noteId }`) for the DB-free MVP. When Prisma is wired, switch to `{ noteId }` → fetch → expand → write back.

### In-memory note state
`AppShell` owns `notes: LocalNote[]` in React state. Notes are lost on page refresh. This is intentional until the DB migration is done — the full `NoteCard`/`ListTab` UI is already built and ready to accept real data.

### Audio recording in RecordTab
Recording logic lives in `RecordTab.tsx` (not the `AudioRecorder.tsx` stub). Extract later if needed elsewhere.

### No nudge/reminder scheduling engine yet
Claude generates nudge dates but nothing sends notifications. Future work — needs a cron job or background queue at deploy time.

### Zod date validation
Originally used `z.string().datetime({ offset: true })` which rejected Claude's dates (no `Z` suffix). Changed to `z.string().refine(s => !isNaN(Date.parse(s)))` — accepts any JS-parseable datetime string. Prompt updated to instruct Claude to always output `Z`-suffixed UTC strings.

---

### Settings tab — `components/SettingsTab.tsx`
Added in session 5. Three tab navigation: Record · Notes · Settings.

- **Google Account section** — `useSession` detects auth state: unauthenticated shows "Connect Google" (calls `signIn('google')`); authenticated shows profile photo + name + email + "Disconnect" (calls `signOut()`)
- **Integrations section** — Google Calendar toggle persisted to `localStorage` key `qn_calendar_enabled`
- **Preferences section** — "Notification preferences" + "Default reminder time" (placeholder rows, no logic)
- **History section** — "Correction history" (placeholder row, no logic)
- Highlight mechansim: `highlightGoogleAccount` prop triggers a cinnabar ring + glow + smooth scroll when the user arrives via the NoteDetailPanel signpost

### NoteDetailPanel — Settings signpost
Unauthenticated "Add to Calendar" button no longer calls `signIn('google')` inline. It now calls `onOpenSettings()` (passed from AppShell), which:
1. Closes the NoteDetailPanel
2. Switches `activeTab` to `'settings'`
3. Sets `highlightGoogleAccount` true for 2.5s, then clears

Button text changed to "Connect Google in Settings to add to Calendar".

### BottomTabBar
`Tab` type extended to `'record' | 'list' | 'settings'`. Gear/cog icon added for Settings. Layout narrowed to fit three tabs (px-4 per tab).

---

## Next steps (in order)

1. **Verify end-to-end in browser after session 9 fixes**
   - Sign in with Google → should complete without OAuthAccountNotLinked error
   - Submit a note → should expand via Claude, show title/category/date on card
   - Tap a card → detail panel should show all AI fields including urgency, calendar event details
   - Swipe left/right → should persist to DB
   - Reload → notes still present

2. **Verify Correction flow**
   - Tap a note → detail panel → "Correct this note" → type correction → Apply
   - Note should re-expand with correction applied and update in place

3. **Polish & edge cases**
   - Delete `components/NoteInput.tsx` (superseded)
   - Whisper API fallback for browsers without Web Speech API
   - Nudge/reminder delivery mechanism (email via Gmail, or push notifications)
   - Rate limiting on API routes
   - Error boundary in UI

---

## Future Ideas

### Correction flow
A "correct" button on each note card (small edit icon, unobtrusive) that opens a voice or text input accepting natural-language feedback. Claude re-processes the original note with the correction as added context and returns an updated expansion. The card updates in place.

The flow you're describing:

Note comes back categorised as PERSONAL
You tap "Correct"
You say or type "Grace is a co-worker"
Claude re-processes the note with that context
Card updates to WORK, maybe adds Grace to people involved
QuickNote quietly logs: Grace = colleague = WORK category
Next time you mention Grace → automatically WORK, no correction needed

Example interactions:
- "Grace is a co-worker" → category flips PERSONAL → WORK, description updated
- "This is actually next Friday, not this Friday" → dueDate shifts forward one week
- "Add a nudge the day before" → nudgeDates updated

**What gets stored in the DB:**
- The correction text alongside the original note
- A `corrections` table (or a JSON column on `Note`) logging `{ originalExpansion, correctionText, revisedExpansion }` pairs

**Longer-term — prompt learning:**
Corrections accumulate per-user as labelled examples (`note content + correction → correct output`). A future prompt improvement pass injects the user's top N correction patterns as few-shot examples in the system prompt, teaching Claude the user's personal context (who their co-workers are, which category their recurring tasks belong to, preferred reminder timing, etc.). This turns corrections into a lightweight personalisation layer without fine-tuning.

That last step is the magic. Over time QuickNote builds a little personal dictionary:

Grace → colleague → WORK
Rob → friend → PERSONAL 
BNZ → finance → always set a due date
bins → home → Tuesday evenings
