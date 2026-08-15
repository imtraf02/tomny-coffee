export type FloorPosition = { posX: number; posY: number }

export function clampPercent(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100))
}

export function autoLayoutPositions<T extends { id: string }>(tables: T[]): Map<string, FloorPosition> {
  const result = new Map<string, FloorPosition>()
  if (!tables.length) return result
  const columns = Math.ceil(Math.sqrt(tables.length))
  const rows = Math.ceil(tables.length / columns)
  tables.forEach((table, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    result.set(table.id, {
      posX: clampPercent(((column + 0.5) / columns) * 100),
      posY: clampPercent(((row + 0.5) / rows) * 100),
    })
  })
  return result
}
