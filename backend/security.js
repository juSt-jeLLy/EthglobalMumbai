require('dotenv').config({ path: __dirname + '/.env' })
const { flashRequest, getCachedFlashAsset, rememberAssets } = require('./flash.js')

const CACHE_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 20000
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const CHAIN_ID = /^\d{1,10}$/
const FLASH_CHAINS = {
  1: 'ethereum', 10: 'optimism', 56: 'bsc', 137: 'polygon', 143: 'monad', 999: 'hyperevm',
  4663: 'robinhood', 5042: 'arc', 8453: 'base', 9745: 'plasma', 42161: 'arbitrum',
  43114: 'avalanche', 57073: 'ink', solana: 'solana',
}
const HONEYPOT_CHAINS = new Set(['1', '56', '8453'])
const cache = new Map()

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function truthy(value) {
  return value === '1' || value === 1 || value === true
}

function statusOne(value) {
  return truthy(value && typeof value === 'object' ? value.status : value)
}

function numeric(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`)
  return body
}

async function flashAssessment(chain, address) {
  const cached = getCachedFlashAsset(FLASH_CHAINS[chain], address)
  if (cached && cached.discoverySource !== 'dexscreener') return cached
  const response = await flashRequest('GET', '/search', { query: address, chain: FLASH_CHAINS[chain], limit: 25 })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Flash returned ${response.status}`)
  rememberAssets(body)
  const asset = (body.assets || []).find((candidate) =>
    String(candidate.address || '').toLowerCase() === address.toLowerCase() && candidate.chain === FLASH_CHAINS[chain]
  )
  if (!asset) throw new Error('Flash could not independently match this contract')
  return asset
}

