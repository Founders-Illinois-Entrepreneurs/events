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
  const items = lines.length > 1 ? lines : text.split(/(?<=[.!?]["”]?)\s+(?=["“A-Z])/)
  return items
    .map((s) => s.trim().replace(/^[-•*]\s*/, '').replace(/(?<!\.)\.$/, ''))
    .filter(Boolean)
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
