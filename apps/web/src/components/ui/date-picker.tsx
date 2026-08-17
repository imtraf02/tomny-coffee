import * as React from 'react'
import {
  format,
  parseISO,
  isValid,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  addDays,
  isSameDay,
  differenceInCalendarDays,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  IconCalendar,
  IconCalendarEvent,
  IconX,
  IconSparkles,
  IconCheck,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { Calendar } from './calendar'
import { Drawer } from './drawer'
import { PrimaryButton, SecondaryButton } from './button'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
} from './popover'
import type { DateRange } from 'react-day-picker'

export interface DatePickerProps {
  /** Date object value */
  date?: Date
  /** ISO string date value (e.g. "2026-08-15") */
  value?: string
  /** Callback when date object changes */
  onDateChange?: (date: Date | undefined) => void
  /** Callback when ISO date string changes */
  onValueChange?: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  clearable?: boolean
  showPresets?: boolean
  showTodayJump?: boolean
  className?: string
  formatString?: string
  minDate?: Date
  maxDate?: Date
  align?: 'start' | 'center' | 'end'
}

export function DatePicker({
  date: controlledDate,
  value,
  onDateChange,
  onValueChange,
  placeholder = 'Chọn ngày…',
  size = 'sm',
  disabled = false,
  clearable = true,
  showPresets = true,
  showTodayJump = true,
  className,
  formatString = 'dd/MM/yyyy',
  minDate,
  maxDate,
  align = 'start',
}: DatePickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)

  // Resolve selected Date
  const selectedDate = React.useMemo(() => {
    if (controlledDate && isValid(controlledDate)) return controlledDate
    if (value) {
      const parsed = parseISO(value)
      if (isValid(parsed)) return parsed
    }
    return undefined
  }, [controlledDate, value])

  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => selectedDate || new Date(),
  )

  // Sync calendar month when selectedDate changes or when opened
  React.useEffect(() => {
    if (open && selectedDate && isValid(selectedDate)) {
      setCurrentMonth(selectedDate)
    }
  }, [open, selectedDate])

  const handleSelect = (nextDate: Date | undefined) => {
    onDateChange?.(nextDate)
    if (nextDate && isValid(nextDate)) {
      onValueChange?.(format(nextDate, 'yyyy-MM-dd'))
    } else {
      onValueChange?.('')
    }
    setOpen(false)
  }

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation()
    onDateChange?.(undefined)
    onValueChange?.('')
  }

  const handlePresetSelect = (presetDate: Date) => {
    handleSelect(presetDate)
  }

  const displayLabel = React.useMemo(() => {
    if (!selectedDate) return null
    return format(selectedDate, formatString, { locale: vi })
  }, [selectedDate, formatString])

  const fullDisplayLabel = React.useMemo(() => {
    if (!selectedDate) return null
    return format(selectedDate, "EEEE, 'ngày' dd 'thg' MM, yyyy", {
      locale: vi,
    })
  }, [selectedDate])

  const today = new Date()
  const isSelectedToday = selectedDate && isSameDay(selectedDate, today)
  const isSelectedYesterday =
    selectedDate && isSameDay(selectedDate, subDays(today, 1))
  const isSelectedTomorrow =
    selectedDate && isSameDay(selectedDate, addDays(today, 1))

  const triggerClasses = cn(
    'group inline-flex items-center justify-between gap-2 rounded-lg border border-[#ded5cb] bg-white text-[var(--char)] font-medium shadow-2xs transition-all duration-120',
    'hover:border-[var(--stone)] hover:bg-[#faf7f2]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:border-[var(--amber)]',
    'data-[open=true]:border-[var(--ember)] data-[open=true]:ring-2 data-[open=true]:ring-[color-mix(in_srgb,var(--ember)_25%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-[#f4efe8]',
    'select-none cursor-pointer',
    size === 'sm' && 'min-h-8.5 px-2.5 text-xs',
    size === 'md' && 'min-h-9.5 px-3 text-sm',
    size === 'lg' && 'min-h-10.5 px-3.5 text-base',
    className,
  )

  const triggerContent = (
    <>
      <span className="flex items-center gap-1.5 truncate">
        <IconCalendar
          size={size === 'sm' ? 14 : 16}
          stroke={1.8}
          className={cn(
            'shrink-0 transition-colors',
            selectedDate
              ? 'text-[var(--ember)]'
              : 'text-[var(--stone)] group-hover:text-[var(--char)]',
          )}
        />
        <span
          className={cn(
            'truncate font-data text-xs sm:text-[13px]',
            !selectedDate && 'font-sans text-[var(--stone)]',
            selectedDate && 'font-semibold text-[var(--char)]',
          )}
        >
          {displayLabel ?? placeholder}
        </span>
      </span>

      <div className="flex items-center gap-1">
        {clearable && selectedDate && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClear(e as unknown as React.MouseEvent)
              }
            }}
            className="flex size-4 items-center justify-center rounded-full text-[var(--stone)] hover:bg-[#ede5dc] hover:text-[var(--char)] active:scale-95 transition-all"
            aria-label="Xóa ngày đã chọn"
            title="Xóa lựa chọn"
          >
            <IconX size={11} stroke={2.5} />
          </span>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          data-empty={!selectedDate}
          data-open={open}
          className={triggerClasses}
          aria-label={placeholder}
        >
          {triggerContent}
        </button>

        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl">
            {/* Header (No redundant drag handle, no X close button) */}
            <div className="px-5 pt-1.5 pb-2 border-b border-[#ede6de] text-center">
              <h3 className="text-sm font-bold font-display text-[var(--char)] m-0 truncate">
                {fullDisplayLabel ?? 'Chọn ngày'}
              </h3>
              <p className="text-xs text-[var(--ember)] font-semibold mt-0.5">
                {selectedDate
                  ? format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: vi })
                  : 'Chạm lịch để chọn ngày'}
              </p>
            </div>

            {/* Presets */}
            {showPresets && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-2 bg-[#faf7f2] border-b border-[#ede6de] shrink-0 -webkit-overflow-scrolling-touch">
                <button
                  type="button"
                  onClick={() => handlePresetSelect(subDays(today, 1))}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150',
                    isSelectedYesterday
                      ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs font-bold'
                      : 'bg-white text-[#5c5044] border border-[#ded5cb] hover:bg-[#ede5dc]',
                  )}
                >
                  Hôm qua
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect(today)}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150',
                    isSelectedToday
                      ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs font-bold'
                      : 'bg-white text-[#5c5044] border border-[#ded5cb] hover:bg-[#ede5dc]',
                  )}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect(addDays(today, 1))}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150',
                    isSelectedTomorrow
                      ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs font-bold'
                      : 'bg-white text-[#5c5044] border border-[#ded5cb] hover:bg-[#ede5dc]',
                  )}
                >
                  Ngày mai
                </button>
              </div>
            )}

            {/* Calendar (Full width, scales with screen) */}
            <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0 flex justify-center w-full">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full max-w-sm px-1 py-0"
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                showTodayJump={showTodayJump}
                onTodayClick={() => {
                  setCurrentMonth(today)
                  handleSelect(today)
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] border-t border-[#ede6de] bg-[#fffdfa] flex items-center gap-3 shrink-0">
              {selectedDate && (
                <SecondaryButton
                  onClick={() => {
                    onDateChange?.(undefined)
                    onValueChange?.('')
                    setOpen(false)
                  }}
                  className="flex-1 text-xs h-10 font-semibold"
                >
                  Xóa chọn
                </SecondaryButton>
              )}
              <PrimaryButton onClick={() => setOpen(false)} className="flex-1 text-xs h-10 font-bold">
                Đóng
              </PrimaryButton>
            </div>
          </Drawer.Content>
        </Drawer.Root>
      </>
    )
  }

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        data-empty={!selectedDate}
        data-open={open}
        className={triggerClasses}
        aria-label={placeholder}
      >
        {triggerContent}
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverPositioner
          side="bottom"
          align={align}
          sideOffset={4}
          className="z-50 outline-hidden"
        >
          <PopoverPopup className="w-fit min-w-[260px] max-w-[290px] overflow-hidden rounded-xl border border-[#ded1c0] bg-[#fffdfa] p-0 shadow-2xl outline-hidden transition-[opacity,scale] duration-120 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
            {/* Header */}
            <div className="border-b border-[#f0eae1] bg-[#fbf8f4] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <IconCalendarEvent size={15} className="text-[var(--ember)] shrink-0" />
                  <span className="text-xs font-bold text-[var(--char)] truncate capitalize leading-none">
                    {fullDisplayLabel ?? 'Chọn ngày'}
                  </span>
                </div>

                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => handleSelect(undefined)}
                    className="text-[11px] font-semibold text-[var(--stone)] hover:text-[var(--ember)] px-1 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {/* 3 Quick Preset Buttons */}
              {showPresets && (
                <div className="mt-2 grid grid-cols-3 gap-1 pt-2 border-t border-[#ede6dc]/70">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(subDays(today, 1))}
                    className={cn(
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate cursor-pointer',
                      isSelectedYesterday
                        ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)]'
                        : 'bg-white border-[#ded5cb] text-[#5c5044] hover:bg-[var(--crema)] hover:border-[var(--stone)]',
                    )}
                  >
                    Hôm qua
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(today)}
                    className={cn(
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate cursor-pointer',
                      isSelectedToday
                        ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)]'
                        : 'bg-white border-[#ded5cb] text-[#5c5044] hover:bg-[var(--crema)] hover:border-[var(--stone)]',
                    )}
                  >
                    Hôm nay
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(addDays(today, 1))}
                    className={cn(
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate cursor-pointer',
                      isSelectedTomorrow
                        ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)]'
                        : 'bg-white border-[#ded5cb] text-[#5c5044] hover:bg-[var(--crema)] hover:border-[var(--stone)]',
                    )}
                  >
                    Ngày mai
                  </button>
                </div>
              )}
            </div>

            {/* Calendar */}
            <div className="flex justify-center p-1">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
                showTodayJump={showTodayJump}
                onTodayClick={() => {
                  setCurrentMonth(today)
                  handleSelect(today)
                }}
              />
            </div>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}

