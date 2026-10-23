'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { money, shortMoney } from '@/lib/format'
import { pillarText, TRACK_LABEL } from '@/lib/types'
import type { Allocation, ClubEvent, InvestorTeam, Pillar, PresenterTeam, RubricScore } from '@/lib/types'
import { saveAllocation as saveAllocationAction, saveScore, submitPortfolio } from '../actions'

// One phone per table, so there is no syncing between devices: this screen is
// the only editor of the table's portfolio. Edits autosave in the background.

type Draft = { amount: number; rationale: string; invest_more_if: string }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SCORE_LABELS = ['', 'Weak', 'Below avg', 'OK', 'Strong', 'Excellent']
const EMPTY: Draft = { amount: 0, rationale: '', invest_more_if: '' }

// "50,000" / "$50000" / "50k" / "0.2m" -> whole dollars.
function parseAmount(raw: string) {
  const s = raw.toLowerCase().replace(/[\s$,]/g, '')
  const mult = s.endsWith('k') ? 1_000 : s.endsWith('m') ? 1_000_000 : 1
  const n = parseFloat(s.replace(/[km]$/, ''))
  return Number.isFinite(n) ? Math.max(0, Math.round(n * mult)) : 0
}

export default function InvestForm({
  event,
  team,
  presenters,
  pillars,
  initialAllocations,
  initialScores,
}: {
  event: ClubEvent
  team: InvestorTeam
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
      d[p.id] = { amount: a?.amount ?? 0, rationale: a?.rationale ?? '', invest_more_if: a?.invest_more_if ?? '' }
    }
    return d
  })
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialScores.map((s) => [`${s.presenter_team_id}:${s.pillar_id}`, s.score])),
  )
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string>()
  const [reviewing, setReviewing] = useState(false)
  // Raw text of the amount box being typed in (formatted with commas once you leave it).
  const [amountText, setAmountText] = useState<{ id: string; text: string } | null>(null)
  const [submitting, startSubmit] = useTransition()

  // Latest drafts for the debounced saver, unsaved cards, and in-flight saves to flush before submit.
  const draftsRef = useRef(drafts)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const inflight = useRef(new Set<Promise<unknown>>())
  // Saves that failed (e.g. phone briefly offline). Retried automatically.
  const failedCards = useRef(new Set<string>())
  const failedScores = useRef(new Map<string, number>())

  const track = useCallback((p: Promise<{ error?: string }>, onDone: (ok: boolean) => void) => {
    inflight.current.add(p)
    setSaveState('saving')
    p.then((res) => {
      onDone(!res.error)
      if (res.error) setError(`Couldn't save: ${res.error}`)
    })
      .catch(() => {
        onDone(false)
        setError("Couldn't save. Check your connection; we'll keep retrying.")
      })
      .finally(() => {
        inflight.current.delete(p)
        if (inflight.current.size === 0) {
          const failing = failedCards.current.size + failedScores.current.size > 0
          setSaveState(failing ? 'error' : 'saved')
          if (!failing) setError(undefined)
        }
      })
    return p
  }, [])

  const saveAllocation = useCallback(
    (presenterId: string) =>
      track(saveAllocationAction(team.id, presenterId, draftsRef.current[presenterId] ?? EMPTY), (ok) => {
        if (ok) failedCards.current.delete(presenterId)
        else failedCards.current.add(presenterId)
      }),
    [team.id, track],
  )

  const sendScore = useCallback(
    (presenterId: string, pillarId: string, score: number) => {
      const key = `${presenterId}:${pillarId}`
      return track(saveScore(team.id, presenterId, pillarId, score), (ok) => {
        if (ok) {
          if (failedScores.current.get(key) === score) failedScores.current.delete(key)
        } else failedScores.current.set(key, score)
      })
    },
    [team.id, track],
  )

  const retryFailed = useCallback(() => {
    for (const id of [...failedCards.current]) saveAllocation(id)
    for (const [key, score] of [...failedScores.current]) {
      const [presenterId, pillarId] = key.split(':')
      sendScore(presenterId, pillarId, score)
    }
  }, [saveAllocation, sendScore])

  // Keep the page's auto-refresh away while anything is unsaved, so nothing typed can be lost.
  useEffect(() => {
    const w = window as unknown as { __ftHoldRefresh?: boolean }
    const id = setInterval(() => {
      w.__ftHoldRefresh =
        Object.keys(timers.current).length + inflight.current.size + failedCards.current.size + failedScores.current.size > 0
    }, 250)
    return () => {
      clearInterval(id)
      w.__ftHoldRefresh = false
    }
  }, [])

  // Retry failed saves when the connection comes back, and every 5 seconds while any are pending.
  useEffect(() => {
    const tick = () => {
      if (inflight.current.size === 0 && failedCards.current.size + failedScores.current.size > 0) retryFailed()
    }
    window.addEventListener('online', tick)
    const id = setInterval(tick, 5000)
    return () => {
      window.removeEventListener('online', tick)
      clearInterval(id)
    }
  }, [retryFailed])

  function update(presenterId: string, patch: Partial<Draft>) {
    const next = { ...draftsRef.current, [presenterId]: { ...(draftsRef.current[presenterId] ?? EMPTY), ...patch } }
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
    failedScores.current.delete(`${presenterId}:${pillarId}`)
    sendScore(presenterId, pillarId, score)
  }

  async function flush() {
    for (const [id, t] of Object.entries(timers.current)) {
      clearTimeout(t)
      delete timers.current[id]
      saveAllocation(id)
    }
    await Promise.allSettled([...inflight.current])
    if (failedCards.current.size + failedScores.current.size > 0) {
      retryFailed()
      await Promise.allSettled([...inflight.current])
    }
  }

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(timers.current).length || inflight.current.size) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const draftOf = (id: string) => drafts[id] ?? EMPTY
  const total = presenters.reduce((sum, p) => sum + draftOf(p.id).amount, 0)
  const remaining = capital - total

  // How many fields each team card still needs.
  const todo = presenters.map((p) => {
    const d = draftOf(p.id)
    const unscored = pillars.filter((pl) => !scores[`${p.id}:${pl.id}`]).length
    return { p, left: (d.rationale.trim() ? 0 : 1) + (d.invest_more_if.trim() ? 0 : 1) + unscored }
  })
  const fieldsLeft = todo.reduce((s, t) => s + t.left, 0)
  const ready = remaining === 0 && fieldsLeft === 0

  const jump = (id: string) => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  function submit() {
    startSubmit(async () => {
      setError(undefined)
      await flush()
      if (failedCards.current.size + failedScores.current.size > 0) {
        setError("Some answers haven't saved yet. Check your connection and try again.")
        setReviewing(false)
        return
      }
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
    <div className="space-y-6 pb-32">
      <div className="alert alert-info space-y-1">
        <p>
          Split <strong>all {money(capital)}</strong> across the teams. For each team: an amount, why, what would make
          you invest more, and a 1–5 score on each pillar.
        </p>
        <p className="text-sm">
          Tip: go one team at a time and talk it through as a table. Settle the dollar split together at the end.
        </p>
      </div>

      {/* Team shortcuts with progress */}
      <nav className="grid grid-cols-3 gap-2" aria-label="Teams">
        {todo.map(({ p, left }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => jump(p.id)}
            className={`card flex min-w-0 flex-col items-start gap-0.5 p-2 text-left sm:p-3 ${left === 0 ? 'bg-[var(--green-soft)]' : ''}`}
          >
            <span className="w-full truncate text-sm font-bold">{p.name}</span>
            <span className={`mono text-xs ${left === 0 ? 'text-green' : 'text-ink-3'}`}>{left === 0 ? '✓ done' : `${left} left`}</span>
            <span className="mono text-xs text-ink-2">{shortMoney(draftOf(p.id).amount)}</span>
          </button>
        ))}
      </nav>

      {presenters.map((p, i) => {
        const d = draftOf(p.id)
        const pct = capital ? Math.round((d.amount / capital) * 100) : 0
        return (
          <section key={p.id} id={`card-${p.id}`} className="card card-shadow scroll-mt-4 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">Team {i + 1}</p>
                <span className={`chip ${p.track === 'partner' ? 'chip-blue' : 'chip-muted'}`}>{TRACK_LABEL[p.track]}</span>
              </div>
              <h2 className="display text-4xl">{p.name}</h2>
              {p.one_liner && <p className="text-ink-2">{p.one_liner}</p>}
              {p.track === 'partner' && (
                <p className="mt-2 rounded-[6px] border-2 border-blue-2 bg-blue-soft p-3 text-sm text-blue">
                  <strong>Startup partner team.</strong> They work with an existing startup. Judge{' '}
                  <strong>this team and the value of their work</strong>, not the partner company. The questions below
                  are reworded for that.
                </p>
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
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={amountText?.id === p.id ? amountText.text : d.amount ? d.amount.toLocaleString('en-US') : ''}
                  onFocus={() => setAmountText({ id: p.id, text: d.amount ? String(d.amount) : '' })}
                  onBlur={() => setAmountText(null)}
                  onChange={(e) => {
                    setAmountText({ id: p.id, text: e.target.value })
                    update(p.id, { amount: Math.min(capital, parseAmount(e.target.value)) })
                  }}
                />
                {remaining > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(p.id, { amount: d.amount + remaining })}>
                    + rest
                  </button>
                )}
                {remaining < 0 && d.amount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => update(p.id, { amount: Math.max(0, d.amount + remaining) })}
                  >
                    Fit total
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
              <p className="field-label">Rubric · 1 weak → 5 excellent · tap ▸ for what to look for</p>
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
            <span className="field-label mb-0">{remaining < 0 ? 'Over' : 'Left'}</span>
            <span className={`num text-2xl sm:text-4xl ${remaining === 0 ? 'text-green' : remaining < 0 ? 'text-red' : ''}`}>
              {money(Math.abs(remaining))}
            </span>
            <span
              className={`mono whitespace-nowrap text-xs ${saveState === 'error' ? 'font-bold text-red' : 'text-ink-3'}`}
              aria-live="polite"
            >
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? '⚠ Not saved' : ''}
            </span>
          </div>
          <button
            className="btn btn-orange sm:min-h-[54px] sm:px-[26px] sm:text-base"
            disabled={!ready || submitting}
            onClick={() => setReviewing(true)}
          >
            Review &amp; submit
          </button>
        </div>
        {error ? (
          <p className="container-page pt-1 text-xs font-semibold text-red sm:pb-3">{error}</p>
        ) : (
          !ready && (
            <p className="container-page flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-ink-2 sm:pb-3">
              {remaining > 0 && <span>Invest {money(remaining)} more.</span>}
              {remaining < 0 && <span className="font-semibold text-red">{money(-remaining)} over. Lower an amount.</span>}
              {todo
                .filter((t) => t.left > 0)
                .map((t) => (
                  <button key={t.p.id} type="button" className="min-h-[32px] underline" onClick={() => jump(t.p.id)}>
                    {t.p.name}: {t.left} left
                  </button>
                ))}
            </p>
          )
        )}
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true">
          <div className="card card-shadow max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="display text-4xl">Lock in your portfolio?</h2>
            <p className="mt-1 text-ink-2">Once submitted, your table can&apos;t change it.</p>
            <table className="table mt-4">
              <tbody>
                {presenters.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="mono text-right">{money(draftOf(p.id).amount)}</td>
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
