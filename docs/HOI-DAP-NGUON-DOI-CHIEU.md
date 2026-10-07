# Bảng đối chiếu nguồn cho nội dung Hỏi - Đáp

> Sinh tự động từ `src/data/faqKnowledge.js`. **Đừng sửa tay file này** — sửa file dữ liệu
> rồi chạy lại: `node scripts/gen-faq-doc.js`

Tài liệu dành cho cán bộ Trung tâm **rà soát trước khi đưa vào sử dụng chính thức**.
Phần lớn nguồn ở đây là **nguồn thứ cấp** (báo, trang luật) vì Cổng Dịch vụ công quốc gia
chặn truy cập tự động. Trước khi dùng chính thức, cán bộ phải mở lại từng URL và đối chiếu
với **văn bản gốc** cùng **quy định của tỉnh/thành mình**.

- Ngày đọc nguồn: **22/09/2026**
- Tổng số câu hỏi: **47**
- Quy định vận hành của hệ thống này: **16** câu
- Đã đối chiếu nguồn: **13** câu
- Nguồn chỉ xác nhận một phần / tùy địa phương: **7** câu
- Chưa xác thực – hãy hỏi cán bộ: **11** câu

## 1. Việc cần làm ngay (các mục CHƯA XÁC THỰC)

Những mục dưới đây hệ thống đang nói thẳng với người dân là "chưa xác thực được".
Cán bộ bổ sung nguồn hoặc sửa nội dung rồi đổi `status` trong `src/data/faqKnowledge.js`.

| Mã | Câu hỏi | Ghi chú |
|---|---|---|
| GT-04 | Thẻ căn cước của tôi hết hạn thì có làm thủ tục được không? | Chưa đối chiếu được nguồn chính thức về việc chấp nhận giấy tờ hết hạn. |
| GT-07 | Chứng thực bản sao giấy tờ ở đâu, mất bao lâu? | Chưa đối chiếu được nguồn cho lệ phí và thời hạn chứng thực. |
| HTI-08 | Đăng ký khai tử trong bao lâu và cần giấy gì? | Chưa đối chiếu được nguồn cho thời hạn đăng ký khai tử theo quy định đang áp dụng năm 2026. |
| HTI-10 | Giấy khai sinh của tôi bị sai tên, sai ngày sinh thì sửa thế nào? | Chưa đối chiếu được nguồn cho thẩm quyền và thời hạn cải chính hộ tịch theo mô hình chính quyền 2 cấp. |
| DD-05 | Tách thửa đất cần điều kiện gì? | Điều kiện tách thửa do từng tỉnh quy định; chưa đối chiếu được quy định cụ thể. |
| DD-06 | Chuyển đất nông nghiệp sang đất ở (thổ cư) thế nào? | Chưa đối chiếu được nguồn cho trình tự, thời hạn và cách tính tiền sử dụng đất năm 2026. |
| KD-03 | Tôi muốn đổi địa chỉ, ngành nghề của hộ kinh doanh thì làm thế nào? | Chưa đối chiếu nguồn cho thủ tục thay đổi nội dung đăng ký hộ kinh doanh theo Nghị định 168/2025. |
| KD-04 | Tạm ngừng hoặc nghỉ hẳn kinh doanh có phải báo không? | Chưa đối chiếu nguồn cho thời hạn thông báo tạm ngừng/giải thể hộ kinh doanh. |
| TT-03 | Nộp qua mạng thì nhận kết quả bằng cách nào? | Hình thức trả kết quả khác nhau theo từng thủ tục và địa phương; chưa đối chiếu được nguồn chung. |
| TT-04 | Nộp qua mạng có rẻ hơn nộp trực tiếp không? | Chính sách miễn giảm phí khi nộp trực tuyến do từng tỉnh quyết định; chưa đối chiếu được nguồn. |
| TT-06 | Tôi không có điện thoại thông minh, không dùng được mạng thì sao? | Việc Trung tâm có hỗ trợ nộp hộ/qua bưu điện hay không tùy từng nơi. |

## 2. Các mục chỉ xác nhận một phần / phụ thuộc địa phương

