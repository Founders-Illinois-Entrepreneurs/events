# Changelog

Each event release is tagged (e.g. `v2026-fall-midpoint`). Each event's folder (e.g. `rd-midpoint-fa26/`) names the tag it used. To run an old version, check out its tag and point it at a fresh Neon branch, since old code may not match the newer database.

## Unreleased

### Changed
- Moved to the club's accounts: the `Founders-Illinois-Entrepreneurs/events` repo, the club's Vercel account, and a Neon database added through Vercel. Event data was copied over unchanged.

## v2026-fall-midpoint (2026-10-25)

First real event: the Fall 2026 R&D midpoint pitches, at events.foundersillinois.org/rd-midpoint-fa26.

### Added
- Founders Events platform: no-account access (members type a name; organizers use one password), shared events table, Founders theme and logos.
- R&D Pitch Evaluation game: own-venture and startup-partner tracks, investor teams, invest-everything rule, written reason and "invest more if" per R&D team, 7-pillar rubric, one phone per table, lock on submit.
- Organizer pages: create or copy events, phase control, live tracker, unlock, Best Investor Thesis star, projector reveal, feedback report (print and CSV).
- Database tests that run in-process with PGlite (`npm run test:db`) and a migration runner (`npm run db:migrate`).
- Rubric v2 for new events: Problem, Customer & Market, Solution, Product, Business Model, Traction & Validation, Pitch Execution. Each pillar has a "listen for" checklist, a 1/3/5 score guide, red flags, startup-partner wording and a weight (Traction 1.5×, Business Model 0.5×). Existing events keep their rubric.
- Rubric scores are weighted averages; they break ties and drive a suggested split on each table's phone ("Split the money", with a slider from even to all-in).
- Startup-partner teams get their own 1/3/5 score guide and red flags (migration 0007).
- "Reset event" organizer button: a fresh restart (no sign-ins, answers or submissions; default rubric; back to Setup) that keeps the event, its R&D teams and tables (migration 0008).
- "Use the latest default rubric" organizer button, to move an older event onto rubric v2 (Setup only, before any scores).
- Flow: open investing as the first pitch starts so tables score each team right after its pitch; split the money after the last pitch.
- Rebuilt "What investors look for" page: how-it-works steps, the 1–5 scale, checklists, a Solution vs. Product callout, and a separate startup-partner section in each pillar.

### Fixed
- Slugs that clash with site paths are refused.
- Typing into an amount box after tabbing into it replaces the amount instead of adding digits to it.
- "Wrong table?" is hidden once a table has saved scores, since the server refuses the move then.
- Deleting an event or freeing a table also deletes sign-ins that are no longer on any table.
- A styled 404 page, and security headers that stop other sites from framing the pages.
- Times on the site use the club's time zone (America/Chicago; `TIME_ZONE` to change), not the server's UTC.
- "Use suggested amounts" waits until every team is fully scored, so an unscored team can't get $0 by accident. The split defaults to "In proportion".
- Phones recover on their own if the organizer changes the rubric or teams mid-event.
- Bad pillar weights are rejected with a message; error messages from the database show only text written for people.

### Changed
- Event pages are at `events.foundersillinois.org/<slug>` (they were at `/invest/<slug>`). Old `/invest/<slug>` links no longer work (no redirect).

### Changed (from the original investment-game)
- Replaced Prisma, NextAuth and per-user passwords with Neon Postgres, a shared organizer password, and SQL game-rule functions.
- Money is stored as whole dollars, not floats.
