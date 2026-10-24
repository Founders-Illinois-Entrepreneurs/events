import Image from 'next/image'
import Link from 'next/link'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <Image
        src="/brand/founders-rd.png"
        alt="Founders R&D"
        width={741}
        height={1000}
        className="mx-auto h-28 w-auto"
      />
      <h1 className="display mt-6 text-6xl">Page not found</h1>
      <p className="mt-3 text-ink-2">Check the link, or open the current event.</p>
      <Link href="/" className="btn btn-orange mt-8">
        Go to the current event
      </Link>
    </div>
  )
}
