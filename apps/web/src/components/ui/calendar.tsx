import * as React from 'react'
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from 'react-day-picker'
import { vi } from 'date-fns/locale'
import { IconChevronLeft, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /** Optional quick action to jump to today */
  showTodayJump?: boolean
  /** Callback when user clicks 'Hôm nay' */
  onTodayClick?: () => void
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  locale = vi,
  formatters,
  components,
  showTodayJump = false,
  onTodayClick,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <div data-slot="calendar" className={cn('flex flex-col items-center w-full', className)}>
      <DayPicker
        locale={locale}
        showOutsideDays={showOutsideDays}
        className={cn(
          'group/calendar w-full p-1 [--cell-size:2.5rem] font-sans select-none',
          '[&_table]:w-full [&_table]:border-collapse [&_table]:border-0 [&_table]:m-0 [&_table]:table-fixed',
          '[&_thead]:border-0 [&_thead]:m-0 [&_thead]:p-0',
          '[&_tbody]:border-0 [&_tbody]:m-0 [&_tbody]:p-0',
          '[&_tr]:border-0 [&_tr]:m-0 [&_tr]:p-0 [&_tr]:flex [&_tr]:w-full [&_tr]:justify-between',
          '[&_th]:p-0! [&_th]:border-0! [&_th]:m-0! [&_th]:font-normal [&_th]:text-center [&_th]:flex-1',
          '[&_td]:p-0! [&_td]:border-0! [&_td]:m-0! [&_td]:text-center [&_td]:align-middle [&_td]:flex-1',
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className,
        )}
        captionLayout={captionLayout}
        formatters={{
          formatMonthDropdown: (date) =>
            date.toLocaleString('vi-VN', { month: 'short' }),
          formatCaption: (date) =>
            `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`,
          formatWeekdayName: (date) => {
            const day = date.getDay()
            return day === 0 ? 'CN' : `T${day + 1}`
          },
          ...formatters,
        }}
        classNames={{
          root: cn('w-full', defaultClassNames.root),
          months: cn(
            'relative flex flex-col gap-3 sm:flex-row sm:gap-4 w-full',
            defaultClassNames.months,
          ),
          month: cn('flex w-full flex-col gap-2', defaultClassNames.month),
          nav: cn(
            'absolute inset-x-0 top-0 flex w-full items-center justify-between z-10 pointer-events-none px-0.5',
            defaultClassNames.nav,
          ),
          button_previous: cn(
            'pointer-events-auto flex size-8 items-center justify-center rounded-xl border border-[#ded5cb] bg-white text-[var(--char)] shadow-2xs transition-all duration-120 select-none hover:bg-[var(--crema)] hover:border-[var(--stone)] active:scale-90 aria-disabled:opacity-30 aria-disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--amber)] cursor-pointer',
            defaultClassNames.button_previous,
          ),
          button_next: cn(
            'pointer-events-auto flex size-8 items-center justify-center rounded-xl border border-[#ded5cb] bg-white text-[var(--char)] shadow-2xs transition-all duration-120 select-none hover:bg-[var(--crema)] hover:border-[var(--stone)] active:scale-90 aria-disabled:opacity-30 aria-disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--amber)] cursor-pointer',
            defaultClassNames.button_next,
          ),
          month_caption: cn(
            'flex h-8 w-full items-center justify-center px-10 font-bold text-sm text-[var(--char)] tracking-tight select-none',
            defaultClassNames.month_caption,
          ),
          dropdowns: cn(
            'flex h-8 w-full items-center justify-center gap-1 text-xs font-semibold',
            defaultClassNames.dropdowns,
          ),
          dropdown_root: cn(
            'relative rounded border border-[#d9d0c8] bg-white shadow-2xs has-focus:border-[var(--ember)] has-focus:ring-1 has-focus:ring-[var(--amber)]',
            defaultClassNames.dropdown_root,
          ),
          dropdown: cn(
            'absolute inset-0 bg-[#fffdf9] opacity-0 cursor-pointer',
            defaultClassNames.dropdown,
          ),
          caption_label: cn(
            'font-bold select-none text-sm text-[var(--char)] tracking-tight',
            defaultClassNames.caption_label,
          ),
          month_grid: cn('w-full border-collapse border-spacing-0 border-0 m-0 table-fixed', defaultClassNames.month_grid),
          weekdays: cn('flex w-full justify-between border-b border-[#f0eae1] pb-1.5 mb-1.5 border-0 p-0 m-0', defaultClassNames.weekdays),
          weekday: cn(
            'flex-1 text-center text-xs font-bold text-[var(--stone)] select-none uppercase tracking-wide py-1 p-0! border-0! m-0!',
            defaultClassNames.weekday,
          ),
          week: cn('mt-1 flex w-full justify-between border-0! p-0! m-0!', defaultClassNames.week),
          week_number_header: cn(
            'w-(--cell-size) select-none text-[0.65rem] font-medium text-[var(--stone)]',
            defaultClassNames.week_number_header,
          ),
          week_number: cn(
            'text-[0.7rem] font-data text-[var(--stone)] select-none opacity-60 flex items-center justify-center',
            defaultClassNames.week_number,
          ),
          day: cn(
            'group/day relative flex-1 aspect-square p-0! m-0! border-0! text-center align-middle select-none flex items-center justify-center',
            defaultClassNames.day,
          ),
          range_start: cn(
            'rounded-l-xl bg-[#f4ede3]',
            defaultClassNames.range_start,
          ),
          range_middle: cn(
            'rounded-none bg-[#f4ede3] text-[var(--char)]',
            defaultClassNames.range_middle,
          ),
          range_end: cn(
            'rounded-r-xl bg-[#f4ede3]',
            defaultClassNames.range_end,
          ),
          today: cn(
            'font-bold',
            defaultClassNames.today,
          ),
          outside: cn(
            'text-[var(--stone)] opacity-30 aria-selected:text-[var(--stone)] aria-selected:opacity-50',
            defaultClassNames.outside,
          ),
          disabled: cn(
            'text-[var(--stone)] opacity-20 cursor-not-allowed line-through',
            defaultClassNames.disabled,
          ),
          hidden: cn('invisible', defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: ({ className, rootRef, ...props }) => {
            return (
              <div
                data-slot="calendar"
                ref={rootRef}
                className={cn('w-full', className)}
                {...props}
              />
            )
          },
          Chevron: ({ className, orientation, ...props }) => {
            if (orientation === 'left') {
              return (
                <IconChevronLeft
                  size={16}
                  stroke={2.2}
                  className={cn('text-[var(--char)] shrink-0', className)}
                  {...props}
                />
              )
            }

            if (orientation === 'right') {
              return (
                <IconChevronRight
                  size={16}
                  stroke={2.2}
                  className={cn('text-[var(--char)] shrink-0', className)}
                  {...props}
                />
              )
            }

            return (
              <IconChevronDown
                size={13}
                stroke={2.2}
                className={cn('text-[var(--stone)] shrink-0', className)}
                {...props}
              />
            )
          },
          DayButton: CalendarDayButton,
          WeekNumber: ({ children, ...props }) => {
            return (
              <td {...props}>
                <div className="flex size-full items-center justify-center text-center">
                  {children}
                </div>
              </td>
            )
          },
          ...components,
        }}
        {...props}
      />

      {showTodayJump && (
        <div className="w-full pt-2 mt-2 border-t border-[#f0eae1] flex items-center justify-between px-2">
          <button
            type="button"
            onClick={onTodayClick}
            className="text-xs font-semibold text-[var(--ember)] hover:text-[#90341e] hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-[var(--amber)] rounded px-1.5 py-0.5 cursor-pointer"
          >
            Hôm nay
          </button>
          <span className="text-xs text-[var(--stone)] font-mono">
            {new Date().toLocaleDateString('vi-VN')}
          </span>
        </div>
      )}
    </div>
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const isToday = modifiers.today
  const isSelected = modifiers.selected
  const isRangeStart = modifiers.range_start
  const isRangeEnd = modifiers.range_end
  const isRangeMiddle = modifiers.range_middle

  // If both start & end, or only start is selected without middle/end, it's a single day selection
  const isSingleDay =
    (isRangeStart && isRangeEnd) ||
    (isRangeStart && !isRangeMiddle && !isRangeEnd) ||
    (isSelected && !isRangeStart && !isRangeEnd && !isRangeMiddle)

  const isTrueRangeStart = isRangeStart && !isSingleDay
  const isTrueRangeEnd = isRangeEnd && !isSingleDay

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSingleDay}
      data-range-start={isTrueRangeStart}
      data-range-end={isTrueRangeEnd}
      data-range-middle={isRangeMiddle}
      data-today={isToday}
      className={cn(
        'relative flex size-full max-w-[42px] max-h-[42px] aspect-square items-center justify-center rounded-xl text-xs sm:text-sm font-semibold leading-none transition-all duration-100 select-none cursor-pointer',
        'hover:bg-[#f2ece2] hover:text-[var(--char)] active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]',
        // Today styling (when unselected)
        isToday &&
          !isSingleDay &&
          !isTrueRangeStart &&
          !isTrueRangeEnd &&
          !isRangeMiddle &&
          'font-bold text-[var(--ember)] bg-[#faf5ed] border border-[#e4d8c8]',
        // Range Middle
        'data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-[#f4ede3] data-[range-middle=true]:text-[var(--char)] data-[range-middle=true]:font-bold',
        // Range Start
        'data-[range-start=true]:rounded-l-xl data-[range-start=true]:rounded-r-none data-[range-start=true]:bg-[var(--ember)] data-[range-start=true]:text-white data-[range-start=true]:font-bold data-[range-start=true]:shadow-xs',
        // Range End
        'data-[range-end=true]:rounded-r-xl data-[range-end=true]:rounded-l-none data-[range-end=true]:bg-[var(--ember)] data-[range-end=true]:text-white data-[range-end=true]:font-bold data-[range-end=true]:shadow-xs',
        // Single Selected (or range where start === end)
        'data-[selected-single=true]:rounded-xl data-[selected-single=true]:bg-[var(--ember)] data-[selected-single=true]:text-white data-[selected-single=true]:font-bold data-[selected-single=true]:shadow-xs data-[selected-single=true]:scale-105',
        defaultClassNames.day,
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center font-sans">
        {props.children}
      </span>
      {/* Today indicator dot if selected */}
      {isToday && (isSingleDay || isTrueRangeStart || isTrueRangeEnd) && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-white/90" />
      )}
    </button>
  )
}

export { Calendar, CalendarDayButton }