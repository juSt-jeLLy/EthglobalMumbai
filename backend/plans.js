const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'plans.json')
const OPEN_STATUSES = new Set(['ORDER_STATUS_PENDING', 'ORDER_STATUS_ACCEPTED', 'ORDER_STATUS_PARTIALLY_FILLED'])
const listeners = new Set()

function readPlans() {
  try {
    const rows = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(rows) ? rows : []
  } catch { return [] }
}

let plans = readPlans()

function savePlans() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(plans, null, 2))
  fs.renameSync(temporary, DATA_FILE)
}

function text(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function validOrderId(value) {
  return /^[a-f0-9-]{20,80}$/i.test(text(value, 80))
}

function publicPlan(plan) {
  const { funderAddress, ...safe } = plan
  return { ...safe, funder: funderAddress ? `${funderAddress.slice(0, 6)}…${funderAddress.slice(-4)}` : null }
}

function emit(plan) {
  const payload = `event: plan\ndata: ${JSON.stringify(publicPlan(plan))}\n\n`
  for (const response of listeners) response.write(payload)
}

function createPlanCtrl(req, res) {
  const body = req.body || {}
  if (!validOrderId(body.orderId)) return res.status(400).json({ error: 'InvalidOrder', message: 'A valid Flash orderId is required.' })
  if (!text(body.token, 32) || !text(body.planType, 32) || !text(body.funderAddress, 80)) {
    return res.status(400).json({ error: 'InvalidPlan', message: 'token, planType and funderAddress are required.' })
  }
  const existing = plans.find((plan) => plan.orderId === body.orderId)
  if (existing) return res.json(publicPlan(existing))
  const plan = {
    orderId: text(body.orderId, 80),
    bracketOrderId: null,
    tweetId: text(body.tweetId, 40) || null,
    authorHandle: text(body.authorHandle, 30).replace(/^@/, '') || null,
    funderAddress: text(body.funderAddress, 80),
    token: text(body.token, 32).toUpperCase(),
    chain: text(body.chain, 32),
    planType: text(body.planType, 32),
    stopLoss: Number(body.stopLoss) > 0 ? Number(body.stopLoss) : null,
    takeProfit: Number(body.takeProfit) > 0 ? Number(body.takeProfit) : null,
    state: 'waiting',
    flashStatus: 'ORDER_STATUS_PENDING',
    result: null,
    transactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  plans.push(plan)
  savePlans()
  emit(plan)
  res.status(201).json(publicPlan(plan))
}

function listPlansCtrl(req, res) {
  const funder = text(req.query.funderAddress, 80).toLowerCase()
  if (!funder) return res.status(400).json({ error: 'MissingFunder', message: 'funderAddress is required.' })
  const rows = plans.filter((plan) => plan.funderAddress.toLowerCase() === funder)
  res.json({ plans: rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicPlan) })
}

function socialProofCtrl(req, res) {
  const tweetId = text(req.query.tweetId, 40)
  const author = text(req.query.authorHandle, 30).replace(/^@/, '').toLowerCase()
  if (!tweetId && !author) return res.status(400).json({ error: 'MissingScope', message: 'tweetId or authorHandle is required.' })
  const scoped = plans.filter((plan) => tweetId ? plan.tweetId === tweetId : (plan.authorHandle || '').toLowerCase() === author)
  const wallets = new Set(scoped.map((plan) => plan.funderAddress.toLowerCase()))
  res.json({
    followed: wallets.size,
    hitTarget: scoped.filter((plan) => plan.state === 'hit_target').length,
    stoppedOut: scoped.filter((plan) => plan.state === 'stopped_out').length,
    active: scoped.filter((plan) => ['waiting', 'filled'].includes(plan.state)).length,
  })
}

function leaderboardCtrl(req, res) {
  const authors = new Map()
  for (const plan of plans) {
    if (!plan.authorHandle) continue
    const key = plan.authorHandle.toLowerCase()
    if (!authors.has(key)) authors.set(key, { authorHandle: plan.authorHandle, wallets: new Set(), followedPlans: 0, hitTarget: 0, stoppedOut: 0 })
    const row = authors.get(key)
    row.wallets.add(plan.funderAddress.toLowerCase())
    row.followedPlans++
    if (plan.state === 'hit_target') row.hitTarget++
    if (plan.state === 'stopped_out') row.stoppedOut++
  }
  const leaderboard = [...authors.values()].map((row) => {
    const resolved = row.hitTarget + row.stoppedOut
    return { authorHandle: row.authorHandle, followers: row.wallets.size, followedPlans: row.followedPlans, hitTarget: row.hitTarget, stoppedOut: row.stoppedOut, hitRate: resolved ? row.hitTarget / resolved : null }
  }).sort((a, b) => (b.hitTarget - a.hitTarget) || (b.followers - a.followers)).slice(0, 50)
  res.json({ leaderboard })
}

function planEventsCtrl(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })
  res.flushHeaders()
  res.write('event: ready\ndata: {}\n\n')
  listeners.add(res)
  req.on('close', () => listeners.delete(res))
}

function exitPrice(order) {
  const target = Number(order.filled && order.filled.targetAmount)
  const contra = Number(order.filled && order.filled.contraAmount)
  return target > 0 && contra > 0 ? contra / target : null
}

function outcomeFor(plan, order) {
  const price = exitPrice(order)
  if (!price || !plan.stopLoss || !plan.takeProfit) return 'filled'
  return Math.abs(price - plan.takeProfit) <= Math.abs(price - plan.stopLoss) ? 'hit_target' : 'stopped_out'
}

function applyOrderUpdate(order) {
  if (!order || !order.orderId) return
  let plan = plans.find((row) => row.orderId === order.orderId || row.bracketOrderId === order.orderId)
  if (!plan && order.sourceEntryOrderId) plan = plans.find((row) => row.orderId === order.sourceEntryOrderId)
  if (!plan) return
  if (order.attachedBracket && order.attachedBracket.bracketOrderId) plan.bracketOrderId = order.attachedBracket.bracketOrderId
  if (order.orderType === 'bracket' && order.sourceEntryOrderId === plan.orderId) plan.bracketOrderId = order.orderId
  plan.flashStatus = order.status || plan.flashStatus
  plan.updatedAt = new Date().toISOString()
  if (OPEN_STATUSES.has(order.status)) {
    plan.state = order.orderId === plan.orderId ? 'waiting' : 'filled'
  } else if (order.status === 'ORDER_STATUS_FILLED') {
    plan.state = order.orderId === plan.bracketOrderId || order.orderType === 'bracket' ? outcomeFor(plan, order) : 'filled'
  } else if (order.status === 'ORDER_STATUS_CANCELLED') {
    plan.state = 'cancelled'
  } else if (order.status === 'ORDER_STATUS_REJECTED' || order.status === 'ORDER_STATUS_TERMINATED') {
    plan.state = 'failed'
  }
  if (order.transactionId) plan.transactionId = order.transactionId
  savePlans()
  emit(plan)
}

module.exports = { createPlanCtrl, listPlansCtrl, socialProofCtrl, leaderboardCtrl, planEventsCtrl, applyOrderUpdate }
