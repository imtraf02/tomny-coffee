import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clampPercent, type FloorPosition } from '../core/floor-layout'

export type FloorTableStatus = 'trong' | 'dang_phuc_vu' | 'dat_truoc' | 'can_don'
export type FloorTable = { id: string; name: string; capacity: number; shape: 'square' | 'round'; status: FloorTableStatus; posX: number; posY: number }

type DragState = { id: string; startX: number; startY: number; original: FloorPosition; halfX: number; halfY: number; moved: boolean }
type Props = {
  tables: FloorTable[]
  selectedTableId?: string | null
  editable?: boolean
  disableReserved?: boolean
  label: string
  onSelect?: (table: FloorTable) => void
  onPositionChange?: (table: FloorTable, position: FloorPosition) => void
}

const labels: Record<FloorTableStatus, string> = { trong: 'Trống', dang_phuc_vu: 'Đang phục vụ', dat_truoc: 'Đặt trước', can_don: 'Cần dọn' }
const GRID_STEP = 5

function snapToGrid(value: number, min: number, max: number) {
  const lowerGrid = Math.ceil(min / GRID_STEP) * GRID_STEP
  const upperGrid = Math.floor(max / GRID_STEP) * GRID_STEP
  if (lowerGrid > upperGrid) return clampPercent(value, min, max)
  return clampPercent(Math.min(upperGrid, Math.max(lowerGrid, Math.round(value / GRID_STEP) * GRID_STEP)), min, max)
}

export function FloorCanvas({ tables, selectedTableId, editable = false, disableReserved = false, label, onSelect, onPositionChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<{ id: string; position: FloorPosition } | null>(null)

  function getPointerPosition(event: PointerEvent<HTMLButtonElement>, halfX: number, halfY: number): FloorPosition | null {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    const minX = (halfX / rect.width) * 100
    const minY = (halfY / rect.height) * 100
    return {
      posX: snapToGrid(((event.clientX - rect.left) / rect.width) * 100, minX, 100 - minX),
      posY: snapToGrid(((event.clientY - rect.top) / rect.height) * 100, minY, 100 - minY),
    }
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, table: FloorTable) {
    if (!editable) return
    const buttonRect = event.currentTarget.getBoundingClientRect()
    dragRef.current = { id: table.id, startX: event.clientX, startY: event.clientY, original: { posX: table.posX, posY: table.posY }, halfX: buttonRect.width / 2, halfY: buttonRect.height / 2, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect?.(table)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true
    const position = getPointerPosition(event, drag.halfX, drag.halfY)
    if (position) setPreview({ id: drag.id, position })
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, table: FloorTable) {
    const drag = dragRef.current
    if (!drag || drag.id !== table.id) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const position = getPointerPosition(event, drag.halfX, drag.halfY) ?? drag.original
    dragRef.current = null
    setPreview(null)
    if (drag.moved && (position.posX !== drag.original.posX || position.posY !== drag.original.posY)) onPositionChange?.(table, position)
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, table: FloorTable) {
    if (!editable) return
    const step = event.shiftKey ? 10 : GRID_STEP
    const deltas: Record<string, FloorPosition> = { ArrowLeft: { posX: -step, posY: 0 }, ArrowRight: { posX: step, posY: 0 }, ArrowUp: { posX: 0, posY: -step }, ArrowDown: { posX: 0, posY: step } }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    onPositionChange?.(table, { posX: clampPercent(table.posX + delta.posX, 2, 98), posY: clampPercent(table.posY + delta.posY, 2, 98) })
  }

  return <div ref={canvasRef} className={`floor-layout-canvas ${editable ? 'is-editable' : 'is-readonly'}`} aria-label={label}>
    {tables.map((table) => {
      const position = preview?.id === table.id ? preview.position : table
      const reserved = disableReserved && table.status === 'dat_truoc'
      return <button key={table.id} type="button" disabled={reserved} onClick={() => onSelect?.(table)} onPointerDown={(event) => beginDrag(event, table)} onPointerMove={moveDrag} onPointerUp={(event) => endDrag(event, table)} onPointerCancel={() => { dragRef.current = null; setPreview(null) }} onKeyDown={(event) => moveWithKeyboard(event, table)} className={`floor-layout-table is-${table.status} ${table.shape === 'round' ? 'is-round' : ''} ${selectedTableId === table.id ? 'is-selected' : ''} ${preview?.id === table.id ? 'is-dragging' : ''}`} style={{ left: `${position.posX}%`, top: `${position.posY}%` }} aria-label={`${table.name}, ${labels[table.status]}, ${table.capacity} chỗ${editable ? '. Dùng mũi tên để dịch chuyển theo lưới.' : ''}`}>
        <strong>{table.name}</strong><span>{table.capacity} chỗ</span><em>{labels[table.status]}</em>
      </button>
    })}
  </div>
}
