# Đối chiếu bộ sơ đồ báo cáo với mã nguồn — đợt 2 (09/10/2026)

Nguồn đối chiếu: 69 sơ đồ trong thư mục `So-do-bao-cao-HCC/PNG - chen Word` (vẽ theo file "Dự án tốt nghiệp CTuấn Team.docx") và bảng 52 use case (Chương 4 của báo cáo).

## 1. Kết luận chung

- 52/52 use case trong Hình 3.1 (sơ đồ phân rã chức năng) đều đã có điểm cuối API tương ứng trong mã nguồn (xem bảng mục 3).
- 12 trang HTML trong Hình 7.2 đều có; 5 tab Admin Control Tower đúng như Hình 7.2.
- Biểu đồ trạng thái vé (Hình 3.8): 7 trạng thái và toàn bộ chuyển trạng thái đã có trong `src/services/queueEngine/`.
- Chức năng "lấy số xong có QR theo dõi" (Hình 2.4, Hình 7.1) **đã có từ trước** ở màn hình "Nhận số thứ tự" của `kiosk-checklist.html`. Lý do thường gặp khiến không thấy màn hình này khi chạy thử:
  - Ngoài giờ làm việc (`KIOSK_HOURS_ENFORCED = 1`, giờ mở 07:30–17:00, Thứ Hai–Thứ Sáu): bấm "Xác nhận & Lấy số" ra màn hình "Chưa thể lấy số lúc này", không cấp số nên không có QR. Muốn demo ngoài giờ: Admin → Cấu hình Tham số → đặt `KIOSK_HOURS_ENFORCED = 0`.
  - Dữ liệu mẫu chỉ mở Quầy 01 (lĩnh vực Hộ tịch); thủ tục thuộc lĩnh vực Đất đai/Kinh doanh sẽ báo "chưa có quầy phục vụ". Mở thêm quầy ở tab Điều phối.

## 2. Phần còn thiếu so với sơ đồ → đã bổ sung đợt này

