import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { one } from '@/lib/db'
import { money } from '@/lib/format'
import type { Results } from '@/lib/types'
import { FeedbackList } from '@/components/invest/ResultsView'
import PrintButton from './PrintButton'

export const metadata = { title: 'Feedback report' }

// One printable section per R&D team: totals, rubric averages, and every comment.
export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const row = await one<{ r: Results }>('select invest_results($1::uuid, true) as r', [id]).catch(() => null)
  if (!row) notFound()
  const r = row.r

  return (
    <div className="space-y-10">
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/admin/invest/${id}`} className="mono text-sm underline">
            ← Back to event
          </Link>
          <h1 className="display mt-2 text-5xl">Feedback report</h1>
          <p className="text-sm text-ink-2">
            Only submitted portfolios are included. Table names are shown here for organizers; on the members&apos;
            results page they are {r.event.reveal_names ? 'shown' : 'hidden'} (change this in event settings).
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/invest/${id}/feedback.csv`} className="btn btn-ghost">
            Download CSV
          </a>
          <PrintButton />
        </div>
      </header>

      {r.teams.map((t, i) => (
        <section key={t.id} className={`space-y-4 ${i > 0 ? 'print-break' : ''}`}>
          <div>
            <p className="eyebrow">{r.event.name} · feedback for</p>
            <h2 className="display text-5xl">{t.name}</h2>
            <p className="mono text-sm">
              Rank #{t.rank} of {r.teams.length} · {money(t.total)} invested · avg rubric {t.avg_score ?? '–'}/5
            </p>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <tbody>
                {r.pillars.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.label}</td>
                    <td className="mono w-24 text-right">{t.pillar_avgs[p.key] ?? '–'}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FeedbackList team={t} />
        </section>
      ))}
    </div>
  )
}
