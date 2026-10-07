// Sinh docs/HOI-DAP-NGUON-DOI-CHIEU.md tu src/data/faqKnowledge.js - bang doi chieu de can bo
// Trung tam ra soat nguon truoc khi dua noi dung vao su dung chinh thuc.
// Chay: node scripts/gen-faq-doc.js
const faq = require('../src/data/faqKnowledge');
const L = [];
L.push('# Bảng đối chiếu nguồn cho nội dung Hỏi - Đáp');
L.push('');
L.push('> Sinh tự động từ `src/data/faqKnowledge.js`. **Đừng sửa tay file này** — sửa file dữ liệu');
L.push('> rồi chạy lại: `node scripts/gen-faq-doc.js`');
L.push('');
L.push('Tài liệu dành cho cán bộ Trung tâm **rà soát trước khi đưa vào sử dụng chính thức**.');
L.push('Phần lớn nguồn ở đây là **nguồn thứ cấp** (báo, trang luật) vì Cổng Dịch vụ công quốc gia');
L.push('chặn truy cập tự động. Trước khi dùng chính thức, cán bộ phải mở lại từng URL và đối chiếu');
L.push('với **văn bản gốc** cùng **quy định của tỉnh/thành mình**.');
L.push('');
L.push('- Ngày đọc nguồn: **' + faq.ACCESSED + '**');
L.push('- Tổng số câu hỏi: **' + faq.FAQS.length + '**');
const byStatus = {};
faq.FAQS.forEach((f) => { byStatus[f.status] = (byStatus[f.status] || 0) + 1; });
Object.keys(faq.STATUS_LABELS).forEach((k) => {
  if (byStatus[k]) L.push('- ' + faq.STATUS_LABELS[k] + ': **' + byStatus[k] + '** câu');
});
L.push('');
L.push('## 1. Việc cần làm ngay (các mục CHƯA XÁC THỰC)');
L.push('');
L.push('Những mục dưới đây hệ thống đang nói thẳng với người dân là "chưa xác thực được".');
L.push('Cán bộ bổ sung nguồn hoặc sửa nội dung rồi đổi `status` trong `src/data/faqKnowledge.js`.');
L.push('');
L.push('| Mã | Câu hỏi | Ghi chú |');
L.push('|---|---|---|');
faq.FAQS.filter((f) => f.status === 'UNVERIFIED').forEach((f) => {
  L.push('| ' + f.id + ' | ' + f.q + ' | ' + (f.note || '') + ' |');
});
L.push('');
L.push('## 2. Các mục chỉ xác nhận một phần / phụ thuộc địa phương');
L.push('');
L.push('| Mã | Câu hỏi | Vì sao chưa chắc chắn |');
L.push('|---|---|---|');
faq.FAQS.filter((f) => f.status === 'PARTIAL').forEach((f) => {
  L.push('| ' + f.id + ' | ' + f.q + ' | ' + (f.note || '') + ' |');
});
L.push('');
L.push('## 3. Danh sách nguồn đã dùng');
L.push('');
Object.keys(faq.SOURCES).forEach((k) => {
  const s = faq.SOURCES[k];
  L.push('- **' + k + '** — ' + s.title);
  L.push('  - ' + s.url + ' (đọc ngày ' + s.accessed + ')');
});
L.push('');
L.push('## 4. Toàn bộ câu hỏi theo chủ đề');
L.push('');
faq.TOPICS.forEach((t) => {
  const items = faq.FAQS.filter((f) => f.topic === t.id);
  L.push('### ' + t.icon + ' ' + t.name + ' (' + items.length + ' câu)');
  L.push('');
  L.push('| Mã | Câu hỏi | Mức xác thực | Nguồn |');
  L.push('|---|---|---|---|');
  items.forEach((f) => {
    L.push('| ' + f.id + ' | ' + f.q + ' | ' + faq.STATUS_LABELS[f.status] + ' | ' + ((f.sources || []).join(', ') || '—') + ' |');
  });
  L.push('');
});
L.push('## 5. Thông tin mở rộng theo từng thủ tục');
L.push('');
L.push('| Mã thủ tục | Nơi nộp | Thời hạn giải quyết | Nộp trực tuyến | Mức xác thực |');
L.push('|---|---|---|---|---|');
Object.keys(faq.SERVICE_EXTRA).forEach((code) => {
  const e = faq.SERVICE_EXTRA[code];
  L.push('| ' + code + ' | ' + e.where + ' | ' + e.slaNote + ' | ' + e.online + ' | ' + faq.STATUS_LABELS[e.status] + ' |');
});
L.push('');
L.push('## 6. Cảnh báo cần xử lý trong dữ liệu seed');
L.push('');
Object.keys(faq.SERVICE_EXTRA).forEach((code) => {
  const e = faq.SERVICE_EXTRA[code];
  (e.warnings || []).forEach((w) => L.push('- **' + code + '**: ' + w));
});
L.push('');
require('fs').writeFileSync(require('path').join(__dirname, '..', 'docs', 'HOI-DAP-NGUON-DOI-CHIEU.md'), L.join('\n'), 'utf8');
console.log('Da sinh docs/HOI-DAP-NGUON-DOI-CHIEU.md');
