# Velopulse UI Redesign Direction

## 1. Product Direction

Velopulse should feel like a premium indoor cycling computer paired with a focused training log. The interface should prioritize fast reading during a ride, clear sensor status before a ride, and useful performance review after a ride.

This is not a marketing site, generic admin dashboard, or decorative fitness app. It is an operational tool for recording and reviewing workouts.

## 2. Design Keywords

- Precise
- Dense
- Calm
- Instrument-like
- Performance-focused
- Low distraction
- Reliable

## 3. Core UI Modes

### Ready

The pre-ride state should answer:

- Are the required sensors connected?
- Is the user profile usable?
- Is sync available?
- Is there live signal?
- Can the session start now?

The primary action is starting a session.

### Ride

The recording state should answer:

- How long has the ride been running?
- What are the current core metrics?
- Which effort zone is active?
- Are the sensors still online?
- Is there a safe way to stop or open deeper telemetry?

The primary metrics are heart rate, power, and cadence. Secondary metrics include speed, distance, calories, and resistance.

### Review

The post-ride and history state should answer:

- What happened in this session?
- How does it compare with recent sessions?
- What trends are visible?
- Is the session saved, synced, imported, or exportable?

## 4. Visual Direction

Use a dark, neutral base with controlled color accents. Avoid making the UI dominated by one neon color.

Recommended visual treatment:

- Background: near-black or charcoal
- Surfaces: subtle dark panels with low-contrast borders
- Radius: mostly 6-8px
- Typography: clear sans for labels, tabular mono for live numbers
- Color: semantic metric colors, not decorative gradients
- Motion: short and functional, never distracting during recording

Metric color roles:

- Heart rate: red
- Power: yellow
- Cadence: green/cyan
- Speed: blue
- Distance: violet
- Calories: pink
- Resistance: orange
- Connected/ready state: green/cyan
- Warning/error state: yellow/red

## 5. Layout Principles

- Recording mode gets the most screen priority.
- Live metrics must be readable at a glance.
- Controls should not compete visually with metrics.
- Avoid nested cards.
- Keep panels dense but organized.
- Use icons for compact actions where meaning is familiar.
- Use text buttons only for explicit commands such as Start, Stop, Save, Import, Export, and Sync.
- Preserve stable dimensions for metric cards, toolbar buttons, and charts to avoid layout shift.

## 6. Scope Guardrails

This redesign should stay in the UI layer unless a later task explicitly changes behavior.

Do not change:

- Database schema
- Supabase table or column expectations
- Workout/session data shape
- Save session logic
- Pending sync logic
- Google Fit sync payloads
- TCX import/export behavior
- Core workout calculations

Expected edit areas:

- `src/components/**`
- `src/App.tsx`
- `src/index.css`
- Small presentational helpers if needed

Avoid editing unless explicitly required:

- `src/store/useWorkoutStore.ts`
- `src/lib/supabase.ts`
- `src/lib/google-fit-service.ts`
- `src/lib/tcx-import-service.ts`
- `src/app/api/**`

## 7. Success Criteria

The redesign is successful when:

- Ready mode makes connection and start readiness obvious.
- Ride mode is readable while exercising.
- Review/history feels like a training log, not a debug modal.
- The app looks cohesive across desktop, tablet, and mobile.
- No data persistence or sync behavior changes as a side effect of UI work.
