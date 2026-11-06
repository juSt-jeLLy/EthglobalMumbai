const fs = require('fs')
const path = require('path')
const { searchAssets } = require('./flash.js')
const { getSignal, listSignals, settlePassport } = require('./signals.js')
const { signalRoom } = require('./plans.js')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json')
const SWARM_WINDOW_MS = 45 * 60 * 1000
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

function readSubscriptions() {
  try {
    const rows = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(rows) ? rows : []
  } catch { return [] }
}

let subscriptions = readSubscriptions()

function saveSubscriptions() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(subscriptions, null, 2))
  fs.renameSync(temporary, DATA_FILE)
}

function text(value, max = 140) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function validWallet(value) {
  const wallet = text(value, 80)
  return /^0x[a-f0-9]{40}$/i.test(wallet) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)
}

function price(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function signalExpiry(signal) {
  const specifiedHours = price(signal && signal.draft && signal.draft.expiryHours)
  const created = new Date(signal.createdAt).getTime()
  return created + (specifiedHours ? specifiedHours * 3600000 : STALE_AFTER_MS)
}

function signalDecay(signal, currentPrice, now = Date.now()) {
  const draft = signal.draft || {}
  const created = new Date(signal.createdAt).getTime()
  if (!Number.isFinite(created)) return { state: 'unknown', label: 'Unknown timing', reason: 'Plan creation time is unavailable.' }
  if (now >= signalExpiry(signal)) return { state: 'expired', label: 'Expired', reason: 'The strategy has passed its stated validity window.' }
  const ageMinutes = Math.floor((now - created) / 60000)
  const entry = price(draft.entryPrice) || price(draft.triggerPrice)
  if (!entry || !currentPrice) {
    return ageMinutes <= 60
      ? { state: 'fresh', label: 'Fresh', reason: 'No fixed entry price was shared; review the current quote before signing.' }
      : { state: 'aging', label: 'Aging', reason: 'No fixed entry price was shared and the signal is over an hour old.' }
  }
  const drift = (currentPrice - entry) / entry
  const side = draft.side || 'buy'
  if (side === 'buy' && drift > 0.03) return { state: 'chasing', label: 'Chasing', drift, reason: `Price is ${(drift * 100).toFixed(1)}% above the shared entry.` }
  if (side === 'sell' && drift < -0.03) return { state: 'chasing', label: 'Chasing', drift, reason: `Price is ${(Math.abs(drift) * 100).toFixed(1)}% below the shared entry.` }
  if (Math.abs(drift) <= 0.015) return { state: 'near_entry', label: 'Near entry', drift, reason: 'Price remains within 1.5% of the shared entry.' }
  if (draft.entryType === 'limit' || draft.entryType === 'stop') return { state: 'waiting', label: 'Waiting for trigger', drift, reason: 'The strategy is still waiting for its declared price condition.' }
  return { state: 'fresh', label: 'Fresh', drift, reason: 'The current price remains within the strategy’s allowed context.' }
}

function signalSummary(signal, currentPrice = null, now = Date.now()) {
  const asset = signal.asset || {}
  return {
    id: signal.id,
    signer: signal.signer,
    verified: !!signal.verified,
    createdAt: signal.createdAt,
    version: signal.version || 1,
    asset: { symbol: asset.symbol, name: asset.name || asset.symbol, chain: asset.chain, address: asset.address, price: currentPrice || price(asset.price) },
    draft: signal.draft,
    strategy: signal.strategy,
    decay: signalDecay(signal, currentPrice || price(asset.price), now),
    room: signalRoom(signal.id),
  }
}

async function freshSignalSummary(signal) {
  let currentPrice = price(signal.asset && signal.asset.price)
  try {
    const result = await searchAssets({ query: signal.asset.address || signal.asset.symbol, chain: signal.asset.chain, limit: 10 })
    const matched = (result.assets || []).find((asset) => String(asset.address).toLowerCase() === String(signal.asset.address).toLowerCase()) || result.assets && result.assets[0]
    currentPrice = price(matched && matched.price) || currentPrice
  } catch { /* Existing signed asset data still gives a usable decay estimate. */ }
  const summary = signalSummary(signal, currentPrice)
  summary.passport = await settlePassport(signal)
  summary.recommendation = signal.recommendation || null
  return summary
}

function signalSwarms(rows, now = Date.now()) {
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.asset.chain}:${row.asset.symbol}:${row.draft.side}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }
  return [...grouped.values()].flatMap((signals) => {
    const recent = signals.filter((signal) => now - new Date(signal.createdAt).getTime() <= SWARM_WINDOW_MS)
    const callers = new Set(recent.map((signal) => signal.signer.toLowerCase()))
    if (callers.size < 2) return []
    const first = recent[0]
    return [{
      id: `${first.asset.chain}:${first.asset.symbol}:${first.draft.side}`,
      token: first.asset.symbol,
      chain: first.asset.chain,
      side: first.draft.side,
      callerCount: callers.size,
      signalIds: recent.map((signal) => signal.id),
      headline: `${callers.size} verified callers converge on ${first.asset.symbol}`,
      recommendedOrder: recent.some((signal) => signal.strategy && signal.strategy.entry && signal.strategy.entry.orderType === 'twap') ? 'twap' : 'limit',
    }]
  })
}

