import * as React from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import { cn } from '@/lib/utils'

/**
 * Helper to resolve className when it's either a string or callback function.
 */
function resolveClassName<T>(
  defaultClasses: string,
  className?: string | ((state: T) => string | undefined)
): string | ((state: T) => string | undefined) {
  if (typeof className === 'function') {
    return (state: T) => cn(defaultClasses, className(state))
  }
  return cn(defaultClasses, className)
}

/**
 * Root component that manages the select state.
 */
export const SelectRoot = BaseSelect.Root

/**
 * Optional label associated with the Select.
 */
export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Label>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Label>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.Label
      ref={ref}
      className={resolveClassName(
        'block text-xs font-bold uppercase tracking-wider text-[var(--stone)] mb-1.5 cursor-default',
        className
      )}
      {...props}
    />
  )
})
SelectLabel.displayName = 'SelectLabel'

/**
 * Trigger button that opens the Select popup dropdown.
 */
export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Trigger> & { size?: 'sm' | 'md' }
>(({ className, size = 'sm', children, ...props }, ref) => {
  return (
    <BaseSelect.Trigger
      ref={ref}
      className={resolveClassName(
        cn(
          'group inline-flex items-center justify-between gap-2.5 rounded-[var(--radius-sm)] border border-[#d9d0c8] bg-white text-[var(--char)] outline-hidden select-none transition-[border-color,background-color,box-shadow] hover:border-[var(--stone)] hover:bg-[#fcfaf7] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:border-[var(--ember)] data-popup-open:bg-[#fdf9f4] data-popup-open:shadow-[0_0_0_3px_rgba(176,67,42,0.08)]',
          size === 'sm' ? 'min-h-10 px-3 py-1.5 text-xs sm:text-sm font-medium' : 'min-h-11 px-3.5 py-2 text-sm font-medium'
        ),
        className
      )}
      {...props}
    >
      {children}
    </BaseSelect.Trigger>
  )
})
SelectTrigger.displayName = 'SelectTrigger'

/**
 * Renders the currently selected value or placeholder.
 */
export const SelectValue = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Value>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Value>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.Value
      ref={ref}
      className={resolveClassName(
        'truncate text-left data-placeholder:text-[var(--stone)]',
        className
      )}
      {...props}
    />
  )
})
SelectValue.displayName = 'SelectValue'

/**
 * Icon container for trigger chevron/caret.
 */
export const SelectIcon = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Icon>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Icon>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.Icon
      ref={ref}
      className={resolveClassName('inline-flex shrink-0 text-[var(--stone)] ml-1 transition-transform duration-150 group-data-popup-open:rotate-180', className)}
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </BaseSelect.Icon>
  )
})
SelectIcon.displayName = 'SelectIcon'

export const SelectPortal = BaseSelect.Portal

/**
 * Positioner for popup placement.
 */
export const SelectPositioner = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Positioner>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Positioner>
>(({ className, sideOffset = 4, ...props }, ref) => {
  return (
    <BaseSelect.Positioner
      ref={ref}
      sideOffset={sideOffset}
      className={resolveClassName('z-50 select-none outline-hidden', className)}
      {...props}
    />
  )
})
SelectPositioner.displayName = 'SelectPositioner'

/**
 * Popup container surface.
 */
export const SelectPopup = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Popup>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.Popup
      ref={ref}
      className={resolveClassName(
        'min-w-[var(--anchor-width)] max-h-72 overflow-hidden rounded-[var(--radius-sm)] border border-[#ded1c0] bg-[#fffdf9] p-1 text-[var(--char)] shadow-xl outline-hidden transition-[opacity,scale] duration-150 ease-out origin-[var(--transform-origin)] data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95',
        className
      )}
      {...props}
    />
  )
})
SelectPopup.displayName = 'SelectPopup'

/**
 * List of select items.
 */
export const SelectList = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.List>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.List>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.List
      ref={ref}
      className={resolveClassName(
        'max-h-[var(--available-height,280px)] overflow-y-auto py-0.5 outline-hidden',
        className
      )}
      {...props}
    />
  )
})
SelectList.displayName = 'SelectList'

/**
 * Group of items.
 */
export const SelectGroup = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Group>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Group>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.Group
      ref={ref}
      className={resolveClassName('p-1', className)}
      {...props}
    />
  )
})
SelectGroup.displayName = 'SelectGroup'

/**
 * Label for a group of items.
 */
export const SelectGroupLabel = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.GroupLabel>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.GroupLabel
      ref={ref}
      className={resolveClassName(
        'px-2.5 py-1.5 text-xs font-semibold text-[var(--stone)]',
        className
      )}
      {...props}
    />
  )
})
SelectGroupLabel.displayName = 'SelectGroupLabel'

/**
 * Individual selectable item.
 */
