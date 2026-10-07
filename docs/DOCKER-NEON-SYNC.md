# Chạy bằng Docker và đồng bộ với Neon

Tài liệu này dành cho người vận hành, không cần biết lập trình. Trên Windows, mọi thao tác dưới đây đều có trong menu **`docker-dong-bo.bat`**: bấm đúp vào file đó, rồi chọn số tương ứng.

---

## 1. Hệ thống gồm những gì

```
                 Internet                                   Trung tâm (máy chạy Docker)
 ┌──────────────────────────────┐              ┌──────────────────────────────────────────────┐
 │  Web trên Render             │              │  container "app"  (web + WebSocket, cổng 3000)│
 │  smart-queue-system-...      │              │        │  APP_DB_TARGET=neon (mặc định)       │
 │        │                     │              │        ▼                                      │
 │        ▼                     │   ghi/đọc    │  ┌────────────────────────┐                    │
 │  ┌──────────────┐  ◀─────────┼──────────────┼──┤ Neon (CSDL chính)       │                    │
 │  │ Neon Postgres│            │              │  └────────────────────────┘                    │
 │  │  (CSDL CHÍNH)│ ──sao chép realtime──────▶│  container "db" (PostgreSQL 17 – bản sao)     │
 │  └──────────────┘  (logical replication)    │  container "sync" (đồng bộ + sao lưu tự động) │
 └──────────────────────────────┘              └──────────────────────────────────────────────┘
        ▲  LISTEN/NOTIFY: gọi số ở Render → Bảng LED mở từ bản Docker cập nhật ngay (và ngược lại)
```

| Container | Vai trò |
|---|---|
| `app` | Web + WebSocket. Máy khác trong mạng LAN mở `http://<IP-máy-này>:3000` |
| `db` | PostgreSQL 17 trong Docker: bản sao realtime của Neon, hoặc CSDL chính khi chạy offline |
| `sync` | Đồng bộ Docker ↔ Neon theo `SYNC_MODE` và sao lưu cả hai CSDL vào `backups/` |
| `adminer` | (tuỳ chọn) giao diện web xem CSDL tại `http://localhost:8080` |

---

## 2. Cài đặt lần đầu

1. Cài **Docker Desktop**, mở lên và đợi biểu tượng cá voi chuyển sang trạng thái chạy.
2. File `.env` của dự án **đã có sẵn** `DATABASE_URL` trỏ tới Neon. Cần mở thêm các dòng mới trong `.env.example` (mục *Docker + đồng bộ Neon*) và chép sang `.env` nếu muốn đổi giá trị mặc định. Nếu không chép, hệ thống vẫn chạy với giá trị mặc định.
3. Bấm đúp **`docker-dong-bo.bat`**, chọn **1** (lần đầu mất vài phút để build).
4. Mở `http://localhost:3000`.

Không dùng menu thì gõ lệnh: `docker compose up -d --build`.

---

## 3. Hai câu hỏi cần chọn

### 3.1. Web trong Docker dùng CSDL nào? — `APP_DB_TARGET`

| Giá trị | Khi nào dùng | Hệ quả |
|---|---|---|
| `neon` *(mặc định)* | Bình thường | Bản Docker và bản Render **dùng chung một CSDL** nên dữ liệu khớp 100%. Gọi số ở bản nào thì Bảng LED ở bản kia cũng cập nhật ngay, nhờ kênh LISTEN/NOTIFY. |
| `local` | Trung tâm mất Internet, hoặc demo/bảo vệ đồ án không có mạng | Web ghi vào PostgreSQL trong Docker. Khi có mạng lại, đẩy dữ liệu lên Neon bằng menu **5**. |

### 3.2. Đồng bộ Postgres Docker ↔ Neon kiểu nào? — `SYNC_MODE`

