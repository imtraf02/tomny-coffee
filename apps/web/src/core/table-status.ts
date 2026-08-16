export type TableOperationalStatus = 'available' | 'serving' | 'reserved' | 'needs_cleaning' | 'maintenance'

export type TableStatusInputs = {
  hasOpenOrder: boolean
  hasActiveMaintenance: boolean
  hasActiveCleaning: boolean
  hasActiveReservation: boolean
  hasReservedHold: boolean
}

/**
 * Runtime status is deliberately derived from orders, reservations and blocks.
 * An inconsistent database state must still render safely: maintenance wins,
 * then an active order, then cleaning, then reservation, then availability.
 */
export function deriveTableStatus(input: TableStatusInputs): TableOperationalStatus {
  if (input.hasActiveMaintenance) return 'maintenance'
  if (input.hasOpenOrder) return 'serving'
  if (input.hasActiveCleaning) return 'needs_cleaning'
  if (input.hasActiveReservation || input.hasReservedHold) return 'reserved'
  return 'available'
}

export const tableStatusLabels: Record<TableOperationalStatus, string> = {
  available: 'Trống',
  serving: 'Đang phục vụ',
  reserved: 'Đặt trước',
  needs_cleaning: 'Cần dọn',
  maintenance: 'Bảo trì',
}

export const tableStatusClasses: Record<TableOperationalStatus, string> = {
  available: 'is-available',
  serving: 'is-serving',
  reserved: 'is-reserved',
  needs_cleaning: 'is-needs-cleaning',
  maintenance: 'is-maintenance',
}

export function overlapsTimeRange(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB
}
