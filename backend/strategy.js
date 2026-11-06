const ENTRY_TYPES = new Set([
  'market', 'limit', 'twap', 'stop', 'stop-loss', 'take-profit',
  'bracket', 'trailing-stop', 'trailing-stop-limit',
])
const STRATEGY_TYPES = new Set(['immediate', 'pullback', 'breakout', 'scale-in', 'protect', 'trail'])
const EXIT_TYPES = new Set(['none', 'bracket', 'trailing'])
const ATTACHABLE_ENTRIES = new Set(['market', 'limit', 'twap'])

function positive(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function inferStrategyType(draft) {
  if (STRATEGY_TYPES.has(draft.strategyType)) return draft.strategyType
  if (draft.entryType === 'twap') return 'scale-in'
  if (draft.entryType === 'limit') return 'pullback'
  if (draft.entryType === 'stop') return draft.triggerDirection === 'lower' ? 'pullback' : 'breakout'
  if (['stop-loss', 'take-profit', 'bracket'].includes(draft.entryType)) return 'protect'
  if (['trailing-stop', 'trailing-stop-limit'].includes(draft.entryType)) return 'trail'
  return 'immediate'
}

function inferExitType(draft) {
  if (EXIT_TYPES.has(draft.exitType)) return draft.exitType
  if (positive(draft.stopLoss) && positive(draft.takeProfit)) return 'bracket'
  if (positive(draft.trailPercent)) return 'trailing'
  return 'none'
}

function compileStrategy(draft, asset) {
  const entryType = ENTRY_TYPES.has(draft.entryType) ? draft.entryType : 'market'
  const strategyType = inferStrategyType({ ...draft, entryType })
  const requestedExit = inferExitType(draft)
  const warnings = []
  const steps = []
  const entry = { orderType: entryType }

  if (positive(draft.entryPrice)) entry.limitNotionalPrice = String(draft.entryPrice)
  if (['stop', 'stop-loss', 'take-profit'].includes(entryType) && positive(draft.triggerPrice)) {
    entry.triggers = [{ notionalPrice: String(draft.triggerPrice), triggerType: draft.triggerDirection === 'lower' ? 'lower' : 'upper' }]
  }
  if (entryType === 'twap') {
    entry.durationSeconds = Math.max(300, Math.round(positive(draft.durationHours) * 3600))
    entry.twapBucketCount = Math.min(2560, Math.max(2, Math.round(positive(draft.bucketCount) || 12)))
  }
  if (['trailing-stop', 'trailing-stop-limit'].includes(entryType)) {
    entry.trailingStop = { trailPercent: String(positive(draft.trailPercent) / 100) }
    if (positive(draft.activationPrice)) entry.trailingStop.activationPrice = String(draft.activationPrice)
  }

  const protection = { type: 'none' }
  if (requestedExit === 'bracket') {
    if (ATTACHABLE_ENTRIES.has(entryType)) {
      protection.type = 'attached-bracket'
      protection.stopLoss = String(draft.stopLoss)
      protection.takeProfit = String(draft.takeProfit)
    } else {
      protection.type = 'follow-up-bracket'
      protection.stopLoss = String(draft.stopLoss)
      protection.takeProfit = String(draft.takeProfit)
      warnings.push('This entry type cannot attach protection atomically; the bracket requires a follower confirmation after the entry fills.')
    }
  } else if (requestedExit === 'trailing' && !['trailing-stop', 'trailing-stop-limit'].includes(entryType)) {
    protection.type = 'follow-up-trailing-stop'
    protection.trailPercent = positive(draft.trailPercent)
    warnings.push('The trailing exit is a second Flash order and requires follower confirmation after the entry fills.')
  }

  const labels = {
    market: 'Market entry', limit: 'Limit entry', twap: 'TWAP scale-in', stop: 'Triggered entry',
    'stop-loss': 'Stop-loss exit', 'take-profit': 'Take-profit exit', bracket: 'Bracket exit',
    'trailing-stop': 'Trailing stop', 'trailing-stop-limit': 'Trailing stop limit',
  }
  steps.push({ kind: 'entry', orderType: entryType, label: labels[entryType] || entryType })
  if (protection.type !== 'none') {
    steps.push({
      kind: 'protection',
      orderType: protection.type === 'attached-bracket' || protection.type === 'follow-up-bracket' ? 'bracket' : 'trailing-stop',
      label: protection.type === 'attached-bracket' ? 'Attached stop + target' : protection.type === 'follow-up-bracket' ? 'Follow-up stop + target' : 'Follow-up trailing stop',
    })
  }

  const strategyLabels = {
    immediate: 'Immediate execution', pullback: 'Buy/sell the pullback', breakout: 'Breakout confirmation',
    'scale-in': 'Scale in over time', protect: 'Protect an existing position', trail: 'Let the winner run',
  }
  const flashOrderTypes = [...new Set(steps.map((step) => step.orderType))]
  return {
    version: 1,
    strategyType,
    title: strategyLabels[strategyType],
    summary: steps.map((step) => step.label).join(' → '),
    entry,
    protection,
    steps,
    flashOrderTypes,
    executableAtomically: !protection.type.startsWith('follow-up-'),
    warnings,
    asset: asset ? { symbol: asset.symbol, chain: asset.chain, address: asset.address } : null,
  }
}

module.exports = { compileStrategy, ENTRY_TYPES, STRATEGY_TYPES, EXIT_TYPES, ATTACHABLE_ENTRIES }
