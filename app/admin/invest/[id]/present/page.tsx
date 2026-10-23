import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { one } from '@/lib/db'
import type { Results } from '@/lib/types'
import AutoRefresh from '@/components/AutoRefresh'
import Reveal from './Reveal'

export const metadata = { title: 'Results reveal' }

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const row = await one<{ r: Results; teams: number }>(
    'select invest_results($1::uuid, true) as r, (select count(*) from invest_investor_teams where event_id = $1::uuid) as teams',
    [id],
  ).catch(() => null)
  if (!row) notFound()
  const data = row.r
  const count = row.teams

  return (
    <>
      {data.event.status !== 'revealed' && <AutoRefresh seconds={5} />}
      <Reveal results={data as Results} investorTeams={count ?? 0} backHref={`/admin/invest/${id}`} />
    </>
  )
}
