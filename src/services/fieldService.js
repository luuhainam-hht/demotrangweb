// Quan ly Linh vuc chuyen mon (service_fields) - nang cap 11/2026.
// Truoc day chi co 3 linh vuc co dinh trong seed (Ho tich, Dat dai, Kinh doanh); nay Admin tu
// them/sua/xoa ngay tren trang quan tri.
//  - code: ma viet hoa khong dau (VD: LAODONG), duy nhat.
//  - ticket_prefix: 1 chu cai dau so thu tu (A-101, B-101...), duy nhat. Bo trong -> tu chon chu
//    cai con trong dau tien.
//  - Xoa: chi khi CHUA co quay nao (ke ca quay da xoa mem) va CHUA co thu tuc nao tham chieu -
//    neu da dung thi phai chuyen quay/thu tuc sang linh vuc khac truoc (giu toan ven bao cao cu).
const { pool, withTransaction } = require('../config/db');
const serviceRepo = require('../repositories/serviceRepository');
const auditRepo = require('../repositories/auditRepository');
const wsHub = require('../websocket/wsHub');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function removeDiacritics(str) {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function normalizeCode(code) {
  return removeDiacritics(code).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20);
}

function normalizeName(name) {
  const value = String(name || '').trim().replace(/\s+/g, ' ');
  if (!value) throw new Error('Vui lòng nhập tên lĩnh vực.');
  if (value.length > 120) throw new Error('Tên lĩnh vực tối đa 120 ký tự.');
  return value;
}

function normalizePrefix(prefix) {
  if (prefix === undefined || prefix === null || String(prefix).trim() === '') return null;
  const value = removeDiacritics(prefix).trim().toUpperCase();
  if (!/^[A-Z]$/.test(value)) throw new Error('Chữ cái đầu số thứ tự phải là 1 chữ cái A-Z.');
  return value;
}

function mapUniqueError(err) {
  if (err && err.code === '23505') {
    const detail = String(err.detail || err.constraint || '');
    if (detail.includes('ticket_prefix')) return new Error('Chữ cái đầu số thứ tự đã được lĩnh vực khác dùng.');
    if (detail.includes('code')) return new Error('Mã lĩnh vực đã tồn tại.');
    return new Error('Mã lĩnh vực hoặc chữ cái đầu số đã tồn tại.');
  }
  return err;
}

async function listFields() {
  return serviceRepo.listFieldsWithUsage(pool);
}

async function createField({ code, name, ticketPrefix }, adminId) {
  const cleanName = normalizeName(name);
  const cleanCode = normalizeCode(code || cleanName.split(/[-–]/)[0]); // VD 'Lao động - TBXH' -> LAODONG
  if (!cleanCode) throw new Error('Vui lòng nhập mã lĩnh vực (chữ không dấu, số hoặc dấu _).');
  let prefix = normalizePrefix(ticketPrefix);

  try {
    const created = await withTransaction(async (client) => {
      if (!prefix) {
        const existing = await serviceRepo.listFields(client);
        const used = new Set(existing.map((f) => String(f.ticket_prefix).trim().toUpperCase()));
        prefix = [...LETTERS].find((l) => !used.has(l));
        if (!prefix) throw new Error('Đã dùng hết 26 chữ cái đầu số thứ tự.');
      }
      const field = await serviceRepo.insertField(client, { code: cleanCode, name: cleanName, ticketPrefix: prefix });
      await auditRepo.insertLog(client, {
        adminId, action: 'FIELD_CREATED', targetType: 'SERVICE', targetId: `FIELD-${field.id}`,
        reason: 'Them linh vuc moi', payload: { code: cleanCode, name: cleanName, ticketPrefix: prefix }
      });
      return field;
    });
    wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { fieldId: created.id, action: 'FIELD_CREATED' });
    return created;
  } catch (err) { throw mapUniqueError(err); }
}

async function updateField(fieldId, { name, ticketPrefix }, adminId) {
  const cleanName = normalizeName(name);
  try {
    const updated = await withTransaction(async (client) => {
      const current = await serviceRepo.findFieldById(client, fieldId);
      if (!current) throw new Error('Lĩnh vực không tồn tại.');
      const prefix = normalizePrefix(ticketPrefix) || String(current.ticket_prefix).trim();
      const field = await serviceRepo.updateFieldInfo(client, fieldId, { name: cleanName, ticketPrefix: prefix });
      await auditRepo.insertLog(client, {
        adminId, action: 'FIELD_UPDATED', targetType: 'SERVICE', targetId: `FIELD-${fieldId}`,
        reason: 'Cap nhat linh vuc',
        payload: { from: { name: current.name, ticketPrefix: current.ticket_prefix }, to: { name: cleanName, ticketPrefix: prefix } }
      });
      return field;
    });
    wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { fieldId, action: 'FIELD_UPDATED' });
    return updated;
  } catch (err) { throw mapUniqueError(err); }
}

async function deleteField(fieldId, adminId, reason) {
  await withTransaction(async (client) => {
    const current = await serviceRepo.findFieldById(client, fieldId);
    if (!current) throw new Error('Lĩnh vực không tồn tại.');
    const refs = await serviceRepo.countFieldReferences(client, fieldId);
    if (refs.counters > 0 || refs.services > 0) {
      throw new Error(`Không thể xóa: lĩnh vực đang có ${refs.counters} quầy và ${refs.services} thủ tục (kể cả đã ẩn/xóa). Hãy chuyển quầy và thủ tục sang lĩnh vực khác trước.`);
    }
    await serviceRepo.deleteField(client, fieldId);
    await auditRepo.insertLog(client, {
      adminId, action: 'FIELD_DELETED', targetType: 'SERVICE', targetId: `FIELD-${fieldId}`,
      reason: reason || 'Xoa linh vuc', payload: { code: current.code, name: current.name }
    });
  });
  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { fieldId, action: 'FIELD_DELETED' });
  return { success: true };
}

module.exports = { listFields, createField, updateField, deleteField, normalizeCode, normalizePrefix };
