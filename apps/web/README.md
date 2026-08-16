# Tomny Coffee · web

Ứng dụng web nội bộ chạy bằng TanStack Start, TanStack Router/Query và Cloudflare Workers. Các surface hiện có:

- `/pos`: thu ngân mở ticket tại quầy, mang đi hoặc theo bàn; chọn size/topping/combo; thanh toán tiền mặt; in bằng print dialog; hỗ trợ queue offline cho đơn quầy/mang đi.
- `/kds`: màn hình pha chế polling nhẹ, ticket theo trạng thái mới/đang pha/sẵn sàng/đã giao.
- `/admin`: dashboard vận hành, catalog (danh mục, sản phẩm, variant, topping, combo, ảnh R2), kho và lô nhập, danh sách bàn/khu vực, lịch sử đơn hàng, nhân viên/quyền, chấm công, báo cáo và audit log.

Tauri, ESC/POS, thanh toán điện tử, hóa đơn điện tử, customer app, loyalty và đa chi nhánh chưa nằm trong MVP.

## Local

```bash
npm install
npm run owner:create:local   # nhập email + mật khẩu owner (tối thiểu 10 ký tự)
npm run dev
```

Mở `http://localhost:3000/login`. Không có tài khoản/mật khẩu mặc định trong source. Migration D1 local chạy bằng:

```bash
npx wrangler d1 migrations apply tomny-coffee --local
```

## Kiểm tra và build

```bash
npm run generate-routes
npx tsc --noEmit
npm test
npm run build
```

Build tạo Worker output và PWA manifest/service worker. Cảnh báo chunk lớn do ExcelJS/PDFMake được lazy-load chỉ ở màn hình xuất báo cáo.

## Cloudflare

Bindings nằm trong `wrangler.jsonc`: D1 `DB`, R2 `BUCKET`, và static assets. Cần `wrangler login` trước khi chạy migration/deploy remote:

```bash
npx wrangler d1 migrations apply tomny-coffee --remote
npm run deploy
```

Không commit secrets. R2 được truy cập bằng binding native `env.BUCKET`, không dùng AWS SDK. Staging nên dùng database/bucket riêng trước khi cấp quyền deploy production.

## Quyền và onboarding

Owner được tạo bằng `scripts/create-owner.sh`. Quản lý mời nhân viên tại `/admin` bằng link một lần, hết hạn sau 48 giờ; link chỉ hiển thị một lần để copy thủ công. Server luôn kiểm tra permission, route guard chỉ là lớp UX.

## Ghi chú vận hành

- PWA/IndexedDB chỉ là giải pháp giảm gián đoạn; offline checkout không áp dụng cho draft bàn.
- Bàn được nhóm theo `zones` và quản lý bằng danh sách. `/admin` hỗ trợ lọc, thêm, sửa, xóa bàn/khu vực; `/pos` chọn bàn từ danh sách của từng khu vực.
- Trạng thái vận hành derive từ đơn mở, hoặc được quản lý thủ công ở `dat_truoc` / `can_don`. Reservation và `table_blocks` vẫn có lifecycle/audit riêng.
- Kho MVP có phiếu nhập, kiểm kê và điều chỉnh tồn thủ công. Thanh toán không còn tự trừ kho hoặc tính COGS theo định mức; các số COGS lịch sử được giữ lại để đối soát báo cáo.
- Audit log ghi các thao tác order, catalog, kho, bàn, nhân viên và mời tài khoản.

## UI primitives

Các primitive giao diện dùng `@base-ui/react`, được bọc tại `src/components/ui` để giữ token Coffee App và trạng thái focus/keyboard nhất quán:

- Dialog, Alert Dialog, Drawer, Popover, Tooltip, Menu, Select, Combobox
- Field, Input, Checkbox, Switch, Radio, Number Field, Progress
- Tabs, Accordion, Toggle/Toggle Group, Separator, Avatar, Toast

Surface nghiệp vụ chỉ ghép các primitive này với pattern riêng: ticket card cho order, thao tác lớn cho POS, workspace/drawer cho Admin, chữ dữ liệu mono và trạng thái luôn có cả màu lẫn chữ cho KDS.
