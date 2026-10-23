// Database tests that run without any server: PGlite is Postgres compiled
// to WebAssembly. Applies every migration and the seed, then checks the
// game rules as different users.
//
//   npm run test:db

import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const db = new PGlite()

for (const f of readdirSync(join(root, 'db/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(root, 'db/migrations', f), 'utf8'))
}
await db.exec(readFileSync(join(root, 'db/seed.sql'), 'utf8'))
await db.exec(readFileSync(join(root, 'db/seed.sql'), 'utf8')) // seeding twice is safe

// --- Helpers ---------------------------------------------------------------
let passed = 0
let failed = 0

function ok(cond, name) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}`)
  }
}

async function throwsLike(fn, pattern, name) {
  try {
    await fn()
    ok(false, `${name} (expected an error)`)
  } catch (e) {
    const matched = pattern.test(e.message)
    ok(matched, matched ? name : `${name} (got: ${e.message})`)
  }
}

const q = async (sql, params = []) => (await db.query(sql, params)).rows

let n = 0
async function addMember(name) {
  const id = `member-${++n}`
  await q(`insert into members (id, name, token_hash) values ($1, $2, $3)`, [id, name, `hash-${id}`])
  return { id, name }
}

// --- Tests -----------------------------------------------------------------
console.log('\nMembers')
await throwsLike(() => addMember('   '), /check/, 'a name is required')
await throwsLike(() => addMember('x'.repeat(121)), /check/, 'names are kept short')
const alice = await addMember('Alice')
const bob = await addMember('Bob')
const carol = await addMember('Carol')
await throwsLike(() => q(`insert into members (id, name, token_hash) values ('dup', 'Dup', $1)`, [`hash-${alice.id}`]), /duplicate/, 'browser tokens are unique')

const [event] = await q(`select id, starting_capital from events where slug = 'demo-midpoint'`)
const presenters = await q('select id, name from invest_presenter_teams where event_id = $1 order by sort_order', [event.id])
const investors = await q('select id, name from invest_investor_teams where event_id = $1 order by name', [event.id])
const pillars = await q('select id, key from invest_rubric_pillars where event_id = $1', [event.id])
ok(pillars.length === 7, 'seed creates 7 default rubric pillars (and is safe to run twice)')

console.log('\nEvents')
const [{ invest_create_event: clonedId }] = await q(
  `select invest_create_event('Clone test', 'clone-test', 100000, $1)`, [event.id])
const [counts0] = await q(`select
  (select count(*)::int from invest_rubric_pillars where event_id = $1) as p,
  (select count(*)::int from invest_presenter_teams where event_id = $1) as t`, [clonedId])
ok(counts0.p === 7 && counts0.t === 3, 'cloning copies pillars and teams')
const [{ invest_create_event: clone2 }] = await q(`select invest_create_event('Clone 2', 'clone-two', null, $1)`, [clonedId])
ok((await q('select starting_capital from events where id = $1', [clone2]))[0].starting_capital === 100000, 'a copied event keeps the original capital')
await throwsLike(() => q(`select invest_create_event('Bad', 'Bad Slug!')`), /check/, 'rejects bad slugs')

console.log('\nTracks (own venture vs. startup partner)')
const partnerText = await q(`select count(*)::int as n from invest_rubric_pillars where event_id = $1 and partner_prompt <> ''`, [event.id])
ok(partnerText[0].n === 7, 'every default pillar has startup-partner wording')
const [gamma] = await q(`select track from invest_presenter_teams where event_id = $1 and name = 'Team Gamma'`, [clonedId])
ok(gamma.track === 'partner', 'cloning keeps each team\'s track')
await throwsLike(() => q(`update invest_presenter_teams set track = 'other' where event_id = $1`, [event.id]), /check/, 'rejects unknown tracks')
const [{ invest_create_event: freshId }] = await q(`select invest_create_event('Fresh', 'fresh-one')`)
const fresh = await q(`select count(*)::int as n from invest_rubric_pillars where event_id = $1 and partner_prompt <> ''`, [freshId])
ok(fresh[0].n === 7, 'new events get partner wording too')

console.log('\nJoining teams')
const [t1, t2] = investors
await q('select invest_join_team($1, $2)', [alice.id, t1.id])
await throwsLike(() => q('select invest_join_team($1, $2)', [bob.id, t1.id]), /Another phone/, 'a second phone cannot sign in for a taken table')
await q('select invest_join_team($1, $2)', [carol.id, t2.id])
const counts = await q('select * from invest_team_counts($1)', [event.id])
ok(counts.find((c) => c.id === t1.id).taken && !counts.find((c) => c.id === investors[2].id).taken, 'join page shows which tables are taken')
await throwsLike(() => q('select invest_join_team($1, $2)', [alice.id, t2.id]), /Another phone/, 'cannot switch into a taken table')
await q(`insert into invest_investor_teams (event_id, name) values ($1, 'Investors 10')`, [event.id])
const order = (await q('select name from invest_team_counts($1)', [event.id])).map((x) => x.name)
ok(order.indexOf('Investors 2') < order.indexOf('Investors 10'), 'tables sort naturally (2 before 10)')
await q(`delete from invest_investor_teams where event_id = $1 and name = 'Investors 10'`, [event.id])

console.log('\nEditing before the event opens')
const save = (user, team, presenter, amount, rationale = 'Strong problem evidence', more = 'Show paying users') =>
  q('select invest_save_allocation($1, $2, $3, $4, $5, $6)', [user.id, team, presenter, amount, rationale, more])
const score = (user, team, presenter, pillar, s) =>
  q('select invest_save_score($1, $2, $3, $4, $5)', [user.id, team, presenter, pillar, s])
await throwsLike(() => save(alice, t1.id, presenters[0].id, 100), /can't edit/, 'cannot invest while event is in setup')

await q(`update events set status = 'open' where id = $1`, [event.id])

console.log('\nInvesting')
await throwsLike(() => save(alice, t2.id, presenters[0].id, 100), /can't edit/, "cannot write another team's portfolio")
await throwsLike(() => save(alice, t1.id, presenters[0].id, -5), /check/, 'rejects negative amounts')
const [otherPresenter] = await q('select id from invest_presenter_teams where event_id = $1 limit 1', [clonedId])
await throwsLike(() => save(alice, t1.id, otherPresenter.id, 5), /foreign key/, "cannot invest in another event's team")
await save(alice, t1.id, presenters[0].id, 100000)
await throwsLike(() => q('select invest_leave_team($1, $2)', [alice.id, event.id]), /started answering/, 'cannot leave a table that has answers')
await throwsLike(() => save(bob, t1.id, presenters[1].id, 50000), /can't edit/, 'a phone not signed in for the table cannot edit it')
await save(alice, t1.id, presenters[1].id, 50000)
const shared = await q('select presenter_team_id, updated_by from invest_allocations where investor_team_id = $1', [t1.id])
ok(shared.length === 2, 'the table portfolio saves')

await throwsLike(() => q('select invest_submit($1, $2)', [alice.id, t1.id]), /Finish every field/, 'submit blocked when a team is missing')
await save(alice, t1.id, presenters[2].id, 40000)
await throwsLike(() => q('select invest_submit($1, $2)', [alice.id, t1.id]), /Finish every field/, 'submit blocked when scores are missing')

const scoreAll = async (user, team, s = 4) => {
  for (const p of presenters) for (const pl of pillars) await score(user, team, p.id, pl.id, s)
}
await throwsLike(() => score(alice, t1.id, presenters[0].id, pillars[0].id, 9), /check/, 'rejects scores outside 1–5')
const [otherPillar] = await q('select id from invest_rubric_pillars where event_id = $1 limit 1', [clonedId])
await throwsLike(() => score(alice, t1.id, presenters[0].id, otherPillar.id, 3), /foreign key/, "cannot score another event's pillar")
await scoreAll(alice, t1.id)
await throwsLike(() => q('select invest_submit($1, $2)', [alice.id, t1.id]), /exactly \$200000 \(you have \$190000/, 'submit blocked unless all money is invested')
await save(alice, t1.id, presenters[2].id, 50000, '   ')
await throwsLike(() => q('select invest_submit($1, $2)', [alice.id, t1.id]), /Finish every field for: Team Gamma/, 'submit blocked on a blank rationale')
await save(alice, t1.id, presenters[2].id, 50000)
await throwsLike(() => q('select invest_submit($1, $2)', [carol.id, t1.id]), /not on this table/, "cannot submit another table's portfolio")
await q('select invest_submit($1, $2)', [alice.id, t1.id])
ok((await q('select * from invest_submissions where investor_team_id = $1', [t1.id])).length === 1, 'valid portfolio submits')
await throwsLike(() => q('select invest_submit($1, $2)', [alice.id, t1.id]), /already submitted/, 'cannot submit twice')
await throwsLike(() => save(alice, t1.id, presenters[0].id, 0), /can't edit/, 'portfolio is locked after submit')
await throwsLike(() => q('select invest_join_team($1, $2)', [alice.id, investors[2].id]), /already submitted/, 'cannot switch teams after submitting')
await throwsLike(() => q('select invest_leave_team($1, $2)', [alice.id, event.id]), /already submitted/, 'cannot leave after submitting')

console.log('\nResults')
await throwsLike(() => q('select invest_results($1)', [event.id]), /not revealed/, 'results hidden from members before reveal')
ok((await q('select invest_results($1, true) as r', [event.id]))[0].r.teams.length === 3, 'organizers can preview results')

// Team 2 (carol) submits a different portfolio, then the admin reveals.
await save(carol, t2.id, presenters[0].id, 0)
await save(carol, t2.id, presenters[1].id, 150000)
await save(carol, t2.id, presenters[2].id, 50000)
await scoreAll(carol, t2.id, 5)
for (const pl of pillars) await score(carol, t2.id, presenters[0].id, pl.id, 1)
// Carol's table finishes but forgets to press Submit; Bob's table never finishes.
await q('select invest_join_team($1, $2)', [bob.id, investors[2].id])
await save(bob, investors[2].id, presenters[1].id, 200000)
const [{ n: auto }] = await q('select invest_close_event($1) as n', [event.id])
ok(auto === 1, 'closing auto-submits complete portfolios only')
ok((await q('select 1 from invest_submissions where investor_team_id = $1', [t2.id])).length === 1, "a complete table that forgot to submit still counts")
ok((await q('select 1 from invest_submissions where investor_team_id = $1', [investors[2].id])).length === 0, "an incomplete table doesn't count")
await throwsLike(() => q('select invest_submit($1, $2)', [bob.id, investors[2].id]), /not open/, 'no submitting after close')
await q(`update events set status = 'revealed' where id = $1`, [event.id])
await q('update invest_submissions set starred = true where investor_team_id = $1', [t2.id])

const [{ r }] = await q('select invest_results($1) as r', [event.id])
const byName = Object.fromEntries(r.teams.map((t) => [t.name, t]))
ok(byName['Team Beta'].total === 200000 && byName['Team Beta'].rank === 1, 'winner has the most investment')
ok(byName['Team Alpha'].total === 100000 && byName['Team Gamma'].total === 100000, 'totals add up')
ok(byName['Team Alpha'].rank === 3 && byName['Team Gamma'].rank === 2, 'ties broken by average rubric score')
ok(byName['Team Beta'].feedback.every((f) => f.investor === null), 'feedback is anonymous by default')
const [{ r: orgView }] = await q('select invest_results($1, true) as r', [event.id])
ok(orgView.teams[0].feedback.every((f) => f.investor), 'organizers always see which table wrote what')
ok(orgView.teams.some((t) => t.feedback.some((f) => f.auto)), 'auto-submitted tables are marked')
ok(byName['Team Beta'].pillar_avgs.honesty === 4.5, 'honesty pillar average is reported')
ok(r.starred.length === 1, 'starred thesis is included')
ok(r.submitted_teams === 2, 'counts submitted teams')
ok(byName['Team Gamma'].track === 'partner', 'results include each team\'s track')
await q('update events set reveal_names = true where id = $1', [event.id])
const [{ r: named }] = await q('select invest_results($1) as r', [event.id])
ok(named.teams[0].feedback.some((f) => f.investor === 'Investors 1'), 'names shown when the admin turns them on')

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
