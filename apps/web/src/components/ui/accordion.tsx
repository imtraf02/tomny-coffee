import * as React from 'react'
import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import { resolveClassName } from './_utils'

export const AccordionRoot = BaseAccordion.Root

export const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Item>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Item>
>(({ className, ...props }, ref) => (
  <BaseAccordion.Item
    ref={ref}
    className={resolveClassName('border-b border-[#ded1c0]', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

export const AccordionHeader = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Header>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Header>
>(({ className, ...props }, ref) => (
  <BaseAccordion.Header
    ref={ref}
    className={resolveClassName('m-0', className)}
    {...props}
  />
))
AccordionHeader.displayName = 'AccordionHeader'

export const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Trigger>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Trigger>
>(({ className, children, ...props }, ref) => (
  <BaseAccordion.Trigger
    ref={ref}
    className={resolveClassName(
      'flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left text-sm font-bold text-[var(--char)] outline-hidden transition-colors hover:text-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  >
    {children}
    <span className="text-[var(--stone)] transition-transform data-panel-open:rotate-180" aria-hidden="true">⌄</span>
  </BaseAccordion.Trigger>
))
AccordionTrigger.displayName = 'AccordionTrigger'

export const AccordionPanel = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Panel>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Panel>
>(({ className, ...props }, ref) => (
  <BaseAccordion.Panel
    ref={ref}
    className={resolveClassName(
      'overflow-hidden pb-4 text-sm leading-relaxed text-[var(--stone)] transition-[height] data-ending-style:h-0 data-starting-style:h-0',
      className,
    )}
    {...props}
  />
))
AccordionPanel.displayName = 'AccordionPanel'

export const Accordion = Object.assign(AccordionRoot, {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
})

