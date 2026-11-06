// Durable PostgreSQL store for the runtime records used by Plan B. There is no
// JSON fallback: a backend instance either has one shared source of truth or
// it does not start.
const fs = require('fs/promises')
const path = require('path')
const { Pool } = require('pg')

let pool
let writes = Promise.resolve()

function getPool() {
  if (pool) return pool
  const connectionString = String(process.env.DATABASE_URL || '').trim()
  if (!connectionString) throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting Plan B.')
  const ssl = process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false
  pool = new Pool({ connectionString, ssl, max: Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 10) })
  return pool
}

async function migrations() {
  const client = await getPool().connect()
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    const directory = path.join(__dirname, '..', 'infra', 'postgres', 'migrations')
    const files = (await fs.readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
    for (const name of files) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
      if (exists.rowCount) continue
      const sql = await fs.readFile(path.join(directory, name), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally { client.release() }
}

async function initDatabase() {
  await getPool().query('SELECT 1')
  await migrations()
}

async function loadCollection(collection) {
  const result = await getPool().query('SELECT document FROM runtime_documents WHERE collection = $1 ORDER BY updated_at, id', [collection])
  return result.rows.map((row) => row.document)
}

// Serialising collection replacements prevents two asynchronous local workers
// (the source monitor and an HTTP request) from overwriting each other's write.
function replaceCollection(collection, rows, idFor) {
  const job = async () => {
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM runtime_documents WHERE collection = $1', [collection])
      for (const row of rows) {
        const id = String(idFor(row) || '')
        if (!id) throw new Error(`Cannot persist ${collection}: missing record id`)
        await client.query('INSERT INTO runtime_documents (collection, id, document) VALUES ($1, $2, $3::jsonb)', [collection, id, JSON.stringify(row)])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally { client.release() }
  }
  writes = writes.catch(() => {}).then(job)
  return writes
}

async function closeDatabase() { if (pool) await pool.end() }

module.exports = { initDatabase, loadCollection, replaceCollection, closeDatabase }
