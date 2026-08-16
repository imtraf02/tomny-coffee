import {
  IconPlus,
  IconSearch,
  IconX,
  IconInfoCircle,
  IconPencil,
  IconDotsVertical,
  IconCopy,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconCoffee,
  IconFolderPlus,
  IconToolsKitchen2,
  IconStack2,
} from '@tabler/icons-react'
import { Dialog } from '@/components/ui/dialog'
import { Drawer } from '@/components/ui/drawer'
import { Popover } from '@/components/ui/popover'
import { AppSelect, type SelectOption } from '@/components/ui/select'
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Menu } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import type { CatalogCategory, CatalogCombo, CatalogModifierGroup, CatalogProduct, CatalogVariant } from '../client/outbox'

type AdminCatalog = { categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups: CatalogModifierGroup[]; combos: CatalogCombo[] }
type VariantDraft = Omit<Pick<CatalogVariant, 'id' | 'name' | 'price' | 'active' | 'sortOrder' | 'modifierGroupIds'>, 'id'> & { id?: string }
type ProductDraft = { id?: string; categoryId: string; name: string; description: string; imageKey: string | null; active: boolean; kind?: 'standard' | 'combo'; sortOrder?: number; variants: VariantDraft[] }

const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}₫`
const blankVariant = (sortOrder: number): VariantDraft => ({ name: sortOrder === 0 ? 'Tiêu chuẩn' : `Size ${sortOrder === 1 ? 'M' : sortOrder === 2 ? 'L' : sortOrder + 1}`, price: 0, active: true, sortOrder, modifierGroupIds: [] })

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Trạng thái: Tất cả' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
]

const TrashIcon = <IconTrash size={16} stroke={1.75} className="text-[var(--ember)]" />

async function getCatalog(): Promise<AdminCatalog> {
  const response = await fetch('/api/menu?view=admin')
  if (!response.ok) throw new Error('Không tải được catalog.')
  return response.json() as Promise<AdminCatalog>
}

async function uploadImage(file: File, onProgress: (value: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/media/menu-images')
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onerror = () => reject(new Error('Không thể upload ảnh.'))
    request.onload = () => {
      const body = request.responseText ? JSON.parse(request.responseText) as { key?: string; message?: string } : {}
      if (request.status < 200 || request.status >= 300 || !body.key) reject(new Error(body.message ?? 'Không thể upload ảnh.'))
      else resolve(body.key)
    }
    const data = new FormData(); data.set('file', file); request.send(data)
  })
}

function ModifierGroupPicker({
  groups,
  selectedIds,
  onChange,
  disabled,
}: {
  groups: CatalogModifierGroup[]
  selectedIds: string[]
  onChange: (nextIds: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const activeGroups = groups.filter((g) => g.active)
  const selectedCount = selectedIds.length

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled || !activeGroups.length}
        className={cn(
          'product-modifier-trigger',
          !selectedCount && 'text-[var(--stone)]'
        )}
      >
        <span className="truncate">
          {selectedCount === 0
            ? 'Chọn nhóm tùy chọn'
            : selectedCount === 1
            ? activeGroups.find((g) => g.id === selectedIds[0])?.name ?? '1 nhóm'
            : `${selectedCount} nhóm tùy chọn`}
        </span>
        <span className="text-[10px] text-[var(--stone)] shrink-0">▾</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50 outline-hidden">
          <Popover.Popup className="w-60 p-2 rounded-lg border border-[#ded1c0] bg-[#fffdf9] shadow-xl outline-hidden">
            <Popover.Title className="text-xs font-bold text-[var(--char)] px-1 pb-1.5 border-b border-[#eee6df]">
              Nhóm tùy chọn / Topping
            </Popover.Title>
            <div className="grid gap-1 mt-1.5 max-h-48 overflow-y-auto">
              {!activeGroups.length ? (
                <p className="text-xs text-[var(--stone)] p-1">Chưa có nhóm topping.</p>
              ) : (
                activeGroups.map((group) => {
                  const isChecked = selectedIds.includes(group.id)
                  return (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[#f5eee7] cursor-pointer text-xs select-none"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(group.id)}
                      />
                      <span className="font-semibold text-[var(--char)]">{group.name}</span>
                    </label>
                  )
                })
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function CatalogManager({ canManage = true }: { canManage?: boolean }) {
  const client = useQueryClient()
  const catalog = useQuery({ queryKey: ['menu-catalog', 'admin'], queryFn: getCatalog })
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [catalogAction, setCatalogAction] = useState<'stop' | 'delete' | null>(null)
  const [manageDrawer, setManageDrawer] = useState<'categories' | 'modifiers' | 'combos' | null>(null)
  const [categoryDialog, setCategoryDialog] = useState<CatalogCategory | null | 'new'>(null)
  const [categoryDraft, setCategoryDraft] = useState({ name: '', active: true, sortOrder: 0 })
  const [productDialog, setProductDialog] = useState(false)
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null)
  const [modifierDialog, setModifierDialog] = useState(false)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CatalogModifierGroup | null>(null)
  const [modifierDraft, setModifierDraft] = useState<{ id?: string; name: string; minSelections: number; maxSelections: number; active: boolean; sortOrder: number; modifiers: Array<{ id?: string; name: string; priceDelta: number; active: boolean; sortOrder: number }> }>({ name: '', minSelections: 0, maxSelections: 1, active: true, sortOrder: 0, modifiers: [] })
  const [comboDialog, setComboDialog] = useState(false)
  const [comboDraft, setComboDraft] = useState<{ id?: string; menuItemId: string; price: number; active: boolean; components: Array<{ variantId: string; quantity: number }> }>({ menuItemId: '', price: 0, active: true, components: [] })
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const save = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(((await response.json().catch(() => ({ message: '' }))) as { message?: string }).message || 'Không thể lưu catalog.')
    },
    onSuccess: async (_data, body) => {
      const action = (body as { action?: string }).action
      if (action === 'saveCategory') setCategoryDialog(null)
      else if (action === 'saveProduct') setProductDialog(false)
      else if (action === 'saveModifierGroup') setModifierDialog(false)
      else if (action === 'deleteModifierGroup') setDeleteGroupTarget(null)
      else if (action === 'saveCombo') setComboDialog(false)
      else if (action === 'stopProduct' || action === 'deleteProduct') { setCatalogAction(null); setSelectedProduct(null) }
      await client.invalidateQueries({ queryKey: ['menu-catalog'] })
    },
  })

  const categories = catalog.data?.categories ?? []
  const allProducts = catalog.data?.products ?? []
  const categoryOptions = useMemo(() => categories.map((cat) => ({ value: cat.id, label: cat.name })), [categories])
  const productOptions = useMemo(() => allProducts.map((p) => ({ value: p.id, label: p.name })), [allProducts])

  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('name-asc')

  const products = useMemo(() => {
    const filtered = allProducts.filter((product) => {
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? product.active : !product.active)
      const term = search.trim().toLocaleLowerCase('vi-VN')
      const matchesSearch = !term || `${product.name} ${product.description}`.toLocaleLowerCase('vi-VN').includes(term)
      return matchesCategory && matchesStatus && matchesSearch
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'vi-VN')
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'vi-VN')
      const minPriceA = Math.min(...a.variants.map((v) => v.price), 0)
      const minPriceB = Math.min(...b.variants.map((v) => v.price), 0)
      if (sortBy === 'price-asc') return minPriceA - minPriceB
      if (sortBy === 'price-desc') return minPriceB - minPriceA
      return 0
    })
  }, [allProducts, categoryFilter, search, statusFilter, sortBy])

  const priceHistory = useQuery({
    queryKey: ['menu-price-history', selectedProduct?.variants[0]?.id],
    enabled: Boolean(selectedProduct?.variants[0]?.id),
    queryFn: async () => {
      const response = await fetch(`/api/menu?priceHistoryVariantId=${encodeURIComponent(selectedProduct?.variants[0]?.id ?? '')}`)
      if (!response.ok) throw new Error('Không tải được lịch sử giá.')
      return response.json() as Promise<{ history: Array<{ id: string; oldPrice: number | null; newPrice: number; changedBy: string | null; createdAt: number; changeKind: string }> }>
    },
  })

  function duplicateProduct(product: CatalogProduct) {
    setProductDraft({
      categoryId: product.categoryId,
      name: `${product.name} (Bản sao)`,
      description: product.description,
      imageKey: product.imageKey,
      active: true,
      kind: product.kind,
      sortOrder: allProducts.length,
      variants: product.variants.map((v) => ({
        name: v.name,
        price: v.price,
        active: v.active,
        sortOrder: v.sortOrder,
        modifierGroupIds: v.modifierGroupIds ?? [],
      })),
    })
    setUploadError('')
    setUploadProgress(null)
    setProductDialog(true)
  }

  function toggleProductActive(product: CatalogProduct) {
    save.mutate({
      action: 'saveProduct',
      product: {
        ...product,
        active: !product.active,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          active: v.active,
          sortOrder: v.sortOrder,
          modifierGroupIds: v.modifierGroupIds ?? [],
        })),
      },
    })
  }

  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const columns: ColumnDef<CatalogProduct>[] = [
    {
      header: 'Sản phẩm',
      cell: ({ row }) => (
        <div className="product-table-cell">
          {row.original.imageKey ? (
            <img
              src={`/api/media/menu-images?key=${encodeURIComponent(row.original.imageKey)}`}
              alt=""
              className="product-table-thumb"
            />
          ) : (
            <div className="product-table-thumb-placeholder" aria-hidden="true">
              <IconCoffee size={20} stroke={1.5} className="text-[#a19588]" />
            </div>
          )}
          <div className="product-table-info">
            <strong className="product-table-name">{row.original.name}</strong>
            <small className="product-table-desc">{row.original.description || 'Không có mô tả'}</small>
          </div>
        </div>
      ),
    },
    {
      header: 'Danh mục',
      cell: ({ row }) => (
        <span className="product-table-category">
          {categoryName.get(row.original.categoryId) ?? '—'}
        </span>
      ),
    },
    {
      header: 'Kích cỡ & Giá bán',
      cell: ({ row }) => (
        <div className="product-variants-wrap">
          {row.original.variants.map((variant) => (
            <span key={variant.id} className={cn('variant-tag-chip', !variant.active && 'is-disabled')}>
              <span className="variant-tag-name">{variant.name}</span>
              <strong className="variant-tag-price tabular-nums">{formatMoney(variant.price)}</strong>
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Trạng thái',
      cell: ({ row }) => (
        <span className={cn('catalog-status-pill', row.original.active ? 'is-active' : 'is-inactive')}>
          <span className={cn('catalog-status-dot', row.original.active ? 'dot-active' : 'dot-inactive')} />
          {row.original.active ? 'Đang bán' : 'Ngừng bán'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      cell: ({ row }) => (
        <div className="product-actions-cell" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canManage}
            onClick={() => openProduct(row.original)}
            className="action-edit-btn flex items-center gap-1"
          >
            <IconPencil size={13} stroke={2} />
            <span>Sửa</span>
          </Button>

          <Menu.Root>
            <Menu.Trigger
              disabled={!canManage}
              className="action-more-btn"
              aria-label={`Thao tác khác cho ${row.original.name}`}
            >
              <IconDotsVertical size={16} stroke={1.75} />
            </Menu.Trigger>
            <Menu.Content positionerProps={{ align: 'end' }}>
              <Menu.Item onClick={() => openProduct(row.original)} className="flex items-center gap-2">
                <IconPencil size={15} stroke={1.75} />
                <span>Sửa sản phẩm</span>
              </Menu.Item>
              <Menu.Item onClick={() => duplicateProduct(row.original)} className="flex items-center gap-2">
                <IconCopy size={15} stroke={1.75} />
                <span>Nhân bản sản phẩm</span>
              </Menu.Item>
              <Menu.Item onClick={() => toggleProductActive(row.original)} className="flex items-center gap-2">
                {row.original.active ? <IconEyeOff size={15} stroke={1.75} /> : <IconEye size={15} stroke={1.75} />}
                <span>{row.original.active ? 'Ngừng bán' : 'Bật bán lại'}</span>
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item
                onClick={() => {
                  setSelectedProduct(row.original)
                  setCatalogAction('delete')
                }}
                className="text-[var(--ember)] focus:text-[var(--ember)] flex items-center gap-2"
              >
                <IconTrash size={15} stroke={1.75} />
                <span>Xóa sản phẩm</span>
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      ),
    },
  ]
  const table = useReactTable({ data: products, columns, getCoreRowModel: getCoreRowModel() })

  function openCategory(category?: CatalogCategory) {
    setCategoryDialog(category ?? 'new')
    setCategoryDraft(category ? { name: category.name, active: category.active, sortOrder: category.sortOrder } : { name: '', active: true, sortOrder: categories.length })
  }

  function openProduct(product?: CatalogProduct) {
    const firstCategory = categories[0]?.id ?? ''
    setProductDraft(
      product
        ? { id: product.id, categoryId: product.categoryId, name: product.name, description: product.description, imageKey: product.imageKey, active: product.active, kind: product.kind, sortOrder: product.sortOrder, variants: product.variants.map((variant) => ({ id: variant.id, name: variant.name, price: variant.price, active: variant.active, sortOrder: variant.sortOrder, modifierGroupIds: variant.modifierGroupIds ?? [] })) }
        : { categoryId: firstCategory, name: '', description: '', imageKey: null, active: true, kind: 'standard', sortOrder: products.length, variants: [blankVariant(0)] }
    )
    setUploadError('')
    setUploadProgress(null)
    setProductDialog(true)
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setProductDraft((current) => (current ? { ...current, variants: current.variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)) } : current))
  }

  async function handleFileSelect(file: File) {
    setUploadProgress(0)
    setUploadError('')
    try {
      const key = await uploadImage(file, setUploadProgress)
      setProductDraft((current) => (current ? { ...current, imageKey: key } : current))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Không thể upload ảnh.')
    } finally {
      setUploadProgress(null)
    }
  }

  function openModifierGroup(group?: CatalogModifierGroup) {
    setModifierDraft(
      group
        ? { id: group.id, name: group.name, minSelections: group.minSelections, maxSelections: group.maxSelections, active: group.active, sortOrder: group.sortOrder, modifiers: group.modifiers.map((modifier) => ({ id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta, active: modifier.active, sortOrder: modifier.sortOrder })) }
        : { name: '', minSelections: 0, maxSelections: 1, active: true, sortOrder: catalog.data?.modifierGroups.length ?? 0, modifiers: [{ name: '', priceDelta: 0, active: true, sortOrder: 0 }] }
    )
    setModifierDialog(true)
  }

  function openCombo(combo?: CatalogCombo) {
    const firstProduct = products[0]
    setComboDraft(
      combo
        ? { id: combo.id, menuItemId: combo.menuItemId, price: combo.price, active: combo.active, components: combo.components }
        : { menuItemId: firstProduct?.id ?? '', price: 0, active: true, components: firstProduct?.variants[0] ? [{ variantId: firstProduct.variants[0].id, quantity: 1 }] : [] }
    )
    setComboDialog(true)
  }

  const variantOptions = allProducts.flatMap((product) => product.variants.filter((variant) => variant.active).map((variant) => ({ ...variant, productName: product.name })))
  const comboVariantOptions = useMemo(() => variantOptions.map((v) => ({ value: v.id, label: `${v.productName} · ${v.name}` })), [variantOptions])

  const hasFilterActive = search.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="catalog-workspace grid gap-3.5 sm:gap-5 w-full min-w-0 max-w-full overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full min-w-0 max-w-full">
        <PrimaryButton size="md" disabled={!canManage || !categories.length} onClick={() => openProduct()} className="flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 sm:order-2">
          <IconPlus size={16} stroke={2} />
          <span>Thêm sản phẩm mới</span>
        </PrimaryButton>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 min-w-0 w-full sm:w-auto sm:order-1 -webkit-overflow-scrolling-touch">
          <SecondaryButton size="sm" disabled={!canManage} onClick={() => openCategory()} className="flex items-center gap-1.5 shrink-0 text-xs">
            <IconFolderPlus size={15} stroke={1.75} />
            <span>Danh mục ({categories.length})</span>
          </SecondaryButton>
          <SecondaryButton size="sm" disabled={!canManage} onClick={() => openModifierGroup()} className="flex items-center gap-1.5 shrink-0 text-xs">
            <IconToolsKitchen2 size={15} stroke={1.75} />
            <span>Topping ({catalog.data?.modifierGroups.length ?? 0})</span>
          </SecondaryButton>
          <SecondaryButton size="sm" disabled={!canManage || !variantOptions.length} onClick={() => openCombo()} className="flex items-center gap-1.5 shrink-0 text-xs">
            <IconStack2 size={15} stroke={1.75} />
            <span>Combo ({catalog.data?.combos.length ?? 0})</span>
          </SecondaryButton>
        </div>
      </div>

      {catalog.isLoading && <p className="floor-feedback">Đang tải catalog…</p>}
      {catalog.isError && <p className="floor-feedback is-error">Không tải được catalog. Kiểm tra quyền menu rồi thử lại.</p>}

      {!!catalog.data && (
        <>
          {/* KPI Metrics: 2x2 on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 w-full min-w-0 max-w-full">
            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">Tổng sản phẩm</span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">{allProducts.length}</strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">Tất cả danh mục</small>
            </article>
            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">Đang bán</span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--moss)] truncate">
                {allProducts.filter((product) => product.active).length}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">Sản phẩm hoạt động</small>
            </article>
            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">Ngừng bán</span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--stone)] truncate">
                {allProducts.filter((product) => !product.active).length}
              </strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">Cần kiểm tra lại</small>
            </article>
            <article className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-0.5 shadow-2xs min-w-0 max-w-full overflow-hidden">
              <span className="text-[10.5px] sm:text-xs font-bold text-[#8c8177] uppercase tracking-wider truncate">Danh mục</span>
              <strong className="text-base sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">{categories.length}</strong>
              <small className="text-[10.5px] sm:text-xs text-[#8c8177] truncate">Nhóm món quản lý</small>
            </article>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs w-full min-w-0 max-w-full">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
              <div className="relative flex items-center min-w-0 flex-1">
                <span className="absolute left-3 text-[#8c8177] pointer-events-none" aria-hidden="true">
                  <IconSearch size={16} stroke={1.75} />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo tên món hoặc mô tả..."
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-[#d9d0c8] bg-white text-xs text-[var(--char)] focus:border-[var(--ember)] focus:outline-none transition-colors"
                  aria-label="Tìm sản phẩm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 text-[#8c8177] hover:text-[var(--char)]"
                    aria-label="Xóa tìm kiếm"
                  >
                    <IconX size={15} stroke={2} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <AppSelect
                  size="sm"
                  items={[{ value: 'all', label: 'Danh mục: Tất cả' }, ...categoryOptions]}
                  value={categoryFilter}
                  onValueChange={(val) => setCategoryFilter(val)}
                  aria-label="Lọc theo danh mục"
                  triggerClassName="w-full sm:w-36 bg-white text-xs"
                />

                <AppSelect
                  size="sm"
                  items={STATUS_OPTIONS}
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
                  aria-label="Lọc theo trạng thái"
                  triggerClassName="w-full sm:w-32 bg-white text-xs"
                />
              </div>

              {hasFilterActive && (
                <SecondaryButton size="sm" onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all') }} className="shrink-0 text-xs h-9">
                  Đặt lại
                </SecondaryButton>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Popover.Root>
                <Popover.Trigger className="w-9 h-9 rounded-lg border border-[#d9d0c8] bg-white flex items-center justify-center text-[#8c8177] hover:text-[var(--char)] hover:border-[var(--stone)] transition-colors" aria-label="Xem quy tắc catalog & POS">
                  <IconInfoCircle size={16} stroke={1.75} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner sideOffset={4} className="z-50 outline-hidden">
                    <Popover.Popup className="w-80 p-3.5 rounded-xl border border-[#ded1c0] bg-[#fffdf9] shadow-xl outline-hidden text-xs">
                      <Popover.Title className="font-bold text-[var(--char)] pb-1.5 border-b border-[#ede6de]">
                        Quy tắc catalog & POS
                      </Popover.Title>
                      <Popover.Description className="mt-2 text-[#8c8177] leading-relaxed">
                        Chỉ sản phẩm, kích cỡ và topping có trạng thái <strong>Đang bán</strong> mới xuất hiện trên POS của thu ngân. Giá combo được tính cố định khi thu ngân chọn món.
                      </Popover.Description>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -my-1 w-full min-w-0" role="tablist" aria-label="Lọc nhanh theo danh mục">
            <button
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer border',
                categoryFilter === 'all'
                  ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)]'
                  : 'bg-white text-[#61574f] border-[#d9d0c8] hover:bg-[#faf7f2]'
              )}
              role="tab"
              aria-selected={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            >
              <span>Tất cả</span>
              <span className={cn('px-1.5 py-0.2 rounded-full font-mono text-[10px]', categoryFilter === 'all' ? 'bg-[#3c2c25] text-[#dfd2c4]' : 'bg-[#f0ebe4] text-[#8c8177]')}>
                {allProducts.length}
              </span>
            </button>
            {categories.map((category) => {
              const count = allProducts.filter((p) => p.categoryId === category.id).length
              const isActive = categoryFilter === category.id
              return (
                <button
                  key={category.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer border',
                    isActive
                      ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)]'
                      : 'bg-white text-[#61574f] border-[#d9d0c8] hover:bg-[#faf7f2]'
                  )}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setCategoryFilter(category.id)}
                >
                  <span>{category.name}</span>
                  <span className={cn('px-1.5 py-0.2 rounded-full font-mono text-[10px]', isActive ? 'bg-[#3c2c25] text-[#dfd2c4]' : 'bg-[#f0ebe4] text-[#8c8177]')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Sub-header: Count + Sort Dropdown */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#8c8177] font-medium">
              <strong className="text-[var(--char)] font-bold">{products.length}</strong> sản phẩm phù hợp
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#8c8177] font-medium hidden sm:inline">Sắp xếp:</span>
              <AppSelect
                size="sm"
                items={[
                  { value: 'name-asc', label: 'Tên A–Z' },
                  { value: 'name-desc', label: 'Tên Z–A' },
                  { value: 'price-asc', label: 'Giá thấp → cao' },
                  { value: 'price-desc', label: 'Giá cao → thấp' },
                ]}
                value={sortBy}
                onValueChange={(val) => setSortBy(val as typeof sortBy)}
                aria-label="Sắp xếp sản phẩm"
                triggerClassName="w-36 bg-white text-xs"
              />
            </div>
          </div>

          {/* Empty states or Product Listing */}
          {!categories.length ? (
            <div className="catalog-empty">
              <p>Chưa có danh mục nào.</p>
              <PrimaryButton disabled={!canManage} onClick={() => openCategory()}>
                Tạo danh mục đầu tiên
              </PrimaryButton>
            </div>
          ) : !products.length ? (
            <div className="catalog-empty">
              <p>Không tìm thấy sản phẩm phù hợp.</p>
              <span>Thử xóa bớt bộ lọc hoặc thêm sản phẩm mới.</span>
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 768px) */}
              <div className="desktop-only-table catalog-table-wrap">
                <table>
                  <thead>
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="is-clickable" onClick={() => setSelectedProduct(row.original)}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (< 768px) */}
              <div className="mobile-only-list gap-2.5 w-full min-w-0 max-w-full">
                {products.map((product) => {
                  const categoryName = categories.find((c) => c.id === product.categoryId)?.name ?? 'Chưa phân loại'
                  return (
                    <div
                      key={product.id}
                      className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-2.5 min-w-0 max-w-full overflow-hidden transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {product.imageKey ? (
                            <img
                              src={`/api/media/menu-images?key=${encodeURIComponent(product.imageKey)}`}
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover border border-[#ede6de] shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-[#f7f2eb] border border-[#ede6de] flex items-center justify-center text-[#a19588] shrink-0">
                              <IconCoffee size={20} stroke={1.5} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-[var(--char)] truncate m-0">{product.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-[#61574f] font-medium px-1.5 py-0.2 bg-[#f5efe8] rounded border border-[#ede6de] truncate max-w-[120px]">
                                {categoryName}
                              </span>
                              <span className="text-[10px] text-[#b8ada1]">·</span>
                              <span className={cn('text-[11px] font-semibold flex items-center gap-1 shrink-0', product.active ? 'text-[#2d6a4f]' : 'text-[#8c8177]')}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', product.active ? 'bg-[#22c55e]' : 'bg-[#9ca3af]')} />
                                {product.active ? 'Đang bán' : 'Tạm ẩn'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canManage}
                            onClick={(e) => {
                              e.stopPropagation()
                              openProduct(product)
                            }}
                            className="h-8 px-2.5 text-xs font-semibold text-[var(--char)] bg-[#f5efe8] hover:bg-[#ede5dc] rounded-lg"
                          >
                            <IconPencil size={13} stroke={2} className="mr-1" />
                            Sửa
                          </Button>

                          <Menu.Root>
                            <Menu.Trigger
                              disabled={!canManage}
                              className="w-8 h-8 rounded-lg border border-[#d9d0c8] bg-white flex items-center justify-center text-[var(--char)]"
                              aria-label={`Thao tác khác cho ${product.name}`}
                            >
                              <IconDotsVertical size={15} stroke={1.75} />
                            </Menu.Trigger>
                            <Menu.Content positionerProps={{ align: 'end' }}>
                              <Menu.Item onClick={() => openProduct(product)} className="flex items-center gap-2">
                                <IconPencil size={15} stroke={1.75} />
                                <span>Sửa sản phẩm</span>
                              </Menu.Item>
                              <Menu.Item onClick={() => duplicateProduct(product)} className="flex items-center gap-2">
                                <IconCopy size={15} stroke={1.75} />
                                <span>Nhân bản sản phẩm</span>
                              </Menu.Item>
                              <Menu.Item onClick={() => toggleProductActive(product)} className="flex items-center gap-2">
                                {product.active ? <IconEyeOff size={15} stroke={1.75} /> : <IconEye size={15} stroke={1.75} />}
                                <span>{product.active ? 'Ngừng bán' : 'Bật bán lại'}</span>
                              </Menu.Item>
                              <Menu.Separator />
                              <Menu.Item
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setCatalogAction('delete')
                                }}
                                className="text-[var(--ember)] focus:text-[var(--ember)] flex items-center gap-2"
                              >
                                <IconTrash size={15} stroke={1.75} />
                                <span>Xóa sản phẩm</span>
                              </Menu.Item>
                            </Menu.Content>
                          </Menu.Root>
                        </div>
                      </div>

                      {/* Description if any */}
                      {product.description && (
                        <p className="text-xs text-[#8c8177] line-clamp-1 m-0">{product.description}</p>
                      )}

                      {/* Variants & Prices */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#f0ebe4]">
                        {product.variants.map((v) => (
                          <span
                            key={v.id}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] border',
                              v.active
                                ? 'bg-[#fbf9f6] border-[#ede6de] text-[var(--char)]'
                                : 'bg-[#f0ebe4] border-[#d9d0c8] text-[#8c8177] line-through opacity-60'
                            )}
                          >
                            <span className="text-[#61574f] font-medium">{v.name}:</span>
                            <strong className="font-mono tabular-nums text-[var(--ember)] font-bold">{formatMoney(v.price)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Quick Manage Drawer for Categories / Modifiers / Combos */}
      <Drawer.Root open={Boolean(manageDrawer)} onOpenChange={(open) => { if (!open) setManageDrawer(null) }}>
        <Drawer.Content className="admin-detail-drawer">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">CẤU HÌNH MENU</p>
              <Drawer.Title>Danh mục & Topping</Drawer.Title>
            </div>
            <Drawer.Close aria-label="Đóng">×</Drawer.Close>
          </div>
          <div className="drawer-section">
            <div className="flex items-center justify-between mb-2">
              <h3 className="m-0">Danh mục món ({categories.length})</h3>
              <SecondaryButton size="sm" disabled={!canManage} onClick={() => { setManageDrawer(null); openCategory() }}>+ Thêm</SecondaryButton>
            </div>
            <div className="grid gap-1.5">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] border border-[#e5ddd6] bg-white text-xs">
                  <div>
                    <strong>{category.name}</strong>
                    <span className="block text-[var(--stone)] font-data">{category.active ? 'Đang dùng' : 'Đã ẩn'} · #{category.sortOrder}</span>
                  </div>
                  <Button variant="secondary" size="sm" disabled={!canManage} onClick={() => { setManageDrawer(null); openCategory(category) }}>Sửa</Button>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="flex items-center justify-between mb-2">
              <h3 className="m-0">Nhóm Topping ({catalog.data?.modifierGroups.length ?? 0})</h3>
              <SecondaryButton size="sm" disabled={!canManage} onClick={() => { setManageDrawer(null); openModifierGroup() }}>+ Thêm</SecondaryButton>
            </div>
            <div className="grid gap-1.5">
              {(catalog.data?.modifierGroups ?? []).map((group) => (
                <div key={group.id} className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] border border-[#e5ddd6] bg-white text-xs">
                  <div>
                    <strong>{group.name}</strong>
                    <span className="block text-[var(--stone)] font-data">{group.modifiers.length} topping · {group.active ? 'Đang dùng' : 'Đã ẩn'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="secondary" size="sm" disabled={!canManage} onClick={() => { setManageDrawer(null); openModifierGroup(group) }}>Sửa</Button>
                    <Button variant="danger" size="sm" disabled={!canManage} onClick={() => setDeleteGroupTarget(group)}>Xóa</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="flex items-center justify-between mb-2">
              <h3 className="m-0">Combo ({catalog.data?.combos.length ?? 0})</h3>
              <SecondaryButton size="sm" disabled={!canManage || !variantOptions.length} onClick={() => { setManageDrawer(null); openCombo() }}>+ Thêm</SecondaryButton>
            </div>
            <div className="grid gap-1.5">
              {(catalog.data?.combos ?? []).map((combo) => {
                const productName = allProducts.find((p) => p.id === combo.menuItemId)?.name ?? 'Sản phẩm combo'
                return (
                  <div key={combo.id} className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] border border-[#e5ddd6] bg-white text-xs">
                    <div>
                      <strong>Combo · {productName}</strong>
                      <span className="block text-[var(--stone)] font-data">{combo.components.length} thành phần · {formatMoney(combo.price)}</span>
                    </div>
                    <Button variant="secondary" size="sm" disabled={!canManage} onClick={() => { setManageDrawer(null); openCombo(combo) }}>Sửa</Button>
                  </div>
                )
              })}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Root>

      {/* Product Detail Drawer */}
      <Drawer.Root open={Boolean(selectedProduct)} onOpenChange={(open) => { if (!open) setSelectedProduct(null) }}>
        <Drawer.Content className="admin-detail-drawer">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">CHI TIẾT SẢN PHẨM</p>
              <Drawer.Title>{selectedProduct?.name ?? 'Sản phẩm'}</Drawer.Title>
            </div>
            <Drawer.Close aria-label="Đóng">×</Drawer.Close>
          </div>
          {selectedProduct && (
            <div className="product-detail-content">
              {selectedProduct.imageKey ? (
                <img src={`/api/media/menu-images?key=${encodeURIComponent(selectedProduct.imageKey)}`} alt="" className="product-detail-image" />
              ) : (
                <div className="product-detail-image product-image-fallback">Chưa có ảnh</div>
              )}
              <p className="drawer-note">{selectedProduct.description || 'Chưa có mô tả.'}</p>
              <div className="drawer-stat-grid">
                <div><span>Trạng thái</span><strong>{selectedProduct.active ? 'Đang bán' : 'Ngừng bán'}</strong></div>
                <div><span>Variants</span><strong>{selectedProduct.variants.length}</strong></div>
              </div>
              <div className="drawer-section">
                <h3>Kích cỡ & Giá bán</h3>
                {selectedProduct.variants.map((variant) => (
                  <div className="drawer-list-row" key={variant.id}>
                    <span>{variant.name}</span>
                    <strong>{formatMoney(variant.price)}</strong>
                  </div>
                ))}
              </div>
              <PrimaryButton className="w-full mt-5" disabled={!canManage} onClick={() => { setSelectedProduct(null); openProduct(selectedProduct) }}>
                Sửa sản phẩm
              </PrimaryButton>
              <div className="drawer-section">
                <h3>Lịch sử giá</h3>
                {priceHistory.isLoading && <p className="drawer-note">Đang tải lịch sử giá…</p>}
                {priceHistory.isError && <p className="form-message">Không tải được lịch sử giá.</p>}
                {!priceHistory.isLoading && !priceHistory.isError && !priceHistory.data?.history.length && <p className="drawer-note">Chưa có thay đổi giá nào được ghi nhận.</p>}
                {priceHistory.data?.history.slice(0, 6).map((event) => <div className="drawer-list-row" key={event.id}><span>{event.oldPrice === null ? 'Thiết lập giá' : `${formatMoney(event.oldPrice)} → ${formatMoney(event.newPrice)}`}<small className="block">{event.changedBy ?? 'Dữ liệu cũ'} · {new Date(event.createdAt).toLocaleString('vi-VN')}</small></span><strong>{event.oldPrice === null ? formatMoney(event.newPrice) : ''}</strong></div>)}
              </div>
              {canManage && <div className="flex gap-2 mt-4">
                {selectedProduct.active && <SecondaryButton size="sm" onClick={() => setCatalogAction('stop')}>Ngừng bán</SecondaryButton>}
                <Button variant="danger" size="sm" onClick={() => setCatalogAction('delete')}>Xóa</Button>
              </div>}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Root>

      <AlertDialog.Root open={catalogAction !== null} onOpenChange={(open) => { if (!open) setCatalogAction(null) }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="dialog-backdrop" />
          <AlertDialog.Viewport className="dialog-viewport">
            <AlertDialog.Popup className="editor-dialog">
              <AlertDialog.Title>{catalogAction === 'delete' ? 'Xóa sản phẩm?' : 'Ngừng bán sản phẩm?'}</AlertDialog.Title>
              <AlertDialog.Description>{catalogAction === 'delete' ? 'Chỉ có thể xóa khi sản phẩm chưa từng xuất hiện trong ticket và không được dùng trong combo. Nếu không đủ điều kiện, hệ thống sẽ hướng dẫn Ngừng bán.' : 'Sản phẩm sẽ biến mất khỏi POS. Các combo đang dùng sản phẩm này cũng được ngừng bán; hóa đơn cũ không thay đổi.'}</AlertDialog.Description>
              <div className="dialog-actions">
                <AlertDialog.Close className="print-button">Hủy</AlertDialog.Close>
                <Button variant="danger" disabled={save.isPending || !selectedProduct} onClick={() => selectedProduct && save.mutate({ action: catalogAction === 'delete' ? 'deleteProduct' : 'stopProduct', productId: selectedProduct.id })}>{catalogAction === 'delete' ? 'Xóa sản phẩm' : 'Ngừng bán'}</Button>
              </div>
              {save.isError && <p className="form-message">{save.error.message}</p>}
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={deleteGroupTarget !== null} onOpenChange={(open) => { if (!open) setDeleteGroupTarget(null) }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="dialog-backdrop" />
          <AlertDialog.Viewport className="dialog-viewport">
            <AlertDialog.Popup className="editor-dialog">
              <AlertDialog.Title>Xóa nhóm topping?</AlertDialog.Title>
              <AlertDialog.Description>Nhóm "{deleteGroupTarget?.name}" và các tùy chọn trong đó sẽ bị xóa khỏi mọi kích cỡ đang gắn. Chỉ xóa được khi nhóm chưa từng được chọn trong ticket; nếu không, hãy dùng phần Sửa để ẩn tùy chọn.</AlertDialog.Description>
              <div className="dialog-actions">
                <AlertDialog.Close className="print-button">Hủy</AlertDialog.Close>
                <Button variant="danger" disabled={save.isPending || !deleteGroupTarget} onClick={() => deleteGroupTarget && save.mutate({ action: 'deleteModifierGroup', groupId: deleteGroupTarget.id })}>Xóa nhóm</Button>
              </div>
              {save.isError && <p className="form-message">{save.error.message}</p>}
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Category Dialog */}
      <Dialog.Root open={categoryDialog !== null} onOpenChange={(open) => { if (!open) setCategoryDialog(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="catalog-dialog">
              <Dialog.Title>{categoryDialog === 'new' ? 'Tạo danh mục' : 'Sửa danh mục'}</Dialog.Title>
              <Dialog.Description>Danh mục ngừng hoạt động sẽ không hiển thị ở POS.</Dialog.Description>
              <form onSubmit={(event) => {
                event.preventDefault()
                save.mutate({ action: 'saveCategory', category: { id: categoryDialog && categoryDialog !== 'new' ? categoryDialog.id : undefined, ...categoryDraft } })
              }}>
                <Field.Root>
                  <Field.Label>Tên danh mục</Field.Label>
                  <Input size="md" required value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))} />
                </Field.Root>
                <Field.Root className="mt-3">
                  <Field.Label>Thứ tự hiển thị</Field.Label>
                  <Input size="md" min="0" type="number" value={categoryDraft.sortOrder} onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                </Field.Root>
                <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[#e5ddd6] bg-[#fbf8f4] my-3">
                  <span className="text-sm font-semibold text-[var(--char)]">Đang hoạt động</span>
                  <Switch checked={categoryDraft.active} onCheckedChange={(checked) => setCategoryDraft((current) => ({ ...current, active: checked === true }))} />
                </div>
                {save.isError && <p className="form-message">{save.error.message}</p>}
                <div className="dialog-actions mt-4">
                  <Dialog.Close className="print-button">Đóng</Dialog.Close>
                  <PrimaryButton disabled={save.isPending} type="submit">Lưu danh mục</PrimaryButton>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Product Dialog matching uploaded mockup 100% */}
      <Dialog.Root open={productDialog} onOpenChange={(open) => { if (!open) setProductDialog(false) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="product-mockup-dialog">
              {productDraft && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    save.mutate({ action: 'saveProduct', product: productDraft })
                  }}
                  className="product-mockup-form"
                >
                  {/* Section 1: Thông tin cơ bản */}
                  <div className="product-mockup-section">
                    <h3 className="product-mockup-heading">1. Thông tin cơ bản</h3>

                    <div className="product-mockup-grid">
                      {/* Left: 1:1 Image Upload Box */}
                      <div className="product-mockup-upload-col">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(file)
                          }}
                        />
                        {productDraft.imageKey ? (
                          <div className="product-mockup-preview">
                            <img
                              src={`/api/media/menu-images?key=${encodeURIComponent(productDraft.imageKey)}`}
                              alt="Ảnh món"
                              className="product-mockup-img"
                            />
                            <button
                              type="button"
                              onClick={() => setProductDraft({ ...productDraft, imageKey: null })}
                              className="product-mockup-remove-btn"
                              title="Xóa ảnh"
                              aria-label="Xóa ảnh"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            className={cn('product-mockup-dropzone', isDragOver && 'is-dragover')}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setIsDragOver(false)
                              const file = e.dataTransfer.files?.[0]
                              if (file) handleFileSelect(file)
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                          >
                            <span className="product-mockup-plus">＋</span>
                            <strong className="product-mockup-title">Thêm ảnh món</strong>
                            <span className="product-mockup-ratio">1 : 1</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="product-mockup-btn"
                        >
                          {productDraft.imageKey ? 'Thay ảnh khác' : 'Chọn ảnh từ máy'}
                        </button>

                        <div className="product-mockup-notes">
                          <div>PNG, JPG, WebP · Tối đa 5MB</div>
                          <div>Tỷ lệ chuẩn: 1 : 1 (Hình vuông)</div>
                        </div>

                        {uploadProgress !== null && (
                          <Progress.Root value={uploadProgress} aria-label="Tiến độ upload ảnh" className="mt-2 w-full">
                            <Progress.Label>Đang tải {uploadProgress}%</Progress.Label>
                            <Progress.Track><Progress.Indicator /></Progress.Track>
                          </Progress.Root>
                        )}
                        {uploadError && <p className="text-xs text-[var(--ember)] font-semibold mt-1">{uploadError}</p>}
                      </div>

                      {/* Right: Form fields */}
                      <div className="product-mockup-fields-col">
                        {/* Row 1: Danh mục & Tên sản phẩm */}
                        <div className="product-mockup-row2">
                          <div className="product-mockup-field">
                            <label className="product-mockup-label">
                              DANH MỤC MÓN <span className="text-[#b3381e]">*</span>
                            </label>
                            <AppSelect
                              size="md"
                              items={categoryOptions}
                              value={productDraft.categoryId}
                              onValueChange={(val) => setProductDraft({ ...productDraft, categoryId: val })}
                              placeholder="Chọn danh mục…"
                              triggerClassName="product-mockup-input"
                            />
                          </div>

                          <div className="product-mockup-field">
                            <label className="product-mockup-label">
                              TÊN SẢN PHẨM <span className="text-[#b3381e]">*</span>
                            </label>
                            <Input
                              size="md"
                              required
                              value={productDraft.name}
                              onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })}
                              placeholder="Ví dụ: Cà phê Muối"
                              className="product-mockup-input"
                            />
                          </div>
                        </div>

                        {/* Row 2: Mô tả món */}
                        <div className="product-mockup-field">
                          <label className="product-mockup-label">MÔ TẢ MÓN</label>
                          <textarea
                            className="product-mockup-textarea"
                            value={productDraft.description}
                            onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })}
                            placeholder="Mô tả ngắn về sản phẩm, hương vị, nguyên liệu đặc trưng…"
                            rows={3}
                          />
                        </div>

                        {/* Row 3: Trạng thái bán card */}
                        <div className="product-mockup-status-card">
                          <div>
                            <span className="product-mockup-status-title">TRẠNG THÁI BÁN</span>
                            <span className="product-mockup-status-sub">Sản phẩm đang hiển thị và bán tại POS</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-semibold text-[var(--char)]">
                              {productDraft.active ? 'Đang bán' : 'Ngừng bán'}
                            </span>
                            <Switch
                              checked={productDraft.active}
                              onCheckedChange={(checked) => setProductDraft({ ...productDraft, active: checked === true })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="product-mockup-divider" />

                  {/* Section 2: Kích cỡ & giá bán */}
                  <div className="product-mockup-section">
                    <div className="product-mockup-section-header">
                      <div>
                        <h3 className="product-mockup-heading">2. Kích cỡ & giá bán</h3>
                        <p className="product-mockup-sub">Thiết lập các size, đơn giá và nhóm topping đính kèm tương ứng.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductDraft({ ...productDraft, variants: [...productDraft.variants, blankVariant(productDraft.variants.length)] })}
                        className="product-mockup-add-btn"
                      >
                        + Thêm kích cỡ
                      </button>
                    </div>

                    {/* Table */}
                    <div className="product-mockup-table-wrap">
                      <table className="product-mockup-table">
                        <thead>
                          <tr>
                            <th style={{ width: '22%' }}>TÊN KÍCH CỠ</th>
                            <th style={{ width: '22%' }}>GIÁ BÁN</th>
                            <th style={{ width: '38%' }}>NHÓM TÙY CHỌN / TOPPING</th>
                            <th style={{ width: '10%' }} className="text-center">TRẠNG THÁI</th>
                            <th style={{ width: '8%' }} className="text-center">THAO TÁC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDraft.variants.map((variant, index) => (
                            <tr key={variant.id ?? `variant-${index}`}>
                              <td>
                                <Input
                                  size="sm"
                                  required
                                  value={variant.name}
                                  onChange={(e) => updateVariant(index, { name: e.target.value })}
                                  placeholder="Tiêu chuẩn"
                                  className="product-mockup-table-input"
                                />
                              </td>
                              <td>
                                <div className="relative flex items-center">
                                  <Input
                                    size="sm"
                                    required
                                    min="0"
                                    step="1000"
                                    type="number"
                                    value={variant.price || ''}
                                    onChange={(e) => updateVariant(index, { price: Number(e.target.value) })}
                                    placeholder="Nhập giá bán"
                                    className="product-mockup-table-input pr-6 font-data"
                                  />
                                  <span className="absolute right-2.5 text-xs text-[var(--stone)] pointer-events-none">₫</span>
                                </div>
                              </td>
                              <td>
                                <ModifierGroupPicker
                                  groups={catalog.data?.modifierGroups ?? []}
                                  selectedIds={variant.modifierGroupIds ?? []}
                                  onChange={(ids) => updateVariant(index, { modifierGroupIds: ids })}
                                />
                              </td>
                              <td>
                                <div className="flex items-center justify-center">
                                  <Switch
                                    checked={variant.active}
                                    onCheckedChange={(checked) => updateVariant(index, { active: checked === true })}
                                    aria-label="Trạng thái kích cỡ"
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center justify-center">
                                  <button
                                    type="button"
                                    disabled={productDraft.variants.length <= 1}
                                    onClick={() => setProductDraft({ ...productDraft, variants: productDraft.variants.filter((_, vIndex) => vIndex !== index) })}
                                    className="product-mockup-trash-btn"
                                    title="Xóa kích cỡ này"
                                    aria-label="Xóa kích cỡ"
                                  >
                                    {TrashIcon}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sticky Footer */}
                  <div className="product-mockup-footer">
                    <span className="product-mockup-count">
                      {productDraft.variants.length} kích cỡ đã tạo
                    </span>
                    <div className="flex items-center gap-3">
                      <Dialog.Close className="product-mockup-cancel-btn">
                        Hủy
                      </Dialog.Close>
                      <button
                        type="submit"
                        disabled={save.isPending || uploadProgress !== null}
                        className="product-mockup-save-btn"
                      >
                        {save.isPending ? 'Đang lưu…' : 'Lưu sản phẩm'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modifier Group Dialog */}
      <Dialog.Root open={modifierDialog} onOpenChange={(open) => { if (!open) setModifierDialog(false) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '620px' }}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  save.mutate({ action: 'saveModifierGroup', group: modifierDraft })
                }}
                className="product-mockup-form"
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-[#ede6de]">
                  <div>
                    <Dialog.Title className="product-mockup-heading">
                      {modifierDraft.id ? 'Sửa nhóm tùy chọn' : 'Thêm nhóm tùy chọn'}
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-[#8c8177] mt-1">
                      Nhóm sẽ được gắn vào các kích cỡ sản phẩm tại POS.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close aria-label="Đóng" className="dialog-close-btn">×</Dialog.Close>
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  {/* Field 1: Tên nhóm */}
                  <div className="product-mockup-field">
                    <label className="product-mockup-label">
                      TÊN NHÓM <span className="text-[#b3381e]">*</span>
                    </label>
                    <Input
                      size="md"
                      required
                      value={modifierDraft.name}
                      onChange={(event) => setModifierDraft({ ...modifierDraft, name: event.target.value })}
                      placeholder="Ví dụ: Độ ngọt, Lượng đá, Topping..."
                      className="product-mockup-input"
                    />
                  </div>

                  {/* Field 2: Cho phép khách chọn */}
                  <div className="product-mockup-field">
                    <label className="product-mockup-label">CHO PHÉP KHÁCH CHỌN</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-[#8c8177] block mb-1">Tối thiểu (Min)</span>
                        <Input
                          size="sm"
                          min="0"
                          type="number"
                          value={modifierDraft.minSelections}
                          onChange={(event) => setModifierDraft({ ...modifierDraft, minSelections: Number(event.target.value) })}
                          className="product-mockup-input font-data text-center"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-[#8c8177] block mb-1">Tối đa (Max)</span>
                        <Input
                          size="sm"
                          min="1"
                          type="number"
                          value={modifierDraft.maxSelections}
                          onChange={(event) => setModifierDraft({ ...modifierDraft, maxSelections: Number(event.target.value) })}
                          className="product-mockup-input font-data text-center"
                        />
                      </div>
                    </div>
                    <small className="text-[11px] text-[#8c8177] mt-1.5 block">
                      0 = Không bắt buộc (khách có thể bỏ qua) · 1 = Bắt buộc chọn đúng 1 lựa chọn
                    </small>
                  </div>
                </div>

                <hr className="product-mockup-divider" />

                {/* Section: Danh sách lựa chọn */}
                <div className="product-mockup-section">
                  <div className="product-mockup-section-header">
                    <div>
                      <h3 className="product-mockup-heading text-base">Danh sách lựa chọn</h3>
                      <p className="product-mockup-sub">Các mục hoặc mức độ khách hàng có thể chọn.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModifierDraft({
                        ...modifierDraft,
                        modifiers: [...modifierDraft.modifiers, { name: '', priceDelta: 0, active: true, sortOrder: modifierDraft.modifiers.length }]
                      })}
                      className="product-mockup-add-btn"
                    >
                      + Thêm lựa chọn
                    </button>
                  </div>

                  <div className="product-mockup-table-wrap">
                    <table className="product-mockup-table">
                      <thead>
                        <tr>
                          <th style={{ width: '46%' }}>TÊN LỰA CHỌN</th>
                          <th style={{ width: '28%' }}>GIÁ THÊM</th>
                          <th style={{ width: '16%' }} className="text-center">BÁN</th>
                          <th style={{ width: '10%' }} className="text-center">XÓA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modifierDraft.modifiers.map((modifier, index) => (
                          <tr key={modifier.id ?? `modifier-${index}`}>
                            <td>
                              <Input
                                size="sm"
                                required
                                value={modifier.name}
                                onChange={(event) => setModifierDraft({
                                  ...modifierDraft,
                                  modifiers: modifierDraft.modifiers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item)
                                })}
                                placeholder="VD: 50% đường, Trân châu..."
                                className="product-mockup-table-input"
                              />
                            </td>
                            <td>
                              <div className="relative flex items-center">
                                <Input
                                  size="sm"
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={modifier.priceDelta || ''}
                                  onChange={(event) => setModifierDraft({
                                    ...modifierDraft,
                                    modifiers: modifierDraft.modifiers.map((item, itemIndex) => itemIndex === index ? { ...item, priceDelta: Number(event.target.value) } : item)
                                  })}
                                  placeholder="0"
                                  className="product-mockup-table-input pr-6 font-data"
                                />
                                <span className="absolute right-2.5 text-xs text-[var(--stone)] pointer-events-none">₫</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={modifier.active}
                                  onCheckedChange={(checked) => setModifierDraft({
                                    ...modifierDraft,
                                    modifiers: modifierDraft.modifiers.map((item, itemIndex) => itemIndex === index ? { ...item, active: checked === true } : item)
                                  })}
                                  aria-label="Trạng thái lựa chọn"
                                />
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  disabled={modifierDraft.modifiers.length <= 1}
                                  onClick={() => setModifierDraft({
                                    ...modifierDraft,
                                    modifiers: modifierDraft.modifiers.filter((_, itemIndex) => itemIndex !== index)
                                  })}
                                  className="product-mockup-trash-btn"
                                  title="Xóa lựa chọn này"
                                  aria-label="Xóa lựa chọn"
                                >
                                  {TrashIcon}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {save.isError && <p className="form-message mt-3">{save.error.message}</p>}

                {/* Sticky Footer */}
                <div className="product-mockup-footer">
                  <span className="product-mockup-count">
                    {modifierDraft.modifiers.length} lựa chọn trong nhóm
                  </span>
                  <div className="flex items-center gap-3">
                    <Dialog.Close className="product-mockup-cancel-btn">
                      Hủy
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={save.isPending}
                      className="product-mockup-save-btn"
                    >
                      {save.isPending ? 'Đang lưu…' : 'Lưu nhóm'}
                    </button>
                  </div>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Combo Dialog */}
      <Dialog.Root open={comboDialog} onOpenChange={(open) => { if (!open) setComboDialog(false) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Viewport className="dialog-viewport">
            <Dialog.Popup className="catalog-dialog">
              <Dialog.Title>{comboDraft.id ? 'Sửa combo' : 'Thêm combo'}</Dialog.Title>
              <Dialog.Description>Combo là một sản phẩm bán theo giá cố định, gồm các món có sẵn.</Dialog.Description>
              <form onSubmit={(event) => { event.preventDefault(); save.mutate({ action: 'saveCombo', combo: comboDraft }) }}>
                <Field.Root>
                  <Field.Label>Sản phẩm combo</Field.Label>
                  <AppSelect
                    size="md"
                    items={productOptions}
                    value={comboDraft.menuItemId}
                    onValueChange={(val) => setComboDraft({ ...comboDraft, menuItemId: val })}
                    placeholder="Chọn sản phẩm…"
                  />
                </Field.Root>
                <Field.Root className="mt-3">
                  <Field.Label>Giá combo (₫)</Field.Label>
                  <Input size="md" min="0" required type="number" value={comboDraft.price} onChange={(event) => setComboDraft({ ...comboDraft, price: Number(event.target.value) })} />
                </Field.Root>
                <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[#e5ddd6] bg-[#fbf8f4] my-3">
                  <span className="text-sm font-semibold text-[var(--char)]">Đang bán</span>
                  <Switch checked={comboDraft.active} onCheckedChange={(checked) => setComboDraft({ ...comboDraft, active: checked === true })} />
                </div>
                <div className="variant-editor">
                  <div className="variant-editor-head">
                    <h3 className="text-sm font-bold text-[var(--char)]">Thành phần combo</h3>
                    <SecondaryButton size="sm" type="button" onClick={() => setComboDraft({ ...comboDraft, components: [...comboDraft.components, { variantId: variantOptions[0]?.id ?? '', quantity: 1 }] })}>
                      + Thêm thành phần
                    </SecondaryButton>
                  </div>
                  {comboDraft.components.map((component, index) => (
                    <div className="variant-edit-row" key={`${component.variantId}-${index}`}>
                      <AppSelect
                        size="sm"
                        items={comboVariantOptions}
                        value={component.variantId}
                        onValueChange={(val) => setComboDraft({ ...comboDraft, components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: val } : item) })}
                        placeholder="Chọn size…"
                        className="flex-1"
                      />
                      <Input size="sm" min="1" max="99" required aria-label="Số lượng thành phần" type="number" value={component.quantity} onChange={(event) => setComboDraft({ ...comboDraft, components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item) })} className="w-24" />
                      <Button variant="secondary" size="sm" type="button" disabled={comboDraft.components.length <= 1} onClick={() => setComboDraft({ ...comboDraft, components: comboDraft.components.filter((_, itemIndex) => itemIndex !== index) })}>
                        Bỏ
                      </Button>
                    </div>
                  ))}
                </div>
                {save.isError && <p className="form-message">{save.error.message}</p>}
                <div className="dialog-actions mt-4">
                  <Dialog.Close className="print-button">Hủy</Dialog.Close>
                  <PrimaryButton disabled={save.isPending || !comboDraft.components.length}>Lưu combo</PrimaryButton>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
