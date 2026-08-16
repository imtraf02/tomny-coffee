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
import { Calendar } from './calendar'
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

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        data-empty={!selectedDate}
        data-open={open}
        className={cn(
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
        )}
        aria-label={placeholder}
      >
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
                    className="text-[11px] font-semibold text-[var(--stone)] hover:text-[var(--ember)] px-1 py-0.5 rounded transition-colors"
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
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate',
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
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate',
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
                      'h-7 px-1.5 rounded-md text-[11px] font-semibold transition-all border shadow-2xs flex items-center justify-center truncate',
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
// DATE RANGE PICKER (WITH SIDEBAR PRESETS)
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

  const handleSelect = (nextRange: DateRange | undefined) => {
    setDraftRange(nextRange)
    if (nextRange?.from && nextRange?.to) {
      applyRange(nextRange)
      setOpen(false)
    } else if (!nextRange) {
      applyRange(undefined)
    }
  }

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation()
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

  const handleApplyPreset = (presetRange: { from: Date; to: Date }) => {
    applyRange(presetRange)
    setCurrentMonth(presetRange.from)
    setOpen(false)
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
    if (!selectedRange?.from || !selectedRange?.to) return null
    const count =
      differenceInCalendarDays(selectedRange.to, selectedRange.from) + 1
    return count > 0 ? count : null
  }, [selectedRange])

  const isPresetActive = (presetRange: { from: Date; to: Date }) => {
    if (!selectedRange?.from || !selectedRange?.to) return false
    return (
      isSameDay(selectedRange.from, presetRange.from) &&
      isSameDay(selectedRange.to, presetRange.to)
    )
  }

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        data-empty={!selectedRange?.from}
        data-open={open}
        className={cn(
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
        )}
        aria-label={placeholder}
      >
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
          {dayCount && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-[#ede6dc] text-[#5e5145] font-sans">
              {dayCount} ngày
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
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverPositioner
          side="bottom"
          align={align}
          sideOffset={4}
          className="z-50 outline-hidden"
        >
          <PopoverPopup className="w-auto overflow-hidden rounded-xl border border-[#ded1c0] bg-[#fffdfa] p-0 shadow-2xl outline-hidden transition-[opacity,scale] duration-120 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
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
                  onClick={() => handleSelect(undefined)}
                  className="text-[11px] font-semibold text-[var(--stone)] hover:text-[var(--ember)] hover:underline px-1 py-0.5 rounded transition-colors shrink-0"
                >
                  Đặt lại
                </button>
              )}
            </div>

            {/* Content Body: Sidebar Presets on Left + Calendar on Right */}
            <div className="flex flex-col sm:flex-row">
              {showPresets && (
                <div className="w-full sm:w-32 bg-[#faf7f2] border-b sm:border-b-0 sm:border-r border-[#ede6dc] p-2 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible">
                  {presets.map((preset) => {
                    const presetVal = preset.getRange()
                    const active = isPresetActive(presetVal)
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPreset(presetVal)}
                        className={cn(
                          'w-full min-w-fit sm:min-w-0 text-left px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-between gap-1 select-none',
                          active
                            ? 'bg-[var(--espresso)] text-[var(--crema)] shadow-2xs font-bold'
                            : 'text-[#5c5044] hover:bg-[#ede5da] hover:text-[var(--char)]',
                        )}
                      >
                        <span className="truncate">{preset.label}</span>
                        {active && (
                          <IconCheck
                            size={12}
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
              <div className="p-1 flex flex-col items-center">
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
                  <div className="w-full border-t border-[#f0eae1] bg-[#fdfaf6] px-3 py-1.5 flex items-center justify-between text-[11px] text-[var(--stone)] mt-0.5">
                    <span>Chọn tiếp ngày kết thúc</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (draftRange.from) {
                          applyRange({
                            from: draftRange.from,
                            to: draftRange.from,
                          })
                          setOpen(false)
                        }
                      }}
                      className="font-bold text-[var(--ember)] hover:underline"
                    >
                      Chỉ ngày này
                    </button>
                  </div>
                )}
              </div>
            </div>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  )
}