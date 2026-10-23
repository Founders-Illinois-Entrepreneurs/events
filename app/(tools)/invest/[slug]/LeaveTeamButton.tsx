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
        if (!confirm('Leave this team? You can join another one.')) return
        start(async () => {
          const res = await leaveTeam(eventId, slug)
          if (res.error) alert(res.error)
        })
      }}
    >
      Switch team
    </button>
  )
}
