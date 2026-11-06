// World ID protects Caller Card reputation from Sybil-created caller farms.
// A World proof establishes one unique human for one Plan B caller wallet; the
// wallet signature still binds each individual strategy to that wallet.
require('dotenv').config({ path: __dirname + '/.env' })
const fs = require('fs')
const path = require('path')
const { verifyMessage } = require('ethers')
const { signRequest } = require('@worldcoin/idkit-core/signing')
const { hashSignal } = require('@worldcoin/idkit-core/hashing')

const DATA_FILE = path.join(__dirname, 'data', 'world-human.json')
const VERIFY_URL = 'https://developer.world.org/api/v4/verify'
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function action() { return process.env.WORLD_ACTION || 'planb-verified-caller-v1' }
function environment() { return process.env.WORLD_ENVIRONMENT || 'staging' }
function configured() {
  return Boolean(process.env.WORLD_APP_ID && process.env.WORLD_RP_ID && process.env.WORLD_RP_SIGNING_KEY)
}
function required() { return process.env.WORLD_REQUIRE_CALLER_VERIFICATION === 'true' }
function normalWallet(value) { return String(value || '').trim().toLowerCase() }
function validWallet(value) { return ADDRESS_RE.test(normalWallet(value)) }
function signalFor(signer) { return `planb-caller:${normalWallet(signer)}` }
function enrollmentMessage(signer, nonce) {
  return [
    'Plan B — World ID Caller Enrollment',
    `Wallet: ${normalWallet(signer)}`,
    `Action: ${action()}`,
    `World nonce: ${String(nonce || '')}`,
  ].join('\n')
}

function readRegistry() {
  try {
    const value = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

let registry = readRegistry()

function saveRegistry() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(registry, null, 2))
  fs.renameSync(temporary, DATA_FILE)
}

function publicRecord(record) {
  if (!record) return null
  return { status: 'world_verified', action: record.action, environment: record.environment, verifiedAt: record.verifiedAt }
}

function humanVerificationFor(signer) {
  const wallet = normalWallet(signer)
  return publicRecord(registry.find((record) => record.signer === wallet && record.action === action()))
}

function missingConfiguration(res) {
  return res.status(503).json({
    error: 'WorldNotConfigured',
    message: 'World ID is not configured. Add WORLD_APP_ID, WORLD_RP_ID and WORLD_RP_SIGNING_KEY to the backend environment.',
  })
}

function statusCtrl(req, res) {
  const signer = normalWallet(req.query.signer)
  res.json({
    configured: configured(),
    required: required(),
    action: action(),
    environment: environment(),
    humanVerification: validWallet(signer) ? humanVerificationFor(signer) : null,
  })
}

function rpContextCtrl(req, res) {
  const signer = normalWallet(req.body && req.body.signer)
  if (!validWallet(signer)) return res.status(400).json({ error: 'InvalidWallet', message: 'Connect a valid EVM wallet before verifying humanity.' })
  if (!configured()) return missingConfiguration(res)
  try {
    const signed = signRequest({ signingKeyHex: process.env.WORLD_RP_SIGNING_KEY, action: action() })
    res.json({
      app_id: process.env.WORLD_APP_ID,
      action: action(),
      environment: environment(),
      signal: signalFor(signer),
      rp_context: {
        rp_id: process.env.WORLD_RP_ID,
        nonce: signed.nonce,
        created_at: signed.createdAt,
        expires_at: signed.expiresAt,
        signature: signed.sig,
      },
    })
  } catch (error) {
    console.error('[world] RP signature failed:', error.message)
    res.status(500).json({ error: 'WorldSetupFailed', message: 'Could not prepare the World ID request.' })
  }
}

