const express = require('express');
const { pool } = require('../config/db');
const serviceRepo = require('../repositories/serviceRepository');
const formTemplateRepo = require('../repositories/formTemplateRepository');
const queueEngine = require('../services/queueEngine');
const configService = require('../config/configService');
const ticketRepo = require('../repositories/ticketRepository');
const { toPublicTracking } = require('../services/ticketTracking');
const { GENERAL_RULES, DOC_HINTS } = require('../data/formGuides');
const kioskHours = require('../services/kioskHours');
const { buildWifiPayload } = require('../utils/wifiQr');
const wifiGuide = require('../data/wifiGuide');
const dvcGuide = require('../data/dvcGuide');
const faqKnowledge = require('../data/faqKnowledge');
const { requireInt, ValidationError } = require('../utils/validate');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

// INTENT: tra cuu / liet ke thu tuc hanh chinh (dong vai tro RAG rut gon: tim theo tu khoa)
router.get('/services', async (req, res) => {
  try {
    const keyword = req.query.q;
    const rows = keyword ? await serviceRepo.searchServices(pool, keyword) : await serviceRepo.listServices(pool);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bo noi dung huong dan dien (fill_guide, dai) ra khoi phan thong tin to khai gui kem checklist -
// chi trang huong dan dien mau moi can, lay rieng qua /services/:id/form-guide.
function withoutGuide(form) {
  if (!form) return null;
  const { fill_guide: _omit, ...rest } = form;
  return rest;
}

// Checklist giay to bat buoc + vi tri phoi/to khai mau (Pre-validation & Form Resolution).
// Moi giay to kem goi y "cach co/can mang gi" (hint) va co danh dau giay nao la to khai co
// huong dan dien chi tiet (hasFillGuide) de Kiosk hien nut "Xem cach dien".
router.get('/services/:id/checklist', async (req, res) => {
  try {
    const service = await serviceRepo.findServiceById(pool, req.params.id);
    if (!service) return res.status(404).json({ error: 'Thu tuc khong ton tai.' });
    const form = await formTemplateRepo.findByServiceId(pool, service.id);
    const guideDocCode = form && form.fill_guide ? form.fill_guide.docCode : null;
    const requiredDocs = (service.required_docs || []).map((d) => ({
      ...d,
      hint: DOC_HINTS[d.code] || null,
      hasFillGuide: !!guideDocCode && d.code === guideDocCode
    }));
    res.json({
      service,
      requiredDocs,
      formTemplate: withoutGuide(form),
      hasFillGuide: !!(form && form.fill_guide),
      // Noi nop / thoi han giai quyet / nop online / can cu phap ly - xem src/data/faqKnowledge.js
      extra: faqKnowledge.getServiceExtra(service.code)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== HOI DAP (FAQ) ==================
// Toan bo ngan hang cau hoi thuong gap, nhom theo chu de, kem NGUON va MUC XAC THUC.
// Dung cho trang hoi-dap.html. Du lieu tinh (src/data/faqKnowledge.js) nen khong cham toi DB.
router.get('/faq', (req, res) => {
  res.json({
    accessed: faqKnowledge.ACCESSED,
    statusLabels: faqKnowledge.STATUS_LABELS,
    topics: faqKnowledge.listForPublic()
  });
});

// Tim nhanh trong ngan hang cau hoi (o tim kiem tren trang Hoi dap + goi y cho Trang chu).
router.get('/faq/search', (req, res) => {
  const keyword = String(req.query.q || '').slice(0, 200);
  const results = faqKnowledge.searchFaqs(keyword, 8).map((r) => ({
    id: r.faq.id,
    topic: r.faq.topic,
    q: r.faq.q,
    short: r.faq.short,
    status: r.faq.status,
    statusLabel: faqKnowledge.STATUS_LABELS[r.faq.status] || r.faq.status
  }));
  res.json({ keyword, results });
});

// Danh sach cac to khai co huong dan dien (de nguoi dan chon khi vao trang huong dan dien mau
// ma chua chon thu tuc nao) + quy tac chung khi dien moi loai giay to.
router.get('/form-guides', async (req, res) => {
  try {
    res.json({ generalRules: GENERAL_RULES, forms: await formTemplateRepo.listWithGuide(pool) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Huong dan dien tung o cua to khai cua 1 thu tuc + noi lay phoi + goi y cac giay to di kem.
router.get('/services/:id/form-guide', async (req, res) => {
  try {
    const service = await serviceRepo.findServiceById(pool, req.params.id);
    if (!service) return res.status(404).json({ error: 'Thu tuc khong ton tai.' });
    const form = await formTemplateRepo.findByServiceId(pool, service.id);
    if (!form || !form.fill_guide) {
      return res.status(404).json({ error: 'Thu tuc nay chua co huong dan dien to khai. Vui long hoi can bo ho tro.' });
    }
    const docHints = (service.required_docs || [])
      .filter((d) => DOC_HINTS[d.code])
      .map((d) => ({ code: d.code, name: d.name, hint: DOC_HINTS[d.code] }));
    res.json({
      service: { id: service.id, name: service.name, fee_amount: service.fee_amount, sla_minutes: service.sla_minutes },
      form: withoutGuide(form),
      guide: form.fill_guide,
      generalRules: GENERAL_RULES,
      docHints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doc Wi-Fi Admin cau hinh (Cau hinh Tham so). Day la thong tin DU PHONG: tren may Kiosk that,
// chatbot/trang Wi-Fi uu tien hoi Dich vu Wi-Fi cuc bo (wifi-local-service, doc mang THAT may dang
// ket noi); khi dich vu do khong chay (hoac nguoi dan mo bang dien thoai rieng) thi dung du lieu nay.
// Kieu bao mat (WPA/WEP/nopass) cung lay tu cau hinh WIFI_SECURITY. Chua co WIFI_SECURITY (CSDL cu)
// -> mac dinh WPA.
async function readConfiguredWifi() {
  const ssid = await configService.get('WIFI_SSID');
  const password = await configService.get('WIFI_PASSWORD');
  let security = 'WPA';
  try { security = await configService.get('WIFI_SECURITY'); } catch (e) { /* CSDL cu chua co khoa nay */ }
  return { ssid, password, security, payload: buildWifiPayload({ ssid, password, security }) };
}

// INTENT 1: Wi-Fi QR 1 cham (du lieu cau hinh - xem readConfiguredWifi).
router.get('/wifi-qr', async (req, res) => {
  try {
    res.json(await readConfiguredWifi());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Huong dan ket noi Wi-Fi cho nguoi lon tuoi (Android/iPhone/nhap tay) kem nguon + muc xac thuc.
router.get('/wifi-guide', async (req, res) => {
  try {
    let network = null;
    try { network = await readConfiguredWifi(); } catch (e) { /* chua cau hinh: van tra huong dan */ }
    res.json({ network, guide: wifiGuide.GUIDE, sources: wifiGuide.SOURCES, statusLabels: wifiGuide.STATUS_LABELS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Huong dan nop ho so truc tuyen tren Cong DVC quoc gia, kem nguon (URL) tung muc + muc xac thuc.
router.get('/dvc-guide', (req, res) => {
  res.json(dvcGuide);
});

// INTENT 2: Dieu kien tai khoan VNeID de nop ho so truc tuyen. Noi dung lay tu src/data/dvcGuide.js
// (co nguon URL). Ban cu tra ve "deeplink" tu che va noi dung khong co nguon - da bo.
// Chi co nguon xac nhan MUC 2 cho it nhat 1 thu tuc cu the (S4); muc 1 chua xac thuc duoc nen
// khong khang dinh "khong nop duoc" hay "nop duoc", chi noi that va huong dan buoc tiep theo.
router.post('/dvc/check-vneid', (req, res) => {
  const level = Number(req.body.vneidLevel);
  const common = {
    guideSteps: dvcGuide.CHATBOT_SHORT_STEPS,
    guideUrl: 'nop-ho-so-truc-tuyen.html',
    portalUrl: 'https://dichvucong.gov.vn/',
    sources: ['S1', 'S2', 'S4', 'S5', 'S7'].map((k) => ({ key: k, ...dvcGuide.SOURCES[k] }))
  };
  if (!(level >= 1)) {
    return res.json({
      eligible: false, certainty: 'PARTIAL', ...common,
      message: 'Bạn cần có tài khoản VNeID đã kích hoạt để nộp hồ sơ trực tuyến. Tài khoản mức 1 tự đăng ký trên ứng dụng VNeID; mức 2 làm trực tiếp tại cơ quan Công an (mang thẻ căn cước, không quá 3 ngày làm việc nếu căn cước còn hiệu lực). Trong lúc chờ, bạn có thể nộp trực tiếp tại quầy.'
    });
  }
  if (level >= 2) {
    return res.json({
      eligible: true, certainty: 'PARTIAL', ...common,
      message: 'Tài khoản mức 2 phù hợp với các hướng dẫn nộp hồ sơ trực tuyến đã đối chiếu. Mỗi thủ tục có thể có yêu cầu riêng, hãy xem chi tiết trên cổng.'
    });
  }
  res.json({
    eligible: false, certainty: 'UNVERIFIED', ...common,
    message: 'Tôi chưa xác thực được tài khoản mức 1 có nộp được hồ sơ hay không (các nguồn đã đọc không nêu rõ; bài hướng dẫn thủ tục trích lục hộ tịch ghi cần mức 2). '
      + 'Bạn có thể hỏi cán bộ, hoặc nâng lên mức 2 tại cơ quan Công an (mang thẻ căn cước, xử lý không quá 3 ngày làm việc nếu căn cước còn hiệu lực), hoặc nộp trực tiếp tại quầy.'
  });
});

// Ho ten/SDT la TUY CHON (Kiosk khong hoi): STT la dinh danh duy nhat cua ve. Chuoi rong/khong
// hop le -> NULL, cat do dai de khong tran cot VARCHAR.
function optionalText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

// Loi doc cau hinh gio (VD thieu tham so o CSDL cu) KHONG duoc khoa cap so: coi nhu dang mo cua.
async function getHoursStatusSafe() {
  try { return await kioskHours.getStatus(); } catch (err) {
    console.error('[kiosk] Khong doc duoc cau hinh gio mo cua, tam thoi cho phep cap so:', err.message);
    return { open: true };
  }
}

// Trang thai gio mo cua (cong khai) - Trang chu/Kiosk hien banner truoc khi nguoi dan mat cong tich giay to.
router.get('/hours', async (req, res) => {
  const { open, enforced, hoursText, message, opensAt } = await getHoursStatusSafe();
  res.json({ open, enforced: !!enforced, hoursText: hoursText || null, message: message || null, opensAt: opensAt || null });
});

// CHECK GATE: Cong Tien kiem Du lieu. Neu du 100% -> cap STT (Two-way tai Kiosk truoc khi vao hang doi).
router.post('/tickets', async (req, res) => {
  try {
    const { confirmedDocCodes } = req.body;
    const citizenName = optionalText(req.body.citizenName, 150);
    const phone = optionalText(req.body.phone, 20);
    const serviceId = requireInt(req.body.serviceId, 'Ma thu tuc (serviceId)');

    const service = await serviceRepo.findServiceById(pool, serviceId);
    if (!service) return res.status(404).json({ error: 'Thu tuc khong ton tai.' });

    // Ngoai gio lam viec (neu cong tac KIOSK_HOURS_ENFORCED dang bat): khong cap so, tra ve
    // thong bao ro rang kem gio mo cua ke tiep de nguoi dan biet khi nao quay lai.
    const hours = await getHoursStatusSafe();
    if (!hours.open) return res.status(200).json({ status: 'CLOSED', message: hours.message, hoursText: hours.hoursText, opensAt: hours.opensAt });

    const mandatoryCodes = (service.required_docs || []).filter((d) => d.mandatory).map((d) => d.code);
    const provided = new Set(confirmedDocCodes || []);
    const missing = mandatoryCodes.filter((c) => !provided.has(c));

    if (missing.length > 0) {
      const form = await formTemplateRepo.findByServiceId(pool, service.id);
      return res.status(200).json({
        status: 'REJECTED',
        missing,
        message: 'Ho so chua du 100%. Vui long bo sung theo huong dan.',
        formTemplate: form
      });
    }

    const result = await queueEngine.createTicket({ serviceId, citizenName, phone });
    res.status(201).json({ status: 'QUEUED', ...result });
  } catch (err) {
    const status = err.code === 'NO_COUNTER_AVAILABLE' ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

// Cong dan tu theo doi ve cua minh (khong can dang nhap/ten): id ve la UUID ngau nhien nen dong
// vai tro "chia khoa" - chi ai giu duoc lien ket/QR tren phieu STT moi xem duoc. Khong tra ten/SDT.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get('/tickets/:id/status', async (req, res) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Khong tim thay ve.' });
    const info = await ticketRepo.getTrackingInfo(pool, req.params.id);
    if (!info) return res.status(404).json({ error: 'Khong tim thay ve.' });
    const body = toPublicTracking(info);
    // Nang cap 10/2026: ve da hoan tat -> cho biet da danh gia chua de trang theo-doi hien form.
    if (info.status === 'COMPLETED') {
      const fb = await feedbackService.getFeedbackForTicket(req.params.id).catch(() => null);
      body.feedback = fb ? { rated: true, rating: fb.rating } : { rated: false };
    }
    // Cho bo sung ho so: kem vi tri lay phoi to khai (ke/khay/ban viet) de cong dan tu di bo sung.
    if (info.status === 'SUPP_PENDING') {
      const form = await formTemplateRepo.findByServiceId(pool, info.service_id).catch(() => null);
      body.formTemplate = form
        ? { form_name: form.form_name, shelf_name: form.shelf_name, tray_number: form.tray_number, desk_area: form.desk_area }
        : null;
      body.hasFillGuide = !!(form && form.fill_guide);
      body.serviceId = info.service_id;
    }
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: 'Loi he thong noi bo.' });
  }
});

// Sau khi ve quay lai hang doi (Re-entry): tra cung mot "goi" thong tin cho moi loi vao (quet QR
// tai Kiosk, nhap tay, nut tren trang theo doi) de giao dien hien so nguoi phia truoc + QR theo doi.
async function buildReentryResponse(ticket) {
  const info = await ticketRepo.getTrackingInfo(pool, ticket.id).catch(() => null);
  return {
    status: 'REQUEUED',
    ticket: { id: ticket.id, ticket_number: ticket.ticket_number, status: ticket.status, counter_id: ticket.counter_id },
    counterName: info ? info.counter_name : null,
    tracking: info ? toPublicTracking(info) : null,
    message: `Số ${ticket.ticket_number} đã trở lại hàng đợi ở vị trí ưu tiên. Vui lòng ở gần quầy và chú ý loa gọi số.`
  };
}

// Ma quay lai in tren phieu = 8 ky tu dau cua token (nhap tay duoc). Chap nhan cach viet
// "3F9A-2B7C", co khoang trang, hoa/thuong.
function normalizeShortCode(value) {
  return String(value || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8).toLowerCase();
}
function normalizeTicketNumber(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]+)-?(\d+)$/, '$1-$2');
}

// Cong dan tu bam "Toi da bo sung xong" tren trang theo doi (mo tu QR phieu STT): dinh danh bang
// id ve (UUID ngau nhien) - khong can token Re-entry, vi ai giu duoc lien ket theo doi thi cung
// chinh la nguoi giu phieu. Ket qua giong het quet QR Re-entry (UC-09).
router.post('/tickets/:id/reentry', async (req, res) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Khong tim thay ve.' });
    const hours = await getHoursStatusSafe();
    if (!hours.open) return res.status(200).json({ status: 'CLOSED', message: hours.message, hoursText: hours.hoursText, opensAt: hours.opensAt });
    const ticket = await ticketRepo.findTicketById(pool, req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Khong tim thay ve.' });
    if (ticket.status !== 'SUPP_PENDING' || !ticket.reentry_qr_token) {
      return res.status(400).json({ error: 'Vé này không ở trạng thái chờ bổ sung hồ sơ, không thể xếp lại hàng đợi.' });
    }
    const updated = await queueEngine.reentryScan(ticket.reentry_qr_token);
    res.json(await buildReentryResponse(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Nang cap 10/2026: cong dan danh gia muc do hai long sau khi hoan tat (1-5 sao + gop y).
router.post('/tickets/:id/feedback', async (req, res) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Khong tim thay ve.' });
    const result = await feedbackService.submitFeedback(req.params.id, req.body || {});
    require('../websocket/wsHub').broadcast('FEEDBACK_RECEIVED', { rating: result.rating, counterId: result.counterId });
    res.status(201).json({ ok: true, rating: result.rating });
  } catch (err) {
    if (!(err instanceof ValidationError)) {
      console.error('[kiosk] feedback:', err);
      return res.status(500).json({ error: 'Loi he thong noi bo.' });
    }
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Cong dan quet lai ma QR Re-entry sau khi bo sung ho so tai Ban ke khai (UC-09). Hai cach goi:
//   { token }                 - may quet/camera tai Kiosk, chatbot, lien ket ?reentry=<token>
//   { ticketNumber, code }    - nhap tay so thu tu + ma quay lai 8 ky tu in tren phieu
// UC-09 «include» UC-12: ngoai gio lam viec cung khong xep lai (quay da dong, khong ai goi).
router.post('/reentry-scan', async (req, res) => {
  try {
    const body = req.body || {};
    const hours = await getHoursStatusSafe();
    if (!hours.open) return res.status(200).json({ status: 'CLOSED', message: hours.message, hoursText: hours.hoursText, opensAt: hours.opensAt });

    let token = typeof body.token === 'string' ? body.token.trim() : '';
    // Nguoi dung dan ca lien ket (VD may quet ma go nguyen URL): tach token tu ?reentry=
    const m = /[?&]reentry=([0-9a-fA-F]{16,})/.exec(token);
    if (m) token = m[1];

    if (!token) {
      const ticketNumber = normalizeTicketNumber(body.ticketNumber);
      const code = normalizeShortCode(body.code);
      if (!ticketNumber || code.length < 8) {
        return res.status(400).json({ error: 'Vui lòng quét mã QR trên phiếu, hoặc nhập đủ Số thứ tự và Mã quay lại (8 ký tự).' });
      }
      const found = await ticketRepo.findSuppPendingByNumberAndCode(pool, ticketNumber, code);
      if (!found) return res.status(400).json({ error: 'Không tìm thấy vé chờ bổ sung khớp Số thứ tự và Mã quay lại này. Vui lòng kiểm tra lại phiếu hoặc nhờ cán bộ hỗ trợ.' });
      token = found.reentry_qr_token;
    }

    const ticket = await queueEngine.reentryScan(token);
    res.json(await buildReentryResponse(ticket));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Chi dan quay giao dich: uoc tinh so nguoi cho phia truoc theo linh vuc
router.get('/counters/status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.code, c.name, c.status, sf.name AS field_name,
        SUM(CASE WHEN t.status = 'QUEUED' THEN 1 ELSE 0 END) AS waiting_count
      FROM active_counters c
      JOIN service_fields sf ON sf.id = c.field_id
      LEFT JOIN tickets t ON t.counter_id = c.id AND t.status IN ('QUEUED','CALLING','PROCESSING')
      GROUP BY c.id, c.code, c.name, c.status, sf.name ORDER BY c.code ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
