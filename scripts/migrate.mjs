// Applies db/migrations/*.sql to DATABASE_URL, in order, once each.
//
//   npm run db:migrate          apply new migrations
//   npm run db:migrate -- --seed   ...and load db/seed.sql (demo data, dev only)

import pg from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Put it in .env.local (see .env.example).')
  process.exit(1)
}

const root = new URL('..', import.meta.url).pathname
const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`)
  const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name))
  const files = readdirSync(join(root, 'db/migrations')).filter((f) => f.endsWith('.sql')).sort()

  let applied = 0
  for (const f of files) {
    if (done.has(f)) continue
    console.log(`Applying ${f}…`)
    await client.query('begin')
    try {
      await client.query(readFileSync(join(root, 'db/migrations', f), 'utf8'))
      await client.query('insert into schema_migrations (name) values ($1)', [f])
      await client.query('commit')
      applied++
    } catch (e) {
      await client.query('rollback')
      throw e
    }
  }
  console.log(applied ? `Applied ${applied} migration(s).` : 'Database is up to date.')

  if (process.argv.includes('--seed')) {
    await client.query(readFileSync(join(root, 'db/seed.sql'), 'utf8'))
    console.log('Loaded demo seed data.')
  }
} catch (e) {
  console.error(`Migration failed: ${e.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
