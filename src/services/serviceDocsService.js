// Cai dat danh sach giay to (required_docs) cho tung thu tuc - dung chung cho trang Quan tri
// (SUPER_ADMIN/MANAGER/SUPERVISOR: sua moi thu tuc) va trang Quay (OFFICER: chi sua thu tuc
// thuoc LINH VUC cua quay minh dang phu trach).
//
// Moi giay to: { code, name, mandatory, note? }
//   - mandatory = true  -> Kiosk CHAN cap so neu cong dan chua danh dau (BR-01).
//   - mandatory = false -> chi hien de cong dan biet, KHONG chan cap so.
//   - note: loi giai thich ngan hien tren Kiosk (uu tien hon goi y co san trong formGuides.js).
// Ma giay to (code) la "khoa" lien ket voi goi y DOC_HINTS, huong dan dien to khai va
// tickets.missing_doc_codes nen KHONG doi ma cua giay to da co; giay to moi khong nhap ma thi
// tu sinh tu ten.
const db = require('../config/db');
const auditRepo = require('../repositories/auditRepository');
const serviceRepo = require('../repositories/serviceRepository');
const wsHub = require('../websocket/wsHub');
const { parseJson } = require('../utils/json');

const MAX_DOCS = 40;
const MAX_NAME = 255;
const MAX_NOTE = 500;
const CODE_PATTERN = /^[A-Z0-9_]{2,40}$/;
const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SUPERVISOR'];

class ServiceDocsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// "Tờ khai đăng ký khai sinh" -> "TO_KHAI_DANG_KY_KHAI_SINH" (bo dau tieng Viet, chi giu A-Z0-9_).
function codeFromName(name) {
  const base = String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
    .replace(/_+$/g, '');
  return base.length >= 2 ? base : `GT_${base || 'MOI'}`;
}

function uniqueCode(base, used) {
  if (!used.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base.slice(0, 36)}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

// Chuan hoa + kiem tra danh sach giay to gui len tu giao dien. Tra ve mang sach de luu JSONB.
function normalizeDocs(input) {
  if (!Array.isArray(input)) throw new ServiceDocsError('Danh sach giay to (docs) phai la mang.');
  if (input.length > MAX_DOCS) throw new ServiceDocsError(`Moi thu tuc toi da ${MAX_DOCS} giay to.`);

  const used = new Set();
  const explicitCodes = new Set();
  const names = new Set();
  input.forEach((d, i) => {
    if (d && typeof d.code === 'string' && d.code.trim() !== '') {
      const code = d.code.trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) {
        throw new ServiceDocsError(`Giay to thu ${i + 1}: ma "${d.code}" chi gom chu khong dau, so, dau gach duoi (2-40 ky tu).`);
      }
      if (explicitCodes.has(code)) throw new ServiceDocsError(`Ma giay to "${code}" bi trung.`);
      explicitCodes.add(code);
    }
  });
  explicitCodes.forEach((c) => used.add(c));

  return input.map((d, i) => {
    if (!d || typeof d !== 'object') throw new ServiceDocsError(`Giay to thu ${i + 1} khong hop le.`);
    const name = typeof d.name === 'string' ? d.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) throw new ServiceDocsError(`Giay to thu ${i + 1}: ten khong duoc de trong.`);
    if (name.length > MAX_NAME) throw new ServiceDocsError(`Giay to thu ${i + 1}: ten qua dai (toi da ${MAX_NAME} ky tu).`);
    const nameKey = name.toLowerCase();
    if (names.has(nameKey)) throw new ServiceDocsError(`Giay to thu ${i + 1}: ten "${name}" bi trung voi giay to khac.`);
    names.add(nameKey);
    if (d.mandatory !== undefined && typeof d.mandatory !== 'boolean') {
      throw new ServiceDocsError(`Giay to thu ${i + 1}: "mandatory" phai la true/false.`);
    }
    const note = typeof d.note === 'string' ? d.note.trim() : '';
    if (note.length > MAX_NOTE) throw new ServiceDocsError(`Giay to thu ${i + 1}: ghi chu qua dai (toi da ${MAX_NOTE} ky tu).`);

    let code = typeof d.code === 'string' && d.code.trim() !== '' ? d.code.trim().toUpperCase() : null;
    if (!code) {
      code = uniqueCode(codeFromName(name), used);
      used.add(code);
    }
    const doc = { code, name, mandatory: d.mandatory !== false };
    if (note) doc.note = note;
    return doc;
  });
}

