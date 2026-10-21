// Them / sua / an-hien THU TUC hanh chinh tu trang Quan tri (SUPER_ADMIN, MANAGER, SUPERVISOR).
// Giay to cua thu tuc cai rieng qua serviceDocsService (dung chung voi trang Quay).
//
// Nguyen tac:
//   - KHONG xoa thu tuc (ve cu, bao cao, nhat ky deu tro toi services.id) - chi AN (is_active = 0):
//     thu tuc an khong hien tren Kiosk/Trang chu/Tro ly AI va Kiosk khong cap so cho no.
//   - Ma thu tuc (code) co dinh sau khi tao: la khoa lien ket voi le phi (serviceFees.js), thong
//     tin "can biet truoc khi di" (faqKnowledge.js), to khai mau.
//   - 14 thu tuc goc co le phi do src/data/serviceFees.js quan ly (ghi de moi lan khoi dong) nen
//     khong cho sua le phi cua chung tren giao dien - sua se bi mat sau lan deploy ke tiep.
const db = require('../config/db');
const auditRepo = require('../repositories/auditRepository');
const serviceRepo = require('../repositories/serviceRepository');
const wsHub = require('../websocket/wsHub');
const { SERVICE_FEES } = require('../data/serviceFees');
const { ServiceDocsError, normalizeDocs, codeFromName } = require('./serviceDocsService');

const CODE_PATTERN = /^[A-Z0-9_]{2,30}$/;
const MAX_FEE = 100000000;

function isFeeManagedByFile(code) { return Object.prototype.hasOwnProperty.call(SERVICE_FEES, String(code).toUpperCase()); }

function text(value, label, { required = false, max }) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : (value === undefined || value === null ? '' : String(value).trim());
  if (required && !v) throw new ServiceDocsError(`${label} khong duoc de trong.`);
  if (max && v.length > max) throw new ServiceDocsError(`${label} qua dai (toi da ${max} ky tu).`);
  return v || null;
}

function intInRange(value, label, min, max) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isInteger(n) || n < min || n > max) {
    throw new ServiceDocsError(`${label} phai la so nguyen tu ${min} den ${max}.`);
  }
  return n;
}

// Chuan hoa thong tin thu tuc tu giao dien. isCreate: bat buoc du truong.
function normalizeInfo(input, isCreate) {
  const body = input || {};
  const out = {};
  if (isCreate || body.fieldId !== undefined) out.fieldId = intInRange(body.fieldId, 'Linh vuc', 1, 2147483647);
  if (isCreate || body.name !== undefined) out.name = text(body.name, 'Ten thu tuc', { required: true, max: 255 });
  if (isCreate || body.shortAlias !== undefined) out.shortAlias = text(body.shortAlias, 'Ten goi ngan', { max: 80 });
  if (isCreate || body.slaMinutes !== undefined) out.slaMinutes = intInRange(body.slaMinutes, 'Thoi gian tiep nhan (phut)', 1, 480);
  if (isCreate || body.feeAmount !== undefined) {
    const fee = body.feeAmount === '' || body.feeAmount === undefined || body.feeAmount === null ? 0 : Number(body.feeAmount);
    if (!Number.isFinite(fee) || fee < 0 || fee > MAX_FEE || Math.round(fee) !== fee) {
      throw new ServiceDocsError('Le phi phai la so tien (dong) tu 0 den 100.000.000.');
    }
    out.feeAmount = fee;
  }
  if (isCreate || body.feeLabel !== undefined) out.feeLabel = text(body.feeLabel, 'Chu hien le phi', { max: 80 });
  if (isCreate || body.feeNote !== undefined) out.feeNote = text(body.feeNote, 'Ghi chu le phi', { max: 2000 });
  return out;
}

async function assertUniqueName(client, name, excludeId) {
  const { rows } = await client.query(
    'SELECT id FROM services WHERE lower(name) = lower(?) AND id <> ?', [name, excludeId || -1]
  );
  if (rows.length) throw new ServiceDocsError(`Da co thu tuc ten "${name}".`, 409);
}

async function assertFieldExists(client, fieldId) {
  const { rows } = await client.query('SELECT id FROM service_fields WHERE id = ?', [fieldId]);
  if (!rows.length) throw new ServiceDocsError('Linh vuc khong ton tai.');
}

async function uniqueServiceCode(client, base) {
  for (let i = 1; i < 1000; i += 1) {
    const candidate = i === 1 ? base : `${base.slice(0, 26)}_${i}`;
    const { rows } = await client.query('SELECT id FROM services WHERE code = ?', [candidate]);
    if (!rows.length) return candidate;
  }
  throw new ServiceDocsError('Khong sinh duoc ma thu tuc, vui long nhap ma.');
}

async function listForAdmin() {
  const rows = await serviceRepo.listAllServices(db.pool);
  return rows.map((s) => ({ ...s, fee_managed_by_file: isFeeManagedByFile(s.code) }));
}

