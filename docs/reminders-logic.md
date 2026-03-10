# Reminders & Nudge Logic

> Reference doc — load with `@docs/reminders-logic.md`

## TODO: document reminder/nudge scheduling rules
- How relative dates ("tomorrow", "next week") are resolved
- Nudge schedule generation algorithm
- When reminders auto-dismiss vs persist

## UX UI Flow store

Redesign the app with a mobile-first bottom tab layout. Here's the full brief:
Overall layout

Mobile-first, max-width ~390px centered on desktop
Bottom tab bar with 2 tabs: a large central record/input button (home) and a list icon
The record tab is the default view on open

Tab 1 — Record (home)

This is the hero screen. It should feel instant and frictionless
A large prominent microphone button, one tap to start recording
Web Speech API for audio, transcribes as you speak
A small text input alternative below for typing
Submit happens automatically after speech ends, or manually via a button
After submitting, show a subtle "Got it ✓" confirmation and reset — user should feel safe to pocket their phone immediately
No expanded result shown here — Claude processes it in the background

Tab 2 — List

A scrollable list of all notes, most recent first
Each card shows: title, category badge, urgency indicator, due date/time, people involved, estimated duration
All of these are auto-filled by Claude — empty fields are hidden, not shown as blank
Swipe left on a card to delete it
Swipe right on a card to mark it as done
Tap a card to see the full expanded detail

Visual style

Clean, calm, minimal — think Apple Reminders meets Notion
Soft shadows, rounded corners, plenty of whitespace
Urgency shown as a subtle colour accent (red/amber/green), not a loud badge
Category as a small pill badge
The mic button on the home screen should feel satisfying to tap — make it the hero element