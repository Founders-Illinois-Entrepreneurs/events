import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { one, pool, query } from '@/lib/db'
import type { Member } from '@/lib/types'

// Two simple kinds of access, no accounts:
//   * Members: type a name when joining; the browser keeps a random token.
//   * Organizers: one shared ADMIN_PASSWORD.

const MEMBER_COOKIE = 'ft_member'
const ADMIN_COOKIE = 'ft_admin'
const MONTH = 60 * 60 * 24 * 30

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
})

// ---- Members ---------------------------------------------------------------

export async function getMember(): Promise<Member | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value
  if (!token) return null
  return one<Member>('select id, name from members where token_hash = $1', [sha256(token)])
}

// Signs this phone in for a table. A new phone's record is created in the same
// transaction as the join, so failed joins (full/taken table, bad id) leave nothing behind.
// Only call from Server Actions, where cookies can be set.
export async function joinTableAs(names: string, teamId: string): Promise<Member> {
  const clean = names.trim().replace(/\s+/g, ' ').slice(0, 120)
  const existing = await getMember()
  if (existing) {
    await query('select invest_join_team($1, $2)', [existing.id, teamId])
    if (clean && clean !== existing.name) {
      await query('update members set name = $2 where id = $1', [existing.id, clean])
      return { ...existing, name: clean }
    }
    return existing
  }
  if (!clean) throw new Error('Please enter the names of everyone at your table.')
  const token = randomBytes(32).toString('base64url')
  const id = randomBytes(12).toString('hex')
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('insert into members (id, name, token_hash) values ($1, $2, $3)', [id, clean, sha256(token)])
    await client.query('select invest_join_team($1, $2)', [id, teamId])
    await client.query('commit')
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
  ;(await cookies()).set(MEMBER_COOKIE, token, cookieOptions(MONTH))
  return { id, name: clean }
}

// ---- Organizers ------------------------------------------------------------

function adminToken() {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return sha256(`founders-tools-admin:${pw}`)
}

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function adminConfigured() {
  return !!process.env.ADMIN_PASSWORD
}

export async function isAdmin() {
  const expected = adminToken()
  const got = (await cookies()).get(ADMIN_COOKIE)?.value
  return !!expected && !!got && same(got, expected)
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login')
}

// Returns true when the password is right (and sets the organizer cookie).
export async function adminSignIn(password: string) {
  const expected = adminToken()
  if (!expected || !same(sha256(`founders-tools-admin:${password}`), expected)) return false
  ;(await cookies()).set(ADMIN_COOKIE, expected, cookieOptions(60 * 60 * 24 * 7))
  return true
}

export async function adminSignOut() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}
