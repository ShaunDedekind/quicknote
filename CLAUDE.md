# QuickNote — Claude Code Context

## Project
A Next.js webapp that converts short audio clips or quick typed text into fully-formed reminders — with smart categorisation, auto date extraction, nudges, and Google Calendar integration.

## Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Audio:** Web Speech API / Whisper API for transcription
- **AI brain:** Claude API (`claude-sonnet-4-20250514`) for note expansion
- **Auth:** NextAuth.js
- **DB:** Prisma + PostgreSQL (or SQLite locally)
- **Integrations:** Google Calendar API (v1 priority), Gmail API (v2)

## Project Structure
```
/app              → Next.js App Router pages & layouts
/app/api          → API routes (note ingestion, expansion, integrations)
/components       → Reusable UI components
/lib              → Shared utilities, API clients, Prisma client
/lib/ai           → Claude prompt logic and response parsing
/lib/integrations → Google Calendar, Gmail connectors
/prisma           → Schema and migrations
/public           → Static assets
/docs             → Architecture decisions, feature specs (@docs/filename.md to reference)
```

## Critical Rules
- **Never use `any` in TypeScript** — define explicit types, always
- **App Router only** — no Pages Router patterns
- **Server Components by default** — only use `'use client'` when genuinely needed (event handlers, hooks, browser APIs)
- **All API routes must validate input** with Zod before touching any logic
- **Never hardcode secrets** — use `.env.local`, reference via `process.env`
- **Audio input is a first-class feature** — don't let it become an afterthought in component design

## How to Run
```bash
npm run dev       # local dev server
npm run build     # production build
npm run lint      # ESLint check
npm run typecheck # tsc --noEmit
```
Always run `typecheck` and `lint` after making changes. Fix all errors before considering a task done.

## AI Note Expansion
The core feature. When a note arrives (text or transcribed audio):
1. Strip filler, extract intent
2. Identify: task/reminder/event/info
3. Extract date/time signals (relative + absolute)
4. Suggest category (work / personal / health / finance / etc.)
5. Generate: title, full description, due date, reminder time, optional nudge schedule

Prompts live in `/lib/ai/`. Keep prompt logic out of API routes.

## Google Calendar Integration
- OAuth2 flow via NextAuth Google provider
- Scopes needed: `calendar.events`, `calendar.readonly`
- Write events to user's primary calendar
- Store token in DB — refresh silently on expiry

## Coding Style
- Prefer `async/await` over `.then()` chains
- Early returns over nested conditionals
- Named exports for components, default exports for pages (Next.js convention)
- Co-locate component styles with the component, not in a global file
- Small focused functions — if it needs a comment to explain what it does, extract it

## What NOT to Do
- Don't add UI libraries (shadcn, MUI etc.) without checking with me first
- Don't add new dependencies without explaining why the existing stack can't handle it
- Don't create barrel `index.ts` files that re-export everything
- Don't use `useEffect` to fetch data — use React Server Components or SWR

## Session Continuity
At the start of every new session, read docs/progress.md before doing anything else. At the end of a session or when asked, update docs/progress.md with what was completed, any decisions made, and what the next steps are.

## Reference Docs
Use `@docs/` prefix to load these on demand — not every session:
- `@docs/architecture.md` — system design decisions
- `@docs/api-contracts.md` — internal API shape contracts
- `@docs/reminders-logic.md` — reminder/nudge scheduling rules