| Mã | Câu hỏi | Vì sao chưa chắc chắn |
|---|---|---|
| GT-02 | Tôi có thể nhờ con cháu hoặc người khác đi làm thủ tục thay được không? | Quy định ủy quyền khác nhau theo từng thủ tục; nguồn đã đọc không liệt kê đầy đủ nên phần này cần cán bộ xác nhận. |
| GT-05 | Tôi không còn sổ hộ khẩu giấy thì chứng minh nơi cư trú bằng cách nào? | Cách chứng minh cư trú có thể khác nhau theo địa phương và mức độ đồng bộ dữ liệu. |
| HTI-04 | Đăng ký kết hôn có còn phải xin Giấy xác nhận tình trạng hôn nhân không? | Đây là nguồn thứ cấp (trang luật), chưa đối chiếu văn bản gốc. Cán bộ Trung tâm cần xác nhận với Sở Tư pháp trước khi bỏ giấy tờ này khỏi danh sách. |
| HTI-06 | Làm khai sinh, khai tử, kết hôn có mất lệ phí không? | Nguồn dẫn Thông tư 179/2015/TT-BTC (đăng năm 2015). Nguyên tắc miễn lệ phí vẫn được nhắc lại trong các nguồn 2026, nhưng mức thu cụ thể phải tra nghị quyết HĐND tỉnh hiện hành. |
| HTI-09 | Tôi cần bản sao giấy khai sinh cũ, xin ở đâu? | Mức lệ phí do HĐND cấp tỉnh quy định nên khác nhau giữa các địa phương; nguồn đã đọc chỉ nêu nguyên tắc miễn/thu, không nêu con số cụ thể. |
| DD-04 | Mua bán đất xong bao lâu phải đi sang tên, để lâu có bị phạt không? | Nguồn nêu có mốc thời hạn nhưng phần tóm tắt đọc được không ghi rõ số ngày; cần tra Luật Đất đai 2024 và nghị định hướng dẫn. |
| KD-02 | Lệ phí đăng ký hộ kinh doanh là bao nhiêu? | Mức lệ phí cụ thể do HĐND tỉnh quy định; chưa đối chiếu nghị quyết của từng địa phương. |

## 3. Danh sách nguồn đã dùng

- **K1** — VietNamNet – Từ 1/7, người dân có thể làm thủ tục hành chính ở bất cứ đâu trong tỉnh, thành (mô hình chính quyền 2 cấp, Nghị định 118/2025/NĐ-CP về cơ chế một cửa)
  - https://vietnamnet.vn/tu-1-7-nguoi-dan-co-the-lam-thu-tuc-hanh-chinh-o-bat-cu-dau-trong-tinh-thanh-2411625.html (đọc ngày 22/09/2026)
- **K2** — Thư viện pháp luật – Quyền khai sinh, ai có trách nhiệm đăng ký khai sinh (trích Điều 15 Luật Hộ tịch 2014: 60 ngày)
  - https://thuvienphapluat.vn/phap-luat/quyen-khai-sinh-ai-co-trach-nhiem-dang-ky-khai-sinh-dang-ky-khai-sinh-nhu-the-nao-1034.html (đọc ngày 22/09/2026)
- **K3** — Thư viện pháp luật – Từ 1/1/2026 đăng ký kết hôn giữa hai công dân Việt Nam không phải nộp Giấy xác nhận tình trạng hôn nhân (dẫn Nghị quyết 66.7/2025/NQ-CP, Quyết định 1833/QĐ-BTP)
  - https://thuvienphapluat.vn/phap-luat/khi-dang-ky-ket-hon-giua-hai-nguoi-viet-nam-tu-112026-co-can-xin-giay-xac-nhan-tinh-trang-hon-nhan--242239.html (đọc ngày 22/09/2026)
- **K4** — Thư viện pháp luật – Thủ tục đăng ký kết hôn cấp xã mới nhất 2026 theo Quyết định 3673/QĐ-BTP
  - https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/tu-van-phap-luat/105545/thu-tuc-dang-ky-ket-hon-cap-xa-moi-nhat-2026-theo-quyet-dinh-3673-qd-btp (đọc ngày 22/09/2026)
- **K5** — Báo Chính phủ – Sửa một số quy định về lệ phí đăng ký hộ tịch (Thông tư 179/2015/TT-BTC: miễn lệ phí khai sinh/khai tử đúng hạn, kết hôn của công dân Việt Nam cư trú trong nước; HĐND tỉnh quyết định mức thu)
  - https://baochinhphu.vn/sua-mot-so-quy-dinh-ve-le-phi-dang-ky-ho-tich-102194243.htm (đọc ngày 22/09/2026)
- **K6** — Thư viện pháp luật – Từ 01/3/2027 được đăng ký khai sinh, kết hôn ở bất kỳ đâu (Luật Hộ tịch 2026, Điều 8)
  - https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/chinh-thuc-tu-ngay-0132027-duoc-dang-ky-khai-sinh-ket-hon-o-bat-ky-dau-224994.html (đọc ngày 22/09/2026)
