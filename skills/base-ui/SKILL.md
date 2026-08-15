---
name: base-ui
description: Build, wrap, and style accessible UI components using @base-ui/react (Base UI v1) and Tailwind CSS v4 in this repository. Use whenever creating or modifying UI components (Dialog, Popover, Select, Menu, Tabs, Tooltip, Switch, Checkbox, Accordion, Drawer, etc.) or when looking up Base UI documentation via https://base-ui.com/llms.txt.
---

# Base UI Component Architecture & Guidelines

This repository uses `@base-ui/react` (Base UI v1) as the headless, unstyled UI component foundation, styled with Tailwind CSS v4 and the project design tokens.

## Authoritative Documentation for AI Agents

- **LLM Index**: [`https://base-ui.com/llms.txt`](https://base-ui.com/llms.txt)
- **Component Docs Format**: Markdown documentation for any component is directly available at:
  `https://base-ui.com/react/components/<component-name>.md`
  (e.g., `https://base-ui.com/react/components/dialog.md`, `https://base-ui.com/react/components/popover.md`, `https://base-ui.com/react/components/select.md`, `https://base-ui.com/react/components/menu.md`, `https://base-ui.com/react/components/tabs.md`, `https://base-ui.com/react/components/tooltip.md`, `https://base-ui.com/react/components/accordion.md`, `https://base-ui.com/react/components/drawer.md`)
- **Quick Start Guide**: [`https://base-ui.com/react/overview/quick-start.md`](https://base-ui.com/react/overview/quick-start.md)

Whenever implementing or troubleshooting any Base UI component, fetch its `.md` documentation directly using your web reading tools.

---

## Component Authoring Standards

1. **File Location**:
   - Place all reusable UI primitives in `src/components/ui/<component-name>.tsx` (e.g., `src/components/ui/dialog.tsx`, `src/components/ui/popover.tsx`).
   - Export components from `src/components/ui/index.ts`.

2. **Class Merging Utility**:
   - Always use `import { cn } from "@/lib/utils"` (powered by `clsx` + `tailwind-merge`).
   - Base UI components allow `className` to be a string or a callback function `(state) => string`. Support both when wrapping primitives:
   ```tsx
   function resolveClassName<T>(
     defaultClasses: string,
     className?: string | ((state: T) => string | undefined)
   ): string | ((state: T) => string | undefined) {
     if (typeof className === 'function') {
       return (state: T) => cn(defaultClasses, className(state))
     }
     return cn(defaultClasses, className)
   }
   ```

3. **Export Pattern**:
   - Provide named primitive exports (e.g. `DialogRoot`, `DialogTrigger`, `DialogPortal`, `DialogBackdrop`, `DialogViewport`, `DialogPopup`, `DialogTitle`, `DialogDescription`, `DialogClose`).
   - Provide convenient high-level composite components (e.g. `DialogContent`, `DialogHeader`, `DialogFooter`).
   - Provide a namespaced default compound component export (e.g. `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`, etc.).

4. **Animations & State Selectors**:
   - Base UI uses HTML data attributes for states and animations:
     - `data-open`, `data-closed`
     - `data-starting-style`, `data-ending-style` (Tailwind: `data-starting-style:opacity-0`, `data-ending-style:opacity-0`)
     - `data-disabled`

5. **iOS Safari Backdrop Fix**:
   - Always add `supports-[-webkit-touch-callout:none]:absolute` to backdrops for full mobile Safari coverage.
