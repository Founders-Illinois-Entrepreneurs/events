import { redirect } from 'next/navigation'
import { adminConfigured, isAdmin } from '@/lib/auth'
import { signInAdmin } from '../actions'

export const metadata = { title: 'Organizer sign-in' }

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect('/admin')
  const { error } = await searchParams

  return (
    <div className="mx-auto max-w-md pt-10">
      <form action={signInAdmin} className="card card-shadow space-y-4">
        <p className="eyebrow">Organizers</p>
        <h1 className="display text-5xl">Sign in</h1>
        {!adminConfigured() ? (
          <p className="alert alert-warn">
            No organizer password is set. Add <span className="mono">ADMIN_PASSWORD</span> to your environment
            variables (see the README).
          </p>
        ) : (
          <>
            {error && <p className="alert alert-error">Wrong password.</p>}
            <div>
              <label className="field-label" htmlFor="pw">
                Organizer password
              </label>
              <input id="pw" name="password" type="password" className="input" autoFocus required />
            </div>
            <button className="btn btn-orange w-full">Sign in</button>
          </>
        )}
      </form>
    </div>
  )
}
