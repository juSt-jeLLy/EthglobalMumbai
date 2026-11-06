const test = require('node:test')
const assert = require('node:assert/strict')
const { canonicalRevisionMessage } = require('./signals.js')

test('revision signature message binds the caller card, revision number and revised terms', () => {
  const message = canonicalRevisionMessage({ id: 'signal-123' }, {
    draft: { token: 'ETH', chain: 'base', side: 'buy', entryType: 'limit', entryPrice: 2100, triggerPrice: null, triggerDirection: null, exitType: 'bracket', stopLoss: 1900, takeProfit: 2500, trailPercent: null, durationHours: null, expiryHours: 24 },
    strategy: { strategyType: 'resting-entry' },
  }, 'Waiting for a pullback', 2)
  assert.match(message, /Plan: signal-123/)
  assert.match(message, /Revision: 2/)
  assert.match(message, /Reason: Waiting for a pullback/)
  assert.match(message, /Entry: limit @ 2100/)
})
