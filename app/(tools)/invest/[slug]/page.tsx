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
      {/* Picks up phase changes (e.g. "investing is open") and teammates joining. */}
      {event.status !== 'revealed' && <AutoRefresh seconds={event.status === 'open' && team && !submittedAt ? 8 : 4} />}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <Image
            src="/brand/founders-rd.png"
            alt="Founders R&D"
            width={741}
            height={1000}
            priority
            className="mt-1 h-16 w-auto sm:h-20"
          />
          <div>
          <p className="eyebrow">Founders R&amp;D · Investment game</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">{event.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusChip status={event.status} />
            <span className="chip chip-muted">{money(event.starting_capital)} per team</span>
          </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/invest/${slug}/learn`} className="btn btn-ghost">
            What investors look for
          </Link>
          {event.status === 'revealed' && (
            <Link href={`/invest/${slug}/results`} className="btn btn-orange">
              See results →
            </Link>
          )}
        </div>
      </header>

      {team ? (
        <section className="card card-muted flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow eyebrow-blue">Your investor team</p>
            <p className="display mt-1 text-3xl">{team.name}</p>
            <p className="text-sm text-ink-2">{teammates.map((t) => t.name).join(' · ')}</p>
          </div>
          {canChangeTeam && <LeaveTeamButton eventId={event.id} slug={slug} />}
        </section>
      ) : canChangeTeam ? (
        <JoinTeams teams={teamCounts} slug={slug} knownName={me?.name ?? null} />
      ) : (
        <p className="alert alert-info">
          Teams are locked for this event.
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
          <h2 className="display text-4xl">Investing opens after the pitches</h2>
          <p className="mt-2 text-ink-2">
            Watch each R&amp;D team pitch. Your team will split <strong>{money(event.starting_capital)}</strong>{' '}
            across them, every dollar of it, and explain why. While you wait, read{' '}
            <Link className="underline" href={`/invest/${slug}/learn`}>
              what investors look for
            </Link>
            . This page updates on its own when investing opens.
          </p>
        </div>
      )
    }
    if (event.status === 'open') {
      return (
        <InvestForm
          event={event}
          team={team!}
          me={me!.id}
          teammates={teammates}
          presenters={presenters}
          pillars={pillars}
          initialAllocations={allocations}
          initialScores={scores}
        />
      )
    }
    return (
      <p className="alert alert-warn">
        Investing closed before your team submitted, so your picks won&apos;t count this time.
      </p>
    )
  }
}