| Giá trị | Cơ chế | Yêu cầu |
|---|---|---|
| `replica` *(mặc định)* | **Sao chép realtime** Neon → Docker (PostgreSQL logical replication). Mỗi thay đổi trên Neon về Docker sau khoảng 1 giây. | Phải bật **Logical Replication** trên Neon (mục 4). Nếu chưa bật, hệ thống tự lùi về `pull`. |
| `pull` | Chép nguyên khối Neon → Docker mỗi `SYNC_INTERVAL_MINUTES` phút | Không cần bật gì |
| `push` | Chép nguyên khối Docker → Neon. **Ghi đè Neon.** | Phải đặt thêm `SYNC_PUSH_CONFIRM=yes` |
| `off` | Tắt đồng bộ, vẫn sao lưu | — |

**Vì sao không đồng bộ hai chiều (cả hai bên cùng ghi)?** Số thứ tự (A-101, A-102…) được cấp theo ngày, riêng ở mỗi CSDL. Nếu hai bên cùng cấp số trong cùng một ngày, cả hai đều sinh ra A-101 cho hai người khác nhau. Không có cách gộp nào giữ đúng cả hai mà không làm sai lệch dữ liệu, nên hệ thống cố ý luôn có **đúng một CSDL chính** tại mỗi thời điểm.

---

## 4. Bật sao chép realtime trên Neon (một lần)

1. Neon Console → chọn project → **Settings → Postgres → Logical replication → Enable**.
   - Theo tài liệu Neon: thao tác này **không đảo ngược được**, và **khởi động lại compute** (web ngắt kết nối vài giây).
   - Role mặc định tạo từ Console (`neondb_owner`) đã có quyền REPLICATION.
2. Dùng chuỗi kết nối **trực tiếp** (host **không** có `-pooler`). Chuỗi trong `.env` hiện tại đã là kết nối trực tiếp.
3. Khởi động lại container sync: `docker compose restart sync`, hoặc chọn menu **6**. Kiểm tra lại bằng menu **3**.

### Lưu ý về chi phí Neon gói Free

- Gói Free có **100 CU-giờ/tháng** cho mỗi project, và compute tự ngủ sau 5 phút không có truy vấn.
- Khi có một bản sao đang kết nối (replica), **compute Neon không ngủ**. Chạy 24/7 ở 0,25 CU tốn khoảng 182 CU-giờ/tháng, **vượt hạn mức** — Neon sẽ tạm dừng compute và web Render cũng ngừng theo.
- Vì vậy mặc định **`SYNC_ACTIVE_HOURS=06:30-18:30`**: ngoài khung giờ này, container sync tạm dừng sao chép và không truy cập Neon để Neon được ngủ. Ước tính khoảng 12 giờ × 22 ngày × 0,25 CU ≈ 66 CU-giờ/tháng.
- Container `app` khi dùng `APP_DB_TARGET=neon` cũng truy vấn Neon mỗi phút (quét vé quá hạn, giám sát thiết bị). **Nên tắt bản Docker ngoài giờ làm việc** (menu **12**), hoặc chuyển Neon lên gói trả phí nếu cần chạy 24/7.
- Neon tự xoá replication slot không hoạt động khoảng 40 giờ (ví dụ máy tắt cả cuối tuần). Container sync **tự phát hiện và thiết lập lại** sao chép khi máy bật lên; không cần làm gì thêm.

---

## 5. Thao tác thường dùng

| Việc cần làm | Menu `docker-dong-bo.bat` | Lệnh tương đương |
|---|---|---|
| Khởi động / cập nhật code | 1 | `docker compose up -d --build` |
| So sánh dữ liệu hai bên (số dòng từng bảng, độ trễ) | 3 | `docker compose run --rm sync node scripts/db-sync.js status` |
| Kéo Neon → Docker | 4 | `... db-sync.js pull` |
| Đẩy Docker → Neon (ghi đè) | 5 | `... db-sync.js push --yes` |
| Bật / tắt realtime | 6 / 7 | `... replica:setup` / `... replica:stop` |
| Sao lưu ngay | 8 | `... backup both` |
| Xem nhật ký đồng bộ | 9 | `docker compose logs -f sync` |
| Dừng hệ thống | 12 | `docker compose down` |

