# Giao diện 2.2 (10/2026)

Nâng cấp giao diện phần công khai, giữ nguyên toàn bộ API và luồng nghiệp vụ.

## Trang chủ (index.html + js/index.js)
- Băng tiêu đề xanh đậm: ô tìm kiếm lớn có biểu tượng, nút "Tìm nhanh" (khai sinh, kết hôn, sang tên sổ đỏ, hộ kinh doanh).
- Thẻ "Tại Trung tâm lúc này" có biểu tượng, chấm "Trực tiếp".
- Dải quy trình 3 bước (Tìm thủ tục → Đối chiếu giấy tờ → Nhận số thứ tự) đè lên mép băng xanh.
- 4 thẻ hỗ trợ nhanh có biểu tượng.
- Thủ tục hiển thị dạng thẻ 2 cột, màu + biểu tượng theo lĩnh vực; nút lọc lĩnh vực tự sinh từ dữ liệu; nút "Xem thêm / Thu gọn".
- Câu hỏi hay gặp dạng thẻ; khối "Không tìm thấy thủ tục"; chân trang có liên kết.

## Dùng chung (css/common.css, js/header.js)
- Khối "GIAO DIỆN 2.2" cuối common.css: chỉ ghi đè, không xóa quy tắc cũ (xóa khối này là về 2.1).
- Header thêm dòng tên hệ thống cạnh logo (tự ẩn trên màn hình hẹp).
- Thẻ, nút bo góc mềm hơn, bóng rất mảnh.

## Trang Kiosk đối chiếu giấy tờ (css/kiosk.css)
- Thanh 3 bước gọn một hàng; ô tích giấy tờ chuyển nền xanh lá khi đã tích.

## Khác
- Tăng phiên bản file (common.css?v=11, header.js?v=5, kiosk.css?v=7) và bộ nhớ đệm Service Worker (hcc-offline-v4) để máy Kiosk nhận giao diện mới ngay.
- Gợi ý tìm kiếm: "SLA 15 phút" → "Tiếp nhận khoảng 15 phút".
