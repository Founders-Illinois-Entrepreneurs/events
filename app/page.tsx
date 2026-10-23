import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEvents } from '@/lib/invest'

// The front page is the current event. With nothing running, a short note.
export default async function Home() {
  const [current] = await getCurrentEvents()
  if (current) redirect(`/invest/${current.slug}`)

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <Image
        src="/brand/founders-rd.png"
        alt="Founders R&D"
        width={741}
        height={1000}
        priority
        className="mx-auto h-28 w-auto"
      />
      <h1 className="display mt-6 text-6xl">No event right now</h1>
      <p className="mt-3 text-ink-2">Check back at the next Founders meeting.</p>
      <Link href="/admin" className="mt-8 inline-block text-sm text-ink-3 underline">
        Organizer sign-in
      </Link>
    </div>
  )
}
