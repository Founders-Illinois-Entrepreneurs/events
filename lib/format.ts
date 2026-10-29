export function money(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

export function shortMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

// Rubric text as checklist items: one per line, or one per sentence when written as a paragraph.
export function checklist(text: string) {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  // Sentence ends need two letters/digits before the stop, so "e.g." and "U.S." don't split.
  // (No regex lookbehind: older iPhones can't parse it.)
  const items =
    lines.length > 1 ? lines : text.replace(/([a-z0-9)]{2}[.!?]["”]?)\s+(?=["“A-Z])/gi, '$1\n').split('\n')
  return items
    .map((s) => s.trim().replace(/^[-•*]\s*/, '').replace(/([^.])\.$/, '$1'))
    .filter(Boolean)
}

// Times are rendered on the server (UTC on Vercel), so pin them to the club's time zone.
function zone() {
  const tz = process.env.TIME_ZONE || 'America/Chicago'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'America/Chicago'
  }
}

export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone() })
}

export function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: zone() })
}

// A rubric score with one decimal ("4.0"), or "–" when there is none.
export function score1(n: number | null | undefined) {
  return n == null || Number.isNaN(Number(n)) ? '–' : Number(n).toFixed(1)
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
