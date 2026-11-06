require('dotenv').config({ path: __dirname + '/.env' })
const WebSocket = require('ws')
const { applyOrderUpdate } = require('./plans.js')

const WS_URL = 'wss://flash.definitive.fi/v1/ws'

function startFlashOrderStream() {
  if (!process.env.DEFINITIVE_FLASH_API_KEY) return () => {}
  let socket = null
  let reconnectTimer = null
  let heartbeatTimer = null
  let attempts = 0
  let stopped = false

  const connect = () => {
    if (stopped) return
    socket = new WebSocket(WS_URL)
    socket.on('open', () => {
      attempts = 0
      socket.send(JSON.stringify({ channel: 'orders', type: 'subscribe', apiKey: process.env.DEFINITIVE_FLASH_API_KEY }))
      socket.send(JSON.stringify({ channel: 'heartbeats', type: 'subscribe', apiKey: process.env.DEFINITIVE_FLASH_API_KEY }))
    })
    socket.on('message', (raw) => {
      let frame
      try { frame = JSON.parse(raw.toString()) } catch { return }
      if (frame.type === 'heartbeat') {
        clearTimeout(heartbeatTimer)
        heartbeatTimer = setTimeout(() => socket && socket.terminate(), 5000)
      }
      if ((frame.type === 'snapshot' || frame.type === 'update') && Array.isArray(frame.orders)) {
        frame.orders.forEach(applyOrderUpdate)
      }
      if (frame.type === 'error') {
        console.warn(`[flash-ws] ${frame.code}: ${frame.message}`)
        if (frame.code === 'UNAUTHORIZED') { stopped = true; socket.close() }
      }
    })
    socket.on('error', (error) => console.warn('[flash-ws]', error.message))
    socket.on('close', () => {
      clearTimeout(heartbeatTimer)
      if (stopped) return
      const maximum = Math.min(30000, 1000 * 2 ** attempts++)
      reconnectTimer = setTimeout(connect, maximum / 2 + Math.random() * maximum / 2)
    })
  }
  connect()
  return () => {
    stopped = true
    clearTimeout(reconnectTimer)
    clearTimeout(heartbeatTimer)
    if (socket) socket.close()
  }
}

module.exports = { startFlashOrderStream }
