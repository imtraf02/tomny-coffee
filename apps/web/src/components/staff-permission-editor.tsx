import { useMemo, useState } from 'react'
import { IconShieldCheck, IconX } from '@tabler/icons-react'
import { Checkbox } from './ui/checkbox'
import { Dialog } from './ui/dialog'
import { Drawer } from './ui/drawer'
import { Button, PrimaryButton } from './ui/button'
import { useIsMobile } from '@/lib/use-mobile'

type StaffUser = { id: string; username?: string; email?: string; displayName: string; active: boolean; permissions: string[] }
type Permission = { id: string; code: string; label: string }

export const GROUP_TITLES: Record<string, string> = {
  pos: 'POS & Bán hàng',
  menu: 'Sản phẩm & Menu',
  inventory: 'Kho & Nguyên liệu',
  floor_plan: 'Sơ đồ bàn',
  tables: 'Vận hành bàn',
  orders: 'Đơn hàng & Doanh thu',
  staff: 'Nhân sự & Phân quyền',
  payroll: 'Lương nhân viên',
  timeclock: 'Chấm công ca làm',
  reports: 'Báo cáo tài chính',
  audit: 'Nhật ký kiểm toán',
  kds: 'Phòng pha chế (KDS)',
  settings: 'Quản trị hệ thống',
}

export function StaffPermissionEditor({
  user,
  permissions,
  canManage,
  onSave,
}: {
  user: StaffUser
  permissions: Permission[]
  canManage: boolean
  onSave: (input: { action: 'updateUser'; userId: string; active: boolean; permissions: string[] }) => void
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(user.active)
  const [selected, setSelected] = useState(user.permissions)

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>()
    permissions.forEach((permission) => {
      const group = permission.code.split('.')[0] ?? 'khác'
      map.set(group, [...(map.get(group) ?? []), permission])
    })
    return [...map.entries()]
  }, [permissions])

  const openEditor = () => {
    setActive(user.active)
    setSelected(user.permissions)
    setOpen(true)
  }

  const toggle = (code: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...new Set([...current, code])] : current.filter((item) => item !== code)
    )

  const toggleGroup = (groupPermissions: Permission[], checkAll: boolean) => {
    const codes = groupPermissions.map((p) => p.code)
    if (checkAll) {
      setSelected((current) => [...new Set([...current, ...codes])])
    } else {
      setSelected((current) => current.filter((c) => !codes.includes(c)))
    }
  }

  const editorBody = (
    <div className="grid gap-3">
      {/* Account Status Switch */}
      <div className="p-3 bg-[#fffdfa] border border-[#ede6de] rounded-xl flex items-center justify-between">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold select-none">
          <Checkbox
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
          />
          <span>{active ? 'Tài khoản đang hoạt động' : 'Tài khoản đang bị khóa'}</span>
        </label>
        <span className={active ? 'text-xs text-[var(--moss)] font-bold shrink-0' : 'text-xs text-[var(--ember)] font-bold shrink-0'}>
          {active ? '● Hoạt động' : '● Đã khóa'}
        </span>
      </div>

      {/* Categorized Permissions */}
      <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {groups.map(([group, items]) => {
          const allChecked = items.every((i) => selected.includes(i.code))
          return (
            <div key={group} className="border border-[#e5ddd6] rounded-xl p-3 bg-white">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f0ebe4]">
                <span className="text-xs font-bold text-[var(--char)] uppercase tracking-wider">
                  {GROUP_TITLES[group] ?? group}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(items, !allChecked)}
                  className="text-[11px] font-semibold text-[var(--ember)] hover:underline cursor-pointer"
                >
                  {allChecked ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map((permission) => (
                  <label
                    className="flex items-start gap-2 cursor-pointer p-1.5 rounded-md hover:bg-[#faf7f2] select-none"
                    key={permission.code}
                  >
                    <Checkbox
                      checked={selected.includes(permission.code)}
                      onCheckedChange={(checked) => toggle(permission.code, checked === true)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-[var(--char)]">{permission.label}</strong>
                      <small className="block text-[10px] text-[#8c8177] font-mono truncate">{permission.code}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-3 pt-3 border-t border-[#ede6de] flex items-center gap-2">
        {isMobile ? (
          <Drawer.Close className="h-10 px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex-1 flex items-center justify-center">Hủy</Drawer.Close>
        ) : (
          <Dialog.Close className="h-9 px-4 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">Hủy</Dialog.Close>
        )}
        <PrimaryButton
          className={isMobile ? 'flex-1 h-10 text-xs font-bold' : 'h-9 text-xs'}
          onClick={() => {
            onSave({ action: 'updateUser', userId: user.id, active, permissions: selected })
            setOpen(false)
          }}
        >
          Lưu quyền hạn
        </PrimaryButton>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canManage}
        onClick={openEditor}
        className="flex items-center gap-1 text-xs h-8 px-2.5"
      >
        <IconShieldCheck size={14} stroke={1.75} />
        <span>Phân quyền</span>
      </Button>

      {open && (
        isMobile ? (
          <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0 bg-[#fffdf9] rounded-t-3xl border-t border-[#ded1c0] shadow-2xl">
              <div className="px-5 pt-2 pb-3 border-b border-[#ede6de] shrink-0">
                <Drawer.Title className="text-base font-bold font-display text-[var(--char)] m-0 truncate">
                  Phân quyền: {user.displayName}
                </Drawer.Title>
                <Drawer.Description className="text-xs text-[#8c8177] mt-0.5 truncate">
                  @{user.username || (user.email ? user.email.split('@')[0] : 'user')} · Gán quyền theo phân hệ.
                </Drawer.Description>
              </div>
              <Drawer.Body className="px-4 py-3">
                {editorBody}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '680px' }}>
                  <div className="product-mockup-form">
                    <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
                      <div>
                        <Dialog.Title className="product-mockup-heading">
                          Phân quyền: {user.displayName}
                        </Dialog.Title>
                        <Dialog.Description className="text-xs text-[#8c8177] mt-1">
                          @{user.username || (user.email ? user.email.split('@')[0] : 'user')} · Gán quyền chi tiết theo từng phân hệ vận hành.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close aria-label="Đóng" className="dialog-close-btn">
                        <IconX size={18} stroke={1.75} />
                      </Dialog.Close>
                    </div>
                    <div className="mt-4">
                      {editorBody}
                    </div>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}
    </>
  )
}