- **K7** — LuatVietnam – Hướng dẫn thủ tục sang tên Sổ đỏ năm 2026 (thời hạn không quá 10 ngày làm việc; thuế TNCN 2%, lệ phí trước bạ 0,5%)
  - https://luatvietnam.vn/dat-dai-nha-o/thu-tuc-sang-ten-so-do-567-23816-article.html (đọc ngày 22/09/2026)
- **K8** — Thư viện pháp luật – Hướng dẫn thủ tục đăng ký hộ kinh doanh năm 2026 (Nghị định 168/2025/NĐ-CP Điều 99: nộp tại cơ quan đăng ký kinh doanh cấp xã, 3 ngày làm việc)
  - https://thuvienphapluat.vn/phap-luat-doanh-nghiep/bai-viet/huong-dan-thu-tuc-dang-ky-ho-kinh-doanh-nam-2026-18449.html (đọc ngày 22/09/2026)
- **K9** — LuatVietnam – Thủ tục liên thông đăng ký khai sinh, cấp căn cước online cho trẻ dưới 6 tuổi từ 01/9/2026
  - https://luatvietnam.vn/hanh-chinh/thu-tuc-lien-thong-dang-ky-khai-sinh-cap-can-cuoc-online-cho-tre-duoi-6-tuoi-tu-01-9-2026-570-111995-article.html (đọc ngày 22/09/2026)
- **K10** — VNeID (Bộ Công an) – Hướng dẫn đăng ký, kích hoạt tài khoản định danh điện tử
  - https://vneid.gov.vn/huongdan/huong-dan-dang-ky-tai-khoan-vneid.html (đọc ngày 22/09/2026)
- **K11** — Cổng Dịch vụ công quốc gia – trang chủ (nộp hồ sơ, tra cứu hồ sơ, phản ánh kiến nghị)
  - https://dichvucong.gov.vn/ (đọc ngày 22/09/2026)

## 4. Toàn bộ câu hỏi theo chủ đề

### 🎫 Lấy số & dùng hệ thống (8 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| HT-01 | Lấy số thứ tự có phải nhập họ tên hay số điện thoại không? | Quy định vận hành của hệ thống này | — |
| HT-02 | Tôi vắng mặt khi được gọi số thì có mất lượt không? | Quy định vận hành của hệ thống này | — |
| HT-03 | Làm sao theo dõi số thứ tự khi đang ngồi chờ hoặc ra ngoài? | Quy định vận hành của hệ thống này | — |
| HT-04 | Tôi làm mất phiếu số thứ tự thì phải làm sao? | Quy định vận hành của hệ thống này | — |
| HT-05 | Cán bộ yêu cầu bổ sung giấy tờ, tôi quay lại có phải lấy số mới từ đầu không? | Quy định vận hành của hệ thống này | — |
| HT-06 | Cuối giờ làm việc mà chưa tới lượt tôi thì sao? | Quy định vận hành của hệ thống này | — |
| HT-07 | Vì sao người đến sau tôi lại được gọi trước? | Quy định vận hành của hệ thống này | — |
| HT-08 | Thời gian chờ ước tính trên phiếu có chính xác không? | Quy định vận hành của hệ thống này | — |

### 🪪 Giấy tờ tùy thân & ủy quyền (7 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| GT-01 | Tôi cần mang bản chính hay bản sao giấy tờ? | Quy định vận hành của hệ thống này | — |
| GT-02 | Tôi có thể nhờ con cháu hoặc người khác đi làm thủ tục thay được không? | Nguồn chỉ xác nhận một phần / tùy địa phương | K1 |
| GT-03 | VNeID là gì và tôi cần tài khoản mức mấy? | Đã đối chiếu nguồn | K10 |
| GT-04 | Thẻ căn cước của tôi hết hạn thì có làm thủ tục được không? | Chưa xác thực – hãy hỏi cán bộ | — |
| GT-05 | Tôi không còn sổ hộ khẩu giấy thì chứng minh nơi cư trú bằng cách nào? | Nguồn chỉ xác nhận một phần / tùy địa phương | K1 |
| GT-06 | Tôi không biết điền tờ khai, ai giúp tôi? | Quy định vận hành của hệ thống này | — |
| GT-07 | Chứng thực bản sao giấy tờ ở đâu, mất bao lâu? | Chưa xác thực – hãy hỏi cán bộ | — |

