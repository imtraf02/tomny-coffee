import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  IconReceipt,
  IconHistory,
  IconLayoutDashboard,
  IconUserCircle,
  IconToolsKitchen2,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

function useIsKeyboardOpen() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleViewportChange = () => {
      if (!window.visualViewport) return
      const isShrunk = window.visualViewport.height < window.innerHeight * 0.75
      setIsKeyboardOpen(isShrunk)
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true')
      ) {
        setIsKeyboardOpen(true)
      }
    }

    const handleFocusOut = () => {
      setIsKeyboardOpen(false)
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
      window.visualViewport.addEventListener('scroll', handleViewportChange)
    }
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
        window.visualViewport.removeEventListener('scroll', handleViewportChange)
      }
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  return isKeyboardOpen
}

export function BottomFloatingBar() {
  const isKeyboardOpen = useIsKeyboardOpen()
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })

  // Hide on login, invite, and api
  const isHidden =
    pathname === '/login' ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/api/')

  if (isHidden) return null

  const isOrders = pathname === '/admin/orders'
  const isAdmin = pathname === '/admin' || (pathname.startsWith('/admin') && !isOrders)
  const isPos = pathname.startsWith('/pos')
  const isKds = pathname.startsWith('/kds')
  const isAccount = pathname.startsWith('/account')

  return (
    <nav
      aria-label="Thanh điều hướng nhanh"
      className={cn(
        'no-print fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] transition-all duration-300 ease-out',
        isKeyboardOpen
          ? 'opacity-0 translate-y-16 pointer-events-none'
          : 'opacity-100 translate-y-0'
      )}
    >
      <div className="w-full max-w-lg pointer-events-auto rounded-2xl liquid-glass-dock px-2 shadow-2xl h-16 flex items-center justify-around border border-white/70">
        {/* 1. Bán Hàng */}
        <Link
          to="/pos"
          className={cn(
            'floating-nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-decoration-none transition-all duration-200 select-none',
            isPos
              ? 'is-active text-[var(--ember)] font-bold'
              : 'text-[#7a6c5f] hover:text-[var(--char)] font-medium'
          )}
        >
          <div
            className={cn(
              'floating-nav-icon-wrap flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
              isPos
                ? 'bg-[var(--ember)] text-white shadow-sm scale-105'
                : 'bg-transparent text-current'
            )}
          >
            <IconReceipt size={18} stroke={isPos ? 2.2 : 1.75} />
          </div>
          <span className="text-[10.5px] tracking-tight leading-none whitespace-nowrap">
            Bán Hàng
          </span>
        </Link>

        {/* 2. Pha Chế */}
        <Link
          to="/kds"
          className={cn(
            'floating-nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-decoration-none transition-all duration-200 select-none',
            isKds
              ? 'is-active text-[var(--ember)] font-bold'
              : 'text-[#7a6c5f] hover:text-[var(--char)] font-medium'
          )}
        >
          <div
            className={cn(
              'floating-nav-icon-wrap flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
              isKds
                ? 'bg-[var(--ember)] text-white shadow-sm scale-105'
                : 'bg-transparent text-current'
            )}
          >
            <IconToolsKitchen2 size={18} stroke={isKds ? 2.2 : 1.75} />
          </div>
          <span className="text-[10.5px] tracking-tight leading-none whitespace-nowrap">
            Pha Chế
          </span>
        </Link>

        {/* 3. Lịch Sử */}
        <Link
          to="/admin/orders"
          className={cn(
            'floating-nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-decoration-none transition-all duration-200 select-none',
            isOrders
              ? 'is-active text-[var(--ember)] font-bold'
              : 'text-[#7a6c5f] hover:text-[var(--char)] font-medium'
          )}
        >
          <div
            className={cn(
              'floating-nav-icon-wrap flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
              isOrders
                ? 'bg-[var(--ember)] text-white shadow-sm scale-105'
                : 'bg-transparent text-current'
            )}
          >
            <IconHistory size={18} stroke={isOrders ? 2.2 : 1.75} />
          </div>
          <span className="text-[10.5px] tracking-tight leading-none whitespace-nowrap">
            Lịch Sử
          </span>
        </Link>

        {/* 3. Quản Trị */}
        <Link
          to="/admin"
          className={cn(
            'floating-nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-decoration-none transition-all duration-200 select-none',
            isAdmin
              ? 'is-active text-[var(--ember)] font-bold'
              : 'text-[#7a6c5f] hover:text-[var(--char)] font-medium'
          )}
        >
          <div
            className={cn(
              'floating-nav-icon-wrap flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
              isAdmin
                ? 'bg-[var(--ember)] text-white shadow-sm scale-105'
                : 'bg-transparent text-current'
            )}
          >
            <IconLayoutDashboard size={18} stroke={isAdmin ? 2.2 : 1.75} />
          </div>
          <span className="text-[10.5px] tracking-tight leading-none whitespace-nowrap">
            Quản Trị
          </span>
        </Link>

        {/* 4. Tài Khoản */}
        <Link
          to="/account"
          className={cn(
            'floating-nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full py-1 text-decoration-none transition-all duration-200 select-none',
            isAccount
              ? 'is-active text-[var(--ember)] font-bold'
              : 'text-[#7a6c5f] hover:text-[var(--char)] font-medium'
          )}
        >
          <div
            className={cn(
              'floating-nav-icon-wrap flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
              isAccount
                ? 'bg-[var(--ember)] text-white shadow-sm scale-105'
                : 'bg-transparent text-current'
            )}
          >
            <IconUserCircle size={18} stroke={isAccount ? 2.2 : 1.75} />
          </div>
          <span className="text-[10.5px] tracking-tight leading-none whitespace-nowrap">
            Tài Khoản
          </span>
        </Link>
      </div>
    </nav>
  )
}
