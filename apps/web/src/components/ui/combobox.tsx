import * as React from 'react'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { resolveClassName } from './_utils'

export const ComboboxRoot = BaseCombobox.Root

export const ComboboxLabel = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Label>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Label>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Label
    ref={ref}
    className={resolveClassName('mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--stone)]', className)}
    {...props}
  />
))
ComboboxLabel.displayName = 'ComboboxLabel'

export const ComboboxInput = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Input>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Input>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Input
    ref={ref}
    className={resolveClassName(
      'min-h-11 w-full rounded-[var(--radius-sm)] border border-[#d9d0c8] bg-white px-3 text-sm text-[var(--char)] outline-hidden placeholder:text-[var(--stone)] focus:border-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-1',
      className,
    )}
    {...props}
  />
))
ComboboxInput.displayName = 'ComboboxInput'

export const ComboboxInputGroup = BaseCombobox.InputGroup
export const ComboboxTrigger = BaseCombobox.Trigger
export const ComboboxValue = BaseCombobox.Value
export const ComboboxPortal = BaseCombobox.Portal
export const ComboboxPositioner = BaseCombobox.Positioner

export const ComboboxPopup = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Popup>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Popup
    ref={ref}
    className={resolveClassName(
      'z-50 min-w-[var(--anchor-width)] overflow-hidden rounded-[var(--radius-lg)] border border-[#ded1c0] bg-[#fffdf9] p-1 text-[var(--char)] shadow-xl outline-hidden',
      className,
    )}
    {...props}
  />
))
ComboboxPopup.displayName = 'ComboboxPopup'

export const ComboboxList = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.List>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.List>
>(({ className, ...props }, ref) => (
  <BaseCombobox.List
    ref={ref}
    className={resolveClassName('max-h-64 overflow-y-auto py-1 outline-hidden', className)}
    {...props}
  />
))
ComboboxList.displayName = 'ComboboxList'

export const ComboboxItem = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Item>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Item>
>(({ className, children, ...props }, ref) => (
  <BaseCombobox.Item
    ref={ref}
    className={resolveClassName(
      'relative flex cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm outline-hidden data-highlighted:bg-[var(--crema)] data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
  </BaseCombobox.Item>
))
ComboboxItem.displayName = 'ComboboxItem'

export const ComboboxItemIndicator = BaseCombobox.ItemIndicator
export const ComboboxEmpty = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Empty>,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Empty>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Empty
    ref={ref}
    className={resolveClassName('px-3 py-4 text-center text-xs text-[var(--stone)]', className)}
    {...props}
  />
))
ComboboxEmpty.displayName = 'ComboboxEmpty'

export const ComboboxGroup = BaseCombobox.Group
export const ComboboxGroupLabel = BaseCombobox.GroupLabel
export const ComboboxStatus = BaseCombobox.Status
export const ComboboxClear = BaseCombobox.Clear
export const ComboboxIcon = BaseCombobox.Icon
export const ComboboxSeparator = BaseCombobox.Separator
export const useComboboxFilter = BaseCombobox.useFilter
export const useFilteredItems = BaseCombobox.useFilteredItems

export interface ComboboxContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseCombobox.Popup> {
  positionerProps?: React.ComponentPropsWithoutRef<typeof BaseCombobox.Positioner>
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseCombobox.Portal>
}

export const ComboboxContent = React.forwardRef<
  React.ComponentRef<typeof BaseCombobox.Popup>,
  ComboboxContentProps
>(({ className, children, positionerProps, portalProps, ...props }, ref) => (
  <ComboboxPortal {...portalProps}>
    <ComboboxPositioner {...positionerProps}>
      <ComboboxPopup ref={ref} className={className} {...props}>
        <ComboboxList>{children}</ComboboxList>
      </ComboboxPopup>
    </ComboboxPositioner>
  </ComboboxPortal>
))
ComboboxContent.displayName = 'ComboboxContent'

export const Combobox = Object.assign(ComboboxRoot, {
  Root: ComboboxRoot,
  Label: ComboboxLabel,
  Input: ComboboxInput,
  InputGroup: ComboboxInputGroup,
  Trigger: ComboboxTrigger,
  Value: ComboboxValue,
  Portal: ComboboxPortal,
  Positioner: ComboboxPositioner,
  Popup: ComboboxPopup,
  Content: ComboboxContent,
  List: ComboboxList,
  Item: ComboboxItem,
  ItemIndicator: ComboboxItemIndicator,
  Empty: ComboboxEmpty,
  Group: ComboboxGroup,
  GroupLabel: ComboboxGroupLabel,
  Status: ComboboxStatus,
  Clear: ComboboxClear,
  Icon: ComboboxIcon,
  Separator: ComboboxSeparator,
  useFilter: useComboboxFilter,
  useFilteredItems,
})

