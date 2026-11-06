const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { verifyMessage } = require('ethers')
const { validateDraft } = require('./parser.js')
const { searchAssets } = require('./flash.js')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'signals.json')

function readSignals() {
  try {
    const value = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

let signals = readSignals()
let sourceMonitorRunning = false
let sourceMonitorTimer = null

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

function canonicalRevisionMessage(signal, result, reason, revision) {
  return [
    'Plan B — Caller Plan Revision',
    `Plan: ${signal.id}`,
    `Revision: ${revision}`,
    `Reason: ${reason || 'No reason supplied'}`,
    canonicalMessage(result),
  ].join('\n')
}

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function price(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function passportFor(result, context = {}) {
  const createdAt = new Date().toISOString()
  const expiryHours = price(result.draft.expiryHours) || 24
  const text = clean(context.text, 4000)
  return {
    version: 1,
    capturedAt: createdAt,
    textHash: text ? crypto.createHash('sha256').update(text).digest('hex') : null,
    tweetId: clean(context.tweetId, 40) || null,
    authorHandle: clean(context.authorHandle, 30).replace(/^@/, '').toLowerCase() || null,
    sourceUrl: clean(context.tweetId, 40) && clean(context.authorHandle, 30) ? `https://x.com/${clean(context.authorHandle, 30).replace(/^@/, '')}/status/${clean(context.tweetId, 40)}` : null,
    asset: { symbol: result.asset.symbol, chain: result.asset.chain, address: result.asset.address },
    integrity: result.integrity || { status: 'unknown', action: 'review', message: 'Contract integrity was not recorded.' },
    entryPrice: price(result.asset.price),
    terms: {
      side: result.draft.side,
      entryType: result.draft.entryType,
      entryPrice: price(result.draft.entryPrice),
      stopLoss: price(result.draft.stopLoss),
      takeProfit: price(result.draft.takeProfit),
      expiresAt: new Date(Date.now() + expiryHours * 3600000).toISOString(),
    },
    availability: { status: clean(context.tweetId, 40) ? 'not_checked' : 'unattached', checks: [] },
    sourceVerification: { status: clean(context.tweetId, 40) ? 'browser_observed' : 'unattached', checks: [] },
    settlement: null,
  }
}

function fingerprint(passport) {
  return passport.tweetId || `${passport.textHash || crypto.randomUUID()}:${passport.asset.chain}:${passport.asset.address}`
}

async function settlePassport(signal) {
  const passport = signal.passport
  if (!passport) return null
  let currentPrice = price(signal.asset && signal.asset.price)
  const expiresAt = Date.parse(passport.terms && passport.terms.expiresAt)
  // Settlement is the only time a Passport needs a fresh mark. Avoid making
  // every Radar read depend on upstream discovery while the signal is active.
  if (!passport.settlement && Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
    try {
      const found = await searchAssets({ query: passport.asset.address, chain: passport.asset.chain, limit: 10 })
      const asset = (found.assets || []).find((item) => String(item.address).toLowerCase() === String(passport.asset.address).toLowerCase())
      currentPrice = price(asset && asset.price) || currentPrice
    } catch { /* A previously captured price is still useful evidence. */ }
  }
  if (!passport.settlement && Number.isFinite(expiresAt) && Date.now() >= expiresAt && currentPrice && passport.entryPrice) {
    const move = (currentPrice - passport.entryPrice) / passport.entryPrice
    const inFavor = passport.terms.side === 'sell' ? move < 0 : move > 0
    passport.settlement = {
      settledAt: new Date().toISOString(),
      method: 'flash_mark_at_expiry_check',
      markPrice: currentPrice,
      returnPercent: move * (passport.terms.side === 'sell' ? -100 : 100),
      outcome: inFavor ? 'price_in_favor' : 'price_against',
    }
    saveSignals()
  }
  return { ...passport, currentPrice }
}

async function checkAvailability(signal) {
  const passport = signal && signal.passport
  if (!passport || !passport.sourceUrl) return passport && passport.availability
  try {
    const response = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(passport.sourceUrl)}`, { signal: AbortSignal.timeout(8000) })
    const status = response.ok ? 'available' : response.status === 404 ? 'not_public' : 'unavailable'
    const checks = [...(passport.availability.checks || []), { status, checkedAt: new Date().toISOString() }].slice(-6)
    const consecutiveMissing = checks.slice(-2).length === 2 && checks.slice(-2).every((check) => check.status === 'not_public')
    passport.availability = { status: consecutiveMissing ? 'removed' : status, checks }
    if (response.ok) {
      const embed = await response.json().catch(() => ({}))
      const authorUrl = String(embed.author_url || '').toLowerCase()
      const text = String(embed.html || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
      const expected = `planb:${signal.id}`.toLowerCase()
      const authorMatches = authorUrl.includes(`/${String(passport.authorHandle || '').toLowerCase()}`)
      const referenceMatches = text.toLowerCase().includes(expected)
      const verification = authorMatches && referenceMatches ? 'public_verified' : 'public_available_unverified'
      passport.sourceVerification = {
        status: verification,
        checks: [...(passport.sourceVerification && passport.sourceVerification.checks || []), { status: verification, checkedAt: new Date().toISOString() }].slice(-6),
      }
    }
    saveSignals()
  } catch {
    passport.availability = { ...(passport.availability || {}), status: 'unavailable', checks: passport.availability && passport.availability.checks || [] }
    saveSignals()
  }
  return passport.availability
}

function lastSourceCheckAt(signal) {
  const checks = signal && signal.passport && signal.passport.availability && signal.passport.availability.checks
  const last = Array.isArray(checks) && checks.at(-1)
  const timestamp = last && Date.parse(last.checkedAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

// Checks only attested Caller Cards with public URLs. This is deliberately a
// small, bounded worker: public source availability is evidence, never a
// prerequisite for placing a signed Flash order.
async function sweepSourceAvailability({ limit = 6, minAgeMs = 15 * 60 * 1000 } = {}) {
  if (sourceMonitorRunning) return { skipped: true, checked: 0 }
  sourceMonitorRunning = true
  try {
    const cutoff = Date.now() - Math.max(60 * 1000, Number(minAgeMs) || 0)
    const candidates = signals
      .filter((signal) => signal && signal.verified && signal.passport && signal.passport.sourceUrl)
      .filter((signal) => lastSourceCheckAt(signal) <= cutoff)
      .sort((a, b) => lastSourceCheckAt(a) - lastSourceCheckAt(b))
      .slice(0, Math.min(20, Math.max(1, Number(limit) || 6)))
    await Promise.allSettled(candidates.map(checkAvailability))
    return { skipped: false, checked: candidates.length }
  } finally {
    sourceMonitorRunning = false
  }
}

function startSourceMonitor() {
  if (sourceMonitorTimer) return sourceMonitorTimer
  const configured = Number(process.env.SOURCE_MONITOR_INTERVAL_MS)
  const intervalMs = Number.isFinite(configured) ? Math.max(60 * 1000, configured) : 15 * 60 * 1000
  const run = () => { void sweepSourceAvailability({ minAgeMs: intervalMs }).catch(() => {}) }
  const initial = setTimeout(run, 3000)
  if (typeof initial.unref === 'function') initial.unref()
  sourceMonitorTimer = setInterval(run, intervalMs)
  return sourceMonitorTimer
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
    signal.passport = passportFor(result, { authorHandle: req.body && req.body.authorHandle, tweetId: req.body && req.body.tweetId, text: req.body && req.body.text })
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

// Captures a parsed social signal before any follower trades it. This makes
// caller history evidence-based rather than dependent on whether somebody
// happened to copy the strategy.
async function captureSignalCtrl(req, res) {
  try {
    const context = req.body && req.body.context || {}
    const result = await validateDraft({ confidence: 1, missing: [], ambiguous: [], ...((req.body && req.body.plan) || {}) }, { sourceText: context.text })
    const passport = passportFor(result, context)
    const key = fingerprint(passport)
    const existing = signals.find((signal) => signal.passport && fingerprint(signal.passport) === key)
    if (existing) return res.json({ signal: existing, passport: await settlePassport(existing) })
    const signal = {
      id: crypto.randomUUID(),
      ...result,
      signer: null,
      signature: null,
      verified: false,
      version: 1,
      createdAt: new Date().toISOString(),
      passport,
    }
    signals.push(signal)
    saveSignals()
    res.status(201).json({ signal, passport })
  } catch (error) {
    res.status(Number(error.status) || 422).json({ error: 'InvalidSignal', message: error.message })
  }
}

// A Caller Card is signed before it is posted. The extension attaches the
// public X source afterwards, without changing the signed strategy itself.
async function attachSourceCtrl(req, res) {
  const signal = getSignal(String(req.params.id || ''))
  if (!signal) return res.status(404).json({ error: 'NotFound', message: 'Signal not found.' })
  if (!signal.verified || !signal.passport) return res.status(409).json({ error: 'NotVerified', message: 'Only a signed Caller Card can be linked to a public post.' })
  const context = req.body && req.body.context || {}
  const tweetId = clean(context.tweetId, 40)
  const authorHandle = clean(context.authorHandle, 30).replace(/^@/, '').toLowerCase()
  const sourceText = clean(context.text, 4000)
  if (!tweetId || !authorHandle) return res.status(400).json({ error: 'InvalidSource', message: 'tweetId and authorHandle are required.' })
  if (signal.passport.tweetId && signal.passport.tweetId !== tweetId) return res.status(409).json({ error: 'SourceAlreadyAttached', message: 'This Caller Card is already linked to a different post.' })
  if (!sourceText.toLowerCase().includes(`planb:${signal.id}`.toLowerCase())) return res.status(422).json({ error: 'MissingPlanReference', message: 'The observed post does not contain this Caller Card reference.' })
  signal.passport.tweetId = tweetId
  signal.passport.authorHandle = authorHandle
  signal.passport.sourceUrl = `https://x.com/${authorHandle}/status/${tweetId}`
  signal.passport.textHash = sourceText ? crypto.createHash('sha256').update(sourceText).digest('hex') : signal.passport.textHash
  signal.passport.availability = { status: 'not_checked', checks: [] }
  signal.passport.sourceVerification = { status: 'browser_observed', checks: [{ status: 'browser_observed', checkedAt: new Date().toISOString() }] }
  saveSignals()
  // Public confirmation is best-effort and never blocks use of a signed plan.
  // The resulting status tells viewers whether the public source was verified.
  await checkAvailability(signal)
  res.json({ signalId: signal.id, passport: signal.passport })
}

async function prepareRevisionCtrl(req, res) {
  try {
    const signal = getSignal(String(req.params.id || ''))
    if (!signal || !signal.verified) return res.status(404).json({ error: 'NotFound', message: 'Signed Caller Card not found.' })
    const result = await validateDraft({ confidence: 1, missing: [], ambiguous: [], ...((req.body && req.body.plan) || {}) })
    const reason = clean(req.body && req.body.reason, 240)
    const revision = (signal.revisions || []).length + 1
    res.json({ ...result, revision, message: canonicalRevisionMessage(signal, result, reason, revision) })
  } catch (error) { res.status(Number(error.status) || 422).json({ error: 'InvalidRevision', message: error.message }) }
}

async function createRevisionCtrl(req, res) {
  try {
    const signal = getSignal(String(req.params.id || ''))
    if (!signal || !signal.verified) return res.status(404).json({ error: 'NotFound', message: 'Signed Caller Card not found.' })
    const result = await validateDraft({ confidence: 1, missing: [], ambiguous: [], ...((req.body && req.body.plan) || {}) })
    const reason = clean(req.body && req.body.reason, 240)
    const revision = (signal.revisions || []).length + 1
    const message = canonicalRevisionMessage(signal, result, reason, revision)
    const signature = String(req.body && req.body.signature || '')
    if (!/^0x[a-f0-9]+$/i.test(signature) || verifyMessage(message, signature).toLowerCase() !== signal.signer) return res.status(401).json({ error: 'InvalidSignature', message: 'Only the original Caller Card signer can publish a revision.' })
    const record = { revision, createdAt: new Date().toISOString(), reason: reason || null, draft: result.draft, strategy: result.strategy, recommendation: result.recommendation, signature }
    signal.revisions = [...(signal.revisions || []), record]
    saveSignals()
    res.status(201).json({ signalId: signal.id, revision: record })
  } catch (error) { res.status(Number(error.status) || 422).json({ error: 'InvalidRevision', message: error.message }) }
}

async function passportCtrl(req, res) {
  const signal = getSignal(String(req.params.id || ''))
  if (!signal) return res.status(404).json({ error: 'NotFound', message: 'Signal not found.' })
  if (req.query.refresh === 'availability' || req.query.refresh === 'source') await checkAvailability(signal)
  res.json({ signalId: signal.id, verified: signal.verified, passport: await settlePassport(signal) })
}

async function creatorProfileCtrl(req, res) {
  const requested = clean(req.params.creator, 80).toLowerCase()
  const rows = signals.filter((signal) => String(signal.signer || '').toLowerCase() === requested || String(signal.passport && signal.passport.authorHandle || '').toLowerCase() === requested)
  // Only signed Caller Cards earn reputation. Parsed public posts are retained
  // as observed context, never treated as proof that an X account authored it.
  const verifiedRows = rows.filter((signal) => signal.verified)
  const passports = await Promise.all(verifiedRows.map(settlePassport))
  const settled = passports.filter((passport) => passport && passport.settlement)
  const wins = settled.filter((passport) => passport.settlement.outcome === 'price_in_favor').length
  const deleted = passports.filter((passport) => passport && passport.availability && passport.availability.status === 'removed').length
  const returns = settled.map((passport) => passport.settlement.returnPercent).filter(Number.isFinite)
  const by = (key) => Object.entries(verifiedRows.reduce((all, signal) => { const value = String(key === 'chain' ? signal.asset && signal.asset.chain : signal.draft && signal.draft.entryType || 'unknown'); all[value] = (all[value] || 0) + 1; return all }, {})).map(([value, count]) => ({ value, count }))
  res.json({
    creator: requested,
    verifiedIdentity: verifiedRows.some((signal) => String(signal.signer || '').toLowerCase() === requested),
    signals: verifiedRows.length,
    observedSignals: rows.filter((signal) => !signal.verified).length,
    scored: settled.length,
    hitRate: settled.length ? wins / settled.length : null,
    medianReturnPercent: median(returns),
    reliability: settled.length >= 5 ? 'established' : settled.length ? 'emerging' : 'unscored',
    minimumScoredSignals: 5,
    breakdown: { orderTypes: by('orderType'), chains: by('chain') },
    deletedSignals: deleted,
    records: passports.filter(Boolean).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, 30),
  })
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

function listObservedSignals() { return signals.filter((signal) => signal && !signal.verified) }

module.exports = { prepareSignalCtrl, createSignalCtrl, captureSignalCtrl, attachSourceCtrl, prepareRevisionCtrl, createRevisionCtrl, passportCtrl, creatorProfileCtrl, getSignalCtrl, getSignal, listSignals, listObservedSignals, settlePassport, checkAvailability, sweepSourceAvailability, startSourceMonitor, canonicalRevisionMessage }
