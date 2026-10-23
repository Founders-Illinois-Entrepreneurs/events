import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { one } from '@/lib/db'
import type { Results } from '@/lib/types'

function cell(v: unknown) {
  const s = v == null ? '' : String(v)
  // Quote everything; neutralize spreadsheet formulas.
  const safe = /^[\s]*[=+\-@]/.test(s) || /^[\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params
  const row = await one<{ r: Results }>('select invest_results($1::uuid, true) as r', [id]).catch(() => null)
  if (!row) return new NextResponse('Not found', { status: 404 })
  const r = row.r

  const header = ['rd_team', 'track', 'rank', 'team_total', 'rubric_score', 'investor', 'amount', 'why', 'invest_more_if', 'starred', 'auto_submitted', ...r.pillars.map((p) => `avg_${p.key}`)]
  const rows = r.teams.flatMap((t) =>
    t.feedback.map((f) => [
      t.name,
      t.track,
      t.rank,
      t.total,
      t.avg_score ?? '',
      f.investor ?? '',
      f.amount,
      f.rationale,
      f.invest_more_if,
      f.starred ? 'yes' : '',
      f.auto ? 'yes' : '',
      ...r.pillars.map((p) => t.pillar_avgs[p.key] ?? ''),
    ]),
  )
  const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n')
  const name = r.event.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  // BOM so Excel reads accented names correctly.
  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-feedback.csv"`,
    },
  })
}
