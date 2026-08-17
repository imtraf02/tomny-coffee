import * as React from 'react'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog'
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from './drawer'

export interface ResponsiveDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerRoot open={open} onOpenChange={onOpenChange}>
        {children}
      </DrawerRoot>
    )
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogRoot>
  )
}

export function ResponsiveDialogTrigger(
  props: React.ComponentPropsWithoutRef<typeof DialogTrigger> & React.ComponentPropsWithoutRef<typeof DrawerTrigger>,
) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerTrigger {...(props as any)} />
  }
  return <DialogTrigger {...props} />
}

export interface ResponsiveDialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  backdropClassName?: string
  showCloseButton?: boolean
  children?: React.ReactNode
}

export const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  ResponsiveDialogContentProps
>(({ className, children, showCloseButton = true, backdropClassName, ...props }, ref) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerContent
        ref={ref}
        className={className}
        backdropClassName={backdropClassName}
        showCloseButton={showCloseButton}
        {...props}
      >
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogContent
      ref={ref}
      className={className}
      backdropClassName={backdropClassName}
      showCloseButton={showCloseButton}
      {...props}
    >
      {children}
    </DialogContent>
  )
})
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent'

export function ResponsiveDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerHeader className={className} {...props} />
  }
  return <DialogHeader className={className} {...props} />
}

export function ResponsiveDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerFooter className={className} {...props} />
  }
  return <DialogFooter className={className} {...props} />
}

export function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogTitle>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerTitle className={className} {...props} />
  }
  return <DialogTitle className={className} {...props} />
}

export function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogDescription>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerDescription className={className} {...props} />
  }
  return <DialogDescription className={className} {...props} />
}

export function ResponsiveDialogClose({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogClose>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerClose className={className} {...props} />
  }
  return <DialogClose className={className} {...props} />
}

export function ResponsiveDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerBody className={className} {...props} />
  }
  return <div className={cn('flex flex-col gap-3 my-2', className)} {...props} />
}
