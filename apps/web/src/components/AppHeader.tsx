import { Link } from '@tanstack/react-router'

export function AppHeader({ area }: { area: 'POS' | 'Quản trị' }) {
  return (
    <header className="app-header">
      <Link to="/" className="wordmark" aria-label="Tomny Coffee, trang chủ">TOMNY <span>COFFEE</span></Link>
      <nav aria-label="Khu vực vận hành">
        <Link to="/pos" activeProps={{ className: 'nav-item is-active' }} className="nav-item">POS</Link>
        <Link to="/admin" activeProps={{ className: 'nav-item is-active' }} className="nav-item">Quản trị</Link>
      </nav>
      <div className="header-meta"><span className="online-dot" />Đang online <span className="header-divider" />{area}</div>
    </header>
  )
}
