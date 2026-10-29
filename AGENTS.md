<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## About this repo

- It's the app at events.foundersillinois.org, owned by the Founders-Illinois-Entrepreneurs GitHub org. Each subdomain has its own repo, named after the subdomain.
- The main website (foundersillinois.org) is a separate repo: https://github.com/Founders-Illinois-Entrepreneurs/founders-website. To use it as context, clone it next to this one.
- The repo is public: never commit secrets or personal data.

## Code map

```
app/page.tsx                 Home: redirects to the current event
app/(tools)/[slug]/          Member pages: join, invest, learn, results
app/admin/                   Organizer sign-in and event list
app/admin/invest/[id]/       Run one event: phases, tracker, teams, rubric, reveal, feedback
components/                  Shared UI
lib/                         Database and access helpers (lib/auth.ts), rubric, types
db/migrations/               The whole database: tables and game rules as SQL functions
scripts/                     migrate.mjs (npm run db:migrate), test-db.mjs (npm run test:db, runs on PGlite)
rd-midpoint-fa26/            Per-event guide (one folder per event)
```

## Rules

- Only server code talks to the database; nothing secret reaches the browser. Member browsers hold a random token, and only its SHA-256 hash is stored.
- Database changes are new numbered files in `db/migrations/`, never edits to old ones. Write them so the code that's live now still works: add tables and columns rather than renaming or dropping. Add tests to `scripts/test-db.mjs`.
- Never put real member data in `db/seed.sql`, tests or docs.

## Adding a tool to this app

Tools share the `events` table, sign-in (`lib/auth.ts`: `getMember()`, `joinTableAs()`, `requireAdmin()`) and theme (`app/globals.css` classes, `public/brand/` logos). For a new tool:
- Add its name to the `events.tool` check constraint in a new migration, and prefix its tables (e.g. `poll_*`).
- Put member pages in `app/(tools)/<tool>/` and add `<tool>` to `RESERVED_SLUGS` in `app/admin/actions.ts`, so no event slug can take that path.
- Put organizer pages in `app/admin/<tool>/`.
