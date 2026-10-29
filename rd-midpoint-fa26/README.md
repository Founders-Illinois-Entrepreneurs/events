# R&D Midpoint Pitch Evaluation · Fall 2026

The guide to the R&D Pitch Evaluation game, as it was run at the Fall 2026 R&D midpoint pitches.

| | |
| --- | --- |
| Date | October 25, 2026 |
| Link | [events.foundersillinois.org/rd-midpoint-fa26](https://events.foundersillinois.org/rd-midpoint-fa26) |
| Setup | 3 R&D teams (2 own venture, 1 startup partner), 8 investor tables, $200,000 per table |
| Rubric | The 7 default pillars: Problem, Customer & Market, Solution, Product, Business Model (0.5×), Traction & Validation (1.5×), Pitch Execution |
| Code version | Git tag [`v2026-fall-midpoint`](https://github.com/Founders-Illinois-Entrepreneurs/events/tree/v2026-fall-midpoint) |

**Running it again next semester:** copy this folder to a new one named after the new event's slug (e.g. `rd-midpoint-sp27/`). Update the table above and anything that changed. In the app, create the new event with **Copy setup from** this one.

## The game

1. The R&D teams pitch at their midpoint presentations.
2. Club members sit at investor tables, a few people each, and use **one phone per table**. Each table gets fake capital ($200,000 by default) and must invest **all of it** across the R&D teams.
3. For every R&D team, the table writes **why** it invested that amount and **what would make it invest more**, and scores the team 1–5 on each pillar of the rubric.
4. The R&D team with the most investment wins. Ties go to the higher rubric score (the weighted average of its pillar scores).

It's built to teach. Members learn what investors look for, because the rubric pillars are the lesson. R&D teams get specific, honest feedback to act on before their final pitch.

R&D teams are on one of two **tracks**:
- **Own venture:** building their own startup.
- **Startup partner:** working with an existing startup as consultants, contractors or mentors.

Both tracks are scored on the same pillars, so results stay comparable. Partner teams get each question reworded for their situation.

## How it works

There are no accounts. One person per table opens the link, types the names of everyone at the table, and picks the table. That phone is remembered, and other phones can't take over the table unless an organizer presses **Free table**. Organizers sign in at `/admin` with one shared password.

The event moves through four phases, controlled from the organizer page:

| Phase | What members can do |
| --- | --- |
| **Setup** | Join a table, read "What investors look for". |
| **Open investing** | Score each team on the rubric after its pitch, then split the money (the scores suggest a split), explain each amount, and submit. Everything autosaves. |
| **Closed** | Nothing. Tables that didn't submit don't count. |
| **Revealed** | See results, rubric averages and all feedback. |

Rules the database enforces:
- One phone per table. Once a table submits, it's locked; an organizer can unlock it while investing is still open.
- Closing investing automatically submits any table whose portfolio is complete but who forgot to press Submit. Incomplete tables don't count.
- A portfolio can only be submitted if it invests exactly the full amount, and every R&D team has a reason, an "invest more if" answer and a score on every pillar.
- Tables can't see each other's picks until the reveal.
- Feedback is anonymous unless the organizer turns on "show investor table names".

Organizer tools:
- A live tracker showing who joined and who has submitted.
- A **Best Investor Thesis** star.
- A full-screen **Projector reveal**.
- A **Feedback report** (print, PDF or CSV) to hand to each R&D team.

If a table signs in on the wrong phone, or a phone dies, press **Free table** in the tracker. Answers so far are kept for whichever phone signs in next.

## Event-night checklist

**Before the meeting**

1. Go to **/admin** and sign in with the organizer password.
2. Fill in the new event's name and slug, then **Create event**. To reuse a past event's rubric, teams and tables, pick it under **Copy setup from**.
3. Add the **R&D teams** with one-liners, and set each team's **track**.
4. Add the **investor tables**. Paste one name per line, e.g. `Table 1` … `Table 8`.
5. Check the **rubric** wording.
6. Do a practice run on two phones, then **Reset event** (Settings) to wipe it.

**At the meeting**

1. Put the site's address on the projector. The home page opens the current event.
2. Each table picks one phone, types everyone's names and signs in while the event is still in **Setup**.
3. Click **Open investing** as the first pitch starts, so tables can score each team right after its pitch.
4. Run the pitches. Suggested format: **7 minutes of pitch and 5 of Q&A per team**, with a visible timer.
5. After the last pitch, give tables about 10 minutes to use **Split the money**, adjust, write their reasons and submit. Watch the **live tracker**.
6. Click **Close investing**. Optionally ★ the best-reasoned portfolio.
7. Open **Projector reveal** and press → to reveal teams from last place to first, then the rubric slide. Click **Reveal results** afterwards: phones show the results within seconds.

**After**

1. Open the **Feedback report**, then print or save a PDF for each R&D team, or download the CSV.
2. Archive the event. It stays in **Admin → Archive** with its results and feedback.
3. Tag the code version used, so it can be run again later:
   ```bash
   git tag -a v2026-fall-midpoint -m "Fall 2026 R&D midpoint"
   git push origin v2026-fall-midpoint
   ```

**Practice run or a mistake?** Settings → **Reset event** wipes every sign-in, answer, score and submission, restores the default rubric and goes back to Setup. The event's name, link, capital, R&D teams and tables are kept. Type the event's slug to confirm.

## Where the code is

| Part | Files |
| --- | --- |
| Member pages: join, invest, learn, results | `app/(tools)/[slug]/` |
| Organizer pages: phases, tracker, teams, rubric, reveal, feedback | `app/admin/invest/[id]/` |
| Rubric text and scoring | `lib/rubric.ts`, `components/invest/` |
| Game rules (submit, close, reset) | SQL functions in `db/migrations/` |
