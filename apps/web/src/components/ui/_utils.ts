import { cn } from '@/lib/utils'

export type StatefulClassName<State = unknown> =
  | string
  | ((state: State) => string | undefined)

export function resolveClassName<State = unknown>(
  defaults: string,
  className?: StatefulClassName<State>,
) {
  if (typeof className === 'function') {
    return (state: State) => cn(defaults, className(state))
  }
  return cn(defaults, className)
}