export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Item>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.Item
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-xs sm:text-sm text-[var(--char)] outline-hidden select-none transition-colors data-highlighted:bg-[var(--crema)] data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </BaseSelect.Item>
  )
})
SelectItem.displayName = 'SelectItem'

/**
 * Text node of the item.
 */
export const SelectItemText = BaseSelect.ItemText

/**
 * Checkmark or active indicator for the selected item.
 */
export const SelectItemIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.ItemIndicator>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.ItemIndicator>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.ItemIndicator
      ref={ref}
      className={resolveClassName('inline-flex shrink-0 text-[var(--ember)] ml-2', className)}
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </BaseSelect.ItemIndicator>
  )
})
SelectItemIndicator.displayName = 'SelectItemIndicator'

/**
 * Separator line between items.
 */
export const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Separator>
>(({ className, ...props }, ref) => {
  return (
    <BaseSelect.Separator
      ref={ref}
      className={resolveClassName('my-1 h-px bg-[#ded1c0]', className)}
      {...props}
    />
  )
})
SelectSeparator.displayName = 'SelectSeparator'

export const SelectScrollUpArrow = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.ScrollUpArrow>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.ScrollUpArrow>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.ScrollUpArrow
      ref={ref}
      className={resolveClassName(
        'flex h-5 w-full items-center justify-center bg-[#fffdf9] text-xs text-[var(--stone)]',
        className
      )}
      {...props}
    >
      {children || '▲'}
    </BaseSelect.ScrollUpArrow>
  )
})
SelectScrollUpArrow.displayName = 'SelectScrollUpArrow'

export const SelectScrollDownArrow = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.ScrollDownArrow>,
  React.ComponentPropsWithoutRef<typeof BaseSelect.ScrollDownArrow>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.ScrollDownArrow
      ref={ref}
      className={resolveClassName(
        'flex h-5 w-full items-center justify-center bg-[#fffdf9] text-xs text-[var(--stone)]',
        className
      )}
      {...props}
    >
      {children || '▼'}
    </BaseSelect.ScrollDownArrow>
  )
})
SelectScrollDownArrow.displayName = 'SelectScrollDownArrow'

export interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseSelect.Popup> {
  positionerProps?: React.ComponentPropsWithoutRef<typeof BaseSelect.Positioner>
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseSelect.Portal>
}

/**
 * Convenient composite Content wrapper combining Portal, Positioner, Popup, and List.
 */
export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof BaseSelect.Popup>,
  SelectContentProps
>(({ className, children, positionerProps, portalProps, ...props }, ref) => {
  return (
    <SelectPortal {...portalProps}>
      <SelectPositioner {...positionerProps}>
        <SelectPopup ref={ref} className={className} {...props}>
          <SelectScrollUpArrow />
          <SelectList>{children}</SelectList>
          <SelectScrollDownArrow />
        </SelectPopup>
      </SelectPositioner>
    </SelectPortal>
  )
})
SelectContent.displayName = 'SelectContent'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AppSelectProps {
  items: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  name?: string
  required?: boolean
  className?: string
  triggerClassName?: string
  popupClassName?: string
  size?: 'sm' | 'md'
  'aria-label'?: string
}

/**
 * High-level, ergonomic Select component that binds items to BaseSelect.Root
 * ensuring proper Vietnamese label lookup and clean styling out of the box.
 */
export function AppSelect({
  items,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Chọn…',
  disabled,
  name,
  required,
  className,
  triggerClassName,
  popupClassName,
  size = 'sm',
  'aria-label': ariaLabel,
}: AppSelectProps) {
  return (
    <SelectRoot
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(val) => {
        if (typeof val === 'string' && onValueChange) {
          onValueChange(val)
        }
      }}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectTrigger
        size={size}
        className={cn(triggerClassName, className)}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
        <SelectIcon />
      </SelectTrigger>
      <SelectPortal>
        <SelectPositioner sideOffset={4}>
          <SelectPopup className={cn('min-w-[var(--anchor-width)] max-h-72 overflow-y-auto p-1', popupClassName)}>
            <SelectList>
              {items.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs sm:text-sm rounded-[var(--radius-sm)] cursor-pointer select-none data-highlighted:bg-[var(--crema)] data-disabled:opacity-50"
                >
                  <SelectItemText>{item.label}</SelectItemText>
                  <SelectItemIndicator />
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </SelectRoot>
  )
}

/**
 * Composite Select export.
 */
export const Select = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Icon: SelectIcon,
  Label: SelectLabel,
  Portal: SelectPortal,
  Positioner: SelectPositioner,
  Popup: SelectPopup,
  List: SelectList,
  Item: SelectItem,
  ItemText: SelectItemText,
  ItemIndicator: SelectItemIndicator,
  Group: SelectGroup,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator,
  ScrollUpArrow: SelectScrollUpArrow,
  ScrollDownArrow: SelectScrollDownArrow,
  Content: SelectContent,
  Simple: AppSelect,
})
