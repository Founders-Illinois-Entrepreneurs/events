import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventBySlug, getPillars, getPresenters } from '@/lib/invest'
import { money } from '@/lib/format'
import { hasScoreGuide, SCORE_LEVELS, SCORE_MEANING, weightLabel, hasPartnerGuide } from '@/lib/rubric'
import type { Pillar } from '@/lib/types'
import { Checklist, ScoreBadge, ScoreGuide } from '@/components/invest/Rubric'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEventBySlug((await params).slug)
  return { title: event ? `What investors look for · ${event.name}` : 'What investors look for' }
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()
  const [pillars, presenters] = await Promise.all([getPillars(event.id), getPresenters(event.id)])
  const partnerTeams = presenters.filter((p) => p.track === 'partner')
  const hasPartner = partnerTeams.length > 0 && pillars.some((p) => p.partner_prompt.trim())
  const partnerNames = partnerTeams.map((t) => t.name).join(', ')
  const guided = pillars.some(hasScoreGuide)
  const weighted = pillars.some((p) => p.weight !== 1)

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <Link href={`/invest/${slug}`} className="mono text-sm underline">
          ← Back to {event.name}
        </Link>
        <h1 className="display mt-3 text-5xl sm:text-7xl">What investors look for</h1>
        <p className="mt-3 text-lg text-ink-2">
          Your table splits <strong>{money(event.starting_capital)}</strong> across the R&amp;D teams. Use this rubric
          while each team pitches: listen for the questions under each pillar, score it 1 to 5, and let your scores
          guide how much each team earns.
        </p>
        {hasPartner && (
          <p className="alert alert-info mt-4">
            <strong>{partnerNames}</strong> {partnerTeams.length > 1 ? 'work' : 'works'} with an existing startup
            instead of building their own. Every team is scored on the same pillars, but each pillar has a separate{' '}
            <strong>Startup partner</strong> section about the value of their work for the partner.
          </p>
        )}
      </header>

      {guided && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Listen', 'Each pillar lists what to listen for. Tick items off in your head as the team pitches.'],
              ['Score', 'Give every pillar 1 to 5 using its score guide. Some pillars count more than others.'],
              ['Invest', `Your scores suggest how to split the ${money(event.starting_capital)}. Adjust it, then explain each amount.`],
            ].map(([title, text], i) => (
              <div key={title} className="card card-muted space-y-1">
                <span className="num text-4xl text-orange-ink">{i + 1}</span>
                <h2 className="display text-3xl">{title}</h2>
                <p className="text-sm text-ink-2">{text}</p>
              </div>
            ))}
          </div>

          <section className="card space-y-4">
            <p className="field-label mb-0">The 1–5 scale</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((n) => (
                <li key={n} className="flex items-center gap-3">
                  <ScoreBadge n={n} />
                  <span className="text-sm leading-snug">
                    <strong className="block">{SCORE_LEVELS[n]}</strong>
                    <span className="text-ink-2">{SCORE_MEANING[n]}</span>
                  </span>
                </li>
              ))}
            </ul>
            {weighted && (
              <p className="text-sm text-ink-2">
                <strong>Weights:</strong>{' '}
                {pillars
                  .filter((p) => p.weight !== 1)
                  .map((p) => `${p.label} ${weightLabel(p.weight).toLowerCase()}`)
                  .join('. ')}
                . Every other pillar counts once. At the midpoint, what a team has learned from real customers matters
                most, and pricing can still be rough.
              </p>
            )}
          </section>
        </>
      )}

      <div className={guided || hasPartner ? 'space-y-5' : 'grid gap-5 md:grid-cols-2'}>
        {pillars.map((p, i) => (
          <Fragment key={p.id}>
            {p.key === 'solution' && pillars[i + 1]?.key === 'product' && <SolutionVsProduct />}
            <PillarCard pillar={p} index={i} weighted={weighted} partnerNames={hasPartner ? partnerNames : null} />
          </Fragment>
        ))}
      </div>

      <section className="card card-muted max-w-3xl">
        <h2 className="display text-3xl">Giving useful feedback</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          <li>Be specific. Point to a moment in the pitch, not a general feeling.</li>
          <li>Name the one thing that would make you invest more. That is the team&apos;s homework before the final pitch.</li>
          <li>Reward honesty. A team that names its risks is easier to back than one that hides them.</li>
          <li>Back the team, not your friends. Your reasons are shared with the R&amp;D teams.</li>
        </ul>
      </section>
    </div>
  )
}

