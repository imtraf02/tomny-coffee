import { describe, expect, it } from 'vitest'
import { allocateFifo } from './fifo'

describe('allocateFifo', () => {
  it('uses oldest lots first and reports cost', () => {
    expect(allocateFifo([{ id: 'old', remainingQuantity: 2, unitCost: 10 }, { id: 'new', remainingQuantity: 5, unitCost: 12 }], 4)).toEqual({ allocations: [{ lotId: 'old', quantity: 2, cost: 20 }, { lotId: 'new', quantity: 2, cost: 24 }], shortage: 0, cost: 44 })
  })

  it('reports shortage without inventing stock', () => {
    expect(allocateFifo([{ id: 'only', remainingQuantity: 1, unitCost: 10 }], 3).shortage).toBe(2)
  })
})
