import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventBySlug, getPillars, getPresenters } from '@/lib/invest'

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

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <Link href={`/invest/${slug}`} className="mono text-sm underline">
          ← Back to {event.name}
        </Link>
        <h1 className="display mt-3 text-5xl sm:text-7xl">What investors look for</h1>
        <p className="mt-3 text-lg text-ink-2">
          Early-stage investors aren&apos;t judging slides. They&apos;re judging <strong>evidence</strong> and{' '}
          <strong>honesty</strong>: is there a real problem, a real customer, and a team that learns fast and tells
          the truth about what it doesn&apos;t know yet? Use these pillars to score every team.
        </p>
        {hasPartner && (
          <p className="alert alert-info mt-4">
            <strong>{partnerTeams.map((t) => t.name).join(', ')}</strong>{' '}
            {partnerTeams.length > 1 ? 'work' : 'works'} with an existing startup instead of building their own. Every
            team is scored on the same pillars, but for partner teams each question is about{' '}
            <strong>the value of their work for the partner</strong>. Look for the blue &ldquo;Startup partner&rdquo; boxes
            below.
          </p>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {pillars.map((p, i) => (
          <article key={p.id} className="card card-lift space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="num text-4xl text-orange">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display text-3xl">{p.label}</h2>
            </div>
            <p className="font-semibold">{p.prompt}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[6px] border-2 border-green bg-[var(--green-soft)] p-3 text-sm">
                <p className="field-label text-green">Strong looks like</p>
                {p.strong_signals}
              </div>
              <div className="rounded-[6px] border-2 border-red bg-[var(--red-soft)] p-3 text-sm">
                <p className="field-label text-red">Red flags</p>
                {p.red_flags}
              </div>
            </div>
            {hasPartner && p.partner_prompt.trim() && (
              <div className="rounded-[6px] border-2 border-blue-2 bg-blue-soft p-3 text-sm">
                <p className="field-label text-blue">Startup partner teams</p>
                <p className="font-semibold">{p.partner_prompt}</p>
                <p className="mt-1">
                  <span className="text-green">Strong:</span> {p.partner_strong_signals}
                </p>
                <p className="mt-1">
                  <span className="text-red">Red flags:</span> {p.partner_red_flags}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      <section className="card card-muted max-w-3xl">
        <h2 className="display text-3xl">Giving useful feedback</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          <li>Be specific. Point to a moment in the pitch, not a general feeling.</li>
          <li>Separate the idea from the pitch. A great idea can be pitched badly, and the reverse.</li>
          <li>Reward honesty. A team that names its risks is easier to back than one that hides them.</li>
          <li>Back the team, not your friends. Your reasons are shared with the R&amp;D teams.</li>
        </ul>
      </section>
    </div>
  )
}
