import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import type { ClubEvent } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import ErrorBanner from '@/components/ErrorBanner'
import { money } from '@/lib/format'
import { createEvent } from './actions'

export const metadata = { title: 'Admin' }

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin()
  const { error } = await searchParams
  const all = await query<ClubEvent>('select * from events order by created_at desc')
  const active = all.filter((e) => !e.archived)
  const archived = all.filter((e) => e.archived)

  return (
    <div className="space-y-12">
      <header>
        <p className="eyebrow">Admin</p>
        <h1 className="display mt-2 text-6xl">Run an event</h1>
      </header>
      <ErrorBanner error={error} />

      <section className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <h2 className="display text-4xl">Events</h2>
          {active.length === 0 && <p className="text-ink-2">No active events. Create one →</p>}
          {active.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
          {archived.length > 0 && (
            <details className="pt-4">
              <summary className="cursor-pointer font-semibold">Archive ({archived.length})</summary>
              <div className="mt-3 space-y-3">
                {archived.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </div>
            </details>
          )}
        </div>

        <form action={createEvent} className="card card-shadow h-fit space-y-4">
          <h2 className="display text-3xl">New investment game</h2>
          <div>
            <label className="field-label" htmlFor="name">Name</label>
            <input id="name" name="name" className="input" placeholder="R&D Midpoint Evaluation · Fall 2026" required />
          </div>
          <div>
            <label className="field-label" htmlFor="slug">URL slug (optional)</label>
            <input id="slug" name="slug" className="input mono" placeholder="rd-midpoint-fa26" />
          </div>
          <div>
            <label className="field-label" htmlFor="cap">Capital per investor team ($)</label>
            <input id="cap" name="starting_capital" className="input mono" defaultValue="200000" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label" htmlFor="clone">Start from</label>
            <select id="clone" name="clone_from" className="input">
              <option value="">Fresh (default rubric)</option>
              {all.map((e) => (
                <option key={e.id} value={e.id}>
                  Copy setup from: {e.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-3">Copying brings over the rubric, team names and capital. Not members or investments.</p>
          </div>
          <button className="btn btn-orange w-full">Create event</button>
        </form>
      </section>

      <section className="card card-muted max-w-2xl space-y-2">
        <h2 className="display text-3xl">Organizer access</h2>
        <p className="text-sm text-ink-2">
          Anyone with the organizer password can run events. To change it, update{' '}
          <span className="mono">ADMIN_PASSWORD</span> in Vercel (and <span className="mono">.env.local</span>) and
          redeploy. Everyone gets signed out.
        </p>
      </section>
    </div>
  )
}

function EventRow({ e }: { e: ClubEvent }) {
  return (
    <Link href={`/admin/invest/${e.id}`} className="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="display text-3xl">{e.name}</h3>
        <p className="mono text-xs text-ink-3">
          /invest/{e.slug} · {money(e.starting_capital)} · {new Date(e.created_at).toLocaleDateString()}
        </p>
      </div>
      <StatusChip status={e.status} />
    </Link>
  )
}