function PillarCard({
  pillar: p,
  index,
  weighted,
  partnerNames,
}: {
  pillar: Pillar
  index: number
  weighted: boolean
  partnerNames: string | null
}) {
  const guided = hasScoreGuide(p)
  return (
    <article className="card space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-4xl text-orange">{String(index + 1).padStart(2, '0')}</span>
        <h2 className="display text-3xl">{p.label}</h2>
        {weighted && (
          <span className={`chip ml-auto self-center ${p.weight > 1 ? 'chip-orange' : p.weight < 1 ? 'chip-muted' : ''}`}>
            {weightLabel(p.weight)}
          </span>
        )}
      </div>
      <p className="max-w-3xl text-lg font-semibold">{p.prompt}</p>
      {p.note && <p className="alert alert-warn max-w-3xl text-sm">{p.note}</p>}

      {guided ? (
        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="field-label">Listen for</p>
            <Checklist text={p.listen_for} kind="listen" />
          </div>
          <div className="space-y-4 rounded-[6px] border-2 border-line bg-paper-2 p-4 text-sm">
            <div>
              <p className="field-label">Score guide</p>
              <ScoreGuide pillar={p} />
            </div>
            {p.red_flags.trim() && (
              <div>
                <p className="field-label text-red">Red flags</p>
                <Checklist text={p.red_flags} kind="red" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="field-label text-green">Strong looks like</p>
            <Checklist text={p.strong_signals} kind="strong" />
          </div>
          <div>
            <p className="field-label text-red">Red flags</p>
            <Checklist text={p.red_flags} kind="red" />
          </div>
        </div>
      )}

      {partnerNames &&
        (p.partner_prompt.trim() ? (
          <section className="overflow-hidden rounded-[6px] border-2 border-blue-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-blue-2 bg-blue-soft px-4 py-2 text-sm text-blue">
              <span className="chip chip-blue">Startup partner</span>
              <span>For {partnerNames}, ask this instead</span>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p className="text-base font-semibold">{p.partner_prompt}</p>
              {p.partner_listen_for.trim() ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Checklist text={p.partner_listen_for} kind="partner" />
                  {hasPartnerGuide(p) && <ScoreGuide pillar={p} track="partner" />}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Checklist text={p.partner_strong_signals || p.strong_signals} kind="strong" />
                  <Checklist text={p.partner_red_flags || p.red_flags} kind="red" />
                </div>
              )}
            </div>
          </section>
        ) : (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] border-2 border-line bg-paper-2 px-4 py-2 text-sm text-ink-2">
            <span className="chip">All teams</span>
            <span>Same questions for {partnerNames}.</span>
          </p>
        ))}
    </article>
  )
}

function SolutionVsProduct() {
  return (
    <section className="card space-y-4 bg-orange-soft">
      <p className="eyebrow">Before you score the next two</p>
      <h2 className="display text-4xl">Solution and product are different things</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Solution', 'What the world needs to fix the problem, whoever builds it. It describes the job, not the app.', '“We need a ___ that does ___, ___ and ___.”'],
          ['Product', 'What this team is building: their version of the solution, its key traits, and why it beats the alternatives.', '“So we’re building ___. Unlike ___, it ___.”'],
        ].map(([title, text, fill]) => (
          <div key={title} className="space-y-2 rounded-[6px] border-2 border-ink bg-paper p-4">
            <h3 className="display text-2xl">{title}</h3>
            <p>{text}</p>
            <p className="mono border-l-4 border-orange bg-paper-2 px-3 py-2 text-sm">{fill}</p>
          </div>
        ))}
      </div>
      <p>A strong pitch states the solution first, then shows why their product is the best way to deliver it. Score them separately.</p>
    </section>
  )
}
