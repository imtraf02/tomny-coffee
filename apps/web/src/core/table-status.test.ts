import { describe, expect, it } from 'vitest'
import { deriveTableStatus, overlapsTimeRange } from './table-status'

describe('table status', () => {
  it('keeps serving visible when an old reservation is still present', () => {
    expect(deriveTableStatus({ hasOpenOrder: true, hasActiveMaintenance: false, hasActiveCleaning: false, hasActiveReservation: true, hasReservedHold: false })).toBe('serving')
  })

  it('prioritizes maintenance for an inconsistent state', () => {
    expect(deriveTableStatus({ hasOpenOrder: true, hasActiveMaintenance: true, hasActiveCleaning: false, hasActiveReservation: false, hasReservedHold: false })).toBe('maintenance')
  })

  it('uses half-open time intervals for reservation conflicts', () => {
    expect(overlapsTimeRange(10, 20, 20, 30)).toBe(false)
    expect(overlapsTimeRange(10, 20, 19, 30)).toBe(true)
  })
})
