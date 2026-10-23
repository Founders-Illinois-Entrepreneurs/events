'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { money } from '@/lib/format'
import { pillarText, TRACK_LABEL } from '@/lib/types'
import type { Allocation, ClubEvent, InvestorTeam, Pillar, PresenterTeam, RubricScore, Teammate } from '@/lib/types'
import { fetchPortfolio, saveAllocation as saveAllocationAction, saveScore, submitPortfolio } from '../actions'

type Draft = { amount: number; rationale: string; invest_more_if: string; updated_by: string | null }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SCORE_LABELS = ['', 'Weak', 'Below avg', 'OK', 'Strong', 'Excellent']
const SYNC_SECONDS = 3

export default function InvestForm({
  event,
  team,
  me,
  teammates,
  presenters,
  pillars,
  initialAllocations,
  initialScores,
}: {
  event: ClubEvent
  team: InvestorTeam
  me: string
  teammates: Teammate[]
  presenters: PresenterTeam[]
  pillars: Pillar[]
  initialAllocations: Allocation[]
  initialScores: RubricScore[]
}) {
  const router = useRouter()
  const capital = event.starting_capital

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const d: Record<string, Draft> = {}
    for (const p of presenters) {
      const a = initialAllocations.find((x) => x.presenter_team_id === p.id)
      d[p.id] = {
        amount: a?.amount ?? 0,
        rationale: a?.rationale ?? '',
        invest_more_if: a?.invest_more_if ?? '',
        updated_by: a?.updated_by ?? null,
      }
    }
    return d
  })
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialScores.map((s) => [`${s.presenter_team_id}:${s.pillar_id}`, s.score])),
  )
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string>()
  const [reviewing, setReviewing] = useState(false)
  const [submitting, startSubmit] = useTransition()

  // Latest drafts for the debounced saver, unsaved cards, and in-flight saves to flush before submit.
  const draftsRef = useRef(drafts)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const inflight = useRef(new Set<Promise<unknown>>())
  // When we last saw each card change, so teammate edits are applied once.
  const seenAt = useRef<Record<string, string>>(
    Object.fromEntries(initialAllocations.map((a) => [a.presenter_team_id, a.updated_at])),
  )

  const nameOf = useCallback(
    (id: string | null) => {
      const t = teammates.find((x) => x.id === id)
      return t ? t.name : 'A teammate'
    },
    [teammates],
  )

  const track = useCallback((p: Promise<{ error?: string }>) => {
    inflight.current.add(p)
    setSaveState('saving')
    p.then((res) => {
      if (res.error) {
        setSaveState('error')
        setError(`Couldn't save: ${res.error}`)
      }
    })
      .catch(() => {
        setSaveState('error')
        setError("Couldn't save. Check your connection.")
      })
      .finally(() => {
        inflight.current.delete(p)
        if (inflight.current.size === 0) setSaveState((s) => (s === 'error' ? s : 'saved'))
      })
    return p
  }, [])

  const saveAllocation = useCallback(
    (presenterId: string) => {
      const d = draftsRef.current[presenterId]
      return track(
        saveAllocationAction(team.id, presenterId, {
          amount: d.amount,
          rationale: d.rationale,
          invest_more_if: d.invest_more_if,
        }),
      )
    },
    [team.id, track],
  )

  function update(presenterId: string, patch: Partial<Draft>) {
    const next = { ...draftsRef.current, [presenterId]: { ...draftsRef.current[presenterId], ...patch, updated_by: me } }
    draftsRef.current = next
    setDrafts(next)
    setError(undefined)
    clearTimeout(timers.current[presenterId])
    timers.current[presenterId] = setTimeout(() => {
      delete timers.current[presenterId]
      saveAllocation(presenterId)
    }, 600)
  }

  function setScore(presenterId: string, pillarId: string, score: number) {
    setScores((prev) => ({ ...prev, [`${presenterId}:${pillarId}`]: score }))
    track(saveScore(team.id, presenterId, pillarId, score))
  }

  async function flush() {
    for (const [id, t] of Object.entries(timers.current)) {
      clearTimeout(t)
      delete timers.current[id]
      saveAllocation(id)
    }
    await Promise.allSettled([...inflight.current])
  }

  // Pick up teammates' edits every few seconds. Our own edits are never overwritten.
  useEffect(() => {
    let stopped = false
    const sync = async () => {
      if (document.visibilityState !== 'visible' || inflight.current.size) return
      const latest = await fetchPortfolio(team.id).catch(() => null)
      if (stopped || !latest) return
      if (latest.submittedAt) {
        router.refresh()
        return
      }
      let next = draftsRef.current
      for (const a of latest.allocations) {
        const id = a.presenter_team_id
        if (!next[id] || a.updated_by === me || timers.current[id]) continue
        if (seenAt.current[id] && seenAt.current[id] >= a.updated_at) continue
        seenAt.current[id] = a.updated_at
        next = {
          ...next,
          [id]: { amount: a.amount, rationale: a.rationale, invest_more_if: a.invest_more_if, updated_by: a.updated_by },
        }
      }
      if (next !== draftsRef.current) {
        draftsRef.current = next
        setDrafts(next)
      }
      const theirs = latest.scores.filter((s) => s.updated_by !== me)
      if (theirs.length) {
        setScores((prev) => {
          let changed = false
          const out = { ...prev }
          for (const s of theirs) {
            const k = `${s.presenter_team_id}:${s.pillar_id}`
            if (out[k] !== s.score) {
              out[k] = s.score
              changed = true
            }
          }
          return changed ? out : prev
        })
      }
    }
    const id = setInterval(sync, SYNC_SECONDS * 1000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [team.id, me, router])

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(timers.current).length || inflight.current.size) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const total = presenters.reduce((sum, p) => sum + (drafts[p.id]?.amount || 0), 0)
  const remaining = capital - total

  const missing = presenters.flatMap((p) => {
    const d = drafts[p.id]
    const items: string[] = []
    if (!d.rationale.trim()) items.push(`${p.name}: why you invested`)
    if (!d.invest_more_if.trim()) items.push(`${p.name}: what would make you invest more`)
    const unscored = pillars.filter((pl) => !scores[`${p.id}:${pl.id}`]).length
    if (unscored) items.push(`${p.name}: ${unscored} rubric score${unscored > 1 ? 's' : ''}`)
    return items
  })
  const ready = remaining === 0 && missing.length === 0

  function submit() {
    startSubmit(async () => {
      setError(undefined)
      await flush()
      const res = await submitPortfolio(team.id, event.slug)
      if (res.error) {
        setError(res.error)
        setReviewing(false)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="alert alert-info">
        Split <strong>all {money(capital)}</strong> across the teams. For each team, explain your decision and score
        it on every pillar. Edits save automatically and your teammates see them live.
      </div>

      {presenters.map((p, i) => {
        const d = drafts[p.id]
        const pct = capital ? Math.round((d.amount / capital) * 100) : 0
        return (
          <section key={p.id} className="card card-shadow space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">Team {i + 1}</p>
                  <span className={`chip ${p.track === 'partner' ? 'chip-blue' : 'chip-muted'}`}>{TRACK_LABEL[p.track]}</span>
                </div>
                <h2 className="display text-4xl">{p.name}</h2>
                {p.one_liner && <p className="text-ink-2">{p.one_liner}</p>}
                {p.track === 'partner' && (
                  <p className="mt-1 text-sm text-ink-2">
                    This team works with an existing startup. Back the <strong>team and the value of their work</strong>,
                    not the partner company itself.
                  </p>
                )}
              </div>
              {d.updated_by && d.updated_by !== me && (
                <span className="chip chip-muted">Last edited by {nameOf(d.updated_by)}</span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="field-label" htmlFor={`amt-${p.id}`}>
                  Investment · {pct}% of capital
                </label>
                <input
                  type="range"
                  min={0}
                  max={capital}
                  step={Math.max(1, Math.round(capital / 200))}
                  value={d.amount}
                  onChange={(e) => update(p.id, { amount: Number(e.target.value) })}
                  aria-label={`Investment in ${p.name}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="num text-2xl">$</span>
                <input
                  id={`amt-${p.id}`}
                  className="input w-40 text-right mono"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={capital}
                  step={1000}
                  value={d.amount}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(capital, Math.floor(Number(e.target.value) || 0)))
                    update(p.id, { amount: n })
                  }}
                />
                {remaining > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update(p.id, { amount: d.amount + remaining })}
                  >
                    + rest
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label" htmlFor={`why-${p.id}`}>
                  Why this amount?
                </label>
                <textarea
                  id={`why-${p.id}`}
                  className="input"
                  placeholder="What convinced you, or didn't? Point to specifics from the pitch."
                  value={d.rationale}
                  onChange={(e) => update(p.id, { rationale: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor={`more-${p.id}`}>
                  What would make you invest more?
                </label>
                <textarea
                  id={`more-${p.id}`}
                  className="input"
                  placeholder="The one thing they should show or fix by the final pitch."
                  value={d.invest_more_if}
                  onChange={(e) => update(p.id, { invest_more_if: e.target.value })}
                />
              </div>
            </div>

            <div>
              <p className="field-label">Rubric · 1 weak → 5 excellent</p>
              <div className="divide-y divide-line rounded-[6px] border-2 border-ink">
                {pillars.map((pl) => {
                  const v = scores[`${p.id}:${pl.id}`]
                  const text = pillarText(pl, p.track)
                  return (
                    <div key={pl.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <details className="min-w-0 flex-1">
                        <summary className="cursor-pointer font-semibold">
                          {pl.label} <span className="font-normal text-ink-3">· {text.prompt}</span>
                        </summary>
                        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                          <p>
                            <span className="field-label text-green">Strong looks like</span>
                            {text.strong}
                          </p>
                          <p>
                            <span className="field-label text-red">Red flags</span>
                            {text.red}
                          </p>
                        </div>
                      </details>
                      <div className="score-row w-full sm:w-auto" role="group" aria-label={`${pl.label} score for ${p.name}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="score-btn"
                            aria-pressed={v === n}
                            title={SCORE_LABELS[n]}
                            onClick={() => setScore(p.id, pl.id, n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}

      {/* Sticky money bar */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper">
        <div className="container-page flex items-center justify-between gap-3 pt-2 sm:py-3">
          <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
            <span className="field-label mb-0">Left</span>
            <span className={`num text-3xl sm:text-4xl ${remaining === 0 ? 'text-green' : remaining < 0 ? 'text-red' : ''}`}>
              {money(remaining)}
            </span>
            <span className="mono hidden text-xs text-ink-3 sm:inline">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Save failed' : ''}
            </span>
          </div>
          <button className="btn btn-orange sm:min-h-[54px] sm:px-[26px] sm:text-base" disabled={!ready || submitting} onClick={() => setReviewing(true)}>
            Review &amp; submit
          </button>
        </div>
        {!ready && (
          <p className="container-page truncate pt-1 text-xs text-ink-2 sm:pb-3 sm:whitespace-normal">
            {remaining > 0
              ? `Invest ${money(remaining)} more. `
              : remaining < 0
                ? `You're ${money(-remaining)} over. `
                : ''}
            {missing.length > 0 && `Still needed: ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}.`}
          </p>
        )}
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      {reviewing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true">
          <div className="card card-shadow max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="display text-4xl">Lock in your portfolio?</h2>
            <p className="mt-1 text-ink-2">Once submitted, your team can&apos;t change it.</p>
            <table className="table mt-4">
              <tbody>
                {presenters.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="mono text-right">{money(drafts[p.id].amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold">Total</td>
                  <td className="mono text-right font-bold">{money(total)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button className="btn btn-ghost px-3" onClick={() => setReviewing(false)} disabled={submitting}>
                Keep editing
              </button>
              <button className="btn btn-orange px-3" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
