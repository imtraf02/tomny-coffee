# Kiến trúc ứng dụng nội bộ

## Quyết định nền tảng

Ứng dụng dùng **TanStack Start** thay cho Next.js. Đây là một ứng dụng full-stack, router-first, gồm ba surface nội bộ: `/pos` cho thu ngân, `/kds` cho pha chế và `/admin` cho quản lý.

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

## Route nội bộ

| Route | Mục đích | Quyền đọc tối thiểu |
| --- | --- | --- |
| `/pos` | Thu ngân, tạo và thanh toán đơn | `pos.read` |
| `/kds` | Pha chế, theo dõi ticket | `kds.read` |
| `/admin` | Tổng quan vận hành | `reports.read` |
| `/admin/menu` | Danh mục, sản phẩm, biến thể, topping và combo | `menu.read` |
| `/admin/inventory` | Kho, lô hàng và kiểm kê | `inventory.read` |
| `/admin/tables` | Danh sách khu vực và bàn | `floor_plan.read` |
| `/admin/orders` | Lịch sử và xử lý đơn | `orders.read` |
| `/admin/staff` | Nhân viên, quyền và chấm công | `staff.read` |
| `/admin/reports` | Báo cáo và xuất file | `reports.read` |
| `/admin/audit` | Nhật ký kiểm toán | `audit.read` |

Mỗi route quản trị tự kiểm tra quyền ở server. Khi không có quyền với trang được yêu cầu, hệ thống chuyển nhân viên đến khu quản trị đầu tiên họ được phép xem.

## Bàn và vận hành tại bàn

- `zones` chỉ nhóm bàn theo khu vực như Tầng 1 hoặc Sân vườn. `tables` giữ identity, mã public và trạng thái vận hành; không có thực thể sơ đồ, canvas, draft hoặc publish.
- `/admin` quản lý bàn qua một danh sách có lọc/search, thêm/sửa/xóa bàn và khu vực. `/pos` hiển thị danh sách lớn, dễ chạm của bàn trong khu vực đang chọn.
- Trạng thái được derive từ đơn mở hoặc override thủ công `dat_truoc` / `can_don`. `reservations`, `reservation_tables` và `table_blocks` vẫn có lifecycle, kiểm tra overlap và audit.

## Phạm vi MVP và nguyên tắc vận hành

- Phase 1: menu, variants, topping/combo, POS tiền mặt, ticket bàn, print dialog, queue PWA/IndexedDB và audit log.
- Phase 2: tồn kho, phiếu nhập/kiểm kê/điều chỉnh thủ công, chấm công và role/invite.
- Phase 3: KDS polling; lịch sử đơn hàng; báo cáo doanh thu/top món/giảm giá/COGS và xuất XLSX/PDF.
- Tauri, hardware ESC/POS, thanh toán điện tử, khách hàng/loyalty, đa chi nhánh, và delivery thuộc giai đoạn mở rộng.

PWA offline chỉ là giảm thiểu gián đoạn: hiển thị rõ trạng thái kết nối và số đơn chờ đồng bộ; không xem nó tương đương POS native offline-first.

## Catalog sản phẩm

- `categories`, `menu_items` và `menu_variants` là catalog bán hàng. POS chỉ nhận các node đang active; danh mục inactive sẽ ẩn sản phẩm bên trong.
- `/admin` quản lý danh mục, sản phẩm, ảnh R2, variants/size, nhóm topping, combo cố định. Các thay đổi chỉ deactivate, không xóa catalog đã phát sinh đơn lịch sử.
- POS cache catalog active gần nhất trong IndexedDB. Checkout lưu product/variant ID và name/price snapshot; server kiểm tra variant còn active trước khi ghi đơn.
- Topping và combo đã có trong MVP. Kho được cập nhật bằng phiếu nhập, kiểm kê hoặc điều chỉnh có audit; thanh toán không tự trừ nguyên liệu hoặc tính COGS theo sản phẩm.

## Ticket và quyền vận hành

- Draft order có `version` để phát hiện thao tác đồng thời; POS cung cấp di chuyển, tách và gộp ticket, server ghi audit cho từng thao tác.
- Thanh toán draft dùng idempotency key riêng; order quầy/mang đi có thể đưa vào IndexedDB khi offline và tự đồng bộ khi online.
- Permission được kiểm tra tại API/route server. Các nhóm chính gồm `pos.*`, `kds.*`, `orders.*`, `menu.*`, `inventory.*`, `floor_plan.*`, `staff.*`, `timeclock.*`, `reports.*` và `audit.read`.
- `/admin` dùng sidebar theo quyền; audit log, chấm công và đổi mật khẩu đều nằm trong cùng ứng dụng nội bộ.