async function goPlusAssessment(chain, address) {
  const path = chain === 'solana'
    ? 'https://api.gopluslabs.io/api/v1/solana/token_security'
    : `https://api.gopluslabs.io/api/v1/token_security/${chain}`
  const headers = { Accept: 'application/json' }
  if (process.env.GOPLUS_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.GOPLUS_ACCESS_TOKEN}`
  const body = await jsonRequest(`${path}?contract_addresses=${encodeURIComponent(address)}`, { headers })
  if (body.code !== 1 && body.code !== 2) throw new Error(body.message || `GoPlus returned code ${body.code}`)
  const result = body.result || {}
  const row = result[address] || result[address.toLowerCase()] || Object.values(result)[0]
  if (!row) throw new Error('GoPlus did not return token data')
  return row
}

async function honeypotAssessment(chain, address) {
  return jsonRequest(`https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=${chain}`)
}

function evaluateEvm(row, blocked, warnings) {
  if (truthy(row.is_honeypot)) blocked.push('GoPlus identified this token as a honeypot')
  if (truthy(row.malicious_address)) blocked.push('The token contract is associated with malicious activity')
  if (truthy(row.cannot_sell_all)) blocked.push('The token prevents holders from selling their full balance')
  if (truthy(row.owner_change_balance)) blocked.push('The owner can change holder balances')
  if (truthy(row.selfdestruct)) blocked.push('The token contract can self-destruct')
  if (row.fake_token && truthy(row.fake_token.value)) blocked.push('This appears to be a counterfeit token')

  const buyTax = numeric(row.buy_tax)
  const sellTax = numeric(row.sell_tax)
  if (buyTax !== null && buyTax >= 0.5) blocked.push(`Extreme buy tax detected (${Math.round(buyTax * 100)}%)`)
  else if (buyTax !== null && buyTax >= 0.1) warnings.push(`High buy tax detected (${Math.round(buyTax * 100)}%)`)
  if (sellTax !== null && sellTax >= 0.5) blocked.push(`Extreme sell tax detected (${Math.round(sellTax * 100)}%)`)
  else if (sellTax !== null && sellTax >= 0.1) warnings.push(`High sell tax detected (${Math.round(sellTax * 100)}%)`)

  const established = truthy(row.trust_list) || truthy(row.is_in_cex && row.is_in_cex.listed)
  if (!established) {
    if (row.is_open_source === '0') warnings.push('The token contract is not verified/open source')
    if (truthy(row.is_proxy)) warnings.push('The contract is upgradeable through a proxy')
    if (truthy(row.is_mintable)) warnings.push('The owner can mint additional supply')
    if (truthy(row.hidden_owner)) warnings.push('The contract contains a hidden owner')
    if (truthy(row.is_blacklisted)) warnings.push('The owner can blacklist wallets')
    if (truthy(row.transfer_pausable)) warnings.push('The owner can pause token transfers')
    if (truthy(row.external_call)) warnings.push('The token can call external contracts')
    const ownerPercent = numeric(row.owner_percent)
    const creatorPercent = numeric(row.creator_percent)
    if (ownerPercent !== null && ownerPercent >= 0.3) warnings.push(`Owner controls ${Math.round(ownerPercent * 100)}% of supply`)
    if (creatorPercent !== null && creatorPercent >= 0.3) warnings.push(`Creator controls ${Math.round(creatorPercent * 100)}% of supply`)
  }
}

function containsMaliciousAuthority(value) {
  if (!value || typeof value !== 'object') return false
  if (truthy(value.malicious_address)) return true
  return Object.values(value).some(containsMaliciousAuthority)
}

function evaluateSolana(row, blocked, warnings) {
  if (containsMaliciousAuthority(row)) blocked.push('A token authority is associated with malicious activity')
  if (truthy(row.non_transferable)) blocked.push('This token is non-transferable')
  if (statusOne(row.balance_mutable_authority)) blocked.push('An authority can modify holder balances')
  if (truthy(row.trusted_token)) return
  if (statusOne(row.closable)) warnings.push('An authority can close token accounts')
  if (statusOne(row.mintable)) warnings.push('The mint authority can create additional supply')
  if (statusOne(row.freezable)) warnings.push('The freeze authority can freeze token accounts')
  if (statusOne(row.transfer_fee_upgradable)) warnings.push('The transfer fee can be changed')
  if (statusOne(row.transfer_hook_upgradable)) warnings.push('The transfer hook can be changed')
  if (statusOne(row.default_account_state_upgradable)) warnings.push('The default account state can be changed')
  if (statusOne(row.metadata_mutable)) warnings.push('Token metadata can be changed')
}

function evaluateHoneypot(row, blocked, warnings) {
  if (row.honeypotResult && row.honeypotResult.isHoneypot === true) {
    blocked.push(`Sell simulation identified a honeypot${row.honeypotResult.honeypotReason ? `: ${row.honeypotResult.honeypotReason}` : ''}`)
  }
  const level = numeric(row.summary && row.summary.riskLevel)
  if (level !== null && level >= 80) blocked.push(`Honeypot simulation returned critical risk (${level}/100)`)
  else if (level !== null && level >= 20) warnings.push(`Honeypot simulation returned elevated risk (${level}/100)`)
  if (row.simulationSuccess === false) warnings.push('A complete buy/sell simulation was not available')
  for (const flag of (row.summary && row.summary.flags) || []) {
    const label = flag.description || flag.flag
    if (String(flag.severity || '').toLowerCase() === 'critical') blocked.push(label)
    else warnings.push(label)
  }
}

async function scanToken(chain, address) {
  const tasks = {
    flash: flashAssessment(chain, address),
    goplus: goPlusAssessment(chain, address),
  }
  if (chain !== 'solana' && HONEYPOT_CHAINS.has(chain)) tasks.honeypot = honeypotAssessment(chain, address)
  const names = Object.keys(tasks)
  const results = await Promise.allSettled(Object.values(tasks))
  const blocked = []
  const warnings = []
  const sources = {}

  const unavailable = []
  results.forEach((result, index) => {
    const name = names[index]
    if (result.status === 'rejected') {
      sources[name] = { available: false }
      unavailable.push(name)
      return
    }
    sources[name] = { available: true }
    if (name === 'flash') {
      const asset = result.value
      if (asset.riskFlagged) warnings.push('Flash flagged common token risk indicators')
      const liquidity = numeric(asset.liquidity)
      if (liquidity !== null && liquidity <= 0) blocked.push('No usable token liquidity was found')
      else if (liquidity !== null && liquidity < 5000) warnings.push(`Very low liquidity (${Math.round(liquidity).toLocaleString('en-US')} USD)`)
    } else if (name === 'goplus') {
      if (chain === 'solana') evaluateSolana(result.value, blocked, warnings)
      else evaluateEvm(result.value, blocked, warnings)
    } else if (name === 'honeypot') evaluateHoneypot(result.value, blocked, warnings)
  })

  if (!sources.goplus || !sources.goplus.available) warnings.push('The primary GoPlus token scan was unavailable')
  if (unavailable.length === names.length) warnings.push('No token-security source was available')

  const blockReasons = unique(blocked)
  const warningReasons = unique(warnings).filter((reason) => !blockReasons.includes(reason))
  const action = blockReasons.length ? 'block' : warningReasons.length ? 'warn' : 'info'
  return {
    action,
    verdict: action === 'block' ? 'critical' : action === 'warn' ? 'caution' : 'no_known_critical_risks',
    reasons: action === 'block' ? blockReasons : warningReasons,
    warnings: warningReasons,
    sources,
    checkedAt: new Date().toISOString(),
  }
}

async function tokenSecurityCtrl(req, res) {
  const chain = String(req.params.chain || '').toLowerCase()
  const address = String(req.params.address || '')
  const validChain = chain === 'solana' || CHAIN_ID.test(chain)
  const validAddress = chain === 'solana' ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address)
  if (!validChain || !FLASH_CHAINS[chain] || !validAddress) {
    return res.status(400).json({ error: 'BadRequest', message: 'Expected a supported chain and token contract address.' })
  }
  const key = `${chain}:${address.toLowerCase()}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value)
  try {
    const value = await scanToken(chain, address)
    cache.set(key, { expiresAt: Date.now() + CACHE_MS, value })
    res.json(value)
  } catch (error) {
    console.warn('[security]', error.message)
    res.status(502).json({ error: 'SecurityUnavailable', message: 'Token security checks could not be completed.' })
  }
}

module.exports = {
  tokenSecurityCtrl,
  scanToken,
  _test: { evaluateEvm, evaluateSolana, evaluateHoneypot },
}