async function verifyCtrl(req, res) {
  const signer = normalWallet(req.body && req.body.signer)
  const result = req.body && req.body.result
  const walletSignature = String(req.body && req.body.walletSignature || '')
  if (!validWallet(signer) || !result || !Array.isArray(result.responses) || result.responses.length === 0) {
    return res.status(400).json({ error: 'InvalidProof', message: 'A wallet and complete World ID result are required.' })
  }
  if (!configured()) return missingConfiguration(res)
  if (result.action !== action() || result.environment !== environment()) {
    return res.status(400).json({ error: 'ProofContextMismatch', message: 'The World proof was created for a different action or environment.' })
  }
  if (!/^0x[a-f0-9]+$/i.test(walletSignature)) return res.status(400).json({ error: 'MissingWalletSignature', message: 'Sign the World ID enrollment with the connected caller wallet.' })
  try {
    if (verifyMessage(enrollmentMessage(signer, result.nonce), walletSignature).toLowerCase() !== signer) {
      return res.status(401).json({ error: 'InvalidWalletSignature', message: 'The World enrollment signature does not match the connected wallet.' })
    }
  } catch {
    return res.status(401).json({ error: 'InvalidWalletSignature', message: 'The World enrollment signature is invalid.' })
  }

  let expectedSignal
  try { expectedSignal = String(hashSignal(signalFor(signer))).toLowerCase() } catch {
    return res.status(500).json({ error: 'SignalHashFailed', message: 'Could not validate the World proof binding.' })
  }
  const proofResponses = result.responses.filter((response) => response && ['proof_of_human', 'orb'].includes(String(response.identifier || '').toLowerCase()))
  if (!proofResponses.length || proofResponses.some((response) => String(response.signal_hash || '').toLowerCase() !== expectedSignal)) {
    return res.status(400).json({ error: 'ProofBindingMismatch', message: 'This World proof is not bound to the connected caller wallet.' })
  }

  let verified
  try {
    const response = await fetch(`${VERIFY_URL}/${encodeURIComponent(process.env.WORLD_RP_ID)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(environment() === 'staging' && process.env.WORLD_STAGING_TOKEN ? { 'x-staging-verification-token': process.env.WORLD_STAGING_TOKEN } : {}),
      },
      // World asks that the completed IDKit result is forwarded unmodified.
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(20000),
    })
    verified = await response.json().catch(() => ({}))
    if (!response.ok || verified.success !== true) {
      return res.status(400).json({ error: verified.code || 'WorldVerificationFailed', message: verified.detail || verified.message || 'World ID could not verify this proof.' })
    }
  } catch (error) {
    console.error('[world] verification request failed:', error.message)
    return res.status(502).json({ error: 'WorldUnavailable', message: 'World ID verification is temporarily unavailable. Try again.' })
  }
  if (verified.environment !== environment()) return res.status(400).json({ error: 'ProofEnvironmentMismatch', message: 'World returned a proof for the wrong environment.' })

  const accepted = (verified.results || []).find((item) => item && item.success && item.nullifier)
  if (!accepted) return res.status(400).json({ error: 'WorldVerificationFailed', message: 'World did not return a usable Proof of Human nullifier.' })
  let nullifier
  try { nullifier = BigInt(accepted.nullifier).toString() } catch {
    return res.status(400).json({ error: 'InvalidNullifier', message: 'World returned an invalid uniqueness proof.' })
  }

  const existingForHuman = registry.find((record) => record.action === action() && record.nullifier === nullifier)
  if (existingForHuman && existingForHuman.signer !== signer) {
    return res.status(409).json({ error: 'HumanAlreadyLinked', message: 'This World ID is already linked to another Plan B caller wallet.' })
  }
  const existingForWallet = registry.find((record) => record.action === action() && record.signer === signer)
  if (existingForWallet && existingForWallet.nullifier !== nullifier) {
    return res.status(409).json({ error: 'WalletAlreadyLinked', message: 'This wallet is already linked to another World ID.' })
  }
  const record = { signer, nullifier, action: action(), environment: environment(), verifiedAt: new Date().toISOString() }
  registry = registry.filter((item) => !(item.action === action() && item.signer === signer))
  registry.push(record)
  saveRegistry()
  res.status(201).json({ humanVerification: publicRecord(record) })
}

module.exports = { statusCtrl, rpContextCtrl, verifyCtrl, humanVerificationFor, worldVerificationRequired: required, enrollmentMessage }
