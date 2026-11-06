const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { verifyMessage } = require('ethers')
const { validateDraft } = require('./parser.js')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'signals.json')

function readSignals() {
  try {
    const value = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

let signals = readSignals()

function saveSignals() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(signals, null, 2))
  fs.renameSync(temporary, DATA_FILE)
}

function canonicalMessage(result) {
  const plan = result.draft
  return [
    'Plan B — Verified Caller Plan',
    `Token: ${plan.token}`,
    `Chain: ${plan.chain}`,
    `Side: ${plan.side}`,
    `Strategy: ${result.strategy.strategyType}`,
    `Entry: ${plan.entryType}${plan.entryPrice ? ` @ ${plan.entryPrice}` : ''}`,
    `Trigger: ${plan.triggerPrice ? `${plan.triggerDirection} @ ${plan.triggerPrice}` : 'none'}`,
    `Exit: ${plan.exitType || 'none'}`,
    `Stop: ${plan.stopLoss || 'none'}`,
    `Target: ${plan.takeProfit || 'none'}`,
    `Trail Percent: ${plan.trailPercent || 'none'}`,
    `Duration Hours: ${plan.durationHours || 'none'}`,
    `Expiry Hours: ${plan.expiryHours || 'none'}`,
  ].join('\n')
}

async function prepareSignalCtrl(req, res) {
  try {
    const result = await validateDraft({ confidence: 1, missing: [], ambiguous: [], ...(req.body || {}) })
    res.json({ ...result, message: canonicalMessage(result) })
  } catch (error) {
    res.status(Number(error.status) || 422).json({ error: 'InvalidPlan', message: error.message })
  }
}

async function createSignalCtrl(req, res) {
  try {
    const result = await validateDraft({ confidence: 1, missing: [], ambiguous: [], ...((req.body && req.body.plan) || {}) })
    const message = canonicalMessage(result)
    const signer = String(req.body && req.body.signer || '').toLowerCase()
    const signature = String(req.body && req.body.signature || '')
    if (!/^0x[a-f0-9]{40}$/i.test(signer) || !/^0x[a-f0-9]+$/i.test(signature)) {
      return res.status(400).json({ error: 'InvalidSignature', message: 'An EVM signer and signature are required.' })
    }
    const recovered = verifyMessage(message, signature).toLowerCase()
    if (recovered !== signer) return res.status(401).json({ error: 'InvalidSignature', message: 'The caller signature does not match the wallet.' })
    const id = crypto.randomUUID()
    const signal = {
      id,
      ...result,
      signer,
      signature,
      verified: true,
      version: 1,
      createdAt: new Date().toISOString(),
    }
    signals.push(signal)
    saveSignals()
    const action = result.draft.side === 'buy' ? 'Buy' : 'Sell'
    const entry = result.draft.entryType === 'market'
      ? 'at market'
      : result.draft.entryType === 'twap'
        ? `over ${result.draft.durationHours}h${result.draft.entryPrice ? ` below ${result.draft.entryPrice}` : ''}`
        : result.draft.entryType === 'stop'
          ? `when price crosses ${result.draft.triggerDirection} ${result.draft.triggerPrice}`
          : `${result.draft.entryType} at ${result.draft.entryPrice || result.draft.triggerPrice || 'market'}`
    const protection = result.draft.stopLoss && result.draft.takeProfit ? ` · stop ${result.draft.stopLoss} · target ${result.draft.takeProfit}` : result.draft.trailPercent ? ` · trail ${result.draft.trailPercent}%` : ''
    res.status(201).json({ signal, tweetText: `${action} $${result.draft.token} on ${result.draft.chain} ${entry}${protection}\n\nFollow this ${result.strategy.summary} strategy on Plan B · planb:${id}` })
  } catch (error) {
    res.status(Number(error.status) || 422).json({ error: 'InvalidPlan', message: error.message })
  }
}

function getSignal(id) {
  return signals.find((signal) => signal.id === id) || null
}

function listSignals() {
  return signals.filter((signal) => signal && signal.verified)
}

function getSignalCtrl(req, res) {
  const signal = getSignal(String(req.params.id || ''))
  if (!signal) return res.status(404).json({ error: 'NotFound', message: 'Caller plan not found.' })
  res.json({ signal })
}

module.exports = { prepareSignalCtrl, createSignalCtrl, getSignalCtrl, getSignal, listSignals }