Mọi thao tác **ghi đè** (pull, push, bật replica) đều **tự sao lưu bên bị ghi đè trước** vào `backups/` (định dạng `pg_dump -Fc`, giữ 14 bản gần nhất mỗi loại). Khôi phục một bản sao lưu:

```bash
docker compose run --rm sync sh -c 'pg_restore --clean --if-exists --no-owner -d "$LOCAL_DATABASE_URL" backups/local-YYYYMMDD-HHMMSS.dump'
```

---

## 6. Tình huống: Trung tâm mất Internet

1. Menu **7** (tắt sao chép) — hoặc lệnh `... db-sync.js promote`: dừng sao chép và chỉnh lại bộ đếm ID trên Docker.
2. Sửa `.env`: `APP_DB_TARGET=local`, rồi chọn menu **1**. Web tại Trung tâm chạy tiếp trên dữ liệu đã sao chép tới thời điểm mất mạng.
3. Khi có mạng lại, **trong lúc không ai dùng web Render**: chọn menu **5** để đẩy Docker → Neon. Neon được tự sao lưu trước khi bị ghi đè.
4. Trả `.env` về `APP_DB_TARGET=neon`, chọn menu **1**, rồi menu **6** để bật lại realtime.

Máy Kiosk mất mạng tạm thời (trong khi máy chủ vẫn chạy) thì đã có **chế độ ngoại tuyến** trên trình duyệt: hiện thanh báo mất mạng, và các trang Hỏi đáp / giấy tờ / cách điền vẫn xem được (`public/sw.js`). Lưu ý: chế độ này chỉ hoạt động khi mở qua `https://` hoặc `http://localhost`.

---

## 7. Kiểm tra đã đồng bộ chưa

- **Admin Control Tower → Giám sát Realtime → "Tình trạng Hệ thống & Đồng bộ dữ liệu"**: hiển thị CSDL đang dùng, độ trễ, kênh realtime giữa các bản chạy, và subscription/slot sao chép.
- `GET /api/health/deep`: dùng cho giám sát ngoài và cho Docker HEALTHCHECK.
- Menu **3**: bảng so sánh số dòng từng bảng Neon ↔ Docker, cột cuối ghi **khớp/LỆCH**.

## 8. Đã kiểm thử

Kiểm thử trên hai cụm PostgreSQL thật (một cụm đóng vai Neon, một cụm đóng vai Docker), cả hai đều bật `wal_level=logical`:

- `pull` / `push`: 13/13 bảng khớp số dòng; bộ đếm IDENTITY được chỉnh đúng; bên bị ghi đè được sao lưu trước.
- `replica:setup`: chép dữ liệu ban đầu khoảng 2 giây với 2.500 vé; vé mới tạo trên "Neon" xuất hiện ở Docker sau dưới 2 giây.
- Migration thêm bảng/cột mới trên Neon được `replica:refresh` (tự chạy mỗi phút) đưa sang Docker, và sao chép tiếp tục.
- Neon xoá slot: container sync tự phát hiện và thiết lập lại.
- Hai bản web cùng trỏ một CSDL: sự kiện realtime và thay đổi cấu hình truyền sang bản kia qua LISTEN/NOTIFY.

Hai phần **chưa kiểm thử được** trong môi trường phát triển:

- **Kết nối thật tới Neon**: môi trường phát triển không mở được cổng 5432 ra ngoài.
- **Build Docker image**: không tải được image gốc từ Docker Hub. Đã kiểm tra `docker compose config` hợp lệ và chạy thử `docker/entrypoint.sh` + `scripts/ensure-schema.js` trực tiếp; workflow CI (`.github/workflows/ci.yml`) có bước `docker build` để kiểm tra trên GitHub.

Lần chạy đầu trên máy thật: chọn menu **1**, rồi menu **3** để xác nhận.
