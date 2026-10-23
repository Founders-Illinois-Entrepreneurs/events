import Image from 'next/image'
import Link from 'next/link'
import { getMember, isAdmin } from '@/lib/auth'
import { signOutAdmin } from '@/app/admin/actions'

// Same header on every page. Event pages carry the event-specific titles.
export default async function Navbar() {
  const [member, admin] = await Promise.all([getMember(), isAdmin()])

  return (
    <header className="border-b-2 border-ink bg-paper no-print">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center no-underline" aria-label="Home">
          <Image
            src="/brand/founders-logo.png"
            alt="Founders · Illinois Entrepreneurs"
            width={535}
            height={141}
            priority
            className="h-[30px] w-auto sm:h-[38px]"
          />
        </Link>

        <nav className="flex items-center gap-3">
          {member && <span className="hidden text-sm text-ink-2 sm:inline">Hi, {member.name}</span>}
          {admin && (
            <>
              <Link href="/admin" className="btn btn-ghost btn-sm">
                Organizer
              </Link>
              <form action={signOutAdmin}>
                <button className="btn btn-primary btn-sm" type="submit">
                  Sign out
                </button>
              </form>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
