import * as React from 'react'
import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { resolveClassName } from './_utils'

export const AvatarRoot = React.forwardRef<
  React.ComponentRef<typeof BaseAvatar.Root>,
  React.ComponentPropsWithoutRef<typeof BaseAvatar.Root>
>(({ className, ...props }, ref) => (
  <BaseAvatar.Root
    ref={ref}
    className={resolveClassName('inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--crema)] text-xs font-bold text-[var(--espresso)]', className)}
    {...props}
  />
))
AvatarRoot.displayName = 'AvatarRoot'

export const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof BaseAvatar.Image>,
  React.ComponentPropsWithoutRef<typeof BaseAvatar.Image>
>(({ className, ...props }, ref) => (
  <BaseAvatar.Image
    ref={ref}
    className={resolveClassName('size-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = 'AvatarImage'

export const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof BaseAvatar.Fallback>,
  React.ComponentPropsWithoutRef<typeof BaseAvatar.Fallback>
>(({ className, ...props }, ref) => (
  <BaseAvatar.Fallback
    ref={ref}
    className={resolveClassName('grid size-full place-items-center bg-[var(--espresso)] text-[var(--crema)]', className)}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

export const Avatar = Object.assign(AvatarRoot, {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
})