| # | Sơ đồ / UC | Trước đợt này | Đã bổ sung |
|---|---|---|---|
| 1 | Hình 2.7 (Luồng 4) + Hình 4.5: "Công dân quét mã QR Re-entry **tại Kiosk**" — UC-09 | Mã QR quay lại chỉ dùng được bằng **điện thoại** (mở `index.html?reentry=` → chatbot). Không có điện thoại thì không có cách quay lại. | Trang mới **`quet-ma.html`** ("Quét mã quay lại hàng đợi") với 3 cách: (1) camera Kiosk — `BarcodeDetector` của trình duyệt, không có thì dùng thư viện `vendor/jsQR.min.js` (Apache-2.0, đóng gói sẵn, chạy offline); (2) máy quét mã USB (gõ như bàn phím) — ô nhận tự giữ focus; (3) nhập tay **Số thứ tự + Mã quay lại 8 ký tự**. Màn hình kết quả hiện số, quầy, số người phía trước, QR theo dõi. Có lối vào trên Trang chủ ("Đã bổ sung hồ sơ xong?") và trong Hướng dẫn sử dụng. |
| 2 | UC-09 — nhập tay khi không quét được | Token 48 ký tự, không thể đọc/nhập tay. | Phiếu quay lại (quầy) in thêm **Mã quay lại** = 8 ký tự đầu của token (VD `3F9A-2B7C`). API `/api/kiosk/reentry-scan` nhận `{ ticketNumber, code }` — phải khớp cả hai, vé phải đang `SUPP_PENDING` trong ngày; giới hạn 20 lần/10 phút/IP để không dò mã. |
| 3 | Hình 3.3: UC-09 «include» UC-12 (chặn ngoài giờ) | Quét Re-entry ngoài giờ vẫn xếp vé vào hàng đợi (không ai gọi). | `/api/kiosk/reentry-scan` và `/api/kiosk/tickets/:id/reentry` trả `status: CLOSED` + giờ mở cửa kế tiếp, không đổi trạng thái vé. Chatbot và trang quét mã đều hiển thị đúng thông báo. |
| 4 | Hình 3.3: UC-11 «extend» UC-09 — trang theo dõi mở rộng sang quay lại hàng đợi | Trang theo dõi chỉ ghi "Cần bổ sung hồ sơ — xem hướng dẫn của cán bộ", không nói thiếu gì, không có cách quay lại. | `theo-doi.html` khi vé `SUPP_PENDING`: kể **tên** giấy tờ còn thiếu, vị trí lấy phôi tờ khai (kệ/khay/bàn viết), nút "Xem cách điền tờ khai", nút **"Tôi đã bổ sung xong — xếp lại vào hàng đợi"** (gọi `POST /api/kiosk/tickets/:id/reentry`, định danh bằng id vé, **không lộ token**). |
| 5 | Hình 7.1: "phiếu số in mã QR theo dõi" — UC-05 | Màn hình "Nhận số" chỉ hiện trên Kiosk, không có bản in. | Nút **"In phiếu số"**: phiếu khổ 72 mm cho máy in nhiệt (số, thủ tục, quầy, số người phía trước, QR theo dõi, giờ cấp, lưu ý 3 lần vắng mặt). CSS `@media print` riêng, không ảnh hưởng màn hình. |
| 6 | Hình 3.3: UC-06 "Xem trạng thái quầy và số người chờ" | Trang chủ chỉ có 2 số tổng (quầy mở, người chờ). | Khối **"Tình trạng các quầy"** trên Trang chủ: từng quầy, lĩnh vực, Đang tiếp nhận/Tạm dừng/Đóng, số người chờ; tự làm mới 15 giây. |
| 7 | Hình 3.8 / UC-50: công dân biết số lần vắng mặt | Trang theo dõi không cho biết đã bị gọi hụt mấy lần. | API trạng thái trả `retryCount`; trang theo dõi cảnh báo "đã vắng mặt N lần — 3 lần số sẽ bị hủy". Khi đến lượt (`CALLING`): rung điện thoại + đổi tiêu đề tab. Vé hủy/hết hạn: nút "Lấy số mới". |
| 8 | UC-16 — đếm ngược 45 s tại quầy | Đồng hồ ở giao diện quầy luôn bắt đầu từ 45 s khi tải lại trang, lệch với máy chủ. | Tính từ `called_at` của vé + `CALL_TIMEOUT_SECONDS` nhận qua sự kiện WebSocket `CALL_NEXT`; tải lại trang vẫn đếm đúng. |
| 9 | Máy quét mã USB tại Kiosk gõ nguyên URL vào ô tìm kiếm Trang chủ | Tìm thủ tục tên "http://…" → không có kết quả. | Trang chủ nhận ra `?reentry=` trong ô tìm kiếm → chuyển ngay sang `quet-ma.html`. |

## 3. Bảng kiểm 52 use case (Hình 3.1) ↔ mã nguồn

