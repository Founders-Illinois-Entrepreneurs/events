import { money } from '@/lib/format'
import type { Results } from '@/lib/types'

// Ranked totals, rubric averages, and the feedback each R&D team received.
export default function ResultsView({ results }: { results: Results }) {
  const { teams, pillars, event } = results
  const max = Math.max(1, ...teams.map((t) => t.total))
  const honesty = pillars.find((p) => p.key === 'honesty')

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        {teams.map((t) => (
          <div key={t.id} className={`card ${t.rank === 1 ? 'card-shadow' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="num text-5xl text-orange">#{t.rank}</span>
                <h2 className="display text-4xl">{t.name}</h2>
                {t.rank === 1 && <span className="chip chip-orange">Winner</span>}
              </div>
              <span className="num text-4xl">{money(t.total)}</span>
            </div>
            <div className="bar-track mt-3">
              <div className="bar-fill" style={{ width: `${(t.total / max) * 100}%` }} />
            </div>
            <div className="mono mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
              <span>Avg rubric: {t.avg_score ?? '–'}/5</span>
              {honesty && (
                <span className="font-bold text-blue">
                  Honesty &amp; Risks: {t.pillar_avgs[honesty.key] ?? '–'}/5
                </span>
              )}
            </div>
          </div>
        ))}
        <p className="mono text-xs text-ink-3">
          {results.submitted_teams} table{results.submitted_teams === 1 ? '' : 's'} submitted ·{' '}
          {money(event.starting_capital)} each · ties go to the higher average rubric score
        </p>
      </section>

      {results.starred.length > 0 && (
        <section>
          <h2 className="display text-4xl">Best Investor Thesis</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {results.starred.map((s, i) => (
              <div key={i} className="card card-shadow space-y-2 bg-orange-soft">
                <p className="eyebrow">{s.investor ?? 'Anonymous table'}</p>
                {s.allocations.map((a) => (
                  <p key={a.team} className="text-sm">
                    <strong>
                      {a.team} · {money(a.amount)}:
                    </strong>{' '}
                    {a.rationale}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="display text-4xl">Rubric averages</h2>
        {teams.length > 2 && <p className="text-xs text-ink-3 sm:hidden">Swipe the table sideways to see every team →</p>}
        <div className="card mt-3 overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Pillar</th>
                {teams.map((t) => (
                  <th key={t.id} className="text-right">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pillars.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.label}</td>
                  {teams.map((t) => (
                    <td key={t.id} className="mono text-right">
                      {t.pillar_avgs[p.key] ?? '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function FeedbackList({ team }: { team: Results['teams'][number] }) {
  if (team.feedback.length === 0) return <p className="text-ink-2">No submitted feedback.</p>
  return (
    <ul className="space-y-3">
      {team.feedback.map((f, i) => (
        <li key={i} className="card card-flat space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="eyebrow">{f.investor ?? `Investor ${i + 1}`}</span>
            <span className="mono font-bold">{money(f.amount)}</span>
          </div>
          <p>{f.rationale}</p>
          <p className="text-sm text-ink-2">
            <strong>Invest more if:</strong> {f.invest_more_if}
          </p>
        </li>
      ))}
    </ul>
  )
}
