import type { ReactNode } from 'react'

export function TicketCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`ticket-card ${className}`}>{children}</article>
}