function isAdminRole(role) { return ADMIN_ROLES.includes(role); }

// Linh vuc ma 1 Officer duoc phep sua giay to = linh vuc cua cac quay (chua xoa) dang gan cho ho.
async function officerFieldIds(client, staffId) {
  const { rows } = await client.query(
    'SELECT DISTINCT field_id FROM counters WHERE officer_id = ? AND is_deleted = 0',
    [staffId]
  );
  return rows.map((r) => Number(r.field_id));
}

async function listEditableServices(actor) {
  const services = await serviceRepo.listServices(db.pool);
  if (isAdminRole(actor.role)) return services;
  const fields = await officerFieldIds(db.pool, actor.staffId);
  return services.filter((s) => fields.includes(Number(s.field_id)));
}

function sameTimestamp(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
}

async function updateRequiredDocs(serviceId, docsInput, actor, options = {}) {
  // Thu tuc khong co giay bat buoc nao van cho luu (giao dien se canh bao truoc khi gui).
  const docs = normalizeDocs(docsInput);

  const result = await db.withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, code, name, field_id, required_docs, updated_at FROM services WHERE id = ? FOR UPDATE',
      [serviceId]
    );
    const service = rows[0];
    if (!service) throw new ServiceDocsError('Thu tuc khong ton tai.', 404);

    if (!isAdminRole(actor.role)) {
      const fields = await officerFieldIds(client, actor.staffId);
      if (!fields.includes(Number(service.field_id))) {
        throw new ServiceDocsError('Ban chi duoc cai giay to cho thu tuc thuoc linh vuc quay minh phu trach.', 403);
      }
    }

    if (options.expectedUpdatedAt && !sameTimestamp(options.expectedUpdatedAt, service.updated_at)) {
      throw new ServiceDocsError('Danh sach giay to vua duoc nguoi khac thay doi. Vui long tai lai roi sua tiep.', 409);
    }

    const before = parseJson(service.required_docs) || [];
    const { rows: updatedRows } = await client.query(
      'UPDATE services SET required_docs = ?::jsonb, updated_at = now() WHERE id = ? RETURNING updated_at',
      [JSON.stringify(docs), serviceId]
    );
    await auditRepo.insertLog(client, {
      adminId: actor.staffId,
      action: 'UPDATE_SERVICE_DOCS',
      targetType: 'SERVICE',
      targetId: serviceId,
      reason: options.reason ? String(options.reason).slice(0, 255) : null,
      payload: { serviceCode: service.code, role: actor.role, before, after: docs }
    });
    return {
      service: { id: service.id, code: service.code, name: service.name, field_id: service.field_id },
      requiredDocs: docs,
      updatedAt: updatedRows[0] ? updatedRows[0].updated_at : null
    };
  });

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, {
    serviceId: result.service.id, fieldId: result.service.field_id, updatedAt: result.updatedAt
  });
  return result;
}

// Bat loi chung cho 2 bo route (admin + quay) - loi nghiep vu tra dung ma HTTP, loi khac -> 400.
function sendError(res, err) {
  const status = err instanceof ServiceDocsError ? err.status : 400;
  res.status(status).json({ error: err.message });
}

module.exports = {
  ServiceDocsError, normalizeDocs, codeFromName, listEditableServices, updateRequiredDocs, sendError,
  MAX_DOCS
};
