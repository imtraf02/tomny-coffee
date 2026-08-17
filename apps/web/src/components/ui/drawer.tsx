import * as React from 'react'
import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/utils'
import { resolveClassName } from './_utils'

export const DrawerRoot = BaseDrawer.Root
export const DrawerProvider = BaseDrawer.Provider
export const DrawerTrigger = BaseDrawer.Trigger
export const DrawerPortal = BaseDrawer.Portal
export const DrawerSwipeArea = BaseDrawer.SwipeArea
export const DrawerVirtualKeyboardProvider = BaseDrawer.VirtualKeyboardProvider
export const DrawerIndent = BaseDrawer.Indent
export const DrawerIndentBackground = BaseDrawer.IndentBackground

export const DrawerBackdrop = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Backdrop
    ref={ref}
    data-slot="drawer-backdrop"
    className={resolveClassName(
      'fixed inset-0 z-50 bg-[#1c1512]/60 backdrop-blur-xs transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0',
      className,
    )}
    {...props}
  />
))
DrawerBackdrop.displayName = 'DrawerBackdrop'

export const DrawerViewport = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Viewport>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Viewport> & {
    direction?: 'bottom' | 'right' | 'left' | 'top'
  }
>(({ className, direction = 'bottom', ...props }, ref) => {
  const positionClass =
    direction === 'right'
      ? 'flex items-stretch justify-end'
      : direction === 'left'
        ? 'flex items-stretch justify-start'
        : direction === 'top'
          ? 'flex items-start justify-center'
          : 'flex items-end justify-center'

  return (
    <BaseDrawer.Viewport
      ref={ref}
      className={resolveClassName(
        cn('fixed inset-0 z-50 pointer-events-none outline-hidden', positionClass),
        className,
      )}
      {...props}
    />
  )
})
DrawerViewport.displayName = 'DrawerViewport'

export const DrawerHandle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      'mx-auto mt-2.5 mb-1.5 h-1.5 w-12 shrink-0 rounded-full bg-[#8c8177]/40 transition-opacity select-none',
      className,
    )}
    {...props}
  />
))
DrawerHandle.displayName = 'DrawerHandle'

export const DrawerPopup = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Popup> & {
    direction?: 'bottom' | 'right' | 'left' | 'top'
  }
>(({ className, direction = 'bottom', ...props }, ref) => {
  const directionClasses =
    direction === 'right'
      ? 'h-full w-full max-w-md border-l border-[#ded1c0] p-0 [transform:translateX(var(--drawer-swipe-movement-x,0px))] data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]'
      : direction === 'left'
        ? 'h-full w-full max-w-md border-r border-[#ded1c0] p-0 [transform:translateX(var(--drawer-swipe-movement-x,0px))] data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)]'
        : direction === 'top'
          ? 'w-full max-h-[85vh] rounded-b-2xl border-b border-[#ded1c0] pt-[calc(1rem+env(safe-area-inset-top,0px))] p-0 [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-ending-style:[transform:translateY(-100%)] data-starting-style:[transform:translateY(-100%)]'
          : 'w-full max-h-[92dvh] rounded-t-3xl border-t border-[#ded1c0] pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]'

  return (
    <BaseDrawer.Popup
      ref={ref}
      data-slot="drawer-popup"
      data-direction={direction}
      className={resolveClassName(
        cn(
          'pointer-events-auto flex flex-col bg-[#fffdf9] text-[var(--char)] shadow-2xl outline-hidden overflow-hidden touch-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform data-swiping:transition-none data-swiping:select-none data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*300ms)]',
          directionClasses,
        ),
        className,
      )}
      {...props}
    />
  )
})
DrawerPopup.displayName = 'DrawerPopup'

export const DrawerHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col gap-1 px-5 pt-2 pb-3 border-b border-[#ded1c0]/50 shrink-0 text-left',
      className,
    )}
    {...props}
  />
))
DrawerHeader.displayName = 'DrawerHeader'

export const DrawerBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-6 min-h-0 touch-auto', className)}
    {...props}
  />
))
DrawerBody.displayName = 'DrawerBody'

export const DrawerFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'mt-auto flex flex-col sm:flex-row gap-2.5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[#ded1c0]/50 shrink-0 bg-inherit/95 backdrop-blur-md',
      className,
    )}
    {...props}
  />
))
DrawerFooter.displayName = 'DrawerFooter'

export const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Title>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Title
    ref={ref}
    className={resolveClassName(
      'text-lg sm:text-xl font-bold tracking-tight text-[var(--char)] font-[var(--font-display,inherit)] glass-text-title',
      className,
    )}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

export const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Description>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Description
    ref={ref}
    className={resolveClassName(
      'text-xs sm:text-sm text-[var(--stone)] leading-relaxed glass-text-desc',
      className,
    )}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

export const DrawerClose = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Close>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Close>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Close
    ref={ref}
    className={resolveClassName(
      'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
DrawerClose.displayName = 'DrawerClose'

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseDrawer.Popup> {
  direction?: 'bottom' | 'right' | 'left' | 'top'
  backdropClassName?: string
  viewportClassName?: string
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseDrawer.Portal>
  showHandle?: boolean
  showCloseButton?: boolean
}

export const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Popup>,
  DrawerContentProps
>(
  (
    {
      className,
      children,
      direction = 'bottom',
      backdropClassName,
      viewportClassName,
      portalProps,
      showHandle = true,
      showCloseButton = false,
      ...props
    },
    ref,
  ) => (
    <DrawerPortal {...portalProps}>
      <DrawerBackdrop className={backdropClassName} />
      <DrawerViewport direction={direction} className={viewportClassName}>
        <DrawerPopup ref={ref} direction={direction} className={className} {...props}>
          {direction === 'bottom' && showHandle && <DrawerHandle />}
          {showCloseButton && (
            <DrawerClose
              className="absolute top-3.5 right-4 inline-flex size-8 items-center justify-center rounded-lg text-[#8c8177] hover:text-[#1c1512] hover:bg-[#efe3d0]/50 transition-colors z-10"
              aria-label="Đóng"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </DrawerClose>
          )}
          <BaseDrawer.Content className="flex flex-col flex-1 overflow-hidden min-h-0">
            {children}
          </BaseDrawer.Content>
        </DrawerPopup>
      </DrawerViewport>
    </DrawerPortal>
  ),
)
DrawerContent.displayName = 'DrawerContent'

export const Drawer = Object.assign(DrawerRoot, {
  Root: DrawerRoot,
  Provider: DrawerProvider,
  Trigger: DrawerTrigger,
  Portal: DrawerPortal,
  Backdrop: DrawerBackdrop,
  Viewport: DrawerViewport,
  Popup: DrawerPopup,
  Content: DrawerContent,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
  Handle: DrawerHandle,
  SwipeArea: DrawerSwipeArea,
  VirtualKeyboardProvider: DrawerVirtualKeyboardProvider,
  Indent: DrawerIndent,
  IndentBackground: DrawerIndentBackground,
  createHandle: BaseDrawer.createHandle,
})
