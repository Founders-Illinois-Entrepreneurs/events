'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { money } from '@/lib/format'
import type { Results } from '@/lib/types'

// Full-screen projector view. Press → / space to reveal teams from last place to first.
export default function Reveal({
  results,
  investorTeams,
  backHref,
}: {
  results: Results
  investorTeams: number
  backHref: string
}) {
  const teams = results.teams
  const order = [...teams].sort((a, b) => b.rank - a.rank) // last place first
  const [shown, setShown] = useState(0)
  const max = Math.max(1, ...teams.map((t) => t.total))
  const honesty = results.pillars.find((p) => p.key === 'honesty')
  const done = shown >= order.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setShown((s) => Math.min(order.length, s + 1))
      }
      if (e.key === 'ArrowLeft') setShown((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [order.length])

  return (
    <div className="band-blue on-dark fixed inset-0 z-50 overflow-y-auto">
      <div className="container-page flex min-h-full flex-col py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="rounded-[6px] border-2 border-white bg-white px-3 py-2">
              <Image src="/brand/founders-logo.png" alt="Founders · Illinois Entrepreneurs" width={535} height={141} className="h-9 w-auto" />
            </span>
            <p className="eyebrow text-white/70">R&amp;D Pitch Investment Game</p>
          </div>
          <Link href={backHref} className="btn btn-ghost btn-sm">
            Exit
          </Link>
        </div>
        <h1 className="display mt-4 text-6xl sm:text-8xl">{results.event.name}</h1>
        <p className="mono mt-2 text-white/70">
          {results.submitted_teams}/{investorTeams} investor teams submitted · {money(results.event.starting_capital)} each
        </p>

        <div className="mt-10 flex-1 space-y-6">
          {teams.map((t) => {
            const idx = order.findIndex((o) => o.id === t.id)
            const visible = idx < shown
            return (
              <div key={t.id} className={`transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-25'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-4">
                    <span className="num text-6xl text-orange">{visible ? `#${t.rank}` : '#?'}</span>
                    <span className="display text-5xl">{t.name}</span>
                    {visible && t.rank === 1 && done && <span className="chip chip-orange text-ink">Winner</span>}
                  </div>
                  <span className="num text-6xl">{visible ? money(t.total) : '$ ???'}</span>
                </div>
                <div className="mt-2 h-8 overflow-hidden rounded-[6px] border-2 border-white/80 bg-white/10">
                  <div
                    className="h-full bg-orange transition-[width] duration-[1600ms] ease-out"
                    style={{ width: visible ? `${(t.total / max) * 100}%` : '0%' }}
                  />
                </div>
                {visible && honesty && (
                  <p className="mono mt-2 text-sm text-white/80">
                    Avg rubric {t.avg_score ?? '–'}/5 · Honesty &amp; Risks {t.pillar_avgs[honesty.key] ?? '–'}/5
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <p className="mono text-sm text-white/60">→ or space to reveal · ← to go back</p>
          <button
            className="btn btn-orange btn-lg"
            onClick={() => setShown((s) => Math.min(order.length, s + 1))}
            disabled={done}
          >
            {shown === 0 ? 'Start reveal' : done ? 'All revealed' : 'Next team'}
          </button>
        </div>
      </div>
    </div>
  )
}
