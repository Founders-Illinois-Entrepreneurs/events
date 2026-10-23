# Changelog

Each event release is tagged (e.g. `v2026-fall-midpoint`). See the README section "Versions and history" for how to run an older version.

## Unreleased

### Added
- Founders Tools platform: no-account access (members type a name; organizers use one password), shared events table, Founders theme and logos.
- R&D Pitch Evaluation game: own-venture and startup-partner tracks, investor teams, invest-everything rule, written reason and "invest more if" per R&D team, 7-pillar rubric, live autosave between teammates, lock on submit.
- Organizer pages: create or copy events, phase control, live tracker, unlock, Best Investor Thesis star, projector reveal, feedback report (print and CSV).
- Database tests that run in-process with PGlite (`npm run test:db`) and a migration runner (`npm run db:migrate`).

### Changed (from the original investment-game)
- Replaced Prisma, NextAuth and per-user passwords with Neon Postgres, a shared organizer password, and SQL game-rule functions.
- Money is stored as whole dollars, not floats.
