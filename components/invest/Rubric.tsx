import { checklist } from '@/lib/format'
import { SCORE_LEVELS, scoreGuide } from '@/lib/rubric'
import type { Pillar, Track } from '@/lib/types'

// Rubric pieces shared by the learn page and the table's phone form.

const BADGE = [
  '',
  'border-red bg-[var(--red-soft)] text-red',
  'border-orange-ink bg-orange-soft text-orange-ink',
  'border-ink-3 bg-paper-2 text-ink-2',
  'border-green bg-[var(--green-soft)] text-green',
  'border-green bg-green text-paper',
]

export function ScoreBadge({ n, small = false }: { n: number; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`mono grid flex-none place-items-center rounded-[6px] border-2 font-bold ${
        small ? 'size-6 text-xs' : 'size-8 text-sm'
      } ${BADGE[n]}`}
    >
      {n}
    </span>
  )
}

const MARKS = {
  listen: { mark: '', box: 'border-ink bg-paper' },
  partner: { mark: '', box: 'border-blue-2 bg-paper' },
  strong: { mark: '✓', box: 'border-green bg-[var(--green-soft)] text-green' },
  red: { mark: '✕', box: 'border-red bg-[var(--red-soft)] text-red' },
}

// Rubric text as a list with a box, tick or cross per item.
export function Checklist({ text, kind }: { text: string; kind: keyof typeof MARKS }) {
  const items = checklist(text)
  if (items.length === 0) return null
  const m = MARKS[kind]
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className={`mt-0.5 grid size-[18px] flex-none place-items-center rounded-[3px] border-2 text-[10px] font-bold leading-none ${m.box}`}
          >
            {m.mark}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// What a 1, 3 and 5 look like for a pillar.
export function ScoreGuide({ pillar, track = 'venture' }: { pillar: Pillar; track?: Track }) {
  return (
    <ol className="space-y-2.5">
      {[1, 3, 5].map((n) => (
        <li key={n} className="flex gap-2.5">
          <ScoreBadge n={n} small />
          <span>
            <span className="mono block text-[0.7rem] font-semibold uppercase tracking-wide">{SCORE_LEVELS[n]}</span>
            {scoreGuide(pillar, n, track)}
          </span>
        </li>
      ))}
    </ol>
  )
}
