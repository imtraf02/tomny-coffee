---
name: coffee-app-ui-ux
description: Design and implement UI for the internal coffee-operations web app (POS, KDS, and Admin). Use when creating or changing any user-facing route, component, style, interaction, data table, order/ticket view, or UI copy in this repository, so the three surfaces share a coherent system while retaining their distinct operational needs.
---

# Coffee App UI/UX

Build for employees, not customers. Keep the interface direct, operational, and calm. Share tokens and primitives across `/pos`, `/kds`, and `/admin`, but do not make their layouts or information density identical.

## Visual system

Use only these tokens unless a functional requirement makes an addition necessary:

```css
:root {
  --espresso: #2B1D17;
  --crema: #EFE3D0;
  --ember: #B0432A;
  --moss: #66735A;
  --amber: #C48A2E;
  --char: #1C1512;
  --stone: #8C8177;

  --font-display: "Bricolage Grotesque", "Fraunces", serif;
  --font-body: "Inter", "Public Sans", sans-serif;
  --font-data: "IBM Plex Mono", "JetBrains Mono", monospace;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  --radius-sm: 4px;
  --radius-lg: 12px;
}
```

Use `--espresso` as the brand anchor for shared navigation and sign-in, not as the dominant workspace background. Use `--font-display` sparingly for dish names or exceptional headings; use `--font-data` for money, order IDs, timestamps, and comparative numeric columns. Avoid the generic warm-cream, high-contrast-serif, terracotta visual formula; do not introduce colors such as `#D97757`.

## Shared patterns

- Render every order with a reusable **ticket card** with a subtle perforated edge (CSS `clip-path` or an SVG mask). This is the single expressive brand motif across POS, KDS, and order history.
- Render statuses as text badges with `--radius-sm`; never rely on color or icon alone.
- Use `--ember` only for the primary action. Make secondary actions transparent with a `--stone` outline. Do not give a third action the same visual weight as the primary action.
- Use active, precise Vietnamese microcopy. Match the action and confirmation: `Thanh toán` → `Đã thanh toán`. Explain errors and the recovery action, for example: `Không đủ nguyên liệu — kiểm tra kho trước khi nhận đơn này`.

## Route requirements

### `/pos`

- Optimize for speed: complete a normal order in at most three taps.
- Keep all primary touch targets at least 48 × 48 px. Make `Thanh toán` clearly larger than nearby controls.
- Support cash only for this phase. Keep a reserved extension point in the payment component for later payment methods without showing empty tabs now.
- Pin a text-and-color online/offline indicator in the header and show the number of orders waiting to sync.
- Target a fixed counter tablet/desktop first; retain basic reflow for narrower screens.
- Avoid decorative animation. Press feedback must feel immediate (under 100 ms).

### `/kds`

- Design for reading at 1.5–2 m: large, high-contrast, non-light text.
- Label every state in words as well as color, including `Mới nhận`, `Đang pha`, and `Trễ`.
- Append new tickets into available space; do not unexpectedly re-sort existing work or cause layout jumps.
- Keep polling feedback unobtrusive if realtime transport is temporarily unavailable.

### `/admin`

- Prefer usable information density over marketing-style whitespace.
- Build inventory, staff, and report tables with TanStack Table. Use `--font-data` for comparable numeric columns, with sorting and filtering by default.
- Keep charts minimal and trend-oriented.
- Give empty and error states a concrete next action, such as `Chưa có đơn nào hôm nay` with `Tạo đơn mới`.
- For R2 image uploads, show explicit uploading progress and a recoverable failure state; do not use an indefinite spinner alone.
- Provide an obvious keyboard focus state.

## Accessibility and resilience

- Maintain at least 4.5:1 text contrast, including on `--espresso`.
- Respect `prefers-reduced-motion` everywhere.
- Treat POS offline status as operationally critical: convey it in text and color, not an icon alone.

## Pre-merge check

- Use only the defined palette, fonts, spacing, and two radius levels.
- Preserve the ticket-card motif wherever an order appears.
- Confirm POS tap count, 48 px targets, and payment extensibility.
- Confirm KDS readability and non-color status cues.
- Confirm Admin TanStack Table usage and actionable empty/error states.
- Confirm copy uses consistent, specific verbs.