async function createService(input, actor) {
  const info = normalizeInfo(input, true);
  const docs = input && input.requiredDocs !== undefined ? normalizeDocs(input.requiredDocs) : [];
  const isActive = input && input.isActive === true ? 1 : 0;

  const created = await db.withTransaction(async (client) => {
    await assertFieldExists(client, info.fieldId);
    await assertUniqueName(client, info.name);

    let code;
    if (input && typeof input.code === 'string' && input.code.trim()) {
      code = input.code.trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) throw new ServiceDocsError('Ma thu tuc chi gom chu khong dau, so, dau gach duoi (2-30 ky tu).');
      const { rows } = await client.query('SELECT id FROM services WHERE code = ?', [code]);
      if (rows.length) throw new ServiceDocsError(`Ma thu tuc "${code}" da ton tai.`, 409);
    } else {
      code = await uniqueServiceCode(client, codeFromName(info.name).slice(0, 30).replace(/_+$/g, ''));
    }
    if (isFeeManagedByFile(code)) throw new ServiceDocsError(`Ma "${code}" danh rieng cho thu tuc goc, vui long chon ma khac.`, 409);

    const { rows } = await client.query(
      `INSERT INTO services (field_id, code, name, short_alias, sla_minutes, fee_amount, fee_label, fee_note, required_docs, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id`,
      [info.fieldId, code, info.name, info.shortAlias, info.slaMinutes, info.feeAmount, info.feeLabel, info.feeNote, JSON.stringify(docs), isActive]
    );
    const id = rows[0].id;
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: 'CREATE_SERVICE', targetType: 'SERVICE', targetId: id,
      payload: { code, ...info, isActive, requiredDocs: docs }
    });
    return serviceRepo.findServiceById(client, id);
  });

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: created.id, fieldId: created.field_id, kind: 'CREATED', updatedAt: created.updated_at });
  return created;
}

async function updateService(serviceId, input, actor) {
  const info = normalizeInfo(input, false);
  const updated = await db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM services WHERE id = ? FOR UPDATE', [serviceId]);
    const before = rows[0];
    if (!before) throw new ServiceDocsError('Thu tuc khong ton tai.', 404);

    const feeTouched = ['feeAmount', 'feeLabel', 'feeNote'].some((k) => info[k] !== undefined);
    if (feeTouched && isFeeManagedByFile(before.code)) {
      const same = (info.feeAmount === undefined || Number(info.feeAmount) === Number(before.fee_amount))
        && (info.feeLabel === undefined || info.feeLabel === before.fee_label)
        && (info.feeNote === undefined || info.feeNote === before.fee_note);
      if (!same) throw new ServiceDocsError('Le phi cua thu tuc goc do file src/data/serviceFees.js quan ly (da doi chieu van ban), khong sua tren giao dien duoc.');
      delete info.feeAmount; delete info.feeLabel; delete info.feeNote;
    }
    if (info.fieldId !== undefined) await assertFieldExists(client, info.fieldId);
    if (info.name !== undefined) await assertUniqueName(client, info.name, serviceId);

    const columns = { fieldId: 'field_id', name: 'name', shortAlias: 'short_alias', slaMinutes: 'sla_minutes', feeAmount: 'fee_amount', feeLabel: 'fee_label', feeNote: 'fee_note' };
    const sets = []; const params = [];
    Object.entries(columns).forEach(([k, col]) => { if (info[k] !== undefined) { sets.push(`${col} = ?`); params.push(info[k]); } });
    if (sets.length === 0) throw new ServiceDocsError('Khong co thong tin nao de cap nhat.');
    await client.query(`UPDATE services SET ${sets.join(', ')}, updated_at = now() WHERE id = ?`, [...params, serviceId]);
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: 'UPDATE_SERVICE', targetType: 'SERVICE', targetId: serviceId,
      reason: input && input.reason ? String(input.reason).slice(0, 255) : null,
      payload: { code: before.code, changes: info }
    });
    return serviceRepo.findServiceById(client, serviceId);
  });
  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: updated.id, fieldId: updated.field_id, kind: 'UPDATED', updatedAt: updated.updated_at });
  return updated;
}

async function setServiceActive(serviceId, active, actor) {
  if (typeof active !== 'boolean') throw new ServiceDocsError('"active" phai la true/false.');
  const updated = await db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id, code, is_active FROM services WHERE id = ? FOR UPDATE', [serviceId]);
    if (!rows[0]) throw new ServiceDocsError('Thu tuc khong ton tai.', 404);
    await client.query('UPDATE services SET is_active = ?, updated_at = now() WHERE id = ?', [active ? 1 : 0, serviceId]);
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: active ? 'SHOW_SERVICE' : 'HIDE_SERVICE', targetType: 'SERVICE', targetId: serviceId,
      payload: { code: rows[0].code }
    });
    return serviceRepo.findServiceById(client, serviceId);
  });
  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: updated.id, fieldId: updated.field_id, kind: active ? 'SHOWN' : 'HIDDEN', updatedAt: updated.updated_at });
  return updated;
}

module.exports = { listForAdmin, createService, updateService, setServiceActive, normalizeInfo, isFeeManagedByFile };
