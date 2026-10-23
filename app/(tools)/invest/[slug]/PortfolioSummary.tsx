import Link from 'next/link'
import { money } from '@/lib/format'
import { TRACK_LABEL } from '@/lib/types'
import type { Allocation, Pillar, PresenterTeam, RubricScore } from '@/lib/types'

export default function PortfolioSummary({
  presenters,
  pillars,
  allocations,
  scores,
  submittedAt,
  revealed,
  slug,
}: {
  presenters: PresenterTeam[]
  pillars: Pillar[]
  allocations: Allocation[]
  scores: RubricScore[]
  submittedAt: string
  revealed: boolean
  slug: string
}) {
  return (
    <section className="space-y-5">
      <div className="alert alert-ok">
        Portfolio submitted {new Date(submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.{' '}
        {revealed ? (
          <Link className="underline" href={`/invest/${slug}/results`}>
            See the results →
          </Link>
        ) : (
          'Results show up here when the organizers reveal them.'
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {presenters.map((p) => {
          const a = allocations.find((x) => x.presenter_team_id === p.id)
          return (
            <div key={p.id} className="card space-y-3">
              <span className={`chip ${p.track === 'partner' ? 'chip-blue' : 'chip-muted'}`}>{TRACK_LABEL[p.track]}</span>
              <h3 className="display text-3xl">{p.name}</h3>
              <p className="num text-5xl text-orange-ink">{money(a?.amount ?? 0)}</p>
              <p className="text-sm">{a?.rationale}</p>
              <p className="text-sm text-ink-2">
                <span className="field-label">Invest more if</span>
                {a?.invest_more_if}
              </p>
              <ul className="mono space-y-0.5 text-xs text-ink-2">
                {pillars.map((pl) => (
                  <li key={pl.id} className="flex justify-between gap-2">
                    <span>{pl.label}</span>
                    <span>
                      {scores.find((s) => s.presenter_team_id === p.id && s.pillar_id === pl.id)?.score ?? '–'}/5
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
