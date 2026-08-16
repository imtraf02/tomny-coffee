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
import { Button } from '@/components/ui/button'
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
    ...actions
  } = props

  return (
    <AlertDialog.Root {...actions}>
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogViewport>
          <AlertDialogPopup className={cn(className)}>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{desc}</AlertDialogDescription>
            {children}
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialogClose disabled={isLoading}>
                {cancelBtnText ?? 'Hủy'}
              </AlertDialogClose>
              <Button
                type={form ? 'submit' : 'button'}
                form={form}
                onClick={handleConfirm}
                variant={destructive ? 'danger' : 'primary'}
                disabled={disabled || isLoading}
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