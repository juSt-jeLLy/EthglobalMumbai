// Definitive Flash API proxy. The API key stays on the server and is never
// exposed to the browser extension.
require('dotenv').config({ path: __dirname + '/.env' })

const FLASH_API_URL = 'https://flash.definitive.fi/v1'
const ROUTES = {
  search: { method: 'GET', path: '/search' },
  balances: { method: 'GET', path: ({ address }) => `/balances/${encodeURIComponent(address)}` },
  quote: { method: 'POST', path: '/quote' },
  order: { method: 'POST', path: '/order' },
  'setup-transaction': { method: 'POST', path: '/setup-transaction' },
  orders: { method: 'GET', path: '/orders' },
  'order-detail': { method: 'GET', path: ({ orderId }) => `/orders/${encodeURIComponent(orderId)}` },
  'cancel-order': { method: 'POST', path: ({ orderId }) => `/orders/${encodeURIComponent(orderId)}/cancel` },
}
const ORDER_TYPES = new Set(['market', 'limit', 'twap', 'stop', 'stop-loss', 'take-profit', 'bracket', 'trailing-stop', 'trailing-stop-limit'])
const assetCache = new Map()

function rememberAssets(payload) {
  for (const asset of (payload && payload.assets) || []) {
    if (!asset.chain || !asset.address) continue
    assetCache.set(`${asset.chain}:${String(asset.address).toLowerCase()}`, { ...asset, cachedAt: Date.now() })
  }
}

function getCachedFlashAsset(chain, address) {
  return assetCache.get(`${chain}:${String(address).toLowerCase()}`) || null
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
    : req.body || {}

  try {
    const response = await flashRequest(route.method, routePath, upstreamParams)
    const text = await response.text()
    if (response.ok && req.params.endpoint === 'search') {
      try { rememberAssets(JSON.parse(text)) } catch { /* Invalid upstream JSON is returned unchanged below. */ }
    }
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

module.exports = { flashProxyCtrl, flashRequest, getCachedFlashAsset, rememberAssets }
