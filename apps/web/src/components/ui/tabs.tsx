import * as React from 'react'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
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

/**
 * Root container for tabs.
 */
export const TabsRoot = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Root>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Root>
>(({ className, ...props }, ref) => {
  return (
    <BaseTabs.Root
      ref={ref}
      className={resolveClassName('flex flex-col gap-2 w-full', className)}
      {...props}
    />
  )
})
TabsRoot.displayName = 'TabsRoot'

/**
 * The container list for Tab buttons.
 */
export const TabsList = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.List>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.List>
>(({ className, ...props }, ref) => {
  return (
    <BaseTabs.List
      ref={ref}
      className={resolveClassName(
        'relative inline-flex items-center gap-1.5 border-b border-[#ded1c0] pb-1 overflow-x-auto text-[#8c8177]',
        className
      )}
      {...props}
    />
  )
})
TabsList.displayName = 'TabsList'

/**
 * An individual tab button.
 */
export const TabsTab = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Tab>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Tab>
>(({ className, ...props }, ref) => {
  return (
    <BaseTabs.Tab
      ref={ref}
      className={resolveClassName(
        'relative inline-flex min-h-9 items-center justify-center rounded-sm px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors outline-hidden select-none hover:text-[#1c1512] focus-visible:outline-2 focus-visible:outline-[#c48a2e] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 data-active:text-[#1c1512] data-active:bg-[#efe3d0]/60',
        className
      )}
      {...props}
    />
  )
})
TabsTab.displayName = 'TabsTab'

/**
 * Alias for TabsTab (shadcn compatible).
 */
export const TabsTrigger = TabsTab

/**
 * Visual sliding indicator for the active tab.
 */
export const TabsIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Indicator>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Indicator>
>(({ className, ...props }, ref) => {
  return (
    <BaseTabs.Indicator
      ref={ref}
      className={resolveClassName(
        'absolute bottom-0 left-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] bg-[#b0432a] transition-[translate,width] duration-200 ease-out',
        className
      )}
      {...props}
    />
  )
})
TabsIndicator.displayName = 'TabsIndicator'

/**
 * The content panel associated with an active tab value.
 */
export const TabsPanel = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Panel>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Panel>
>(({ className, ...props }, ref) => {
  return (
    <BaseTabs.Panel
      ref={ref}
      className={resolveClassName(
        'mt-2 outline-hidden focus-visible:outline-2 focus-visible:outline-[#c48a2e] focus-visible:outline-offset-2 [[hidden]]:hidden',
        className
      )}
      {...props}
    />
  )
})
TabsPanel.displayName = 'TabsPanel'

/**
 * Alias for TabsPanel (shadcn compatible).
 */
export const TabsContent = TabsPanel

/**
 * Composite Tabs object.
 */
export const Tabs = Object.assign(TabsRoot, {
  Root: TabsRoot,
  List: TabsList,
  Tab: TabsTab,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
  Content: TabsContent,
  Indicator: TabsIndicator,
})
