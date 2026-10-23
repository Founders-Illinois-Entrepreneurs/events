'use client'

import { useState, useTransition } from 'react'
import { joinTeam } from '../actions'
import type { TeamCount } from '@/lib/types'

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
  const [name, setName] = useState(knownName ?? '')

  if (teams.length === 0) {
    return <p className="alert alert-info">The organizers haven&apos;t set up the investor tables yet. Hang tight.</p>
  }

  const nameOk = name.trim().length > 0

  return (
    <section className="space-y-5">
      <div className="card card-shadow max-w-xl space-y-3">
        <h2 className="display text-4xl">Join the game</h2>
        <div>
          <label className="field-label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            placeholder="First name and last initial"
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-3">Your teammates and the organizers will see this.</p>
        </div>
      </div>

      <div>
        <h3 className="display text-3xl">Pick your investor table</h3>
        <p className="text-ink-2">Join the table you&apos;re sitting with. You&apos;ll share one portfolio.</p>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {teams.map((t) => {
          const full = t.member_count >= t.max_members
          const locked = full || t.submitted
          return (
            <button
              key={t.id}
              disabled={pending || locked || !nameOk}
              title={!nameOk ? 'Enter your name first' : undefined}
              onClick={() =>
                start(async () => {
                  setError(undefined)
                  const res = await joinTeam(t.id, slug, name)
                  if (res.error) setError(res.error)
                })
              }
              className="card card-lift flex flex-col items-start gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="display text-3xl">{t.name}</span>
              <span className="mono text-sm text-ink-2">
                {t.member_count}/{t.max_members} people
                {t.submitted ? ' · submitted' : full ? ' · full' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
