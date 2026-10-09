# Tích hợp chatbot Mindtek (bot.mindtek.ai)

Website HCC chạy song song 2 chatbot:

| | Trợ lý AI nội bộ (có sẵn) | Bot Mindtek (mới) |
|---|---|---|
| Nằm ở đâu | `public/js/chatbot.js` + `/api/chatbot/ask` (Gemini + luật) | `bot.mindtek.ai`, nhúng qua `embed.js` (iframe) |
| Dữ liệu trực tiếp (số đang gọi, quầy mở, Wi-Fi QR, quét mã Bổ sung hồ sơ) | Có | Không |
| Trả lời từ tài liệu nạp vào, quản lý hội thoại/lead trên dashboard Mindtek | Không | Có |

## 1. Cài đặt trên Mindtek (làm 1 lần)

1. Đăng nhập https://bot.mindtek.ai/dashboard → **Create Bot**.
2. Phần hướng dẫn/prompt của bot: dán toàn bộ nội dung file [`docs/mindtek/system-prompt.md`](mindtek/system-prompt.md).
3. Phần Knowledge / Training data: tải lên file [`docs/mindtek/tri-thuc-hcc.md`](mindtek/tri-thuc-hcc.md).
   Nền tảng không nhận `.md` thì đổi đuôi thành `.txt` rồi tải lại.
4. Trong cài đặt bảo mật của bot (nếu có mục Allowed domains / Whitelist): thêm
   `smart-queue-system-akpr.onrender.com` và `localhost`.
5. Mở phần Embed / Install của bot, sao chép đoạn mã nhúng dạng
   `<script src="https://bot.mindtek.ai/embed.js" data-bot-id="..."></script>`.

## 2. Bật trên web HCC (không sửa code, không deploy lại)

Admin → tab **Cấu hình Tham số**:

- `MINDTEK_BOT_ID`: dán **nguyên đoạn mã nhúng** ở bước 5 (hoặc chỉ Bot ID) → **Lưu**. Hệ thống tự tách đúng Bot ID.
- `CHATBOT_MODE`:
  - `both` (mặc định, khuyến nghị): giữ Trợ lý nội bộ, thêm thanh **"✨ Hỏi Trợ lý AI chuyên sâu"** ngay dưới tiêu đề khung chat để mở bot Mindtek. Chỉ 1 nút chat trên màn hình.
  - `mindtek`: ẩn Trợ lý nội bộ, chỉ hiện nút chat Mindtek. Riêng link quét QR Bổ sung hồ sơ (`?reentry=`) vẫn dùng Trợ lý nội bộ vì cần dữ liệu hàng đợi thật.
  - `internal`: tắt Mindtek, chạy như trước.

Tải lại trang (Ctrl+F5) là có hiệu lực. Xóa trống `MINDTEK_BOT_ID` = tắt Mindtek ngay lập tức.

## 3. Cập nhật tri thức cho bot

Mỗi khi đổi thủ tục, giấy tờ, lệ phí, FAQ (`src/data/*.js` hoặc CSDL):

```
npm run mindtek:knowledge
```

Rồi tải lại `docs/mindtek/tri-thuc-hcc.md` lên Mindtek (xóa bản cũ trước để bot không trả lời theo dữ liệu cũ).
Script đọc CSDL theo `.env` (`DATABASE_URL` Neon); không kết nối được CSDL thì vẫn xuất phần từ `src/data`, chỉ thiếu danh sách giấy tờ.

## 4. Kỹ thuật (cho người bảo trì)

- `src/server.js`: CSP mở `script-src`, `frame-src`, `img-src` cho `https://bot.mindtek.ai`. Thiếu thì trình duyệt chặn im lặng, nút Mindtek không hiện.
- `GET /api/chatbot/config` → `{ mode, mindtekBotId, mindtekOrigin }`; chưa có Bot ID thì luôn trả `mode: "internal"`.
- `public/js/mindtek-chat.js`: được `chatbot.js` tự nạp, không cần thêm thẻ `<script>` vào trang nào. Mindtek tải lỗi (mất mạng, sai Bot ID) thì tự hiện lại Trợ lý nội bộ.
- Class của Trợ lý nội bộ đã đổi thành `hcc-chat-widget` / `hcc-chat-close`: `embed.js` của Mindtek chèn CSS toàn cục cho `.chatbot-widget` và `.chatbot-close` (nút đóng `opacity: 0`). Giữ tên cũ là nút ✕ của khung chat nội bộ bị ẩn mất. **Không đặt lại 2 tên class này** (có test `test/mindtek.test.js` chặn).
- Màn hình LED (`display.html`) ẩn cả 2 widget.
- Kiosk đặt trong mạng nội bộ chặn Internet ra ngoài: phải cho phép `bot.mindtek.ai` (HTTPS 443), nếu không chỉ có Trợ lý nội bộ hoạt động.