### 👶 Hộ tịch (10 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| HTI-01 | Sinh con xong bao lâu thì phải đi đăng ký khai sinh? | Đã đối chiếu nguồn | K2 |
| HTI-02 | Làm giấy khai sinh cần mang những gì? | Đã đối chiếu nguồn | K2 |
| HTI-03 | Có thể làm khai sinh cho con qua mạng không? | Đã đối chiếu nguồn | K9 |
| HTI-04 | Đăng ký kết hôn có còn phải xin Giấy xác nhận tình trạng hôn nhân không? | Nguồn chỉ xác nhận một phần / tùy địa phương | K3, K4 |
| HTI-05 | Đăng ký kết hôn có bắt buộc cả hai người cùng đến không? | Đã đối chiếu nguồn | K4 |
| HTI-06 | Làm khai sinh, khai tử, kết hôn có mất lệ phí không? | Nguồn chỉ xác nhận một phần / tùy địa phương | K5 |
| HTI-07 | Tôi phải đăng ký hộ tịch ở nơi nào, có phải về đúng quê không? | Đã đối chiếu nguồn | K2, K6 |
| HTI-08 | Đăng ký khai tử trong bao lâu và cần giấy gì? | Chưa xác thực – hãy hỏi cán bộ | — |
| HTI-09 | Tôi cần bản sao giấy khai sinh cũ, xin ở đâu? | Nguồn chỉ xác nhận một phần / tùy địa phương | K5 |
| HTI-10 | Giấy khai sinh của tôi bị sai tên, sai ngày sinh thì sửa thế nào? | Chưa xác thực – hãy hỏi cán bộ | — |

### 🏠 Đất đai – nhà ở (6 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| DD-01 | Sang tên sổ đỏ mất bao lâu? | Đã đối chiếu nguồn | K7 |
| DD-02 | Sang tên sổ đỏ phải nộp những khoản tiền gì? | Đã đối chiếu nguồn | K7 |
| DD-03 | Hồ sơ sang tên sổ đỏ gồm những gì? | Đã đối chiếu nguồn | K7 |
| DD-04 | Mua bán đất xong bao lâu phải đi sang tên, để lâu có bị phạt không? | Nguồn chỉ xác nhận một phần / tùy địa phương | K7 |
| DD-05 | Tách thửa đất cần điều kiện gì? | Chưa xác thực – hãy hỏi cán bộ | — |
| DD-06 | Chuyển đất nông nghiệp sang đất ở (thổ cư) thế nào? | Chưa xác thực – hãy hỏi cán bộ | — |

### 🏪 Hộ kinh doanh (4 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| KD-01 | Đăng ký hộ kinh doanh nộp ở đâu, bao lâu có giấy phép? | Đã đối chiếu nguồn | K8 |
| KD-02 | Lệ phí đăng ký hộ kinh doanh là bao nhiêu? | Nguồn chỉ xác nhận một phần / tùy địa phương | K5, K8 |
| KD-03 | Tôi muốn đổi địa chỉ, ngành nghề của hộ kinh doanh thì làm thế nào? | Chưa xác thực – hãy hỏi cán bộ | — |
| KD-04 | Tạm ngừng hoặc nghỉ hẳn kinh doanh có phải báo không? | Chưa xác thực – hãy hỏi cán bộ | — |

### 💻 Nộp hồ sơ qua mạng (6 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| TT-01 | Tôi có phải về đúng nơi cư trú để nộp hồ sơ không? | Đã đối chiếu nguồn | K1 |
| TT-02 | Nộp hồ sơ qua mạng bắt đầu từ đâu? | Đã đối chiếu nguồn | K10, K11 |
| TT-03 | Nộp qua mạng thì nhận kết quả bằng cách nào? | Chưa xác thực – hãy hỏi cán bộ | — |
| TT-04 | Nộp qua mạng có rẻ hơn nộp trực tiếp không? | Chưa xác thực – hãy hỏi cán bộ | — |
| TT-05 | Làm sao biết hồ sơ của tôi đã xử lý tới đâu? | Đã đối chiếu nguồn | K11 |
| TT-06 | Tôi không có điện thoại thông minh, không dùng được mạng thì sao? | Chưa xác thực – hãy hỏi cán bộ | — |

### 🤝 Hỗ trợ tại Trung tâm (6 câu)