function subscribeCtrl(req, res) {
  const funderAddress = text(req.body && req.body.funderAddress, 80)
  const signal = getSignal(text(req.body && req.body.signalId, 80))
  if (!validWallet(funderAddress) || !signal) return res.status(400).json({ error: 'InvalidSubscription', message: 'A wallet and verified strategy ID are required.' })
  const enabled = req.body && req.body.enabled !== false
  const key = `${funderAddress.toLowerCase()}:${signal.signer.toLowerCase()}`
  subscriptions = subscriptions.filter((row) => `${row.funderAddress.toLowerCase()}:${row.creatorSigner.toLowerCase()}` !== key)
  if (enabled) subscriptions.push({ funderAddress, creatorSigner: signal.signer, signalId: signal.id, createdAt: new Date().toISOString() })
  saveSubscriptions()
  res.json({ subscribed: enabled, creatorSigner: signal.signer, signalId: signal.id })
}

async function radarCtrl(req, res) {
  const funderAddress = text(req.query.funderAddress, 80)
  if (!validWallet(funderAddress)) return res.status(400).json({ error: 'InvalidWallet', message: 'A connected wallet is required.' })
  const followed = subscriptions.filter((row) => row.funderAddress.toLowerCase() === funderAddress.toLowerCase()).map((row) => row.creatorSigner.toLowerCase())
  const allSignals = listSignals().filter((signal) => followed.includes(signal.signer.toLowerCase()))
  const signals = await Promise.all(allSignals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30).map(freshSignalSummary))
  const allRecent = await Promise.all(listSignals().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50).map(freshSignalSummary))
  res.json({ signals, swarms: signalSwarms(allRecent), followedCreators: [...new Set(followed)].length })
}

// Public, read-only terminal for signed Caller Cards. It deliberately excludes
// unsigned observations so a caller's public track record cannot be gamed.
async function terminalCtrl(req, res) {
  const entryType = text(req.query.entryType, 40).toLowerCase()
  const freshness = text(req.query.freshness, 40).toLowerCase()
  const sort = text(req.query.sort, 40).toLowerCase() || 'newest'
  let rows = await Promise.all(listSignals()
    .filter((signal) => signal.verified)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 80)
    .map(freshSignalSummary))
  if (entryType) rows = rows.filter((row) => String(row.draft && row.draft.entryType || '').toLowerCase() === entryType)
  if (freshness) rows = rows.filter((row) => String(row.decay && row.decay.state || '').toLowerCase() === freshness)
  if (sort === 'followed') rows.sort((a, b) => Number(b.room && b.room.followers || 0) - Number(a.room && a.room.followers || 0))
  if (sort === 'fresh') rows.sort((a, b) => (a.decay.state === 'fresh' ? -1 : 0) - (b.decay.state === 'fresh' ? -1 : 0))
  res.json({ signals: rows.slice(0, 50), swarms: signalSwarms(rows), note: 'Only wallet-signed Caller Cards appear in Radar. Followers always choose their own size and sign from their own wallet.' })
}

async function roomCtrl(req, res) {
  const signal = getSignal(text(req.params.id, 80))
  if (!signal) return res.status(404).json({ error: 'NotFound', message: 'Verified strategy not found.' })
  res.json({ signal: await freshSignalSummary(signal) })
}

module.exports = { subscribeCtrl, radarCtrl, terminalCtrl, roomCtrl, signalDecay, signalSwarms, _test: { signalDecay } }