// -------------------------------------------------------------
// DATE RANGE PICKER (MOBILE DRAWER + DESKTOP POPOVER + DO NOT AUTO CLOSE)
// -------------------------------------------------------------

export interface DateRangeValue {
  from?: Date
  to?: Date
}

export interface DateRangeStringValue {
  from?: string
  to?: string
}

export interface DateRangePickerProps {
  /** Range object value with Date objects */
  range?: DateRangeValue
  /** Range object value with ISO date strings ("YYYY-MM-DD") */
  value?: DateRangeStringValue
  /** Callback when Date objects range changes */
  onRangeChange?: (range: DateRangeValue | undefined) => void
  /** Callback when ISO date strings range changes */
  onValueChange?: (value: DateRangeStringValue) => void
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  clearable?: boolean
  showPresets?: boolean
  numberOfMonths?: 1 | 2
  className?: string
  formatString?: string
  minDate?: Date
  maxDate?: Date
  align?: 'start' | 'center' | 'end'
}

export function DateRangePicker({
  range: controlledRange,
  value,
  onRangeChange,
  onValueChange,
  placeholder = 'Chọn khoảng ngày…',
  size = 'sm',
  disabled = false,
  clearable = true,
  showPresets = true,
  numberOfMonths = 1,
  className,
  formatString = 'dd/MM/yyyy',
  minDate,
  maxDate,
  align = 'start',
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)

  // Resolve selected range
  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    if (controlledRange?.from || controlledRange?.to) {
      return {
        from:
          controlledRange.from && isValid(controlledRange.from)
            ? controlledRange.from
            : undefined,
        to:
          controlledRange.to && isValid(controlledRange.to)
            ? controlledRange.to
            : undefined,
      }
    }
    if (value?.from || value?.to) {
      const fromParsed = value.from ? parseISO(value.from) : undefined
      const toParsed = value.to ? parseISO(value.to) : undefined
      return {
        from: fromParsed && isValid(fromParsed) ? fromParsed : undefined,
        to: toParsed && isValid(toParsed) ? toParsed : undefined,
      }
    }
    return undefined
  }, [controlledRange, value])

  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(
    selectedRange,
  )
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => selectedRange?.from || new Date(),
  )

  // Sync draft when opened or external selectedRange changes
  React.useEffect(() => {
    setDraftRange(selectedRange)
    if (selectedRange?.from && isValid(selectedRange.from)) {
      setCurrentMonth(selectedRange.from)
    }
  }, [selectedRange, open])

  const applyRange = (newRange: DateRange | undefined) => {
    setDraftRange(newRange)
    onRangeChange?.(newRange)
    if (newRange) {
      onValueChange?.({
        from:
          newRange.from && isValid(newRange.from)
            ? format(newRange.from, 'yyyy-MM-dd')
            : '',
        to:
          newRange.to && isValid(newRange.to)
            ? format(newRange.to, 'yyyy-MM-dd')
            : '',
      })
    } else {
      onValueChange?.({ from: '', to: '' })
    }
  }

  // NOTE: When clicking range or dates, DO NOT close the popover/drawer!
  const handleSelect = (nextRange: DateRange | undefined) => {
    setDraftRange(nextRange)
    if (nextRange?.from && nextRange?.to) {
      applyRange(nextRange)
    } else if (nextRange?.from && !nextRange.to) {
      applyRange({ from: nextRange.from, to: undefined })
    } else if (!nextRange) {
      applyRange(undefined)
    }
  }

  const handleClear = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    applyRange(undefined)
  }

  const today = new Date()

  // Preset ranges definitions
  const presets = React.useMemo(
    () => [
      {
        label: 'Hôm nay',
        getRange: () => ({ from: startOfDay(today), to: endOfDay(today) }),
      },
      {
        label: 'Hôm qua',
        getRange: () => {
          const y = subDays(today, 1)
          return { from: startOfDay(y), to: endOfDay(y) }
        },
      },
      {
        label: '7 ngày qua',
        getRange: () => ({
          from: startOfDay(subDays(today, 6)),
          to: endOfDay(today),
        }),
      },
      {
        label: '30 ngày qua',
        getRange: () => ({
          from: startOfDay(subDays(today, 29)),
          to: endOfDay(today),
        }),
      },
      {
        label: 'Tháng này',
        getRange: () => ({ from: startOfMonth(today), to: endOfMonth(today) }),
      },
      {
        label: 'Tháng trước',
        getRange: () => {
          const prev = subMonths(today, 1)
          return { from: startOfMonth(prev), to: endOfMonth(prev) }
        },
      },
    ],
    [today],
  )

  // NOTE: Preset click updates range without closing
  const handleApplyPreset = (presetRange: { from: Date; to: Date }) => {
    applyRange(presetRange)
    setCurrentMonth(presetRange.from)
  }

  // Label formatting
  const displayLabel = React.useMemo(() => {
    if (!selectedRange?.from) return null
    const fromStr = format(selectedRange.from, formatString, { locale: vi })
    if (!selectedRange.to || isSameDay(selectedRange.from, selectedRange.to)) {
      return fromStr
    }
    const toStr = format(selectedRange.to, formatString, { locale: vi })
    return `${fromStr} → ${toStr}`
  }, [selectedRange, formatString])

  const dayCount = React.useMemo(() => {
    if (!draftRange?.from || !draftRange?.to) return null
    const count =
      differenceInCalendarDays(draftRange.to, draftRange.from) + 1
    return count > 0 ? count : null
  }, [draftRange])

  const isPresetActive = (presetRange: { from: Date; to: Date }) => {
    if (!draftRange?.from || !draftRange?.to) return false
    return (
      isSameDay(draftRange.from, presetRange.from) &&
      isSameDay(draftRange.to, presetRange.to)
    )
  }

  const triggerClasses = cn(
    'group inline-flex items-center justify-between gap-2 rounded-lg border border-[#ded5cb] bg-white text-[var(--char)] font-medium shadow-2xs transition-all duration-120',
    'hover:border-[var(--stone)] hover:bg-[#faf7f2]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:border-[var(--amber)]',
    'data-[open=true]:border-[var(--ember)] data-[open=true]:ring-2 data-[open=true]:ring-[color-mix(in_srgb,var(--ember)_25%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-[#f4efe8]',
    'select-none cursor-pointer',
    size === 'sm' && 'min-h-8.5 px-2.5 text-xs',
    size === 'md' && 'min-h-9.5 px-3 text-sm',
    size === 'lg' && 'min-h-10.5 px-3.5 text-base',
    className,
  )

  const triggerContent = (
    <>
      <span className="flex items-center gap-1.5 truncate">
        <IconCalendar
          size={size === 'sm' ? 14 : 16}
          stroke={1.8}
          className={cn(
            'shrink-0 transition-colors',
            selectedRange?.from
              ? 'text-[var(--ember)]'
              : 'text-[var(--stone)] group-hover:text-[var(--char)]',
          )}
        />
        <span
          className={cn(
            'truncate font-data text-xs sm:text-[13px]',
            !selectedRange?.from && 'font-sans text-[var(--stone)]',
            selectedRange?.from && 'font-semibold text-[var(--char)]',
          )}
        >
          {displayLabel ?? placeholder}
        </span>
        {selectedRange?.from && selectedRange?.to && (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-[#ede6dc] text-[#5e5145] font-sans">
            {differenceInCalendarDays(selectedRange.to, selectedRange.from) + 1} ngày
          </span>
        )}
      </span>

      <div className="flex items-center gap-1">
        {clearable && selectedRange?.from && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClear(e as unknown as React.MouseEvent)
              }
            }}
            className="flex size-4 items-center justify-center rounded-full text-[var(--stone)] hover:bg-[#ede5dc] hover:text-[var(--char)] active:scale-95 transition-all"
            aria-label="Xóa khoảng ngày đã chọn"
            title="Xóa lựa chọn"
          >
            <IconX size={11} stroke={2.5} />
          </span>
        )}
      </div>
    </>
  )

  // ==========================================
  // MOBILE: NATIVE BOTTOM SHEET DRAWER
  // ==========================================
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          data-empty={!selectedRange?.from}
          data-open={open}
          className={triggerClasses}
          aria-label={placeholder}
        >
          {triggerContent}
        </button>

        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl">
            {/* Header (No duplicate drag handle, no X close button) */}
            <div className="px-5 pt-1.5 pb-2 border-b border-[#ede6de] text-center">
              <h3 className="text-sm font-bold font-display text-[var(--char)] m-0">
                Chọn khoảng thời gian
              </h3>
              <p className="text-xs text-[var(--ember)] font-semibold mt-0.5">
                {draftRange?.from ? (
                  <>
                    {format(draftRange.from, 'dd/MM/yyyy')}
                    {draftRange.to
                      ? ` → ${format(draftRange.to, 'dd/MM/yyyy')} (${dayCount} ngày)`
                      : ' (chạm tiếp ngày kết thúc)'}
                  </>
                ) : (
                  <span className="text-[#8c8177] font-normal">Chạm lịch để chọn ngày</span>
                )}
              </p>
            </div>

            {/* Presets: Horizontal Scrollable Chips Bar */}
            {showPresets && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-2 bg-[#faf7f2] border-b border-[#ede6de] shrink-0 -webkit-overflow-scrolling-touch">
                {presets.map((preset) => {
                  const presetVal = preset.getRange()
                  const active = isPresetActive(presetVal)
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyPreset(presetVal)}
                      className={cn(
                        'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer',
                        active
                          ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-xs font-bold'
                          : 'bg-white text-[#5c5044] border border-[#ded5cb] hover:bg-[#ede5dc]',
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Calendar (Full width, scales with screen) */}
            <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0 flex justify-center w-full">
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={handleSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full max-w-sm px-1 py-0"
                disabled={[
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]}
              />
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))] border-t border-[#ede6de] bg-[#fffdfa] flex items-center gap-3 shrink-0">
              <SecondaryButton
                onClick={() => handleClear()}
                disabled={!draftRange?.from}
                className="flex-1 text-xs h-10 font-semibold"
              >
                Đặt lại
              </SecondaryButton>
              <PrimaryButton onClick={() => setOpen(false)} className="flex-1 text-xs h-10 font-bold">
                Áp dụng
              </PrimaryButton>
            </div>
          </Drawer.Content>
        </Drawer.Root>
      </>
    )
  }

  // ==========================================
  // DESKTOP: COMPACT POPOVER
  // ==========================================
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        data-empty={!selectedRange?.from}
        data-open={open}
        className={triggerClasses}
        aria-label={placeholder}
      >
        {triggerContent}
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverPositioner
          side="bottom"
          align={align}
          sideOffset={4}
          className="z-50 outline-hidden"
        >
          <PopoverPopup className="w-fit overflow-hidden rounded-xl border border-[#ded1c0] bg-[#fffdfa] p-0 shadow-2xl outline-hidden transition-[opacity,scale] duration-120 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
            {/* Header: Displays active date range + Reset action */}
            <div className="border-b border-[#f0eae1] bg-[#fbf8f4] px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <IconSparkles size={15} className="text-[var(--ember)] shrink-0" />
                <span className="text-xs font-bold font-data text-[var(--char)] truncate leading-none">
                  {draftRange?.from
                    ? `${format(draftRange.from, 'dd/MM/yyyy')} ${
                        draftRange.to
                          ? `→ ${format(draftRange.to, 'dd/MM/yyyy')}`
                          : '(chọn ngày kết thúc)'
                      }`
                    : 'Chưa chọn khoảng ngày'}
                </span>
                {dayCount && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ede6dc] text-[#5e5145] font-sans shrink-0">
                    {dayCount} ngày
                  </span>
                )}
              </div>

              {draftRange?.from && (
                <button
                  type="button"
                  onClick={() => handleClear()}
                  className="text-[11px] font-semibold text-[var(--stone)] hover:text-[var(--ember)] hover:underline px-1 py-0.5 rounded transition-colors shrink-0 cursor-pointer"
                >
                  Đặt lại
                </button>
              )}
            </div>

            {/* Content Body: Sidebar Presets on Left + Calendar on Right */}
            <div className="flex flex-row">
              {showPresets && (
                <div className="w-36 bg-[#faf7f2] border-r border-[#ede6dc] p-2 flex flex-col gap-1 shrink-0">
                  {presets.map((preset) => {
                    const presetVal = preset.getRange()
                    const active = isPresetActive(presetVal)
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPreset(presetVal)}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-between gap-1 select-none cursor-pointer',
                          active
                            ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-2xs font-bold'
                            : 'text-[#5c5044] hover:bg-[#ede5da] hover:text-[var(--char)]',
                        )}
                      >
                        <span className="truncate">{preset.label}</span>
                        {active && (
                          <IconCheck
                            size={13}
                            stroke={3}
                            className="text-[var(--amber)] shrink-0"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Calendar Container */}
              <div className="p-2 flex flex-col items-center">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={handleSelect}
                  numberOfMonths={numberOfMonths}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  disabled={[
                    ...(minDate ? [{ before: minDate }] : []),
                    ...(maxDate ? [{ after: maxDate }] : []),
                  ]}
                />

                {/* Bottom Helper Note if only start date is picked */}
                {draftRange?.from && !draftRange.to && (
                  <div className="w-full border-t border-[#f0eae1] bg-[#fdfaf6] px-3 py-1.5 flex items-center justify-between text-[11px] text-[var(--stone)] mt-0.5 rounded-b-md">
                    <span>Chọn tiếp ngày kết thúc</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (draftRange.from) {
                          applyRange({
                            from: draftRange.from,
                            to: draftRange.from,
                          })
                        }
                      }}
                      className="font-bold text-[var(--ember)] hover:underline cursor-pointer"
                    >
                      Chỉ chọn ngày này
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer with Confirm / Apply Button */}
            <div className="border-t border-[#f0eae1] bg-[#fbf8f4] px-3.5 py-2 flex items-center justify-between gap-2">
              <div className="text-[11px] text-[#8c8177]">
                {draftRange?.from && draftRange?.to ? (
                  <span>
                    Khoảng thời gian: <strong className="text-[var(--char)]">{dayCount} ngày</strong>
                  </span>
                ) : (
                  <span>Click chọn ngày trên lịch</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded-lg bg-[var(--espresso)] text-[var(--crema)] text-xs font-semibold hover:bg-[#3c2c25] active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}