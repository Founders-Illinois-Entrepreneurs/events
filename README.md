# Founders Tools

Live activities for **Founders · Illinois Entrepreneurs** events, built to be reused semester after semester.

The first tool is the **R&D Pitch Evaluation** investment game:

1. The R&D teams pitch (e.g. at their midpoint presentations).
2. Club members sit at investor tables (a few people each) and use **one phone per table**. Each table gets fake capital (default **$200,000**) and must invest **all of it** across the R&D teams.
3. For every R&D team, the table writes **why** it invested that amount and **what would make it invest more**, and scores the team 1–5 on each pillar of the rubric.
4. The R&D team with the most investment wins. Ties go to the higher rubric score (the weighted average of its pillar scores).

It's built to teach. Members learn what investors look for, because the rubric pillars are the lesson. R&D teams get specific, honest feedback to act on before their final pitch.

R&D teams can be on one of two **tracks**:
- **Own venture**: building their own startup.
- **Startup partner**: working with an existing startup as consultants, contractors or mentors.

Both tracks are scored on the same pillars, so results stay comparable. Partner teams get each question reworded for their situation.

> Forked from [wgarrett707/investment-game](https://github.com/wgarrett707/investment-game) with the author's permission. Thank you!

---

## How an event runs

There are no accounts. One person per table opens the link, types the names of everyone at the table, and picks the table. That phone is remembered. Other phones can't take over a table unless an organizer presses **Free table**. Organizers use one shared password.

Every event moves through four phases, controlled from the organizer page:

| Phase | What members can do |
| --- | --- |
| **Setup** | Join a table, read "What investors look for". |
| **Open investing** | Score each team on the rubric after its pitch, then split the money (the scores suggest a split), explain each amount, and submit. It autosaves. |
| **Closed** | Nothing. Tables that didn't submit don't count. |
| **Revealed** | See results, rubric averages, and all feedback. |

Rules the database enforces:

- One phone per table. Once a table submits, it's locked. An organizer can unlock it while investing is still open.
- Closing investing automatically submits any table whose portfolio is complete but who forgot to press Submit. Incomplete tables don't count.
- A portfolio can only be submitted if it invests exactly the full amount, and every R&D team has a reason, an "invest more if" answer, and a score on every pillar.
- Tables can't see each other's picks until the reveal.
- Feedback is anonymous unless the organizer turns on "show investor table names".

Organizer extras:
- A live tracker showing who joined and who has submitted.
- A **Best Investor Thesis** star.
- A full-screen **projector reveal**.
- A **feedback report** (print/PDF or CSV) to hand to each R&D team.

If a table signs in on the wrong phone, or a phone dies, press **Free table** in the tracker. Their answers so far are kept for whichever phone signs in next.

## Event-night checklist

**Before the meeting**

1. Go to **/admin** and sign in with the organizer password.
2. Click **New investment game**. To reuse a past event's rubric and team names, pick it under "Copy setup from".
3. Add the **R&D teams** with one-liners, and set each team's **track**.
4. Add the **investor tables**. Paste one name per line, e.g. `Table 1 … Table 8`.
5. Check the **rubric** wording.

**At the meeting**

1. Put the site's address on the projector. The home page opens the current event.
2. Each table picks one phone, types everyone's names and signs in while the event is still in **Setup**.
3. Click **Open investing** as the first pitch starts, so tables can score each team on the rubric right after its pitch.
4. Run the pitches. Suggested format: **7 minutes of pitch and 5 of Q&A per team**, with a visible timer.
5. After the last pitch, give tables about 10 minutes to use **Split the money**, adjust, write their reasons and submit. Watch the **live tracker**.
6. Click **Close investing**. Optionally ★ the best-reasoned portfolio.
7. Open **Projector reveal** and press → to reveal teams from last place to first, then the rubric slide. Click **Reveal results** afterwards: phones show results within seconds.

**After**

1. Open the **Feedback report**, then print or save a PDF for each R&D team, or download the CSV.
2. Archive the event. It stays in history.

**Practice run or a mistake?** Settings → **Reset event** wipes every sign-in, answer, score and submission, restores the default rubric and goes back to Setup. The event's name, link, capital, R&D teams and tables are kept. Type the event's slug to confirm.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS.
  - Styled like the Founders site: Bebas Neue + Montserrat, Illini blue `#13294b` and orange `#ff9500`, official logos.
- [Neon](https://neon.tech) serverless Postgres (free tier is plenty).
- Hosted on [Vercel](https://vercel.com) (free tier).

The whole site needs **two settings**: `DATABASE_URL` and `ADMIN_PASSWORD`.

```
app/
  page.tsx                    Home: opens the current event
  (tools)/[slug]/             Member pages: join, invest, learn, results
  admin/                      Organizer sign-in and events
  admin/invest/[id]/          Run one event: phases, tracker, teams, rubric, reveal, feedback
components/                   Shared UI (header, status chips, auto-refresh)
lib/                          Database + access helpers, types
db/migrations/                The whole database: tables and game rules (SQL)
db/seed.sql                   Demo data for local development
scripts/migrate.mjs           Applies migrations (npm run db:migrate)
scripts/test-db.mjs           Database tests (no server needed)
public/brand/                 Official Founders logos
```

## Setup (about 10 minutes)

1. **Database.**
   - Create a free [Neon](https://neon.tech) project.
   - Click **Connect** and copy the **pooled** connection string. Its host contains `-pooler`.
2. **Local settings.**
   ```bash
   npm install
   cp .env.example .env.local   # paste DATABASE_URL, choose an ADMIN_PASSWORD
   npm run db:migrate           # creates the tables (add `-- --seed` for a demo event)
   npm run dev                  # http://localhost:3000, organizers sign in at /admin
   ```
3. **Deploy.**
   - Import the repo in [Vercel](https://vercel.com).
   - Add the same two environment variables, `DATABASE_URL` and `ADMIN_PASSWORD`.
   - Deploy.

Tip: create a Neon **branch** (e.g. `dev`) for local testing, so you never test against event-night data.

To change the organizer password, update `ADMIN_PASSWORD` and redeploy. Everyone who was signed in as an organizer gets signed out.

## Checking your work

```bash
npm run test:db     # database rules and game logic, runs in-process with PGlite
npm run lint
npm run typecheck
npm run build
```

Changing the database:
- Add a **new** numbered file in `db/migrations/` (e.g. `0004_add_polls.sql`), then run `npm run db:migrate`.
- Never edit a migration that has already been applied.
- Add tests to `scripts/test-db.mjs`.

## Versions and history

There are two kinds of "going back":

**1. Reusing a past event's setup (most common).**
- Events are never lost. Archived events stay in **Admin → Archive**, with their results and feedback.
- To run a similar event, create a new one and choose **Copy setup from**.

**2. Running an older version of the code.**
- Each semester's event gets a git tag and a GitHub Release, e.g. `v2026-fall-midpoint`. See [CHANGELOG.md](CHANGELOG.md).
- Vercel keeps every deployment at its own permanent URL. The release notes link the one used for that event.
- To run an old version for real, give it its own database, since old code may not match a newer schema. A new Neon branch works well:
  ```bash
  git checkout v2026-fall-midpoint
  # point DATABASE_URL at a fresh Neon branch
  npm install && npm run db:migrate && npm run dev
  ```
- The default branch (`master`) is always the latest version.

To cut a release after an event:

```bash
git tag -a v2026-fall-midpoint -m "Fall 2026 R&D midpoint"
git push origin v2026-fall-midpoint
gh release create v2026-fall-midpoint --generate-notes
```

## Adding a new tool

The repo is meant to grow (check-in, live polls, demo-day voting…). What's shared:

- **Access**: `lib/auth.ts`
  - `getMember()` / `getOrCreateMember()`: name-based, remembered per browser.
  - `requireAdmin()`: organizer password.
- **Events**: one `events` table for every tool. Add your tool's name to the `tool` check constraint in a new migration.
- **Theme**: the classes in `app/globals.css` (`btn`, `card`, `chip`, `display`, `eyebrow`…) and the logos in `public/brand/`.

For a new tool:
- Prefix its tables (`poll_*`).
- Put its pages in `app/(tools)/<tool>/`.
- Put its organizer pages in `app/admin/<tool>/`.

## Security notes (this repo is public)

- **Never commit** `.env.local` (it's gitignored). `DATABASE_URL` gives full database access, and `ADMIN_PASSWORD` gives organizer access.
- Only server code talks to the database. Nothing secret is sent to the browser.
- Member browsers hold a random token. Only its SHA-256 hash is stored.
- Don't put real member data in `db/seed.sql` or anywhere in the repo.