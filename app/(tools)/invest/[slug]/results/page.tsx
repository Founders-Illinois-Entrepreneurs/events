import Link from 'next/link'
import { notFound } from 'next/navigation'
import { one } from '@/lib/db'
import { getEventBySlug } from '@/lib/invest'
import type { Results } from '@/lib/types'
import ResultsView, { FeedbackList } from '@/components/invest/ResultsView'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEventBySlug((await params).slug)
  return { title: event ? `Results · ${event.name}` : 'Results' }
}

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const row = await one<{ r: Results }>('select invest_results($1) as r', [event.id]).catch(() => null)
  const data = row?.r
  const error = !data

  return (
    <div className="space-y-8">
      <header>
        <Link href={`/invest/${slug}`} className="mono text-sm underline">
          ← Back to {event.name}
        </Link>
        <h1 className="display mt-3 text-5xl sm:text-7xl">Results</h1>
      </header>
      {error || !data ? (
        <p className="alert alert-info">Results aren&apos;t out yet. They&apos;ll appear here after the reveal.</p>
      ) : (
        <>
          <ResultsView results={data as Results} />
          <section className="space-y-6">
            <h2 className="display text-4xl">What investors said</h2>
            {(data as Results).teams.map((t) => (
              <div key={t.id}>
                <h3 className="display text-3xl">{t.name}</h3>
                <div className="mt-2">
                  <FeedbackList team={t} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
