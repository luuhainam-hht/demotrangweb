# Báo cáo nâng cấp phiên bản 2.0 (10/2026)

Nguồn yêu cầu: báo cáo đồ án *"Dự án tốt nghiệp — bản 200 trang"*, mục **6.17 Hạn chế kỹ thuật đã biết**, phần **Kết luận — 3. Hạn chế của đề tài** và **4. Hướng phát triển**; cùng yêu cầu **Docker + đồng bộ với CSDL Neon**.

## 1. Bảng đối chiếu: hạn chế/hướng phát triển → đã làm gì

| # | Nội dung trong báo cáo | Trạng thái | Hiện thực |
|---|---|---|---|
| 1 | Mã QR quay lại chưa hiển thị trên giao diện quầy (6.17) | ✅ Đã làm | Hộp thoại **Phiếu quay lại** ngay sau thao tác *Yêu cầu Bổ sung*: số vé, danh sách giấy tờ thiếu, mã QR, nút **In phiếu** (khổ giấy nhiệt 72 mm). Công dân quét QR → được xếp lại ưu tiên. `public/counter.html`, `public/js/counter.js` |
| 2 | Giờ mở cửa chỉ 1 khung/ngày, chưa nghỉ trưa (6.17) | ✅ Đã làm | Tham số mới `KIOSK_TIME_SLOTS` (VD `07:30-11:30,13:30-17:00`). Kiosk báo "đang nghỉ giữa ca, mở lại 13:30 hôm nay". Có kiểm tra định dạng và chống chồng lấn. `src/services/kioskHours.js` |
| 3 | Đánh giá mức độ hài lòng sau mỗi lượt (Hướng phát triển trung hạn) | ✅ Đã làm | Bảng `ticket_feedback`. Trang theo dõi vé (QR trên phiếu) hiện 5 biểu tượng cảm xúc + góp ý, không cần tên; mỗi vé đánh giá 1 lần trong 48 giờ. Báo cáo: điểm TB, CSAT %, tỷ lệ phản hồi, phân bố, theo cán bộ, theo thủ tục, góp ý gần đây, xuất CSV. Đánh giá ≤ 2★ báo ngay lên Dashboard. |
| 4 | Dự báo lượng công dân theo giờ/ngày, gợi ý bố trí quầy (Hướng phát triển dài hạn) | ✅ Đã làm | `src/services/forecastService.js`: trung bình N tuần cùng thứ theo từng giờ, từng lĩnh vực; **số quầy cần mở theo mô hình M/M/c – Erlang C** (mục 1.8.1 của báo cáo), sao cho thời gian chờ trung bình ≤ `AWT_ALERT_MINUTES`. Có biểu đồ, giờ cao điểm và bảng chi tiết. |
| 5 | Phát hiện thủ tục thường xuyên vượt ngưỡng cam kết (dài hạn) | ✅ Đã làm | Báo cáo **Thủ tục vượt ngưỡng SLA**: % trễ, thời gian xử lý trung bình và P90, xếp theo mức độ trễ, xuất CSV. |
| 6 | Bảng `device_health` có trong thiết kế nhưng chưa có mã nguồn (5.5.12) | ✅ Đã làm | Heartbeat từ Bảng LED/Kiosk; tự đánh dấu OFFLINE sau `DEVICE_OFFLINE_SECONDS`; Bảng LED chưa bật loa → DEGRADED; cảnh báo realtime trên Dashboard. |
| 7 | Chưa kiểm thử tải (6.17) | ✅ Đã làm | `npm run load:test` (`scripts/kiem-thu-tai.js`) – kết quả ở mục 3. |
| 8 | Chưa xử lý mất kết nối mạng tại Kiosk (Kết luận – 3) | ✅ Một phần | Service Worker: Kiosk mất mạng vẫn xem được thủ tục/giấy tờ/hỏi đáp; thanh báo mất mạng; trang `offline.html` tự kết nối lại. **Không** cấp số khi mất mạng (số phải do máy chủ cấp để không trùng). Mất Internet toàn Trung tâm → chạy Docker `APP_DB_TARGET=local`. |
| 9 | Cảnh báo bảo mật thư viện phụ thuộc (6.17) | ✅ Đã làm | `npm audit fix`: **0 lỗ hổng** (trước: 4, trong đó 1 mức *critical* – proxy-addr). Express vẫn ở bản 4 (bản vá nằm trong 4.x, không cần lên Express 5). |
| 10 | Thư viện QR tải từ CDN | ✅ Đã làm | Đóng gói `public/vendor/qrcode.min.js` (MIT): Kiosk chạy offline vẫn tạo được mã QR. |
| — | **Docker + đồng bộ Neon** (yêu cầu mới) | ✅ Đã làm | Xem `docs/DOCKER-NEON-SYNC.md`: `Dockerfile`, `docker-compose.yml` (app + db PostgreSQL 17 + sync + adminer), `scripts/db-sync.js` (status / pull / push / backup / replica realtime / promote / tự phục hồi), menu tiếng Việt `docker-dong-bo.bat`. |
| — | Đồng bộ realtime giữa nhiều bản chạy (phát sinh khi chạy Render + Docker) | ✅ Đã làm | `src/realtime/pgBus.js`: Postgres LISTEN/NOTIFY trên chính Neon. Gọi số ở bản này thì Bảng LED của bản kia cập nhật ngay; đổi cấu hình thì bản kia nạp lại; Batch Purge cuối ngày chỉ chạy 1 lần nhờ advisory lock. |
| — | Gửi SMS/Zalo thật, giọng đọc phía máy chủ, JWT/SSO, app di động, nhiều Trung tâm | ⏳ Chưa làm | Cần tài khoản nhà cung cấp (SMS brandname, Zalo OA, dịch vụ TTS) hoặc thay đổi kiến trúc lớn. Giữ nguyên trong mục *Hướng phát triển*. |

