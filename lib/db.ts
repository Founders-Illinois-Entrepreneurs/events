import { Pool, types } from 'pg'

// Return counts (int8) and averages (numeric) as JS numbers.
types.setTypeParser(20, (v) => Number(v))
types.setTypeParser(1700, (v) => Number(v))

// One shared connection pool per server process. On Vercel, use Neon's
// *pooled* connection string (the host contains "-pooler").
const g = globalThis as unknown as { __pool?: Pool }
export const pool = g.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
if (process.env.NODE_ENV !== 'production') g.__pool = pool

// Run a query and get plain rows back (dates become ISO strings, so rows can be
// passed straight to client components).
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows.map((row) => {
    for (const k in row) if (row[k] instanceof Date) row[k] = row[k].toISOString()
    return row
  }) as T[]
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null
}

// Postgres error text (from `raise exception`) is written for people, so show it as-is.
export function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/duplicate key/.test(msg)) return 'That name or slug is already taken.'
  if (/events_slug_check/.test(msg)) return 'Slugs can only use lowercase letters, numbers and dashes.'
  if (/invalid input syntax for type uuid/.test(msg)) return 'Not found.'
  return msg
}
