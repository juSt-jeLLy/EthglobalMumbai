const test = require('node:test')
const assert = require('node:assert/strict')
const { _test } = require('./security.js')

test('blocks confirmed EVM fraud signals', () => {
  const blocked = []
  const warnings = []
  _test.evaluateEvm({ is_honeypot: '1', fake_token: { value: 1 }, sell_tax: '0.75' }, blocked, warnings)
  assert.ok(blocked.some((reason) => reason.includes('honeypot')))
  assert.ok(blocked.some((reason) => reason.includes('counterfeit')))
  assert.ok(blocked.some((reason) => reason.includes('sell tax')))
})

test('warns for dangerous capabilities but does not false-warn trusted proxies', () => {
  const blocked = []
  const warnings = []
  _test.evaluateEvm({ is_open_source: '0', is_proxy: '1', is_mintable: '1' }, blocked, warnings)
  assert.equal(blocked.length, 0)
  assert.ok(warnings.length >= 3)

  const trustedWarnings = []
  _test.evaluateEvm({ trust_list: '1', is_proxy: '1', is_mintable: '1' }, [], trustedWarnings)
  assert.deepEqual(trustedWarnings, [])
})

test('blocks mutable Solana balances and confirmed honeypot simulations', () => {
  const solanaBlocked = []
  _test.evaluateSolana({ balance_mutable_authority: { status: '1' } }, solanaBlocked, [])
  assert.ok(solanaBlocked.some((reason) => reason.includes('holder balances')))

  const honeypotBlocked = []
  _test.evaluateHoneypot({ honeypotResult: { isHoneypot: true, honeypotReason: 'TRANSFER_FROM_FAILED' } }, honeypotBlocked, [])
  assert.ok(honeypotBlocked.some((reason) => reason.includes('honeypot')))
})
