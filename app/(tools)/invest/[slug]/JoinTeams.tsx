'use client'

import { useState, useTransition } from 'react'
import { joinTeam } from '../actions'
import type { TeamCount } from '@/lib/types'

// One phone per table: whoever opens the link first for the table signs in
// for everyone sitting there.
export default function JoinTeams({
  teams,
  slug,
  knownName,
}: {
  teams: TeamCount[]
  slug: string
  knownName: string | null
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  const [names, setNames] = useState(knownName ?? '')

  if (teams.length === 0) {
    return <p className="alert alert-info">The organizers haven&apos;t set up the investor tables yet. Hang tight.</p>
  }

  const namesOk = names.trim().length > 0

  return (
    <section className="space-y-5">
      {knownName && (
        <p className="alert alert-warn max-w-xl">
          This phone isn&apos;t signed in for a table right now. If an organizer freed your table, another phone may be
          using it. Pick your table again, or check with an organizer.
        </p>
      )}
      <div className="card card-shadow max-w-xl space-y-3">
        <h2 className="display text-4xl">Sign in your table</h2>
        <p className="text-ink-2">
          <strong>Use one phone per table.</strong> Pick one person to hold it; the whole table decides together.
        </p>
        <div>
          <label className="field-label" htmlFor="name">
            Who&apos;s at your table?
          </label>
          <input
            id="name"
            className="input"
            placeholder="e.g. Priya S., Jordan K., Sam L."
            maxLength={120}
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-3">Everyone&apos;s name, separated by commas. Organizers will see this.</p>
        </div>
      </div>

      <div>
        <h3 className="display text-3xl">Which table are you at?</h3>
        {!namesOk && <p className="mt-1 text-sm font-semibold text-orange-ink">↑ Type your names first to unlock the tables.</p>}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {teams.map((t) => {
          const locked = t.taken || t.submitted
          return (
            <button
              key={t.id}
              disabled={pending || locked || !namesOk}
              onClick={() =>
                start(async () => {
                  setError(undefined)
                  const res = await joinTeam(t.id, slug, names)
                  if (res.error) setError(res.error)
                })
              }
              className="card card-lift flex flex-col items-start gap-1 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 sm:p-[22px]"
            >
              <span className="display text-2xl sm:text-3xl">{t.name}</span>
              <span className="mono text-sm text-ink-2">
                {t.submitted ? 'Submitted' : t.taken ? 'Already signed in' : 'Free'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-ink-3">
        Table already signed in on another phone? Use that phone, or ask an organizer to free the table.
      </p>
    </section>
  )
}
