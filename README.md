# Founders Events

Live tools for **Founders · Illinois Entrepreneurs** events, at [events.foundersillinois.org](https://events.foundersillinois.org). Members join from their phones; organizers run the event from `/admin`.

## Events

Each event has a folder with its full guide: how it works, the event-night checklist, and how it was set up.

| Event | Date | Guide |
| --- | --- | --- |
| R&D Midpoint Pitch Evaluation, Fall 2026 | Oct 25, 2026 | [rd-midpoint-fa26](rd-midpoint-fa26/) |

To run a new event, copy the most recent similar folder and rename it to the new event's slug.

## Running it locally

Never develop against the production database: it holds every past event's results. Get your own copy first: in the club's Vercel account, `events` → **Storage** → **Open in Neon** → **Branches** → create a branch named after you, and copy its pooled connection string. Or create a free [Neon](https://neon.com) project.

```bash
npm install
cp .env.example .env.local   # paste your DATABASE_URL, choose any ADMIN_PASSWORD
npm run db:migrate           # creates the tables
npm run db:seed              # optional: adds a demo event
npm run dev                  # http://localhost:3000, organizers sign in at /admin
```

Before opening a pull request: `npm run test:db && npm run lint && npm run typecheck && npm run build`.

## How it's deployed

- **Hosting:** the Vercel project `events` in the club's account. Merging to `main` deploys.
- **Database:** Neon Postgres, added through Vercel's **Storage** tab.
- **Settings:** two environment variables in Vercel, `DATABASE_URL` and `ADMIN_PASSWORD`. Changing the password and redeploying signs every organizer out.
- **Database changes:**
  1. Add a new numbered file in `db/migrations/`. Never edit one that has already run.
  2. Test it on your own database.
  3. Before merging, someone with Vercel access applies it to production: `vercel env pull .env.production.local --environment production`, then `node --env-file=.env.production.local scripts/migrate.mjs`, then delete that file.

How to contribute, and who approves changes: see the [org page](https://github.com/Founders-Illinois-Entrepreneurs).

## Credits

Thank you to everyone who built this. If you contributed, add yourself here in your pull request, with a link to your GitHub profile.

- **Will Garrett** ([GitHub](https://github.com/wgarrett707)): original [investment-game](https://github.com/wgarrett707/investment-game) that this app grew from.
- **Amey Gupta** ([GitHub](https://github.com/amey-gupt)): R&D pitch evaluation game.
- **Zuyu Liu** ([GitHub](https://github.com/geeeethubb)): contributor.