| Phân hệ | UC | Điểm cuối / vị trí trong mã | Trạng thái |
|---|---|---|---|
| 1. Xác thực | UC-01, UC-02 | `POST /api/auth/login`, `/logout` (+ `/change-password` buộc đổi mật khẩu lần đầu) | Có |
| 2. Tự phục vụ | UC-03, UC-04 | `GET /api/kiosk/services`, `/services/:id/checklist` | Có |
| | UC-05 | `POST /api/kiosk/tickets` → màn hình Nhận số + QR + **In phiếu số** | Có (bổ sung in) |
| | UC-06 | `GET /api/kiosk/counters/status` → **khối Tình trạng các quầy** | Có (bổ sung giao diện) |
| | UC-07, UC-13 | `GET /api/kiosk/wifi-qr`, `/wifi-guide`, `ket-noi-wifi.html` | Có |
| | UC-08, UC-14 | `POST /api/kiosk/dvc/check-vneid`, `GET /dvc-guide`, `nop-ho-so-truc-tuyen.html` | Có |
| | UC-09 | `POST /api/kiosk/reentry-scan` → **`quet-ma.html`** (camera / máy quét / nhập tay) + chatbot | Có (bổ sung Kiosk) |
| | UC-10 | `GET /api/kiosk/services/:id/form-guide`, `huong-dan-dien-mau.html` | Có |
| | UC-11 | `GET /api/kiosk/tickets/:id/status`, `theo-doi.html` (+ **bổ sung hồ sơ, retryCount**) | Có (mở rộng) |
| | UC-12 | `GET /api/kiosk/hours`, `kioskHours.js` (áp dụng cho cả Re-entry) | Có |
| 3. Vận hành quầy | UC-15…UC-22 | `counterRoutes.js`: queue, call-next, accept, no-show, complete, undo, supplement, today-stats | Có |
| 4. Giám sát, điều phối | UC-23…UC-36 | `adminRoutes.js`: counters, fields, top-metrics, heatmap, status, field, CRUD quầy, officer, rebalance, priority-inject, emergency-skip, restore | Có |
| 5. Quản trị | UC-37…UC-46 | configs, form-templates, officer-kpi, peak-hour, service-quality, audit-logs, staff CRUD/active/password | Có |
| 6. AI, thiết bị, nền | UC-47 | `POST /api/chatbot/ask` (rule-based → Gemini + RAG) | Có |
| | UC-48, UC-49 | `GET /api/display/counters`, `/tts-config`, `display.html` | Có |
| | UC-50, UC-51, UC-52 | `ticketLifecycle.handleNoShow`, `purgeScheduler.js` | Có |

## 4. Thay đổi mã nguồn

- Mới: `public/quet-ma.html`, `public/js/quet-ma.js`, `public/vendor/jsQR.min.js` (+ `jsQR.LICENSE.txt`).
- Sửa máy chủ: `src/routes/kioskRoutes.js` (reentry-scan nhận token/URL/số+mã, kiểm tra giờ, trả thông tin hàng đợi; thêm `POST /tickets/:id/reentry`; trạng thái vé kèm giấy tờ thiếu + vị trí phôi), `src/repositories/ticketRepository.js` (`findSuppPendingByNumberAndCode`, tracking info thêm `missing_doc_codes`/`required_docs`/`retry_count`), `src/services/ticketTracking.js` (`missingDocs`, `canReenter`, `retryCount`), `src/server.js` (giới hạn tần suất Re-entry).
- Sửa giao diện: `kiosk-checklist.html/js` (in phiếu), `theo-doi.html/js`, `index.html/js`, `counter.html/js`, `huong-dan.html`, `chatbot.js` (xử lý CLOSED), `header.js`, `sw.js` (precache trang mới), `css/kiosk.css`, `css/common.css`.
- Không đổi CSDL (không cần migration). Mã quay lại 8 ký tự lấy từ `reentry_qr_token` có sẵn.

## 5. Kiểm thử

| Loại | Kết quả |
|---|---|
| `npm test` | 190 ca (184 cũ + 6 mới cho Re-entry/trạng thái vé), 187 đạt, 3 bỏ qua (tích hợp CSDL, cần `TEST_DATABASE_URL`) |
| Tích hợp PostgreSQL thật | 3/3 đạt |
| Luồng thật qua HTTP | cấp số → gọi → tiếp nhận → yêu cầu bổ sung → theo dõi (`SUPP_PENDING`, đúng tên giấy tờ thiếu, không lộ token) → quay lại bằng (a) id vé, (b) số + mã 8 ký tự, (c) URL trên QR; mã dùng lần 2 bị từ chối |
| Giao diện (Chromium) | Trang chủ, phiếu số + bản in 72 mm, theo dõi (bổ sung → xếp lại), quét mã (nhập tay → thành công; mã dùng lại → báo lỗi), quầy (phiếu quay lại có mã ngắn, đếm ngược theo giờ máy chủ) — 0 lỗi JavaScript |

Chưa kiểm được bằng máy thật: quét QR qua camera (cần máy Kiosk có webcam và cấp quyền camera — trình duyệt chỉ cho dùng camera trên `https://` hoặc `localhost`). Máy quét USB kiểm bằng cách gõ chuỗi URL + Enter vào ô "Đang chờ máy quét…".
