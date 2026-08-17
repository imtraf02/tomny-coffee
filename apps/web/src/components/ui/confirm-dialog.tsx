import * as React from 'react'
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogViewport,
} from '@/components/ui/alert-dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  disabled?: boolean
  desc: React.ReactElement | string
  cancelBtnText?: string
  confirmText?: React.ReactNode
  destructive?: boolean
  isLoading?: boolean
  className?: string
  children?: React.ReactNode
} & (
  | { form: string; handleConfirm?: undefined }
  | { form?: undefined; handleConfirm: () => void }
)

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title,
    desc,
    children,
    className,
    confirmText,
    cancelBtnText,
    destructive,
    isLoading,
    disabled = false,
    form,
    handleConfirm,
    open,
    onOpenChange,
  } = props

  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn('p-0 pb-6', className)}>
          <DrawerHeader className="px-5 pt-3 pb-2 text-left">
            <DrawerTitle className="text-base font-bold text-[var(--char)]">
              {title}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-[var(--stone)] mt-1">
              {desc}
            </DrawerDescription>
          </DrawerHeader>
          {children && <DrawerBody className="px-5 py-2">{children}</DrawerBody>}
          <DrawerFooter className="px-5 pt-3 flex flex-col gap-2">
            <Button
              type={form ? 'submit' : 'button'}
              form={form}
              onClick={handleConfirm}
              variant={destructive ? 'danger' : 'primary'}
              disabled={disabled || isLoading}
              className="w-full h-11 text-sm font-bold rounded-xl shadow-xs"
            >
              {confirmText ?? 'Xác nhận'}
            </Button>
            <DrawerClose
              className="w-full h-11 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs sm:text-sm shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              disabled={isLoading}
            >
              {cancelBtnText ?? 'Hủy'}
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer.Root>
    )
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogViewport>
          <AlertDialogPopup className={cn('rounded-2xl border border-[#ded6cc] shadow-2xl p-6 bg-[#fffdf9]', className)}>
            <AlertDialogTitle className="text-xl font-bold font-display text-[var(--char)]">{title}</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm leading-relaxed text-[var(--stone)]">{desc}</AlertDialogDescription>
            {children}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <AlertDialogClose
                disabled={isLoading}
                className="h-9 px-4 text-xs sm:text-sm font-bold rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {cancelBtnText ?? 'Hủy'}
              </AlertDialogClose>
              <Button
                type={form ? 'submit' : 'button'}
                form={form}
                onClick={handleConfirm}
                variant={destructive ? 'danger' : 'primary'}
                disabled={disabled || isLoading}
                className="h-9 px-4 text-xs sm:text-sm font-bold rounded-xl shadow-xs"
              >
                {confirmText ?? 'Xác nhận'}
              </Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogViewport>
      </AlertDialogPortal>
    </AlertDialog.Root>
  )
}