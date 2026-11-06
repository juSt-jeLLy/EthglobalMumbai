// One-time import utility for existing local demo data. The running backend
// never reads these JSON files; this command is explicit and idempotent.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs/promises')
const path = require('path')
const { initDatabase, replaceCollection, closeDatabase } = require('../database.js')

async function read(name) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'data', name), 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function main() {
  await initDatabase()
  const [plans, signals, subscriptions, world] = await Promise.all([
    read('plans.json'), read('signals.json'), read('subscriptions.json'), read('world-human.json'),
  ])
  await replaceCollection('plans', plans, (row) => row.orderId)
  await replaceCollection('signals', signals, (row) => row.id)
  await replaceCollection('subscriptions', subscriptions, (row) => `${row.funderAddress.toLowerCase()}:${row.creatorSigner.toLowerCase()}`)
  await replaceCollection('world_human', world, (row) => `${row.action}:${row.signer}`)
  console.log(`Imported ${plans.length} plans, ${signals.length} signals, ${subscriptions.length} subscriptions, and ${world.length} World records.`)
}

main().finally(() => closeDatabase()).catch((error) => { console.error(error.message); process.exitCode = 1 })
