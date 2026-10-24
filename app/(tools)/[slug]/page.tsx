import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMember } from '@/lib/auth'
import { query } from '@/lib/db'
import { getEventBySlug, loadMemberView } from '@/lib/invest'
import { money } from '@/lib/format'
import type { TeamCount } from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import AutoRefresh from '@/components/AutoRefresh'
import JoinTeams from './JoinTeams'
import InvestForm from './InvestForm'
import PortfolioSummary from './PortfolioSummary'
import LeaveTeamButton from './LeaveTeamButton'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEventBySlug((await params).slug)
  return { title: event?.name ?? 'Event' }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const me = await getMember()
  const view = await loadMemberView(slug, me?.id ?? null)
  if (!view) notFound()

  const { event, presenters, pillars, team, teammates, allocations, scores, submittedAt } = view
  const canChangeTeam = (event.status === 'setup' || event.status === 'open') && !submittedAt

  let teamCounts: TeamCount[] = []
  if (!team && canChangeTeam) {
    teamCounts = await query<TeamCount>('select * from invest_team_counts($1)', [event.id])
  }

  return (
    <div className="space-y-8">
      {/* Picks up phase changes (e.g. "investing is open"). */}
      {event.status !== 'revealed' && <AutoRefresh seconds={submittedAt ? 10 : event.status === 'open' && team ? 8 : 5} />}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <Image
            src="/brand/founders-rd.png"
            alt="Founders R&D"
            width={741}
            height={1000}
            priority
            className="mt-1 h-12 w-auto sm:h-20"
          />
          <div>
          <p className="eyebrow">Founders R&amp;D · Investment game</p>
          <h1 className="display mt-2 text-4xl sm:text-6xl">{event.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusChip status={event.status} />
            <span className="chip chip-muted">{money(event.starting_capital)} per table</span>
          </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${slug}/learn`} className="btn btn-ghost">
            What investors look for
          </Link>
          {event.status === 'revealed' && (
            <Link href={`/${slug}/results`} className="btn btn-orange">
              See results →
            </Link>
          )}
        </div>
      </header>

      {team ? (
        <section className="card card-muted flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow eyebrow-blue">Your table</p>
            <p className="display mt-1 text-3xl">{team.name}</p>
            <p className="text-sm text-ink-2">{teammates.map((t) => t.name).join(' · ')}</p>
          </div>
          {canChangeTeam && allocations.length === 0 && <LeaveTeamButton eventId={event.id} slug={slug} />}
        </section>
      ) : canChangeTeam ? (
        <JoinTeams teams={teamCounts} slug={slug} knownName={me?.name ?? null} />
      ) : (
        <p className="alert alert-info">
          Tables are locked for this event.
          {event.status === 'revealed' ? ' The results are out.' : ''}
        </p>
      )}

      {team && renderStage()}
    </div>
  )

  function renderStage() {
    if (submittedAt) {
      return (
        <PortfolioSummary
          presenters={presenters}
          pillars={pillars}
          allocations={allocations}
          scores={scores}
          submittedAt={submittedAt}
          revealed={event.status === 'revealed'}
          slug={slug}
        />
      )
    }
    if (event.status === 'setup') {
      return (
        <div className="card card-shadow">
          <h2 className="display text-4xl">Scoring opens when the pitches start</h2>
          <p className="mt-2 text-ink-2">
            Your table will score each R&amp;D team right after its pitch, then split{' '}
            <strong>{money(event.starting_capital)}</strong> across them, every dollar of it, and explain why. While you
            wait, read{' '}
            <Link className="underline" href={`/${slug}/learn`}>
              what investors look for
            </Link>
            . This page updates on its own when scoring opens.
          </p>
          {presenters.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="field-label">Today&apos;s teams</p>
                <ul className="space-y-1">
                  {presenters.map((p) => (
                    <li key={p.id}>
                      <strong>{p.name}</strong>
                      {p.one_liner && <span className="text-ink-2"> · {p.one_liner}</span>}
                      {p.track === 'partner' && <span className="chip chip-blue ml-2">Startup partner</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="field-label">You’ll score each team on these pillars</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-ink-2">
                  {pillars.map((pl) => (
                    <li key={pl.id}>{pl.label}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )
    }
    if (event.status === 'open') {
      return (
        <InvestForm
          event={event}
          team={team!}
          presenters={presenters}
          pillars={pillars}
          initialAllocations={allocations}
          initialScores={scores}
        />
      )
    }
    return (
      <p className="alert alert-warn">
        Investing closed before your table submitted, so your picks won&apos;t count this time.
      </p>
    )
  }
}
