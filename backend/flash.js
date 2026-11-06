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

async function flashProxyCtrl(req, res) {
  const route = ROUTES[req.params.endpoint]
  if (!route) return res.status(404).json({ error: 'NotFound', message: `Unknown Flash endpoint: ${req.params.endpoint}` })
  if (!process.env.DEFINITIVE_FLASH_API_KEY) {
    return res.status(500).json({ error: 'MissingApiKey', message: 'DEFINITIVE_FLASH_API_KEY is not set in backend/.env' })
  }

  const params = route.method === 'GET' ? req.query : req.body || {}
  const routePath = typeof route.path === 'function' ? route.path(params) : route.path
  const query = route.method === 'GET'
    ? new URLSearchParams(Object.entries(params).filter(([key, value]) => value !== undefined && !['orderId', 'address'].includes(key))).toString()
    : ''

  try {
    const response = await fetch(`${FLASH_API_URL}${routePath}${query ? `?${query}` : ''}`, {
      method: route.method,
      headers: {
        'x-definitive-api-key': process.env.DEFINITIVE_FLASH_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(route.method !== 'GET' && { body: JSON.stringify(req.body || {}) }),
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    if (!response.ok) console.log(`Flash ${req.params.endpoint} ${response.status}: ${text.slice(0, 500)}`)
    res.status(response.status).type('application/json').send(text)
  } catch (error) {
    console.log(`Flash ${req.params.endpoint} failed:`, error)
    res.status(502).json({ error: 'UpstreamError', message: error.message })
  }
}

module.exports = { flashProxyCtrl }
