const test = require('node:test')
const assert = require('node:assert/strict')
const { contractReference } = require('./parser.js')

test('extracts an explicit EVM contract without treating a ticker as an address', () => {
  assert.deepEqual(contractReference('Buy PEPE: 0x1234567890abcdef1234567890abcdef12345678'), {
    kind: 'evm', address: '0x1234567890abcdef1234567890abcdef12345678',
  })
  assert.equal(contractReference('Buy $ETH on Base'), null)
})

test('extracts a Solana contract reference', () => {
  assert.deepEqual(contractReference('Watch So11111111111111111111111111111111111111112'), {
    kind: 'solana', address: 'So11111111111111111111111111111111111111112',
  })
})
