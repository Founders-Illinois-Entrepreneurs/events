# Changelog

Each event release is tagged (e.g. `v2026-fall-midpoint`). See the README section "Versions and history" for how to run an older version.

## Unreleased

### Added
- Founders Tools platform: no-account access (members type a name; organizers use one password), shared events table, Founders theme and logos.
- R&D Pitch Evaluation game: own-venture and startup-partner tracks, investor teams, invest-everything rule, written reason and "invest more if" per R&D team, 7-pillar rubric, live autosave between teammates, lock on submit.
- Organizer pages: create or copy events, phase control, live tracker, unlock, Best Investor Thesis star, projector reveal, feedback report (print and CSV).
- Database tests that run in-process with PGlite (`npm run test:db`) and a migration runner (`npm run db:migrate`).
- Rubric v2 for new events: Problem, Customer & Market, Solution, Product, Business Model, Traction & Validation, Pitch Execution. Each pillar has a "listen for" checklist, a 1/3/5 score guide, red flags, startup-partner wording and a weight (Traction 1.5×, Business Model 0.5×). Existing events keep their rubric.
- Rubric scores are weighted averages; they break ties and drive a suggested split on each table's phone ("Split the money", with a slider from even to all-in).
- Rebuilt "What investors look for" page: how-it-works steps, the 1–5 scale, checklists, a Solution vs. Product callout, and a separate startup-partner section in each pillar.

### Changed (from the original investment-game)
- Replaced Prisma, NextAuth and per-user passwords with Neon Postgres, a shared organizer password, and SQL game-rule functions.
- Money is stored as whole dollars, not floats.
