// Definitive Flash API proxy. The API key stays on the server and is never
// exposed to the browser extension.
require('dotenv').config({ path: __dirname + '/.env' })

const FLASH_API_URL = 'https://flash.definitive.fi/v1'
const EVM_NATIVE_ASSET = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const ROUTES = {
  search: { method: 'GET', path: '/search' },
  balances: { method: 'GET', path: ({ address }) => `/balances/${encodeURIComponent(address)}` },
  quote: { method: 'POST', path: '/quote' },
  order: { method: 'POST', path: '/order' },
  'setup-transaction': { method: 'POST', path: '/setup-transaction' },
  orders: { method: 'GET', path: '/orders' },
  'order-detail': { method: 'GET', path: ({ orderId }) => `/orders/${encodeURIComponent(orderId)}` },
  'update-order': { method: 'PATCH', path: ({ orderId }) => `/orders/${encodeURIComponent(orderId)}` },
  'cancel-order': { method: 'POST', path: ({ orderId }) => `/orders/${encodeURIComponent(orderId)}/cancel` },
}
const ORDER_TYPES = new Set(['market', 'limit', 'twap', 'stop', 'stop-loss', 'take-profit', 'bracket', 'trailing-stop', 'trailing-stop-limit'])
const assetCache = new Map()
const DEX_TO_FLASH_CHAIN = {
  ethereum: 'ethereum', base: 'base', arbitrum: 'arbitrum', optimism: 'optimism', avalanche: 'avalanche',
  bsc: 'bsc', polygon: 'polygon', solana: 'solana', hyperliquid: 'hyperevm', hyperevm: 'hyperevm',
  ink: 'ink', monad: 'monad', plasma: 'plasma', robinhood: 'robinhood', arc: 'arc',
}
const RPC_URLS = {
  ethereum: 'https://ethereum-rpc.publicnode.com', base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc', optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc', bsc: 'https://bsc-dataseed.bnbchain.org',
  polygon: 'https://polygon-bor-rpc.publicnode.com', hyperevm: 'https://rpc.hyperliquid.xyz/evm',
  ink: 'https://rpc-gel.inkonchain.com', monad: 'https://rpc.monad.xyz', plasma: 'https://rpc.plasma.to',
  robinhood: 'https://rpc.mainnet.chain.robinhood.com', arc: 'https://rpc.drpc.mainnet.arc.io',
  solana: 'https://api.mainnet-beta.solana.com',
}
const NATIVE_ASSETS = {
  ethereum: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  base: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  arbitrum: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  optimism: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  ink: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  robinhood: { symbol: 'ETH', dexSymbol: 'WETH', name: 'Ether', decimals: 18 },
  avalanche: { symbol: 'AVAX', dexSymbol: 'WAVAX', name: 'Avalanche', decimals: 18 },
  bsc: { symbol: 'BNB', dexSymbol: 'WBNB', name: 'BNB', decimals: 18 },
  polygon: { symbol: 'POL', dexSymbol: 'WPOL', name: 'POL', decimals: 18 },
  hyperevm: { symbol: 'HYPE', dexSymbol: 'WHYPE', name: 'HYPE', decimals: 18 },
  monad: { symbol: 'MON', dexSymbol: 'WMON', name: 'Monad', decimals: 18 },
  plasma: { symbol: 'XPL', dexSymbol: 'WXPL', name: 'XPL', decimals: 18 },
}

function rememberAssets(payload) {
  for (const asset of (payload && payload.assets) || []) {
    if (!asset.chain || !asset.address) continue
    assetCache.set(`${asset.chain}:${String(asset.address).toLowerCase()}`, { ...asset, cachedAt: Date.now() })
  }
}

function getCachedFlashAsset(chain, address) {
  return assetCache.get(`${chain}:${String(address).toLowerCase()}`) || null
}

async function rpcDecimals(chain, address) {
  const rpc = RPC_URLS[chain]
  if (!rpc) return null
  const solana = chain === 'solana'
  const body = solana
    ? { jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [address] }
    : { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address, data: '0x313ce567' }, 'latest'] }
  try {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const value = await response.json()
    const decimals = solana ? Number(value.result && value.result.value && value.result.value.decimals) : parseInt(value.result, 16)
    return Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null
  } catch { return null }
}

