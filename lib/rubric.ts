import type { Pillar } from '@/lib/types'

// Scoring rules shared by the learn page, the table's phone form and the database
// (invest_results weights pillar scores the same way).

export const SCORE_LEVELS = ['', 'Missing', 'Weak', 'Partial', 'Solid', 'Convincing']
export const SCORE_MEANING = [
  '',
  'Not covered, or plainly wrong',
  'Mentioned, but thin',
  'Covered, with real gaps',
  'Strong, with small gaps',
  'Clear evidence you would bet on',
]

// Older events only have "strong looks like" and red flags; newer ones have a 1/3/5 guide.
export const hasScoreGuide = (p: Pillar) => p.weak_signals.trim() !== '' || p.partial_signals.trim() !== ''

// What a score means for this pillar. 2 and 4 sit between the written anchors.
export function scoreGuide(p: Pillar, n: number) {
  if (n === 1) return p.weak_signals
  if (n === 3) return p.partial_signals
  if (n === 5) return p.strong_signals
  return n === 2 ? 'Has a little of what a 3 needs, not all of it.' : 'Most of what a 5 needs, with small gaps.'
}

export function weightLabel(w: number) {
  if (w === 1) return 'Counts once'
  if (w === 0.5) return 'Counts half'
  return `Counts ${w}×`
}

// A team's rubric score: the weighted average of the pillars scored so far (null if none).
export function weightedScore(pillars: Pillar[], scoreOf: (pillarId: string) => number | undefined) {
  let sum = 0
  let weights = 0
  for (const p of pillars) {
    const v = scoreOf(p.id)
    if (v) {
      sum += v * p.weight
      weights += p.weight
    }
  }
  return weights ? sum / weights : null
}

export const SPLIT_STYLES = [
  { label: 'Even', hint: 'Every scored team gets the same amount.' },
  { label: 'In proportion', hint: 'Money follows your scores. A team at 4 gets 1.5× a team at 3.' },
  { label: 'Back the best', hint: 'Your top teams get much more. A team at 4 gets about twice a team at 3.' },
  { label: 'All-in', hint: 'Most of the money goes to your top one or two teams.' },
]

// Splits the capital in proportion to (score - 1) ^ style, in $1,000 steps that add up
// exactly (whole dollars if the capital isn't a round thousand). Unscored teams get $0.
export function suggestSplit(scores: (number | null)[], capital: number, style: number) {
  const scored = scores.map((s, i) => [s, i] as const).filter((x): x is readonly [number, number] => x[0] != null)
  const out = scores.map(() => 0)
  if (scored.length === 0) return out

  let raw = scored.map(([s]) => (style === 0 ? 1 : Math.pow(s - 1, style)))
  if (raw.every((r) => r === 0)) raw = raw.map(() => 1)
  const total = raw.reduce((a, b) => a + b, 0)

  const unit = capital % 1000 === 0 ? 1000 : 1
  const units = capital / unit
  const exact = raw.map((r) => (r / total) * units)
  const base = exact.map(Math.floor)
  let left = units - base.reduce((a, b) => a + b, 0)
  for (const [, i] of exact.map((x, i) => [x - base[i], i] as const).sort((a, b) => b[0] - a[0])) {
    if (left-- <= 0) break
    base[i]++
  }
  scored.forEach(([, i], j) => (out[i] = base[j] * unit))
  return out
}
