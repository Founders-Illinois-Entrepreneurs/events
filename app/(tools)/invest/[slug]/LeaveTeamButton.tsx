'use client'

import { useTransition } from 'react'
import { leaveTeam } from '../actions'

export default function LeaveTeamButton({ eventId, slug }: { eventId: string; slug: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Sign this phone out of the table? You can pick a different table.')) return
        start(async () => {
          const res = await leaveTeam(eventId, slug)
          if (res.error) alert(res.error)
        })
      }}
    >
      Wrong table?
    </button>
  )
}
