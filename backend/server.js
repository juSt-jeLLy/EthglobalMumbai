// Routes
const express = require('express')
const cors = require('cors')
const { flashProxyCtrl } = require('./flash.js')
const { parsePlanCtrl } = require('./parser.js')
const { tokenSecurityCtrl } = require('./security.js')
const { createPlanCtrl, listPlansCtrl, socialProofCtrl, leaderboardCtrl, planEventsCtrl, hydratePlans } = require('./plans.js')
const { startFlashOrderStream } = require('./flash-stream.js')
const { prepareSignalCtrl, createSignalCtrl, captureSignalCtrl, attachSourceCtrl, prepareRevisionCtrl, createRevisionCtrl, passportCtrl, creatorProfileCtrl, getSignalCtrl, startSourceMonitor, hydrateSignals } = require('./signals.js')
const { subscribeCtrl, radarCtrl, terminalCtrl, roomCtrl, hydrateSubscriptions } = require('./radar.js')
const { statusCtrl: worldStatusCtrl, rpContextCtrl: worldRpContextCtrl, verifyCtrl: verifyWorldHumanCtrl, hydrateWorldHuman } = require('./world-human.js')
const { initDatabase, closeDatabase } = require('./database.js')
const app = express()
const port = process.env.PORT || 8000

const allowedWebOrigins = new Set(['http://localhost:4173', 'http://127.0.0.1:4173'])
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedWebOrigins.has(origin)) return callback(null, true)
    if (origin.startsWith('chrome-extension://')) {
      const id = origin.slice('chrome-extension://'.length)
      return callback(null, !process.env.EXTENSION_ID || id === process.env.EXTENSION_ID)
    }
    callback(Object.assign(new Error('Origin not allowed'), { status: 403, publicMessage: 'This origin is not allowed.' }))
  },
}))
app.use(express.json({ limit: '64kb' }))

const rateBuckets = new Map()
app.use((req, res, next) => {
  const now = Date.now()
  const key = `${req.ip}:${req.path === '/parse' ? 'parse' : 'api'}`
  const limit = req.path === '/parse' ? 20 : 180
  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= 60000) rateBuckets.set(key, { startedAt: now, count: 1 })
  else if (++bucket.count > limit) return res.status(429).json({ error: 'RateLimited', message: 'Too many requests. Try again shortly.' })
  if (rateBuckets.size > 2000) for (const [bucketKey, value] of rateBuckets) if (now - value.startedAt > 120000) rateBuckets.delete(bucketKey)
  next()
})

app.get('/', (req, res) => res.send('Plan B backend OK'))
app.post('/parse', parsePlanCtrl)
app.post('/plans', createPlanCtrl)
app.get('/plans', listPlansCtrl)
app.get('/plans/events', planEventsCtrl)
app.get('/social', socialProofCtrl)
app.get('/leaderboard', leaderboardCtrl)
app.post('/signals/message', prepareSignalCtrl)
app.post('/signals', createSignalCtrl)
app.post('/signals/capture', captureSignalCtrl)
app.post('/signals/:id/source', attachSourceCtrl)
app.post('/signals/:id/revisions/message', prepareRevisionCtrl)
app.post('/signals/:id/revisions', createRevisionCtrl)
app.get('/world/status', worldStatusCtrl)
app.post('/world/rp-context', worldRpContextCtrl)
app.post('/world/verify', verifyWorldHumanCtrl)
app.post('/subscriptions', subscribeCtrl)
app.get('/radar', radarCtrl)
app.get('/terminal', terminalCtrl)
app.get('/rooms/:id', roomCtrl)
app.get('/signals/:id/passport', passportCtrl)
app.get('/creators/:creator', creatorProfileCtrl)
app.get('/signals/:id', getSignalCtrl)
app.all('/flash/:endpoint', flashProxyCtrl)
app.get('/security/token/:chain/:address', tokenSecurityCtrl)

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const status = Number.isInteger(error.status) ? error.status : 500
  if (status >= 500) console.error('[server]', error.message)
  res.status(status).json({
    error: status === 403 ? 'OriginNotAllowed' : 'ServerError',
    message: error.publicMessage || (status < 500 ? error.message : 'The request could not be completed.'),
  })
})

async function start() {
  await initDatabase()
  // Hydrate before listening so every route sees the same durable state.
  await hydrateWorldHuman()
  await Promise.all([hydratePlans(), hydrateSignals(), hydrateSubscriptions()])
  const server = app.listen(port, () => {
    console.log(`Plan B backend listening on port ${port} (PostgreSQL connected)`)
    startFlashOrderStream()
    startSourceMonitor()
  })
  const shutdown = () => server.close(() => { void closeDatabase().finally(() => process.exit(0)) })
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error) => {
  console.error('[server] PostgreSQL startup failed:', error.message)
  process.exitCode = 1
})
