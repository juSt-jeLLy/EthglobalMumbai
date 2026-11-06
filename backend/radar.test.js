const test = require('node:test')
const assert = require('node:assert/strict')
const { signalDecay, signalSwarms } = require('./radar.js')
const { voiceFallbackDraft } = require('./parser.js')

function signal(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    signer: '0x1111111111111111111111111111111111111111',
    createdAt: new Date().toISOString(),
    asset: { symbol: 'ETH', chain: 'base', price: 2200 },
    draft: { side: 'buy', entryType: 'limit', entryPrice: 2200, expiryHours: 4 },
    ...overrides,
  }
}
const crypto = require('crypto')

test('marks late buy signals as chasing and expired plans as expired', () => {
  assert.equal(signalDecay(signal(), 2280).state, 'chasing')
  assert.equal(signalDecay(signal({ createdAt: new Date(Date.now() - 26 * 3600000).toISOString() }), 2200).state, 'expired')
})

test('only creates a swarm from independent verified callers', () => {
  const one = signal()
  const two = signal({ signer: '0x2222222222222222222222222222222222222222' })
  const swarm = signalSwarms([one, two])
  assert.equal(swarm.length, 1)
  assert.equal(swarm[0].callerCount, 2)
  assert.equal(signalSwarms([one]).length, 0)
})

test('retains explicit advanced order details from a voice command', () => {
  const draft = voiceFallbackDraft('Buy ETH on Base via TWAP over two hours, stop loss at 2100, take profit at 2500')
  assert.equal(draft.entryType, 'twap')
  assert.equal(draft.durationHours, 2)
  assert.equal(draft.stopLoss, 2100)
  assert.equal(draft.takeProfit, 2500)
  assert.equal(draft.exitType, 'bracket')
})

test('recovers an explicit tweet bracket when structured parsing is unavailable', () => {
  const draft = voiceFallbackDraft('Buy ETH on Base at market, stop at 1800 and take profit at 3000')
  assert.equal(draft.chain, 'base')
  assert.equal(draft.entryType, 'market')
  assert.equal(draft.stopLoss, 1800)
  assert.equal(draft.takeProfit, 3000)
  assert.equal(draft.exitType, 'bracket')
})

test('does not turn casual token commentary into a recovered market order', () => {
  assert.equal(voiceFallbackDraft('I might buy ETH someday'), null)
})