async function dexScreenerSearch(params) {
  const query = String(params.query || '').trim()
  const wantedChain = params.chain || null
  const native = wantedChain && NATIVE_ASSETS[wantedChain] && NATIVE_ASSETS[wantedChain].symbol.toLowerCase() === query.toLowerCase()
    ? NATIVE_ASSETS[wantedChain]
    : null
  const lookup = native ? native.dexSymbol : query
  const searchQuery = wantedChain && !/^0x[0-9a-f]{40}$/i.test(lookup) ? `${lookup} ${wantedChain}` : lookup
  const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw Object.assign(new Error(`Asset discovery fallback returned ${response.status}`), { status: 502 })
  const payload = await response.json().catch(() => ({}))
  const wanted = lookup.toLowerCase().replace(/^\$/, '')
  const byAddress = new Map()
  for (const pair of payload.pairs || []) {
    const chain = DEX_TO_FLASH_CHAIN[String(pair.chainId || '').toLowerCase()]
    if (!chain || (wantedChain && chain !== wantedChain)) continue
    const basePrice = Number(pair.priceUsd)
    const crossPrice = Number(pair.priceNative)
    for (const [kind, token] of [['base', pair.baseToken], ['quote', pair.quoteToken]]) {
      if (!token || !token.address || !token.symbol) continue
      if (token.symbol.toLowerCase() !== wanted && token.address.toLowerCase() !== wanted) continue
      const price = kind === 'base' ? basePrice : (basePrice > 0 && crossPrice > 0 ? basePrice / crossPrice : null)
      const liquidity = Number(pair.liquidity && pair.liquidity.usd) || 0
      const key = `${chain}:${token.address.toLowerCase()}`
      const candidate = {
        chain, address: native ? EVM_NATIVE_ASSET : token.address,
        symbol: native ? native.symbol : token.symbol, name: native ? native.name : token.name || token.symbol,
        decimals: native ? native.decimals : null, price: Number.isFinite(price) && price > 0 ? String(price) : null,
        marketCap: pair.marketCap ? String(pair.marketCap) : null, liquidity: String(liquidity),
        volume24h: pair.volume && pair.volume.h24 ? String(pair.volume.h24) : null,
        imageUrl: kind === 'base' && pair.info && pair.info.imageUrl || null,
        riskFlagged: false, discoverySource: 'dexscreener',
      }
      if (!byAddress.has(key) || liquidity > Number(byAddress.get(key).liquidity || 0)) byAddress.set(key, candidate)
    }
  }
  const limit = Math.min(25, Math.max(1, Number(params.limit) || 10))
  const ranked = [...byAddress.values()].sort((a, b) => Number(b.liquidity) - Number(a.liquidity)).slice(0, limit)
  const assets = (await Promise.all(ranked.map(async (asset) => asset.decimals !== null ? asset : ({ ...asset, decimals: await rpcDecimals(asset.chain, asset.address) })))).filter((asset) => asset.decimals !== null)
  if (!assets.length) throw Object.assign(new Error(`No fallback asset match for ${query}${wantedChain ? ` on ${wantedChain}` : ''}`), { status: 422 })
  const result = { assets, discoverySource: 'dexscreener', flashSearchUnavailable: true }
  rememberAssets(result)
  return result
}

async function searchAssets(params) {
  const response = await flashRequest('GET', '/search', params)
  const body = await response.json().catch(() => ({}))
  if (response.ok) {
    rememberAssets(body)
    return body
  }
  const code = body && body.error && body.error.code
  if (response.status === 403 && code === 'SEARCH_NOT_ELIGIBLE') return dexScreenerSearch(params)
  const message = body && body.error && body.error.message || `Flash search returned ${response.status}`
  throw Object.assign(new Error(message), { status: response.status >= 500 ? 502 : response.status })
}

