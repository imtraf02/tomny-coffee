export type StockLot = { id: string; remainingQuantity: number; unitCost: number }
export type FifoAllocation = { lotId: string; quantity: number; cost: number }

export function allocateFifo(lots: StockLot[], quantity: number) {
  let remaining = quantity
  const allocations: FifoAllocation[] = []
  for (const lot of lots) {
    if (remaining <= 0) break
    const used = Math.min(lot.remainingQuantity, remaining)
    if (used > 0) allocations.push({ lotId: lot.id, quantity: used, cost: Math.round(used * lot.unitCost) })
    remaining -= used
  }
  return { allocations, shortage: remaining, cost: allocations.reduce((sum, allocation) => sum + allocation.cost, 0) }
}