| Mã | Câu hỏi | Mức xác thực | Nguồn |
|---|---|---|---|
| HO-01 | Người cao tuổi, người khuyết tật, phụ nữ mang thai có được ưu tiên không? | Quy định vận hành của hệ thống này | — |
| HO-02 | Trung tâm làm việc mấy giờ? | Quy định vận hành của hệ thống này | — |
| HO-03 | Màn hình chữ nhỏ quá, tôi nhìn không rõ thì làm sao? | Quy định vận hành của hệ thống này | — |
| HO-04 | Tôi muốn phản ánh, góp ý hoặc khiếu nại thì gửi ở đâu? | Quy định vận hành của hệ thống này | — |
| HO-05 | Wi-Fi của Trung tâm kết nối thế nào? | Quy định vận hành của hệ thống này | — |
| HO-06 | Thông tin trên trang này có phải là văn bản pháp luật chính thức không? | Quy định vận hành của hệ thống này | — |

## 5. Thông tin mở rộng theo từng thủ tục

| Mã thủ tục | Nơi nộp | Thời hạn giải quyết | Nộp trực tuyến | Mức xác thực |
|---|---|---|---|---|
| KHAISINH | UBND cấp xã nơi cha hoặc mẹ cư trú (nộp qua Trung tâm Phục vụ hành chính công). | Thường trả kết quả ngay trong ngày làm việc nếu hồ sơ đầy đủ. Nộp trực tuyến liên thông: cán bộ hộ tịch xử lý trong 24 giờ. | Có – nộp được trên Cổng Dịch vụ công quốc gia hoặc ứng dụng VNeID (thủ tục liên thông cho trẻ dưới 6 tuổi từ 01/9/2026). | Đã đối chiếu nguồn |
| KETHON | UBND cấp xã nơi một trong hai bên cư trú. | Thường trao Giấy chứng nhận kết hôn ngay trong ngày; trường hợp phải xác minh thì không quá 5 ngày làm việc. | Nộp hồ sơ trực tuyến được, nhưng hai bên vẫn phải đến ký trực tiếp. | Nguồn chỉ xác nhận một phần / tùy địa phương |
| KHAITU | UBND cấp xã nơi người chết cư trú cuối cùng (nộp qua Trung tâm Phục vụ hành chính công). | Thường giải quyết ngay trong ngày làm việc nếu hồ sơ đầy đủ. | Nộp trực tuyến được trên Cổng Dịch vụ công quốc gia (tùy địa phương triển khai). | Nguồn chỉ xác nhận một phần / tùy địa phương |
| XNTTHN | UBND cấp xã nơi cư trú. | Thường trả trong ngày hoặc theo giấy hẹn của cán bộ hộ tịch. | Tùy địa phương; hãy hỏi cán bộ trước khi đi. | Nguồn chỉ xác nhận một phần / tùy địa phương |
| TRICHLUC_HT | Nơi đã đăng ký sự kiện hộ tịch trước đây, hoặc cơ quan đang lưu trữ sổ hộ tịch. | Thường trả trong ngày làm việc nếu tra được sổ gốc. | Có – đây là một trong các thủ tục hộ tịch đã có hướng dẫn nộp trên Cổng Dịch vụ công quốc gia. | Nguồn chỉ xác nhận một phần / tùy địa phương |
| CAICHINH_HT | Cơ quan đã đăng ký hộ tịch trước đây hoặc cơ quan có thẩm quyền theo quy định. | Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ hộ tịch. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| SANGTEN | Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai / chi nhánh. | Không quá 10 ngày làm việc, không tính ngày nghỉ lễ và thời gian bạn đi nộp thuế, lệ phí. | Một phần – nhiều địa phương cho nộp hồ sơ trực tuyến, nhưng bản chính Giấy chứng nhận vẫn phải nộp trực tiếp. | Đã đối chiếu nguồn |
| CAPMOI_GCN | Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai. | Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi ngày hẹn ghi trên giấy biên nhận. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| TACHTHUA | Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai. | Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| CHUYENMDSDD | Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai. | Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| DKKD_HKD | Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở hộ kinh doanh. | 3 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ. | Có – nộp trên Hệ thống thông tin đăng ký hộ kinh doanh (cần chữ ký số). | Đã đối chiếu nguồn |
| THAYDOI_DKKD | Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở. | Chưa đối chiếu được thời hạn — hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| TAMNGUNG_KD | Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở. | Chưa đối chiếu được thời hạn — hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |
| GIAITHE_HKD | Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở. | Chưa đối chiếu được thời hạn — hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ. | Chưa xác thực – hãy hỏi cán bộ |

## 6. Cảnh báo cần xử lý trong dữ liệu seed

- **KETHON**: Danh sách giấy tờ hiện cấu hình trong hệ thống vẫn còn "Giấy xác nhận tình trạng hôn nhân" — cán bộ Trung tâm cần rà lại theo quy định mới.
