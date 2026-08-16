import { describe, expect, it } from 'vitest'
import { calculateTotal } from './money'

describe('calculateTotal', () => {
  it('caps a percentage discount at the subtotal', () => {
    expect(calculateTotal(100_000, { type: 'percent', value: 20 })).toEqual({ subtotal: 100_000, discountAmount: 20_000, total: 80_000 })
    expect(calculateTotal(100_000, { type: 'percent', value: 120 })).toEqual({ subtotal: 100_000, discountAmount: 100_000, total: 0 })
  })

  it('caps a fixed discount and never returns a negative total', () => {
    expect(calculateTotal(100_000, { type: 'fixed', value: 25_000 }).total).toBe(75_000)
    expect(calculateTotal(100_000, { type: 'fixed', value: 200_000 }).total).toBe(0)
  })
})
