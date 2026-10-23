'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { money } from '@/lib/format'
import type { Results } from '@/lib/types'

// Full-screen projector view. Press → / space to reveal teams from last place
// to first, then once more for the rubric slide. Nothing about the order is
// visible until each team is revealed.
export default function Reveal({
  results,
  investorTeams,
  backHref,
}: {
  results: Results
  investorTeams: number
  backHref: string
}) {
  const teams = results.teams // rank order, #1 first
  const steps = teams.length + 1 // one per team, then the rubric slide
  const [shown, setShown] = useState(0)
  const max = Math.max(1, ...teams.map((t) => t.total))
  const done = shown >= teams.length
  const rubricSlide = shown > teams.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setShown((s) => Math.min(steps, s + 1))
      }
      if (e.key === 'ArrowLeft') setShown((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps])

  const bestEvidence = [...teams].sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))[0]

  return (
    <div className="band-blue on-dark fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[1800px] flex-col px-10 py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="rounded-[6px] border-2 border-white bg-white px-3 py-2">
              <Image src="/brand/founders-logo.png" alt="Founders · Illinois Entrepreneurs" width={535} height={141} className="h-10 w-auto" />
            </span>
            <p className="mono text-xl text-white/80">{results.event.name}</p>
          </div>
          <Link href={backHref} className="btn btn-ghost btn-sm">
            Exit
          </Link>
        </div>

        {!rubricSlide ? (
          <>
            <p className="mono mt-6 text-2xl text-white/80">
              {results.submitted_teams}/{investorTeams} tables invested · {money(results.event.starting_capital)} each
            </p>
            <div className="mt-8 flex-1 space-y-8">
              {teams.map((t, i) => {
                // Slots fill from the bottom: the last-place team is revealed first.
                const visible = teams.length - i <= shown
                return (
                  <div key={t.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <div className="flex items-baseline gap-6">
                        <span className="num text-8xl text-orange">#{t.rank}</span>
                        <span className="display text-7xl">{visible ? t.name : '? ? ?'}</span>
                        {visible && t.rank === 1 && done && (
                          <span className="chip chip-orange min-h-12 px-5 text-2xl text-ink">Winner</span>
                        )}
                      </div>
                      <span className="num text-8xl">{visible ? money(t.total) : ''}</span>
                    </div>
                    <div className="mt-3 h-10 overflow-hidden rounded-[6px] border-2 border-white/80 bg-white/10">
                      <div
                        className="h-full bg-orange transition-[width] duration-[1600ms] ease-out"
                        style={{ width: visible ? `${(t.total / max) * 100}%` : '0%' }}
                      />
                    </div>
                    {visible && (
                      <p className="mono mt-3 text-3xl text-white/90">
                        Rubric score <strong>{t.avg_score ?? '–'}/5</strong>
                        {t.pillar_avgs.honesty != null && (
                          <>
                            {' '}
                            · Honesty &amp; Risks <strong>{t.pillar_avgs.honesty}/5</strong>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="mt-8 flex-1">
            <h1 className="display text-7xl">What the investors saw</h1>
            <p className="mt-2 text-3xl text-white/80">
              Average rubric score per pillar (1–5).{' '}
              {bestEvidence && bestEvidence.rank !== 1 && (
                <>
                  <strong className="text-orange">{bestEvidence.name}</strong> had the strongest scores but not the
                  most money. Why?
                </>
              )}
            </p>
            <table className="mt-8 w-full text-3xl">
              <thead>
                <tr className="border-b-2 border-white/60 text-left">
                  <th className="py-3 font-normal text-white/70">Pillar</th>
                  {teams.map((t) => (
                    <th key={t.id} className="py-3 text-right display text-4xl">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.pillars.map((p) => {
                  const vals = teams.map((t) => t.pillar_avgs[p.key] ?? 0)
                  const best = Math.max(...vals)
                  return (
                    <tr key={p.id} className="border-b border-white/20">
                      <td className="py-3">{p.label}</td>
                      {teams.map((t) => {
                        const v = t.pillar_avgs[p.key]
                        return (
                          <td key={t.id} className={`num py-3 text-right text-5xl ${v != null && v === best ? 'text-orange' : ''}`}>
                            {v ?? '–'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="mono text-lg text-white/60">→ or space for next · ← to go back</p>
          <button
            className="btn btn-orange btn-lg"
            onClick={() => setShown((s) => Math.min(steps, s + 1))}
            disabled={shown >= steps}
          >
            {shown === 0 ? 'Start reveal' : shown < teams.length ? 'Next team' : shown === teams.length ? 'Rubric scores →' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