function validateFlashInput(endpoint, params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return 'Request body must be an object'
  const string = (key, max = 300) => typeof params[key] === 'string' && params[key].length > 0 && params[key].length <= max
  if (endpoint === 'search') return string('query', 120) ? '' : 'query is required'
  if (endpoint === 'balances') return string('address', 120) ? '' : 'address is required'
  if (endpoint === 'order-detail') return string('orderId', 80) ? '' : 'orderId is required'
  if (endpoint === 'cancel-order') {
    if (!string('orderId', 80) || !string('cancelMessage', 500) || !string('userSignature', 500)) return 'orderId, cancelMessage and userSignature are required'
    return ''
  }
  if (endpoint === 'update-order') {
    if (!string('orderId', 80) || !string('updateMessage', 1200) || !string('userSignature', 2000)) return 'orderId, updateMessage and userSignature are required'
    const hasUpdate = string('limitCrossPrice') || string('limitNotionalPrice') || (Array.isArray(params.triggers) && params.triggers.length) || (params.trigger && typeof params.trigger === 'object')
    return hasUpdate ? '' : 'An order update requires a limit price, trigger, or bracket triggers'
  }
  if (endpoint === 'setup-transaction') return string('signedSetupTx', 100000) ? '' : 'signedSetupTx is required'
  if (endpoint === 'quote' || endpoint === 'order') {
    for (const key of ['targetChain', 'contraChain', 'targetAsset', 'contraAsset', 'side', 'qty', 'orderType']) if (!string(key)) return `${key} is required`
    if (!['buy', 'sell'].includes(params.side)) return 'side must be buy or sell'
    if (!ORDER_TYPES.has(params.orderType)) return 'Unsupported orderType'
    if (!(Number(params.qty) > 0)) return 'qty must be positive'
    if (endpoint === 'order' && (!string('quoteId', 120) || !string('userSignature', 2000))) return 'quoteId and userSignature are required'
  }
  return ''
}

async function flashProxyCtrl(req, res) {
  const route = ROUTES[req.params.endpoint]
  if (!route) return res.status(404).json({ error: 'NotFound', message: `Unknown Flash endpoint: ${req.params.endpoint}` })
  if (req.method !== route.method) return res.status(405).json({ error: 'MethodNotAllowed', message: `${req.params.endpoint} requires ${route.method}` })
  if (!process.env.DEFINITIVE_FLASH_API_KEY) {
    return res.status(500).json({ error: 'MissingApiKey', message: 'DEFINITIVE_FLASH_API_KEY is not set in backend/.env' })
  }

  const params = route.method === 'GET' ? req.query : req.body || {}
  const validationError = validateFlashInput(req.params.endpoint, params)
  if (validationError) return res.status(400).json({ error: 'InvalidRequest', message: validationError })
  const routePath = typeof route.path === 'function' ? route.path(params) : route.path
  const upstreamParams = route.method === 'GET'
    ? Object.fromEntries(Object.entries(params).filter(([key]) => !['orderId', 'address'].includes(key)))
    : Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => !(req.params.endpoint === 'update-order' && key === 'orderId')))

  try {
    if (req.params.endpoint === 'search') return res.json(await searchAssets(upstreamParams))
    const response = await flashRequest(route.method, routePath, upstreamParams)
    const text = await response.text()
    if (!response.ok) console.log(`Flash ${req.params.endpoint} ${response.status}: ${text.slice(0, 500)}`)
    res.status(response.status).type('application/json').send(text)
  } catch (error) {
    console.log(`Flash ${req.params.endpoint} failed:`, error)
    res.status(502).json({ error: 'UpstreamError', message: error.message })
  }
}

async function flashRequest(method, path, params = {}) {
  if (!process.env.DEFINITIVE_FLASH_API_KEY) throw Object.assign(new Error('DEFINITIVE_FLASH_API_KEY is not set in backend/.env'), { status: 500 })
  const query = method === 'GET'
    ? new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    : ''
  return fetch(`${FLASH_API_URL}${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        'x-definitive-api-key': process.env.DEFINITIVE_FLASH_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(method !== 'GET' && { body: JSON.stringify(params) }),
      signal: AbortSignal.timeout(30000),
    })
}

module.exports = { flashProxyCtrl, flashRequest, searchAssets, getCachedFlashAsset, rememberAssets }
