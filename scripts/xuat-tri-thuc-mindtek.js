// =====================================================================================
// Xuat toan bo tri thuc cua he thong HCC thanh 1 file Markdown de NAP VAO bot Mindtek
// (bot.mindtek.ai -> bot cua ban -> muc Knowledge / Training data -> Upload file).
//
// Nguon: CSDL (danh muc thu tuc + giay to bat buoc + thoi gian xu ly + gio lam viec) va cac file
// src/data/*.js (FAQ, le phi, huong dan DVC, cach dien to khai). Chay lai moi khi doi du lieu:
//   npm run mindtek:knowledge
// Ket qua: docs/mindtek/tri-thuc-hcc.md
//
// Khong ket noi duoc CSDL -> van xuat phan tu file src/data (bo qua danh sach giay to tu CSDL).
// =====================================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const faq = require('../src/data/faqKnowledge');
const fees = require('../src/data/serviceFees');
const dvc = require('../src/data/dvcGuide');
const forms = require('../src/data/formGuides');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'mindtek');
const OUT_FILE = path.join(OUT_DIR, 'tri-thuc-hcc.md');

const money = (n) => `${Number(n).toLocaleString('vi-VN')} đ`;
const list = (arr, indent = '') => (arr || []).map((x) => `${indent}- ${x}`).join('\n');

async function loadFromDb() {
  try {
    const { pool } = require('../src/config/db');
    const { rows: services } = await pool.query(
      `SELECT s.code, s.name, s.sla_minutes, s.required_docs, f.name AS field_name
       FROM services s JOIN service_fields f ON f.id = s.field_id ORDER BY f.id, s.id`
    );
    const { rows: cfg } = await pool.query(
      `SELECT config_key, config_value FROM system_configs
       WHERE config_key IN ('KIOSK_OPEN_TIME','KIOSK_CLOSE_TIME','KIOSK_WORKING_DAYS','KIOSK_TIME_SLOTS')`
    );
    return { services, cfg: Object.fromEntries(cfg.map((r) => [r.config_key, r.config_value])) };
  } catch (err) {
    console.warn('[mindtek] Khong doc duoc CSDL (' + err.message + ') - bo qua phan giay to tu CSDL.');
    return { services: [], cfg: {} };
  }
}

function parseDocs(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || []); } catch (e) { return []; }
}

