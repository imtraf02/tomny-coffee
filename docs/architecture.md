# Kiến trúc ứng dụng nội bộ

## Quyết định nền tảng

Ứng dụng dùng **TanStack Start** thay cho Next.js. Đây là một ứng dụng full-stack, router-first, gồm hai surface nội bộ: `/pos` cho thu ngân và `/admin` cho quản lý.

Triển khai ứng dụng lên **Cloudflare Workers**, không dùng Cloudflare Pages hay các adapter Next.js. TanStack Start chạy trên Vite với `@cloudflare/vite-plugin`; Wrangler deploy Worker và static assets. Không dùng `@cloudflare/next-on-pages` hoặc OpenNext.

```
apps/
  web/          # TanStack Start + TanStack Router, chạy trên Cloudflare Workers
packages/
  db/           # Drizzle ORM + Cloudflare D1
  api/          # tRPC routers và server adapters dùng từ web Worker
  ui/           # React components, tokens, ticket card dùng chung
  core/         # Business logic thuần: giá, khuyến mãi, COGS
skills/
  coffee-app-ui-ux/  # Quy chuẩn UI/UX cục bộ của project
```

## Data và server boundary

- Dùng TanStack Query làm lớp fetch/cache duy nhất ở client. Giữ tRPC với `@trpc/tanstack-react-query` cho router dữ liệu có kiểu; thực thi router trong cùng Worker của TanStack Start, trừ khi một service độc lập có lý do vận hành rõ ràng.
- Dùng TanStack Router cho route, loader, search schema và error/pending boundaries. Dùng TanStack Start server functions hoặc server routes ở các ranh giới server phù hợp.
- Truy cập binding D1, R2 và các secret ở mã server qua `env` từ `cloudflare:workers`; không đọc biến runtime bằng `process.env` ở module scope.
- `packages/db` dùng `drizzle-orm/d1`. R2 chỉ dùng Worker binding native (`env.BUCKET.put()` / `get()`), không thêm AWS SDK.

## Deploy

- Dùng `wrangler.jsonc` cho Worker chính, bindings D1/R2 và observability. Vite chịu trách nhiệm build; `wrangler deploy` phát hành Worker.
- Session tự quản lý lưu D1. Quyền là các action riêng lẻ, được kiểm tra ở server boundary; route guard phía client không phải lớp bảo mật duy nhất.

## Bàn và sơ đồ vận hành

- `zones` và `tables` lưu dữ liệu bàn. `pos_x`/`pos_y` là phần trăm canvas và là nguồn dữ liệu duy nhất cho sơ đồ tự do.
- `/admin` là editor canvas có lưới 5%, pointer drag/drop và keyboard nudge; vị trí tự lưu khi thả. `/pos` render cùng canvas ở chế độ chỉ đọc, và cho phép mỗi thiết bị chọn view `Sơ đồ` hoặc `Lưới`.
- `dat_truoc` và `can_don` do quản lý đặt thủ công, tạm ghi đè trạng thái tự động. Khi không có override, `trong`/`dang_phuc_vu` theo lifecycle đơn.
- Không thêm thư viện DnD: drag dùng Pointer Events và Pointer Capture. Ảnh mặt bằng riêng tư trong R2 là nâng cấp sau; canvas hiện dùng nền lưới.

## Phạm vi MVP và nguyên tắc vận hành

- Phase 1: menu, POS tiền mặt, print dialog, queue PWA/IndexedDB, và audit log cho mọi sửa/hủy/giảm giá đơn hàng.
- Phase 2: tồn kho, recipe/BOM, COGS, chấm công và role.
- Phase 3: báo cáo doanh thu/COGS/top món và xuất dữ liệu.
- Tauri, hardware ESC/POS, thanh toán điện tử, khách hàng/loyalty, đa chi nhánh, và delivery thuộc giai đoạn mở rộng.

PWA offline chỉ là giảm thiểu gián đoạn: hiển thị rõ trạng thái kết nối và số đơn chờ đồng bộ; không xem nó tương đương POS native offline-first.
