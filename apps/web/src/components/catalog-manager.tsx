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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Menu } from '@/components/ui/menu'
import { ImageUpload } from '@/components/ui/image-upload'
import { SkeletonList, SkeletonMetricGrid, SkeletonTable } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { CatalogCategory, CatalogCombo, CatalogModifierGroup, CatalogProduct, CatalogVariant } from '../client/outbox'

type AdminCatalog = { categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups: CatalogModifierGroup[]; combos: CatalogCombo[] }
type VariantDraft = Omit<Pick<CatalogVariant, 'id' | 'name' | 'price' | 'active' | 'sortOrder' | 'modifierGroupIds'>, 'id'> & { id?: string }
type ProductDraft = { id?: string; categoryId: string; name: string; description: string; imageKey: string | null; active: boolean; kind?: 'standard' | 'combo'; sortOrder?: number; variants: VariantDraft[] }

const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}₫`
const blankVariant = (sortOrder: number): VariantDraft => ({ name: sortOrder === 0 ? 'Tiêu chuẩn' : `Size ${sortOrder === 1 ? 'M' : sortOrder === 2 ? 'L' : sortOrder + 1}`, price: 0, active: true, sortOrder, modifierGroupIds: [] })

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
]

const TrashIcon = <IconTrash size={16} stroke={1.75} className="text-[var(--ember)]" />

async function getCatalog(): Promise<AdminCatalog> {
  const response = await fetch('/api/menu?view=admin')
  if (!response.ok) throw new Error('Không tải được catalog.')
  return response.json() as Promise<AdminCatalog>
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
  const isMobile = useIsMobile()
  const client = useQueryClient()
  const catalog = useQuery({ queryKey: ['menu-catalog', 'admin'], queryFn: getCatalog })
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'modifiers' | 'combos'>('products')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [catalogAction, setCatalogAction] = useState<'stop' | 'delete' | null>(null)
  const [categoryDialog, setCategoryDialog] = useState<CatalogCategory | null | 'new'>(null)
  const [categoryDraft, setCategoryDraft] = useState({ name: '', active: true, sortOrder: 0 })
  const [productDialog, setProductDialog] = useState(false)
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null)
  const [modifierDialog, setModifierDialog] = useState(false)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<CatalogModifierGroup | null>(null)
  const [modifierDraft, setModifierDraft] = useState<{ id?: string; name: string; minSelections: number; maxSelections: number; active: boolean; sortOrder: number; modifiers: Array<{ id?: string; name: string; priceDelta: number; active: boolean; sortOrder: number }> }>({ name: '', minSelections: 0, maxSelections: 1, active: true, sortOrder: 0, modifiers: [] })
  const [comboDialog, setComboDialog] = useState(false)
  const [comboDraft, setComboDraft] = useState<{ id?: string; menuItemId: string; price: number; active: boolean; components: Array<{ variantId: string; quantity: number }> }>({ menuItemId: '', price: 0, active: true, components: [] })

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
    setProductDialog(true)
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setProductDraft((current) => (current ? { ...current, variants: current.variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)) } : current))
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
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full min-w-0 max-w-full">
        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f0ebe4] border border-[#e2dad1] overflow-x-auto scrollbar-none shrink-0 min-w-0 w-full sm:w-auto -webkit-overflow-scrolling-touch">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap',
              activeTab === 'products'
                ? 'bg-white text-[var(--char)] shadow-xs'
                : 'text-[#6a5e52] hover:text-[var(--char)] hover:bg-white/50'
            )}
          >
            <IconCoffee size={15} stroke={1.75} />
            <span>Sản phẩm</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                activeTab === 'products' ? 'bg-[#ede6de] text-[var(--char)]' : 'bg-[#e5ddd3] text-[#716559]'
              )}
            >
              {allProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap',
              activeTab === 'categories'
                ? 'bg-white text-[var(--char)] shadow-xs'
                : 'text-[#6a5e52] hover:text-[var(--char)] hover:bg-white/50'
            )}
          >
            <IconFolderPlus size={15} stroke={1.75} />
            <span>Danh mục</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                activeTab === 'categories' ? 'bg-[#ede6de] text-[var(--char)]' : 'bg-[#e5ddd3] text-[#716559]'
              )}
            >
              {categories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('modifiers')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap',
              activeTab === 'modifiers'
                ? 'bg-white text-[var(--char)] shadow-xs'
                : 'text-[#6a5e52] hover:text-[var(--char)] hover:bg-white/50'
            )}
          >
            <IconToolsKitchen2 size={15} stroke={1.75} />
            <span>Nhóm Topping</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                activeTab === 'modifiers' ? 'bg-[#ede6de] text-[var(--char)]' : 'bg-[#e5ddd3] text-[#716559]'
              )}
            >
              {catalog.data?.modifierGroups.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('combos')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap',
              activeTab === 'combos'
                ? 'bg-white text-[var(--char)] shadow-xs'
                : 'text-[#6a5e52] hover:text-[var(--char)] hover:bg-white/50'
            )}
          >
            <IconStack2 size={15} stroke={1.75} />
            <span>Combo</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                activeTab === 'combos' ? 'bg-[#ede6de] text-[var(--char)]' : 'bg-[#e5ddd3] text-[#716559]'
              )}
            >
              {catalog.data?.combos.length ?? 0}
            </span>
          </button>
        </div>

        {/* Primary Action Button based on Active Tab */}
        <div className="w-full sm:w-auto shrink-0">
          {activeTab === 'products' && (
            <PrimaryButton
              size="md"
              disabled={!canManage || !categories.length}
              onClick={() => openProduct()}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-xs"
            >
              <IconPlus size={16} stroke={2} />
              <span>Thêm sản phẩm mới</span>
            </PrimaryButton>
          )}

          {activeTab === 'categories' && (
            <PrimaryButton
              size="md"
              disabled={!canManage}
              onClick={() => openCategory()}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-xs"
            >
              <IconPlus size={16} stroke={2} />
              <span>Thêm danh mục mới</span>
            </PrimaryButton>
          )}

          {activeTab === 'modifiers' && (
            <PrimaryButton
              size="md"
              disabled={!canManage}
              onClick={() => openModifierGroup()}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-xs"
            >
              <IconPlus size={16} stroke={2} />
              <span>Thêm nhóm Topping</span>
            </PrimaryButton>
          )}

          {activeTab === 'combos' && (
            <PrimaryButton
              size="md"
              disabled={!canManage || !variantOptions.length}
              onClick={() => openCombo()}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-xs"
            >
              <IconPlus size={16} stroke={2} />
              <span>Thêm Combo mới</span>
            </PrimaryButton>
          )}
        </div>
      </div>

      {catalog.isLoading && (
        <div className="grid gap-3.5 sm:gap-5" role="status" aria-busy="true">
          <span className="sr-only">Đang tải catalog…</span>
          <SkeletonMetricGrid count={4} label="" />
          <SkeletonTable
            columns={[
              { width: '30%', cellClassName: 'w-40' },
              { width: '16%', cellClassName: 'w-16' },
              { width: '16%', cellClassName: 'w-20' },
              { width: '14%', align: 'center', cellClassName: 'w-20' },
              { width: '14%', align: 'center', cellClassName: 'w-20' },
              { width: '10%', align: 'right', cellClassName: 'w-16' },
            ]}
            rows={6}
            label=""
          />
        </div>
      )}
      {catalog.isError && <p className="floor-feedback is-error">Không tải được catalog. Kiểm tra quyền menu rồi thử lại.</p>}

      {!!catalog.data && (
        <>
          {/* TAB 1: SẢN PHẨM */}
          {activeTab === 'products' && (
            <>
              {/* KPI Metrics: 2x2 on mobile, 4 on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 w-full min-w-0 max-w-full">
                <article className="p-3.5 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-1 shadow-2xs min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#8c8177] uppercase tracking-wider truncate">Tổng sản phẩm</span>
                    <IconCoffee size={15} stroke={1.5} className="text-[#a19588] shrink-0" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">{allProducts.length}</strong>
                  <small className="text-[11px] text-[#8c8177] truncate">Tất cả danh mục món</small>
                </article>
                <article className="p-3.5 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-1 shadow-2xs min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#8c8177] uppercase tracking-wider truncate">Đang bán</span>
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 truncate">
                    {allProducts.filter((product) => product.active).length}
                  </strong>
                  <small className="text-[11px] text-[#8c8177] truncate">Hiển thị trên POS</small>
                </article>
                <article className="p-3.5 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-1 shadow-2xs min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#8c8177] uppercase tracking-wider truncate">Ngừng bán</span>
                    <span className="size-2 rounded-full bg-gray-300 shrink-0" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#8c8177] truncate">
                    {allProducts.filter((product) => !product.active).length}
                  </strong>
                  <small className="text-[11px] text-[#8c8177] truncate">Tạm ẩn trên POS</small>
                </article>
                <article className="p-3.5 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-1 shadow-2xs min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#8c8177] uppercase tracking-wider truncate">Danh mục</span>
                    <IconFolderPlus size={15} stroke={1.5} className="text-[#a19588] shrink-0" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--char)] truncate">{categories.length}</strong>
                  <small className="text-[11px] text-[#8c8177] truncate">Nhóm món quản lý</small>
                </article>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl border border-[#e5ddd6] bg-white shadow-2xs w-full min-w-0 max-w-full">
                {/* Search input */}
                <div className="relative flex items-center min-w-0 flex-1">
                  <span className="absolute left-3 text-[#8c8177] pointer-events-none" aria-hidden="true">
                    <IconSearch size={16} stroke={1.75} />
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo tên món hoặc mô tả..."
                    className="w-full h-9 pl-9 pr-8 rounded-xl border border-[#d9d0c8] bg-[#fdfcfb] text-xs text-[var(--char)] focus:border-[var(--ember)] focus:bg-white focus:outline-none transition-colors"
                    aria-label="Tìm sản phẩm"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 text-[#8c8177] hover:text-[var(--char)] cursor-pointer"
                      aria-label="Xóa tìm kiếm"
                    >
                      <IconX size={15} stroke={2} />
                    </button>
                  )}
                </div>

                {/* Filter controls */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  <AppSelect
                    size="sm"
                    items={[{ value: 'all', label: 'Tất cả danh mục' }, ...categoryOptions]}
                    value={categoryFilter}
                    onValueChange={(val) => setCategoryFilter(val)}
                    aria-label="Lọc theo danh mục"
                    triggerClassName="h-9 min-w-[145px] sm:min-w-[160px] bg-[#fdfcfb] text-xs font-semibold rounded-xl border-[#d9d0c8]"
                  />

                  <AppSelect
                    size="sm"
                    items={STATUS_OPTIONS}
                    value={statusFilter}
                    onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
                    aria-label="Lọc theo trạng thái"
                    triggerClassName="h-9 min-w-[135px] sm:min-w-[145px] bg-[#fdfcfb] text-xs font-semibold rounded-xl border-[#d9d0c8]"
                  />

                  <AppSelect
                    size="sm"
                    items={[
                      { value: 'name-asc', label: 'Sắp xếp: Tên A–Z' },
                      { value: 'name-desc', label: 'Sắp xếp: Tên Z–A' },
                      { value: 'price-asc', label: 'Giá: Thấp → Cao' },
                      { value: 'price-desc', label: 'Giá: Cao → Thấp' },
                    ]}
                    value={sortBy}
                    onValueChange={(val) => setSortBy(val as typeof sortBy)}
                    aria-label="Sắp xếp sản phẩm"
                    triggerClassName="h-9 min-w-[145px] sm:min-w-[155px] bg-[#fdfcfb] text-xs font-semibold rounded-xl border-[#d9d0c8]"
                  />

                  {hasFilterActive && (
                    <SecondaryButton
                      size="sm"
                      onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); setSortBy('name-asc') }}
                      className="h-9 px-3 text-xs font-bold shrink-0 rounded-xl"
                    >
                      Đặt lại
                    </SecondaryButton>
                  )}

                  <div className="hidden lg:flex items-center shrink-0">
                    <Popover.Root>
                      <Popover.Trigger
                        className="size-9 rounded-xl border border-[#d9d0c8] bg-[#fdfcfb] flex items-center justify-center text-[#8c8177] hover:text-[var(--char)] hover:border-[var(--stone)] transition-colors cursor-pointer"
                        aria-label="Xem quy tắc catalog & POS"
                      >
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
              </div>

              {/* Category Filter Chips & Counter Bar */}
              <div className="flex items-center justify-between gap-3 w-full min-w-0">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -my-1 min-w-0 flex-1" role="tablist" aria-label="Lọc nhanh theo danh mục">
                  <button
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer border',
                      categoryFilter === 'all'
                        ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] shadow-2xs'
                        : 'bg-white text-[#61574f] border-[#d9d0c8] hover:bg-[#faf7f2]'
                    )}
                    role="tab"
                    aria-selected={categoryFilter === 'all'}
                    onClick={() => setCategoryFilter('all')}
                  >
                    <span>Tất cả</span>
                    <span className={cn('px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', categoryFilter === 'all' ? 'bg-[#3c2c25] text-[#dfd2c4]' : 'bg-[#f0ebe4] text-[#8c8177]')}>
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
                            ? 'bg-[var(--espresso)] text-[var(--crema)] border-[var(--espresso)] shadow-2xs'
                            : 'bg-white text-[#61574f] border-[#d9d0c8] hover:bg-[#faf7f2]'
                        )}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setCategoryFilter(category.id)}
                      >
                        <span>{category.name}</span>
                        <span className={cn('px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold', isActive ? 'bg-[#3c2c25] text-[#dfd2c4]' : 'bg-[#f0ebe4] text-[#8c8177]')}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <span className="text-xs text-[#8c8177] font-medium shrink-0 hidden sm:inline whitespace-nowrap">
                  Hiển thị <strong className="text-[var(--char)] font-bold">{products.length}</strong> sản phẩm
                </span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-[#e5ddd6] bg-white overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b border-[#ede6de] bg-[#fbf9f6]">
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                              className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10.5px] text-[#786c5e]"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-[#f0ebe4]">
                      {table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-[#faf7f2] transition-colors cursor-pointer"
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest('button, [role="menuitem"], input, label')) return
                            setSelectedProduct(row.original)
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-3.5 py-2.5 align-middle">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!table.getRowModel().rows.length && (
                        <tr>
                          <td colSpan={columns.length} className="px-4 py-8 text-center text-[#8c8177]">
                            {hasFilterActive ? 'Không tìm thấy sản phẩm nào phù hợp.' : 'Chưa có sản phẩm nào. Bấm "Thêm sản phẩm mới" để bắt đầu.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards List */}
              <div className="md:hidden grid gap-2.5">
                {!products.length && (
                  <div className="p-6 text-center text-xs text-[#8c8177] rounded-xl border border-[#e5ddd6] bg-white">
                    {hasFilterActive ? 'Không tìm thấy sản phẩm nào phù hợp.' : 'Chưa có sản phẩm nào.'}
                  </div>
                )}
                {products.map((product) => {
                  const minPrice = Math.min(...product.variants.map((v) => v.price), 0)
                  const maxPrice = Math.max(...product.variants.map((v) => v.price), 0)
                  const isMultiPrice = minPrice !== maxPrice

                  return (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-2.5 active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5">
                        {product.imageKey ? (
                          <img
                            src={`/api/media/menu-images?key=${encodeURIComponent(product.imageKey)}`}
                            alt=""
                            className="size-14 rounded-lg object-cover border border-[#e5ddd6] shrink-0"
                          />
                        ) : (
                          <div className="size-14 rounded-lg bg-[#f5ede4] text-[var(--ember)] border border-[#e5ddd6] flex items-center justify-center shrink-0">
                            <IconCoffee size={24} stroke={1.5} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-[#f0ebe4] text-[#61574f]">
                              {categories.find((c) => c.id === product.categoryId)?.name ?? 'Chưa phân loại'}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[9.5px] font-bold',
                                product.active ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {product.active ? 'Đang bán' : 'Ngừng bán'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-[var(--char)] truncate m-0">{product.name}</h4>
                          <p className="font-mono text-xs font-bold text-[var(--ember)] tabular-nums mt-0.5 m-0">
                            {isMultiPrice ? `${formatMoney(minPrice)} - ${formatMoney(maxPrice)}` : formatMoney(minPrice)}
                          </p>
                        </div>

                        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                          <Menu.Root>
                            <Menu.Trigger
                              aria-label="Tác vụ"
                              className="size-8 rounded-lg border border-[#ded6cc] bg-white text-[#8c8177] hover:text-[var(--char)] flex items-center justify-center cursor-pointer"
                            >
                              <IconDotsVertical size={15} stroke={1.75} />
                            </Menu.Trigger>
                            <Menu.Content positionerProps={{ align: 'end' }}>
                              <Menu.Item onClick={() => openProduct(product)} className="flex items-center gap-2">
                                <IconPencil size={15} stroke={1.75} />
                                <span>Sửa</span>
                              </Menu.Item>
                              <Menu.Item onClick={() => duplicateProduct(product)} className="flex items-center gap-2">
                                <IconCopy size={15} stroke={1.75} />
                                <span>Nhân bản</span>
                              </Menu.Item>
                              <Menu.Item onClick={() => toggleProductActive(product)} className="flex items-center gap-2">
                                {product.active ? <IconEyeOff size={15} stroke={1.75} /> : <IconEye size={15} stroke={1.75} />}
                                <span>{product.active ? 'Ngừng bán' : 'Bật bán'}</span>
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
                                <span>Xóa</span>
                              </Menu.Item>
                            </Menu.Content>
                          </Menu.Root>
                        </div>
                      </div>

                      {/* Variants & Prices */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#f0ebe4]">
                        {product.variants.map((v) => (
                          <span
                            key={v.id}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border',
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

          {/* TAB 2: DANH MỤC */}
          {activeTab === 'categories' && (
            <div className="grid gap-3.5 sm:gap-4 w-full min-w-0">
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-display text-[var(--char)] m-0">Danh mục thực đơn ({categories.length})</h2>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                    Phân loại các nhóm món (Cà phê, Trà sữa, Trà trái cây, Bánh...) để hiển thị tại POS và KDS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((category) => {
                  const prodCount = allProducts.filter((p) => p.categoryId === category.id).length
                  return (
                    <div
                      key={category.id}
                      className="p-4 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-3 hover:border-[#c5b8a9] transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-9 rounded-lg bg-[#fbf5ee] text-[var(--ember)] flex items-center justify-center border border-[#ede5dc] shrink-0">
                              <IconFolderPlus size={18} stroke={1.75} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-[var(--char)] m-0 truncate">{category.name}</h3>
                              <span className="text-[11px] text-[#8c8177] mt-0.5 block">Thứ tự #{category.sortOrder}</span>
                            </div>
                          </div>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border',
                              category.active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-[#f0ebe4] text-[#716559] border-[#ded6cc]'
                            )}
                          >
                            {category.active ? 'Đang dùng' : 'Đã ẩn'}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[#f0ebe4] flex items-center justify-between text-xs">
                          <span className="text-[#8c8177] font-medium">Số lượng món:</span>
                          <strong className="font-mono font-bold text-[var(--char)]">{prodCount} sản phẩm</strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#f0ebe4]">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canManage}
                          onClick={() => openCategory(category)}
                          className="text-xs w-full font-bold flex items-center justify-center gap-1.5 h-8.5 rounded-lg border-[#d9d0c8]"
                        >
                          <IconPencil size={13} stroke={2} />
                          <span>Sửa danh mục</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 3: NHÓM TOPPING & TÙY CHỌN */}
          {activeTab === 'modifiers' && (
            <div className="grid gap-3.5 sm:gap-4 w-full min-w-0">
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-display text-[var(--char)] m-0">
                    Nhóm Topping & Tùy chọn ({catalog.data?.modifierGroups.length ?? 0})
                  </h2>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                    Quản lý các nhóm tùy biến (Độ ngọt, Lượng đá, Topping phụ thu...) và liên kết vào kích cỡ từng món.
                  </p>
                </div>
              </div>

              {/* List of modifier groups */}
              {catalog.data?.modifierGroups.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#ded6cc] bg-white text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="size-12 rounded-full bg-[#f5ede4] text-[var(--ember)] flex items-center justify-center">
                    <IconToolsKitchen2 size={24} stroke={1.75} />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="text-sm font-bold text-[var(--char)] m-0">Chưa có nhóm Topping nào</h3>
                    <p className="text-xs text-[#8c8177] m-0 mt-1">
                      Tạo nhóm đầu tiên để cấu hình các mức đường, đá hoặc các loại topping có tính phí (trân châu, thạch, kem cheese...).
                    </p>
                  </div>
                  <PrimaryButton size="sm" disabled={!canManage} onClick={() => openModifierGroup()} className="mt-1">
                    + Thêm nhóm Topping đầu tiên
                  </PrimaryButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
                  {catalog.data?.modifierGroups.map((group) => (
                    <div
                      key={group.id}
                      className="p-4 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-3 hover:border-[#c5b8a9] transition-all"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-8 rounded-lg bg-[#fbf5ee] text-[var(--ember)] flex items-center justify-center border border-[#ede5dc] shrink-0">
                              <IconToolsKitchen2 size={16} stroke={1.75} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-[var(--char)] m-0 truncate">{group.name}</h3>
                              <span className="text-[11px] text-[#8c8177] mt-0.5 block">
                                {group.modifiers.length} tùy chọn · Thứ tự #{group.sortOrder}
                              </span>
                            </div>
                          </div>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border',
                              group.active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-[#f0ebe4] text-[#716559] border-[#ded6cc]'
                            )}
                          >
                            {group.active ? 'Đang dùng' : 'Đã ẩn'}
                          </span>
                        </div>

                        {/* Constraint badge */}
                        <div className="mb-2.5">
                          {group.minSelections === 1 && group.maxSelections === 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                              Bắt buộc chọn đúng 1
                            </span>
                          ) : group.minSelections === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[#f0ebe4] text-[#716559]">
                              Tối đa {group.maxSelections} lựa chọn
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Chọn từ {group.minSelections} đến {group.maxSelections}
                            </span>
                          )}
                        </div>

                        {/* Modifiers items list */}
                        <div className="space-y-1.5 pt-2 border-t border-[#f0ebe4]">
                          {group.modifiers.map((mod) => (
                            <div
                              key={mod.id}
                              className={cn(
                                'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border',
                                mod.active
                                  ? 'bg-[#fdfbf7] border-[#ede6de] text-[var(--char)]'
                                  : 'bg-[#f5f1eb] border-[#e0d6cb] text-[#8c8177] line-through opacity-70'
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={cn('size-1.5 rounded-full shrink-0', mod.active ? 'bg-emerald-500' : 'bg-gray-400')} />
                                <span className="truncate font-semibold">{mod.name}</span>
                              </div>
                              <span className="font-mono tabular-nums text-[11px] font-bold shrink-0 text-[var(--ember)]">
                                {mod.priceDelta > 0 ? `+${formatMoney(mod.priceDelta)}` : '0₫'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#ede6de]">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={() => setDeleteGroupTarget(group)}
                          className="text-xs text-[var(--ember)] hover:bg-red-50 hover:text-red-700 h-8 px-2.5 rounded-lg font-semibold"
                        >
                          <IconTrash size={14} stroke={1.75} className="mr-1" />
                          <span>Xóa</span>
                        </Button>
                        <SecondaryButton
                          size="sm"
                          disabled={!canManage}
                          onClick={() => openModifierGroup(group)}
                          className="text-xs font-bold flex items-center gap-1.5 h-8 px-3 rounded-lg border-[#d9d0c8]"
                        >
                          <IconPencil size={13} stroke={2} />
                          <span>Sửa nhóm & Topping</span>
                        </SecondaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COMBO */}
          {activeTab === 'combos' && (
            <div className="grid gap-3.5 sm:gap-4 w-full min-w-0">
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                <div>
                  <h2 className="text-sm sm:text-base font-bold font-display text-[var(--char)] m-0">Gói Combo thực đơn ({catalog.data?.combos.length ?? 0})</h2>
                  <p className="text-xs text-[#8c8177] m-0 mt-0.5">
                    Tạo các gói combo kết hợp nhiều món với mức giá ưu đãi.
                  </p>
                </div>
              </div>

              {catalog.data?.combos.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#ded6cc] bg-white text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="size-12 rounded-full bg-[#f5ede4] text-[var(--ember)] flex items-center justify-center">
                    <IconStack2 size={24} stroke={1.75} />
                  </div>
                  <div className="max-w-sm">
                    <h3 className="text-sm font-bold text-[var(--char)] m-0">Chưa có gói Combo nào</h3>
                    <p className="text-xs text-[#8c8177] m-0 mt-1">
                      Tạo gói combo kết hợp (ví dụ: Cà phê + Bánh ngọt) với giá combo đặc biệt.
                    </p>
                  </div>
                  <PrimaryButton size="sm" disabled={!canManage || !variantOptions.length} onClick={() => openCombo()} className="mt-1">
                    + Thêm Combo đầu tiên
                  </PrimaryButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
                  {catalog.data?.combos.map((combo) => {
                    const productName = allProducts.find((p) => p.id === combo.menuItemId)?.name ?? 'Sản phẩm combo'
                    return (
                      <div
                        key={combo.id}
                        className="p-4 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-3 hover:border-[#c5b8a9] transition-all"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-8 rounded-lg bg-[#fbf5ee] text-[var(--ember)] flex items-center justify-center border border-[#ede5dc] shrink-0">
                                <IconStack2 size={16} stroke={1.75} />
                              </div>
                              <h3 className="text-sm font-bold text-[var(--char)] m-0 truncate">{productName}</h3>
                            </div>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border',
                                combo.active
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-[#f0ebe4] text-[#716559] border-[#ded6cc]'
                              )}
                            >
                              {combo.active ? 'Đang dùng' : 'Đã ẩn'}
                            </span>
                          </div>
                          <div className="font-mono text-base font-bold text-[var(--ember)] tabular-nums mt-1 mb-2">
                            {formatMoney(combo.price)}
                          </div>
                          <div className="space-y-1 pt-2 border-t border-[#f0ebe4]">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c8177] block mb-1">
                              Thành phần ({combo.components.length}):
                            </span>
                            {combo.components.map((comp, idx) => {
                              const variant = comboVariantOptions.find((v) => v.value === comp.variantId)
                              return (
                                <div key={idx} className="flex items-center justify-between text-xs text-[#554a40] py-0.5">
                                  <span>{variant?.label ?? comp.variantId}</span>
                                  <span className="font-bold font-mono text-[var(--char)]">x{comp.quantity}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ede6de]">
                          <SecondaryButton
                            size="sm"
                            disabled={!canManage}
                            onClick={() => openCombo(combo)}
                            className="text-xs w-full font-bold flex items-center justify-center gap-1.5 h-8.5 rounded-lg border-[#d9d0c8]"
                          >
                            <IconPencil size={13} stroke={2} />
                            <span>Sửa Combo</span>
                          </SecondaryButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}



      {/* Product Detail Drawer */}
      <Drawer.Root open={Boolean(selectedProduct)} onOpenChange={(open) => { if (!open) setSelectedProduct(null) }} swipeDirection={isMobile ? 'down' : 'right'}>
        <Drawer.Content direction={isMobile ? 'bottom' : 'right'} className={cn(isMobile ? 'w-full max-h-[92dvh] p-0' : 'w-full max-w-[440px] p-0 flex flex-col')}>
          {selectedProduct && (() => {
            const categoryName = categories.find((c) => c.id === selectedProduct.categoryId)?.name ?? 'Chưa phân loại'
            const minPrice = Math.min(...selectedProduct.variants.map((v) => v.price), 0)
            const maxPrice = Math.max(...selectedProduct.variants.map((v) => v.price), 0)
            const isMultiPrice = minPrice !== maxPrice

            return (
              <>
                <Drawer.Header className="px-5 pt-4 pb-3 border-b border-[#ede6de] flex items-start justify-between gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f0ebe4] text-[#61574f] border border-[#ded6cc]">
                        {categoryName}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          selectedProduct.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-[#f0ebe4] text-[#716559] border-[#ded6cc]'
                        )}
                      >
                        {selectedProduct.active ? 'Đang bán' : 'Ngừng bán'}
                      </span>
                    </div>
                    <Drawer.Title className="text-xl font-bold font-display text-[var(--char)] m-0 truncate">
                      {selectedProduct.name}
                    </Drawer.Title>
                  </div>
                  <Drawer.Close
                    aria-label="Đóng"
                    className="size-8 rounded-lg border border-[#ded6cc] bg-white text-[#716559] hover:text-[var(--char)] flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-[#faf7f3] transition-all"
                  >
                    <IconX size={17} stroke={2} />
                  </Drawer.Close>
                </Drawer.Header>

                <Drawer.Body className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
                  {/* Image & Description */}
                  <div className="rounded-xl border border-[#ede6de] bg-[#fbf9f6] p-3 flex flex-col gap-3">
                    {selectedProduct.imageKey ? (
                      <div className="aspect-video w-full rounded-lg overflow-hidden border border-[#ede6de] bg-white">
                        <img
                          src={`/api/media/menu-images?key=${encodeURIComponent(selectedProduct.imageKey)}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-lg bg-[#f3ece3] border border-dashed border-[#d9d0c8] flex flex-col items-center justify-center gap-1.5 text-[#8c8177]">
                        <IconCoffee size={32} stroke={1.5} className="text-[var(--ember)] opacity-60" />
                        <span className="text-xs font-semibold">Chưa có ảnh món</span>
                      </div>
                    )}
                    {selectedProduct.description ? (
                      <p className="text-xs text-[#5c5248] italic leading-relaxed m-0 border-t border-[#ede6de] pt-2">
                        "{selectedProduct.description}"
                      </p>
                    ) : (
                      <p className="text-xs text-[#a0958a] italic m-0 border-t border-[#ede6de] pt-2">
                        Chưa có mô tả cho sản phẩm này.
                      </p>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                      <span className="text-[10.5px] uppercase font-bold text-[#8c8177] tracking-wider block">Phân loại / Size</span>
                      <strong className="text-sm font-bold text-[var(--char)] mt-0.5 block">
                        {selectedProduct.variants.length} kích cỡ
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs">
                      <span className="text-[10.5px] uppercase font-bold text-[#8c8177] tracking-wider block">Khoảng giá bán</span>
                      <strong className="font-mono text-sm font-bold text-[var(--ember)] mt-0.5 block tabular-nums">
                        {isMultiPrice ? `${formatMoney(minPrice)} - ${formatMoney(maxPrice)}` : formatMoney(minPrice)}
                      </strong>
                    </div>
                  </div>

                  {/* Variants Section */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#63574c] m-0">
                        Kích cỡ & Giá bán ({selectedProduct.variants.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {selectedProduct.variants.map((variant) => {
                        const linkedGroups = (catalog.data?.modifierGroups ?? []).filter((g) =>
                          variant.modifierGroupIds?.includes(g.id)
                        )

                        return (
                          <div
                            key={variant.id}
                            className="p-3 rounded-xl border border-[#e5ddd6] bg-white shadow-2xs flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[var(--char)]">{variant.name}</span>
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[9.5px] font-bold',
                                    variant.active ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                  )}
                                >
                                  {variant.active ? 'Đang bán' : 'Ẩn'}
                                </span>
                              </div>
                              <strong className="font-mono text-sm font-bold text-[var(--ember)] tabular-nums">
                                {formatMoney(variant.price)}
                              </strong>
                            </div>

                            {linkedGroups.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#f0ebe4]">
                                <span className="text-[10px] text-[#8c8177] font-semibold">Topping:</span>
                                {linkedGroups.map((g) => (
                                  <span
                                    key={g.id}
                                    className="px-1.5 py-0.5 rounded bg-[#f5ede4] text-[#61574f] text-[10px] font-medium border border-[#e5ddd6]"
                                  >
                                    {g.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Price History Section */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#63574c] m-0">Lịch sử giá</h4>
                    </div>
                    {priceHistory.isLoading && <SkeletonList rows={3} label="Đang tải lịch sử giá…" itemClassName="p-3" />}
                    {priceHistory.isError && <p className="text-xs text-red-600">Không tải được lịch sử giá.</p>}
                    {!priceHistory.isLoading && !priceHistory.isError && !priceHistory.data?.history.length && (
                      <div className="p-3 rounded-xl border border-dashed border-[#ded6cc] bg-[#fbf9f6] text-center text-xs text-[#8c8177]">
                        Chưa có thay đổi giá nào được ghi nhận.
                      </div>
                    )}
                    {priceHistory.data?.history && priceHistory.data.history.length > 0 && (
                      <div className="space-y-1.5">
                        {priceHistory.data.history.slice(0, 6).map((event) => (
                          <div
                            key={event.id}
                            className="p-2.5 rounded-lg border border-[#ede6de] bg-[#fdfbf8] text-xs flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-[var(--char)] block">
                                {event.oldPrice === null
                                  ? 'Thiết lập giá ban đầu'
                                  : `${formatMoney(event.oldPrice)} → ${formatMoney(event.newPrice)}`}
                              </span>
                              <small className="text-[10px] text-[#8c8177] block mt-0.5">
                                {event.changedBy ?? 'Hệ thống'} · {new Date(event.createdAt).toLocaleString('vi-VN')}
                              </small>
                            </div>
                            {event.oldPrice === null && (
                              <strong className="font-mono text-xs font-bold text-[var(--ember)] tabular-nums">
                                {formatMoney(event.newPrice)}
                              </strong>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Drawer.Body>

                {/* Footer Action Buttons */}
                <div className="p-4 border-t border-[#ede6de] bg-[#fffdfa] flex flex-col gap-2.5 shrink-0">
                  <PrimaryButton
                    className="w-full flex items-center justify-center gap-2 h-10 font-bold"
                    disabled={!canManage}
                    onClick={() => {
                      setSelectedProduct(null)
                      openProduct(selectedProduct)
                    }}
                  >
                    <IconPencil size={15} stroke={2} />
                    <span>Sửa sản phẩm</span>
                  </PrimaryButton>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <SecondaryButton
                        size="sm"
                        className="flex-1 text-xs font-bold h-8.5"
                        onClick={() => setCatalogAction(selectedProduct.active ? 'stop' : null)}
                      >
                        {selectedProduct.active ? 'Ngừng bán' : 'Bật bán'}
                      </SecondaryButton>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-[var(--ember)] hover:bg-red-50 hover:text-red-700 h-8.5 px-3 rounded-lg font-semibold"
                        onClick={() => setCatalogAction('delete')}
                      >
                        <IconTrash size={14} stroke={1.75} className="mr-1" />
                        <span>Xóa</span>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </Drawer.Content>
      </Drawer.Root>

      {/* Stop / Delete Product Alert Dialog */}
      {catalogAction !== null && (
        isMobile ? (
          <Drawer.Root open={catalogAction !== null} onOpenChange={(open) => { if (!open) setCatalogAction(null) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[85dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-2 text-left">
                <Drawer.Title className="text-base font-bold text-[var(--char)]">{catalogAction === 'delete' ? 'Xóa sản phẩm?' : 'Ngừng bán sản phẩm?'}</Drawer.Title>
                <Drawer.Description className="text-xs text-[var(--stone)] mt-1">{catalogAction === 'delete' ? 'Chỉ có thể xóa khi sản phẩm chưa từng xuất hiện trong ticket và không được dùng trong combo. Nếu không đủ điều kiện, hệ thống sẽ hướng dẫn Ngừng bán.' : 'Sản phẩm sẽ biến mất khỏi POS. Các combo đang dùng sản phẩm này cũng được ngừng bán; hóa đơn cũ không thay đổi.'}</Drawer.Description>
              </Drawer.Header>
              <Drawer.Footer className="px-5 pt-3 flex flex-col gap-2">
                <Button variant="danger" className="w-full py-2.5 font-bold" disabled={save.isPending || !selectedProduct} onClick={() => selectedProduct && save.mutate({ action: catalogAction === 'delete' ? 'deleteProduct' : 'stopProduct', productId: selectedProduct.id })}>{catalogAction === 'delete' ? 'Xóa sản phẩm' : 'Ngừng bán'}</Button>
                <Drawer.Close className="w-full h-10 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center">Hủy</Drawer.Close>
              </Drawer.Footer>
              {save.isError && <p className="form-message px-5 pb-3">{save.error.message}</p>}
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <AlertDialog.Root open={catalogAction !== null} onOpenChange={(open) => { if (!open) setCatalogAction(null) }}>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="dialog-backdrop" />
              <AlertDialog.Viewport className="dialog-viewport">
                <AlertDialog.Popup className="editor-dialog">
                  <AlertDialog.Title>{catalogAction === 'delete' ? 'Xóa sản phẩm?' : 'Ngừng bán sản phẩm?'}</AlertDialog.Title>
                  <AlertDialog.Description>{catalogAction === 'delete' ? 'Chỉ có thể xóa khi sản phẩm chưa từng xuất hiện trong ticket và không được dùng trong combo. Nếu không đủ điều kiện, hệ thống sẽ hướng dẫn Ngừng bán.' : 'Sản phẩm sẽ biến mất khỏi POS. Các combo đang dùng sản phẩm này cũng được ngừng bán; hóa đơn cũ không thay đổi.'}</AlertDialog.Description>
                  <div className="dialog-actions">
                    <AlertDialog.Close className="h-8.5 px-4 text-xs font-bold rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">Hủy</AlertDialog.Close>
                    <Button variant="danger" disabled={save.isPending || !selectedProduct} onClick={() => selectedProduct && save.mutate({ action: catalogAction === 'delete' ? 'deleteProduct' : 'stopProduct', productId: selectedProduct.id })}>{catalogAction === 'delete' ? 'Xóa sản phẩm' : 'Ngừng bán'}</Button>
                  </div>
                  {save.isError && <p className="form-message">{save.error.message}</p>}
                </AlertDialog.Popup>
              </AlertDialog.Viewport>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )
      )}

      {/* Delete Group Alert Dialog */}
      {deleteGroupTarget !== null && (
        isMobile ? (
          <Drawer.Root open={deleteGroupTarget !== null} onOpenChange={(open) => { if (!open) setDeleteGroupTarget(null) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[85dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-2 text-left">
                <Drawer.Title className="text-base font-bold text-[var(--char)]">Xóa nhóm topping?</Drawer.Title>
                <Drawer.Description className="text-xs text-[var(--stone)] mt-1">Nhóm "{deleteGroupTarget?.name}" và các tùy chọn trong đó sẽ bị xóa khỏi mọi kích cỡ đang gắn. Chỉ xóa được khi nhóm chưa từng được chọn trong ticket; nếu không, hãy dùng phần Sửa để ẩn tùy chọn.</Drawer.Description>
              </Drawer.Header>
              <Drawer.Footer className="px-5 pt-3 flex flex-col gap-2">
                <Button variant="danger" className="w-full py-2.5 font-bold" disabled={save.isPending || !deleteGroupTarget} onClick={() => deleteGroupTarget && save.mutate({ action: 'deleteModifierGroup', groupId: deleteGroupTarget.id })}>Xóa nhóm</Button>
                <Drawer.Close className="w-full h-10 rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs shadow-2xs hover:bg-[#faf7f3] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center">Hủy</Drawer.Close>
              </Drawer.Footer>
              {save.isError && <p className="form-message px-5 pb-3">{save.error.message}</p>}
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <AlertDialog.Root open={deleteGroupTarget !== null} onOpenChange={(open) => { if (!open) setDeleteGroupTarget(null) }}>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="dialog-backdrop" />
              <AlertDialog.Viewport className="dialog-viewport">
                <AlertDialog.Popup className="editor-dialog">
                  <AlertDialog.Title>Xóa nhóm topping?</AlertDialog.Title>
                  <AlertDialog.Description>Nhóm "{deleteGroupTarget?.name}" và các tùy chọn trong đó sẽ bị xóa khỏi mọi kích cỡ đang gắn. Chỉ xóa được khi nhóm chưa từng được chọn trong ticket; nếu không, hãy dùng phần Sửa để ẩn tùy chọn.</AlertDialog.Description>
                  <div className="dialog-actions">
                    <AlertDialog.Close className="h-8.5 px-4 text-xs font-bold rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center">Hủy</AlertDialog.Close>
                    <Button variant="danger" disabled={save.isPending || !deleteGroupTarget} onClick={() => deleteGroupTarget && save.mutate({ action: 'deleteModifierGroup', groupId: deleteGroupTarget.id })}>Xóa nhóm</Button>
                  </div>
                  {save.isError && <p className="form-message">{save.error.message}</p>}
                </AlertDialog.Popup>
              </AlertDialog.Viewport>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )
      )}

      {/* Category Dialog / Drawer */}
      {categoryDialog !== null && (
        isMobile ? (
          <Drawer.Root open={categoryDialog !== null} onOpenChange={(open) => { if (!open) setCategoryDialog(null) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[85dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de] text-left">
                <Drawer.Title className="text-lg font-bold font-display text-[var(--char)]">
                  {categoryDialog === 'new' ? 'Tạo danh mục mới' : 'Sửa danh mục'}
                </Drawer.Title>
                <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                  Danh mục phân loại các món hiển thị trên POS & KDS.
                </Drawer.Description>
              </Drawer.Header>
              <Drawer.Body className="px-5 py-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    save.mutate({ action: 'saveCategory', category: { id: categoryDialog && categoryDialog !== 'new' ? categoryDialog.id : undefined, ...categoryDraft } })
                  }}
                  className="space-y-4"
                >
                  <div className="product-mockup-field">
                    <label className="product-mockup-label">
                      TÊN DANH MỤC <span className="text-[#b3381e]">*</span>
                    </label>
                    <Input
                      size="md"
                      required
                      value={categoryDraft.name}
                      onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ví dụ: Cà phê, Trà trái cây, Bánh ngọt..."
                      className="product-mockup-input"
                    />
                  </div>

                  <div className="product-mockup-field">
                    <label className="product-mockup-label">THỨ TỰ HIỂN THỊ</label>
                    <Input
                      size="md"
                      min="0"
                      type="number"
                      value={categoryDraft.sortOrder}
                      onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                      className="product-mockup-input font-data"
                    />
                    <small className="text-[11px] text-[#8c8177] mt-1">
                      Số nhỏ hơn sẽ hiển thị trước trên thanh danh mục POS.
                    </small>
                  </div>

                  <div className="product-mockup-status-card">
                    <div>
                      <span className="product-mockup-status-title">TRẠNG THÁI HOẠT ĐỘNG</span>
                      <span className="product-mockup-status-sub">Hiển thị danh mục trên menu POS</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-[var(--char)]">
                        {categoryDraft.active ? 'Đang dùng' : 'Đã ẩn'}
                      </span>
                      <Switch
                        checked={categoryDraft.active}
                        onCheckedChange={(checked) => setCategoryDraft((current) => ({ ...current, active: checked === true }))}
                      />
                    </div>
                  </div>

                  {save.isError && <p className="form-message">{save.error.message}</p>}

                  <div className="product-mockup-footer pt-3">
                    <div className="flex items-center gap-2.5 w-full">
                      <Drawer.Close className="product-mockup-cancel-btn flex-1">
                        Hủy
                      </Drawer.Close>
                      <button
                        type="submit"
                        disabled={save.isPending}
                        className="product-mockup-save-btn flex-1"
                      >
                        {save.isPending ? 'Đang lưu…' : 'Lưu danh mục'}
                      </button>
                    </div>
                  </div>
                </form>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={categoryDialog !== null} onOpenChange={(open) => { if (!open) setCategoryDialog(null) }}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '520px' }}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      save.mutate({ action: 'saveCategory', category: { id: categoryDialog && categoryDialog !== 'new' ? categoryDialog.id : undefined, ...categoryDraft } })
                    }}
                    className="product-mockup-form"
                  >
                    {/* Header */}
                    <div className="product-mockup-header">
                      <div>
                        <Dialog.Title className="product-mockup-heading">
                          {categoryDialog === 'new' ? 'Tạo danh mục mới' : 'Chỉnh sửa danh mục'}
                        </Dialog.Title>
                        <Dialog.Description className="product-mockup-sub">
                          Danh mục phân loại các món hiển thị trên POS & KDS.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close aria-label="Đóng" className="product-mockup-close-btn">
                        <IconX size={18} stroke={1.75} />
                      </Dialog.Close>
                    </div>

                    <div className="flex flex-col gap-4 mt-4">
                      <div className="product-mockup-field">
                        <label className="product-mockup-label">
                          TÊN DANH MỤC <span className="text-[#b3381e]">*</span>
                        </label>
                        <Input
                          size="md"
                          required
                          value={categoryDraft.name}
                          onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Ví dụ: Cà phê, Trà trái cây, Bánh ngọt..."
                          className="product-mockup-input"
                        />
                      </div>

                      <div className="product-mockup-field">
                        <label className="product-mockup-label">THỨ TỰ HIỂN THỊ</label>
                        <Input
                          size="md"
                          min="0"
                          type="number"
                          value={categoryDraft.sortOrder}
                          onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                          className="product-mockup-input font-data"
                        />
                        <small className="text-[11px] text-[#8c8177] mt-1">
                          Số nhỏ hơn sẽ hiển thị trước trên thanh danh mục POS.
                        </small>
                      </div>

                      <div className="product-mockup-status-card">
                        <div>
                          <span className="product-mockup-status-title">TRẠNG THÁI HOẠT ĐỘNG</span>
                          <span className="product-mockup-status-sub">Hiển thị danh mục trên menu POS</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-[var(--char)]">
                            {categoryDraft.active ? 'Đang dùng' : 'Đã ẩn'}
                          </span>
                          <Switch
                            checked={categoryDraft.active}
                            onCheckedChange={(checked) => setCategoryDraft((current) => ({ ...current, active: checked === true }))}
                          />
                        </div>
                      </div>
                    </div>

                    {save.isError && <p className="form-message mt-3">{save.error.message}</p>}

                    <div className="product-mockup-footer">
                      <div className="ml-auto flex items-center gap-3">
                        <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                        <button type="submit" disabled={save.isPending} className="product-mockup-save-btn">
                          {save.isPending ? 'Đang lưu…' : 'Lưu danh mục'}
                        </button>
                      </div>
                    </div>
                  </form>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}

      {/* Product Dialog / Drawer matching uploaded mockup 100% */}
      {productDialog && (
        isMobile ? (
          <Drawer.Root open={productDialog} onOpenChange={(open) => { if (!open) setProductDialog(false) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de]">
                <div>
                  <Drawer.Title className="text-xl font-bold font-display text-[var(--char)]">
                    {productDraft?.id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                  </Drawer.Title>
                  <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                    Quản lý thông tin món, ảnh đại diện và kích cỡ.
                  </Drawer.Description>
                </div>
              </Drawer.Header>
              <Drawer.Body className="px-3 sm:px-5 py-3">
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
                          <ImageUpload
                            value={productDraft.imageKey}
                            onChange={(key) => setProductDraft((current) => current ? { ...current, imageKey: key } : current)}
                          />
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
                        <Drawer.Close className="product-mockup-cancel-btn">
                          Hủy
                        </Drawer.Close>
                        <button
                          type="submit"
                          disabled={save.isPending}
                          className="product-mockup-save-btn"
                        >
                          {save.isPending ? 'Đang lưu…' : 'Lưu sản phẩm'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
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
                            <ImageUpload
                              value={productDraft.imageKey}
                              onChange={(key) => setProductDraft((current) => current ? { ...current, imageKey: key } : current)}
                            />
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
                            disabled={save.isPending}
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
        )
      )}

      {/* Modifier Group Dialog / Drawer */}
      {modifierDialog && (
        isMobile ? (
          <Drawer.Root open={modifierDialog} onOpenChange={(open) => { if (!open) setModifierDialog(false) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[90dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de]">
                <div>
                  <Drawer.Title className="text-xl font-bold font-display text-[var(--char)]">
                    {modifierDraft.id ? 'Sửa nhóm tùy chọn' : 'Thêm nhóm tùy chọn'}
                  </Drawer.Title>
                  <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                    Nhóm sẽ được gắn vào các kích cỡ sản phẩm tại POS.
                  </Drawer.Description>
                </div>
              </Drawer.Header>
              <Drawer.Body className="px-4 py-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    save.mutate({ action: 'saveModifierGroup', group: modifierDraft })
                  }}
                  className="product-mockup-form"
                >
                  <div className="flex flex-col gap-4">
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
                                    required
                                    min="0"
                                    step="1000"
                                    type="number"
                                    value={modifier.priceDelta || ''}
                                    onChange={(event) => setModifierDraft({
                                      ...modifierDraft,
                                      modifiers: modifierDraft.modifiers.map((item, itemIndex) => itemIndex === index ? { ...item, priceDelta: Number(event.target.value) } : item)
                                    })}
                                    placeholder="0"
                                    className="product-mockup-table-input pr-6 font-data"
                                  />
                                  <span className="absolute right-2 text-xs text-[var(--stone)] pointer-events-none">₫</span>
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
                                    aria-label="Trạng thái tùy chọn"
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
                      <Drawer.Close className="product-mockup-cancel-btn">
                        Hủy
                      </Drawer.Close>
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
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={modifierDialog} onOpenChange={(open) => { if (!open) setModifierDialog(false) }}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '640px' }}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      save.mutate({ action: 'saveModifierGroup', group: modifierDraft })
                    }}
                    className="product-mockup-form"
                  >
                    {/* Header */}
                    <div className="product-mockup-header">
                      <div>
                        <Dialog.Title className="product-mockup-heading">
                          {modifierDraft.id ? 'Sửa nhóm tùy chọn' : 'Thêm nhóm tùy chọn'}
                        </Dialog.Title>
                        <Dialog.Description className="product-mockup-sub">
                          Nhóm sẽ được gắn vào các kích cỡ sản phẩm tại POS.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close
                        aria-label="Đóng"
                        className="product-mockup-close-btn"
                      >
                        <IconX size={18} stroke={1.75} />
                      </Dialog.Close>
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
                                      required
                                      min="0"
                                      step="1000"
                                      type="number"
                                      value={modifier.priceDelta || ''}
                                      onChange={(event) => setModifierDraft({
                                        ...modifierDraft,
                                        modifiers: modifierDraft.modifiers.map((item, itemIndex) => itemIndex === index ? { ...item, priceDelta: Number(event.target.value) } : item)
                                      })}
                                      placeholder="0"
                                      className="product-mockup-table-input pr-6 font-data"
                                    />
                                    <span className="absolute right-2 text-xs text-[var(--stone)] pointer-events-none">₫</span>
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
                                      aria-label="Trạng thái tùy chọn"
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
        )
      )}

      {/* Combo Dialog / Drawer */}
      {comboDialog && (
        isMobile ? (
          <Drawer.Root open={comboDialog} onOpenChange={(open) => { if (!open) setComboDialog(false) }}>
            <Drawer.Content direction="bottom" className="w-full max-h-[90dvh] p-0">
              <Drawer.Header className="px-5 pt-3 pb-3 border-b border-[#ede6de] text-left">
                <Drawer.Title className="text-lg font-bold font-display text-[var(--char)]">
                  {comboDraft.id ? 'Sửa gói Combo' : 'Thêm gói Combo mới'}
                </Drawer.Title>
                <Drawer.Description className="text-xs text-[#8c8177] mt-0.5">
                  Combo là gói kết hợp nhiều món/size với mức giá ưu đãi.
                </Drawer.Description>
              </Drawer.Header>
              <Drawer.Body className="px-5 py-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    save.mutate({ action: 'saveCombo', combo: comboDraft })
                  }}
                  className="space-y-4"
                >
                  <div className="product-mockup-field">
                    <label className="product-mockup-label">
                      SẢN PHẨM COMBO <span className="text-[#b3381e]">*</span>
                    </label>
                    <AppSelect
                      size="md"
                      items={productOptions}
                      value={comboDraft.menuItemId}
                      onValueChange={(val) => setComboDraft({ ...comboDraft, menuItemId: val })}
                      placeholder="Chọn món đại diện cho Combo…"
                      triggerClassName="product-mockup-input"
                    />
                  </div>

                  <div className="product-mockup-field">
                    <label className="product-mockup-label">
                      GIÁ BÁN COMBO (₫) <span className="text-[#b3381e]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Input
                        size="md"
                        min="0"
                        step="1000"
                        required
                        type="number"
                        value={comboDraft.price || ''}
                        onChange={(event) => setComboDraft({ ...comboDraft, price: Number(event.target.value) })}
                        placeholder="Nhập giá bán combo"
                        className="product-mockup-input pr-7 font-data"
                      />
                      <span className="absolute right-3 text-xs text-[var(--stone)] pointer-events-none">₫</span>
                    </div>
                  </div>

                  <div className="product-mockup-status-card">
                    <div>
                      <span className="product-mockup-status-title">TRẠNG THÁI BÁN</span>
                      <span className="product-mockup-status-sub">Hiển thị và bán combo này tại POS</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-[var(--char)]">
                        {comboDraft.active ? 'Đang bán' : 'Ngừng bán'}
                      </span>
                      <Switch
                        checked={comboDraft.active}
                        onCheckedChange={(checked) => setComboDraft({ ...comboDraft, active: checked === true })}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#63574c] m-0">
                        Thành phần gói combo ({comboDraft.components.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setComboDraft({
                          ...comboDraft,
                          components: [...comboDraft.components, { variantId: comboVariantOptions[0]?.value ?? '', quantity: 1 }]
                        })}
                        className="text-xs font-semibold text-[var(--ember)] hover:underline"
                      >
                        + Thêm món
                      </button>
                    </div>

                    <div className="space-y-2">
                      {comboDraft.components.map((component, index) => (
                        <div key={`${component.variantId}-${index}`} className="flex items-center gap-2 p-2 rounded-lg border border-[#e5ddd6] bg-[#fdfcfb]">
                          <AppSelect
                            size="sm"
                            items={comboVariantOptions}
                            value={component.variantId}
                            onValueChange={(val) => setComboDraft({
                              ...comboDraft,
                              components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: val } : item)
                            })}
                            placeholder="Chọn món / size…"
                            triggerClassName="flex-1 bg-white text-xs"
                          />
                          <Input
                            size="sm"
                            min="1"
                            max="99"
                            required
                            type="number"
                            value={component.quantity}
                            onChange={(event) => setComboDraft({
                              ...comboDraft,
                              components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item)
                            })}
                            className="w-14 text-center font-data text-xs"
                          />
                          <button
                            type="button"
                            disabled={comboDraft.components.length <= 1}
                            onClick={() => setComboDraft({
                              ...comboDraft,
                              components: comboDraft.components.filter((_, itemIndex) => itemIndex !== index)
                            })}
                            className="product-mockup-trash-btn text-[var(--ember)]"
                          >
                            {TrashIcon}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {save.isError && <p className="form-message">{save.error.message}</p>}

                  <div className="product-mockup-footer pt-3">
                    <div className="flex items-center gap-2.5 w-full">
                      <Drawer.Close className="product-mockup-cancel-btn flex-1">
                        Hủy
                      </Drawer.Close>
                      <button
                        type="submit"
                        disabled={save.isPending || !comboDraft.components.length}
                        className="product-mockup-save-btn flex-1"
                      >
                        {save.isPending ? 'Đang lưu…' : 'Lưu Combo'}
                      </button>
                    </div>
                  </div>
                </form>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Root>
        ) : (
          <Dialog.Root open={comboDialog} onOpenChange={(open) => { if (!open) setComboDialog(false) }}>
            <Dialog.Portal>
              <Dialog.Backdrop className="dialog-backdrop" />
              <Dialog.Viewport className="dialog-viewport">
                <Dialog.Popup className="product-mockup-dialog" style={{ maxWidth: '600px' }}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      save.mutate({ action: 'saveCombo', combo: comboDraft })
                    }}
                    className="product-mockup-form"
                  >
                    {/* Header */}
                    <div className="product-mockup-header">
                      <div>
                        <Dialog.Title className="product-mockup-heading">
                          {comboDraft.id ? 'Sửa gói Combo' : 'Tạo gói Combo mới'}
                        </Dialog.Title>
                        <Dialog.Description className="product-mockup-sub">
                          Combo là một sản phẩm bán theo giá cố định, gồm các món có sẵn.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close aria-label="Đóng" className="product-mockup-close-btn">
                        <IconX size={18} stroke={1.75} />
                      </Dialog.Close>
                    </div>

                    <div className="flex flex-col gap-4 mt-4">
                      <div className="product-mockup-field">
                        <label className="product-mockup-label">
                          SẢN PHẨM COMBO <span className="text-[#b3381e]">*</span>
                        </label>
                        <AppSelect
                          size="md"
                          items={productOptions}
                          value={comboDraft.menuItemId}
                          onValueChange={(val) => setComboDraft({ ...comboDraft, menuItemId: val })}
                          placeholder="Chọn sản phẩm đại diện…"
                          triggerClassName="product-mockup-input"
                        />
                      </div>

                      <div className="product-mockup-field">
                        <label className="product-mockup-label">
                          GIÁ COMBO (₫) <span className="text-[#b3381e]">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <Input
                            size="md"
                            min="0"
                            step="1000"
                            required
                            type="number"
                            value={comboDraft.price || ''}
                            onChange={(event) => setComboDraft({ ...comboDraft, price: Number(event.target.value) })}
                            placeholder="Nhập giá trọn gói combo"
                            className="product-mockup-input pr-7 font-data"
                          />
                          <span className="absolute right-3 text-xs text-[var(--stone)] pointer-events-none">₫</span>
                        </div>
                      </div>

                      <div className="product-mockup-status-card">
                        <div>
                          <span className="product-mockup-status-title">TRẠNG THÁI BÁN</span>
                          <span className="product-mockup-status-sub">Hiển thị và bán combo này tại POS</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-[var(--char)]">
                            {comboDraft.active ? 'Đang bán' : 'Ngừng bán'}
                          </span>
                          <Switch
                            checked={comboDraft.active}
                            onCheckedChange={(checked) => setComboDraft({ ...comboDraft, active: checked === true })}
                          />
                        </div>
                      </div>
                    </div>

                    <hr className="product-mockup-divider" />

                    {/* Section: Thành phần combo */}
                    <div className="product-mockup-section">
                      <div className="product-mockup-section-header">
                        <div>
                          <h3 className="product-mockup-heading text-base">Thành phần trong Combo</h3>
                          <p className="product-mockup-sub">Các món và số lượng tương ứng bao gồm trong gói combo này.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setComboDraft({
                            ...comboDraft,
                            components: [...comboDraft.components, { variantId: comboVariantOptions[0]?.value ?? '', quantity: 1 }]
                          })}
                          className="product-mockup-add-btn"
                        >
                          + Thêm thành phần
                        </button>
                      </div>

                      <div className="space-y-2 mt-3">
                        {comboDraft.components.map((component, index) => (
                          <div key={`${component.variantId}-${index}`} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#e5ddd6] bg-[#fdfcfb]">
                            <AppSelect
                              size="sm"
                              items={comboVariantOptions}
                              value={component.variantId}
                              onValueChange={(val) => setComboDraft({
                                ...comboDraft,
                                components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: val } : item)
                              })}
                              placeholder="Chọn món / size…"
                              triggerClassName="flex-1 bg-white text-xs"
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-[#8c8177] font-medium">SL:</span>
                              <Input
                                size="sm"
                                min="1"
                                max="99"
                                required
                                aria-label="Số lượng thành phần"
                                type="number"
                                value={component.quantity}
                                onChange={(event) => setComboDraft({
                                  ...comboDraft,
                                  components: comboDraft.components.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item)
                                })}
                                className="w-16 text-center font-data"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={comboDraft.components.length <= 1}
                              onClick={() => setComboDraft({
                                ...comboDraft,
                                components: comboDraft.components.filter((_, itemIndex) => itemIndex !== index)
                              })}
                              className="product-mockup-trash-btn text-[var(--ember)]"
                              title="Xóa thành phần"
                            >
                              {TrashIcon}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {save.isError && <p className="form-message mt-3">{save.error.message}</p>}

                    <div className="product-mockup-footer">
                      <span className="product-mockup-count">
                        {comboDraft.components.length} thành phần trong combo
                      </span>
                      <div className="flex items-center gap-3">
                        <Dialog.Close className="product-mockup-cancel-btn">Hủy</Dialog.Close>
                        <button
                          type="submit"
                          disabled={save.isPending || !comboDraft.components.length}
                          className="product-mockup-save-btn"
                        >
                          {save.isPending ? 'Đang lưu…' : 'Lưu Combo'}
                        </button>
                      </div>
                    </div>
                  </form>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        )
      )}
    </div>
  )
}