function hoursSection(cfg) {
  if (!cfg.KIOSK_OPEN_TIME) return '';
  const dayNames = { 1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư', 4: 'Thứ Năm', 5: 'Thứ Sáu', 6: 'Thứ Bảy', 7: 'Chủ nhật' };
  const days = String(cfg.KIOSK_WORKING_DAYS || '').split(',').map((d) => dayNames[d.trim()]).filter(Boolean).join(', ');
  const slots = (cfg.KIOSK_TIME_SLOTS || '').trim() || `${cfg.KIOSK_OPEN_TIME}-${cfg.KIOSK_CLOSE_TIME}`;
  return `## Giờ làm việc của Trung tâm\n\n- Ngày làm việc: ${days}\n- Khung giờ cấp số: ${slots.split(',').join(', ')}\n- Ngoài giờ làm việc Kiosk không cấp số mới; vẫn xem được hướng dẫn trên website.\n`;
}

function serviceSection(services) {
  const byCode = Object.fromEntries(services.map((s) => [s.code, s]));
  const codes = Array.from(new Set([...services.map((s) => s.code), ...Object.keys(fees.SERVICE_FEES)]));
  const formByService = {};
  forms.FORM_GUIDES.forEach((g) => { (formByService[g.serviceCode] = formByService[g.serviceCode] || []).push(g); });

  return codes.map((code) => {
    const s = byCode[code] || {};
    const fee = fees.SERVICE_FEES[code];
    const extra = faq.SERVICE_EXTRA[code] || {};
    const docs = parseDocs(s.required_docs);
    const out = [`### ${s.name || code}${s.field_name ? ` (lĩnh vực: ${s.field_name})` : ''}`];
    if (docs.length) {
      out.push('Giấy tờ cần chuẩn bị:');
      out.push(docs.map((d) => `- ${d.name}${d.mandatory ? ' (bắt buộc)' : ' (nếu có)'}`).join('\n'));
    }
    if (fee) out.push(`Lệ phí: ${fee.label}${fee.amount ? ` – ${money(fee.amount)}` : ''}. ${fee.note || ''}`.trim());
    if (extra.where) out.push(`Nơi giải quyết: ${extra.where}`);
    if (extra.slaNote) out.push(`Thời gian giải quyết: ${extra.slaNote}`);
    else if (s.sla_minutes) out.push(`Thời gian tiếp nhận tại quầy: khoảng ${s.sla_minutes} phút.`);
    if (extra.online) out.push(`Nộp trực tuyến: ${extra.online}`);
    if (extra.legal) out.push(`Căn cứ pháp lý: ${extra.legal}`);
    if (extra.tips && extra.tips.length) out.push('Lưu ý:\n' + list(extra.tips));
    (formByService[code] || []).forEach((g) => {
      out.push(`Mẫu tờ khai: ${g.formName} (mã ${g.formCode}) – lấy tại ${g.shelf}, ${g.tray}, điền tại ${g.desk}. ${g.intro || ''}`.trim());
      if (g.fields && g.fields.length) out.push('Cách điền:\n' + g.fields.map((f) => `- ${f.label}: ${f.how}${f.example ? ` (Ví dụ: ${f.example})` : ''}`).join('\n'));
      if (g.mistakes && g.mistakes.length) out.push('Lỗi hay gặp khi điền:\n' + list(g.mistakes.map((m) => (typeof m === 'string' ? m : m.text || JSON.stringify(m)))));
    });
    return out.join('\n\n');
  }).join('\n\n');
}

function faqSection() {
  const topicName = Object.fromEntries(faq.TOPICS.map((t) => [t.id, t.name]));
  const groups = {};
  faq.FAQS.forEach((q) => { (groups[q.topic] = groups[q.topic] || []).push(q); });
  return Object.keys(groups).map((t) => [
    `### ${topicName[t] || t}`,
    ...groups[t].map((q) => [
      `**Hỏi:** ${q.q}`,
      q.aliases && q.aliases.length ? `(Cách hỏi khác: ${q.aliases.join('; ')})` : '',
      `**Đáp:** ${q.short}`,
      list(q.details)
    ].filter(Boolean).join('\n'))
  ].join('\n\n')).join('\n\n');
}

function dvcSection() {
  const sup = dvc.SUPPORT || {};
  return [
    dvc.INTRO,
    '### Cần chuẩn bị trước',
    dvc.PREREQUISITES.map((p) => `- ${p.title}: ${p.simple}\n${list(p.details, '  ')}`).join('\n'),
    '### Các bước nộp hồ sơ trên Cổng Dịch vụ công quốc gia (dichvucong.gov.vn)',
    dvc.STEPS.map((s) => `${s.no}. ${s.title}: ${s.simple}${s.details && s.details.length ? '\n' + list(s.details, '   ') : ''}`).join('\n'),
    '### Lỗi thường gặp khi nộp trực tuyến',
    dvc.COMMON_PROBLEMS.map((p) => `- ${p.problem}: ${p.advice}`).join('\n'),
    sup.phone ? `### Tổng đài hỗ trợ Cổng DVC quốc gia\n- Điện thoại: ${sup.phone}${sup.email ? `\n- Email: ${sup.email}` : ''}` : ''
  ].filter(Boolean).join('\n\n');
}

async function main() {
  const { services, cfg } = await loadFromDb();
  const md = [
    '# Tri thức Trung tâm Phục vụ Hành chính công cấp xã/phường',
    `Tài liệu do hệ thống Một Cửa Thông Minh tự xuất ngày ${new Date().toLocaleDateString('vi-VN')}. Lệ phí đối chiếu ngày ${fees.FEES_CHECKED_AT}.`,
    '## Cách dùng hệ thống lấy số tại Trung tâm',
    '- Tại Kiosk: chọn thủ tục → tích đủ giấy tờ mang theo → bấm "Xác nhận & Lấy số thứ tự". Không cần nhập họ tên hay số điện thoại.',
    '- Theo dõi số đang gọi trên màn hình LED hoặc trang "Theo dõi số" trên website.',
    '- Số thứ tự hiện tại, quầy nào đang mở, số người đang chờ: là dữ liệu trực tiếp, xem trên website hoặc hỏi Trợ lý nội bộ của Trung tâm.',
    hoursSection(cfg),
    '## Danh mục thủ tục, giấy tờ, lệ phí và cách điền tờ khai',
    serviceSection(services),
    '## Hướng dẫn nộp hồ sơ trực tuyến',
    dvcSection(),
    '## Quy tắc chung khi điền tờ khai',
    forms.GENERAL_RULES.map((r) => `- ${r.title}: ${r.text}`).join('\n'),
    '## Câu hỏi thường gặp',
    faqSection()
  ].filter(Boolean).join('\n\n') + '\n';

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, md, 'utf8');
  console.log(`[mindtek] Da xuat ${OUT_FILE} (${(md.length / 1024).toFixed(1)} KB, ${services.length} thu tuc tu CSDL, ${faq.FAQS.length} cau hoi FAQ).`);
}

// process.exit: pool CSDL (src/config/db.js) giu ket noi mo, khong tu thoat.
main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