## 2. Thay đổi cơ sở dữ liệu (tự chạy khi khởi động, không mất dữ liệu cũ)

- Bảng mới `ticket_feedback` (id, ticket_id UNIQUE → tickets ON DELETE CASCADE, rating 1–5, comment ≤ 500, counter_id, officer_id, created_at).
- Tham số mới: `KIOSK_TIME_SLOTS` (mặc định để trống, tức hành vi cũ), `DEVICE_OFFLINE_SECONDS` (120, giới hạn 30–3600).
- Chỉ mục: `idx_feedback_created`, `idx_feedback_officer`, `idx_device_health_heartbeat`.
- Nằm trong `src/migrations/runMigrations.js` (`addUpgrade202610`) và `db/schema.sql`.

## 3. Kết quả kiểm thử

| Loại | Kết quả |
|---|---|
| Kiểm thử tự động (`npm test`) | **184 ca**: 166 ca cũ + 15 ca đơn vị mới (Erlang C, nhiều khung giờ, kênh realtime, đánh giá, thiết bị) + 3 ca tích hợp với PostgreSQL thật — **0 lỗi** |
| Kiểm thử giao diện (Chromium) | Phiếu QR quay lại hiện + sinh QR; đánh giá trên điện thoại gửi thành công; Dashboard hiển thị dự báo/SLA/hài lòng/thiết bị/đồng bộ; thanh báo mất mạng; **0 lỗi JavaScript** |
| Kiểm thử tải (máy phát triển, CSDL cục bộ) | 50 kết nối đồng thời + 200 WebSocket trong 15 giây: **~950 yêu cầu/giây**, độ trễ p50 48 ms / p95 112 ms / p99 145 ms, **0% lỗi**, 200/200 WebSocket giữ kết nối |
| Đồng bộ Docker ↔ Neon | Xem `docs/DOCKER-NEON-SYNC.md` mục 8 |

Lưu ý về số liệu tải: đo với CSDL cùng máy. Với Neon (Singapore) mỗi truy vấn thêm khoảng vài chục ms độ trễ mạng; nên chạy lại `npm run load:test -- --url https://<web-của-bạn>` để có số thật.

## 4. Dữ liệu mẫu để trình diễn báo cáo mới

```bash
npm run demo:history                # sinh 8 tuần vé lịch sử (đã hoàn tất) + đánh giá mẫu
npm run demo:history -- --clear     # xoá dữ liệu mẫu
```

Script **từ chối ghi lên Neon**, trừ khi thêm `--allow-remote`. Mọi vé mẫu đều được đánh dấu để xoá sạch được.
