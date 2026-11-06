const test = require('node:test')
const assert = require('node:assert/strict')
const { compileStrategy } = require('./strategy.js')

test('compiles a capped TWAP with an atomic attached bracket', () => {
  const strategy = compileStrategy({ entryType: 'twap', entryPrice: 2300, durationHours: 2, bucketCount: 12, stopLoss: 2180, takeProfit: 2600, exitType: 'bracket' })
  assert.equal(strategy.strategyType, 'scale-in')
  assert.equal(strategy.entry.limitNotionalPrice, '2300')
  assert.equal(strategy.entry.durationSeconds, 7200)
  assert.equal(strategy.protection.type, 'attached-bracket')
  assert.equal(strategy.executableAtomically, true)
  assert.deepEqual(strategy.flashOrderTypes, ['twap', 'bracket'])
})

test('marks protection after a triggered entry as a signed follow-up', () => {
  const strategy = compileStrategy({ entryType: 'stop', triggerPrice: 2500, triggerDirection: 'upper', stopLoss: 2350, takeProfit: 2800, exitType: 'bracket' })
  assert.equal(strategy.strategyType, 'breakout')
  assert.equal(strategy.protection.type, 'follow-up-bracket')
  assert.equal(strategy.executableAtomically, false)
  assert.equal(strategy.warnings.length, 1)
})

test('compiles a standalone trailing stop', () => {
  const strategy = compileStrategy({ entryType: 'trailing-stop', trailPercent: 5, activationPrice: 2500 })
  assert.equal(strategy.strategyType, 'trail')
  assert.deepEqual(strategy.entry.trailingStop, { trailPercent: '0.05', activationPrice: '2500' })
})

test('does not mistake a protective stop for a market-entry trigger', () => {
  const strategy = compileStrategy({ entryType: 'market', triggerPrice: 1800, stopLoss: 1800, takeProfit: 3000, exitType: 'bracket' })
  assert.equal(strategy.entry.triggers, undefined)
  assert.equal(strategy.protection.type, 'attached-bracket')
})
