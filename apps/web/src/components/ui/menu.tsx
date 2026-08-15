import * as React from 'react'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import { cn } from '@/lib/utils'

function resolveClassName<T>(
  defaultClasses: string,
  className?: string | ((state: T) => string | undefined)
): string | ((state: T) => string | undefined) {
  if (typeof className === 'function') {
    return (state: T) => cn(defaultClasses, className(state))
  }
  return cn(defaultClasses, className)
}

export const MenuRoot = BaseMenu.Root
export const MenuTrigger = BaseMenu.Trigger
export const MenuPortal = BaseMenu.Portal

export const MenuPositioner = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.Positioner>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>
>(({ className, sideOffset = 6, align = 'start', ...props }, ref) => {
  return (
    <BaseMenu.Positioner
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={resolveClassName('z-50 select-none outline-hidden', className)}
      {...props}
    />
  )
})
MenuPositioner.displayName = 'MenuPositioner'

export const MenuPopup = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Popup>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.Popup
      ref={ref}
      className={resolveClassName(
        'min-w-44 origin-[var(--transform-origin)] rounded-xl border border-[#ded1c0] bg-[#fffdf9] p-1.5 text-[#1c1512] shadow-xl outline-hidden transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95',
        className
      )}
      {...props}
    />
  )
})
MenuPopup.displayName = 'MenuPopup'

export const MenuItem = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.Item>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Item>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.Item
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1c1512] outline-hidden select-none transition-colors data-highlighted:bg-[#efe3d0] data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
MenuItem.displayName = 'MenuItem'

export const MenuLinkItem = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.LinkItem>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.LinkItem>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.LinkItem
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1c1512] text-decoration-none outline-hidden select-none transition-colors data-highlighted:bg-[#efe3d0] data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
MenuLinkItem.displayName = 'MenuLinkItem'

export const MenuGroup = BaseMenu.Group

export const MenuGroupLabel = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.GroupLabel>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.GroupLabel
      ref={ref}
      className={resolveClassName(
        'px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#8c8177]',
        className
      )}
      {...props}
    />
  )
})
MenuGroupLabel.displayName = 'MenuGroupLabel'

export const MenuSeparator = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Separator>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.Separator
      ref={ref}
      className={resolveClassName('my-1 h-px bg-[#ded1c0]', className)}
      {...props}
    />
  )
})
MenuSeparator.displayName = 'MenuSeparator'

export const MenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.CheckboxItem>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.CheckboxItem
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-[#1c1512] outline-hidden select-none transition-colors data-highlighted:bg-[#efe3d0] data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
MenuCheckboxItem.displayName = 'MenuCheckboxItem'

export const MenuCheckboxItemIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.CheckboxItemIndicator>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.CheckboxItemIndicator>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseMenu.CheckboxItemIndicator
      ref={ref}
      className={resolveClassName('inline-flex shrink-0 text-[#b0432a]', className)}
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
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
    </BaseMenu.CheckboxItemIndicator>
  )
})
MenuCheckboxItemIndicator.displayName = 'MenuCheckboxItemIndicator'

export const MenuRadioGroup = BaseMenu.RadioGroup

export const MenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.RadioItem>
>(({ className, ...props }, ref) => {
  return (
    <BaseMenu.RadioItem
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-[#1c1512] outline-hidden select-none transition-colors data-highlighted:bg-[#efe3d0] data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
MenuRadioItem.displayName = 'MenuRadioItem'

export const MenuRadioItemIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.RadioItemIndicator>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.RadioItemIndicator>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseMenu.RadioItemIndicator
      ref={ref}
      className={resolveClassName('inline-flex shrink-0 text-[#b0432a]', className)}
      {...props}
    >
      {children || (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="6" />
        </svg>
      )}
    </BaseMenu.RadioItemIndicator>
  )
})
MenuRadioItemIndicator.displayName = 'MenuRadioItemIndicator'

export const MenuSubmenuRoot = BaseMenu.SubmenuRoot
export const MenuSubmenuTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.SubmenuTrigger>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.SubmenuTrigger>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseMenu.SubmenuTrigger
      ref={ref}
      className={resolveClassName(
        'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-[#1c1512] outline-hidden select-none transition-colors data-highlighted:bg-[#efe3d0]',
        className
      )}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </BaseMenu.SubmenuTrigger>
  )
})
MenuSubmenuTrigger.displayName = 'MenuSubmenuTrigger'

export interface MenuContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseMenu.Popup> {
  positionerProps?: React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseMenu.Portal>
}

/**
 * Convenient composite Content wrapper for Dropdown Menu.
 */
export const MenuContent = React.forwardRef<
  React.ComponentRef<typeof BaseMenu.Popup>,
  MenuContentProps
>(({ className, children, positionerProps, portalProps, ...props }, ref) => {
  return (
    <MenuPortal {...portalProps}>
      <MenuPositioner {...positionerProps}>
        <MenuPopup ref={ref} className={className} {...props}>
          {children}
        </MenuPopup>
      </MenuPositioner>
    </MenuPortal>
  )
})
MenuContent.displayName = 'MenuContent'

export const createMenuHandle = BaseMenu.createHandle

export const Menu = Object.assign(MenuRoot, {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Portal: MenuPortal,
  Positioner: MenuPositioner,
  Popup: MenuPopup,
  Content: MenuContent,
  Item: MenuItem,
  LinkItem: MenuLinkItem,
  Group: MenuGroup,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator,
  CheckboxItem: MenuCheckboxItem,
  CheckboxItemIndicator: MenuCheckboxItemIndicator,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  RadioItemIndicator: MenuRadioItemIndicator,
  SubmenuRoot: MenuSubmenuRoot,
  SubmenuTrigger: MenuSubmenuTrigger,
  createHandle: BaseMenu.createHandle,
})
