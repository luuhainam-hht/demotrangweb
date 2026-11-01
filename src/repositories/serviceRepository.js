const { parseJson } = require('../utils/json');

function mapService(row) {
  if (!row) return null;
  return { ...row, required_docs: parseJson(row.required_docs) };
}

async function listFields(client) {
  const { rows } = await client.query('SELECT * FROM service_fields ORDER BY id ASC');
  return rows;
}

async function listServices(client) {
  const { rows } = await client.query(
    `SELECT s.*, sf.name AS field_name, sf.code AS field_code, sf.ticket_prefix
     FROM services s JOIN service_fields sf ON sf.id = s.field_id
     WHERE s.is_active = 1 ORDER BY s.name ASC`
  );
  return rows.map(mapService);
}

async function findServiceById(client, serviceId) {
  const { rows } = await client.query(
    `SELECT s.*, sf.name AS field_name, sf.ticket_prefix, sf.id AS field_id
     FROM services s JOIN service_fields sf ON sf.id = s.field_id
     WHERE s.id = ?`,
    [serviceId]
  );
  return mapService(rows[0]);
}

// ILIKE (khong phan biet hoa/thuong) de giu nguyen trai nghiem tim kiem nhu ban MySQL cu
// (collation utf8mb4_unicode_ci mac dinh khong phan biet hoa/thuong) - Postgres LIKE thuong
// thi co phan biet hoa/thuong.
async function searchServices(client, keyword) {
  const { rows } = await client.query(
    `SELECT s.*, sf.name AS field_name, sf.code AS field_code FROM services s
     JOIN service_fields sf ON sf.id = s.field_id
     WHERE s.is_active = 1 AND (s.name ILIKE ? OR s.short_alias ILIKE ? OR s.code ILIKE ?)
     ORDER BY s.name ASC LIMIT 20`,
    [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
  );
  return rows.map(mapService);
}

// ---------------------------------------------------------------------------------------
// UC-60 / UC-61: quan ly danh muc thu tuc + giay to (xem src/services/serviceCatalogService.js).
// ---------------------------------------------------------------------------------------

// Liet ke CA thu tuc dang an (khac listServices chi lay is_active = 1) de man quan ly hien dau du.
// fieldIds = null -> tat ca linh vuc; mang -> chi cac linh vuc do (Can bo Quay chi thay linh vuc quay minh).
async function listForManage(client, fieldIds = null) {
  const params = [];
  let where = '';
  if (Array.isArray(fieldIds)) {
    if (fieldIds.length === 0) return [];
    where = `WHERE s.field_id IN (${fieldIds.map(() => '?').join(', ')})`;
    params.push(...fieldIds);
  }
  const { rows } = await client.query(
    `SELECT s.*, sf.name AS field_name, sf.code AS field_code
     FROM services s JOIN service_fields sf ON sf.id = s.field_id
     ${where}
     ORDER BY sf.id ASC, s.name ASC`,
    params
  );
  return rows.map(mapService);
}

// Khoa dong thu tuc trong giao dich (FOR UPDATE OF s) de 2 nguoi sua cung luc khong ghi de nhau.
async function lockById(client, serviceId) {
  const { rows } = await client.query(
    `SELECT s.*, sf.name AS field_name, sf.code AS field_code
     FROM services s JOIN service_fields sf ON sf.id = s.field_id
     WHERE s.id = ? FOR UPDATE OF s`,
    [serviceId]
  );
  return mapService(rows[0]);
}

async function insertService(client, { fieldId, code, name, shortAlias, slaMinutes, feeAmount, feeLabel, feeNote }) {
  // is_active = 0: thu tuc moi mac dinh AN, cai giay to xong moi duoc bat hien (UC-60).
  // fee_manual = 1: le phi nhap tay, migration updateServiceFees khong duoc ghi de.
  const { rows } = await client.query(
    `INSERT INTO services (field_id, code, name, short_alias, sla_minutes, fee_amount, fee_label, fee_note, fee_manual, required_docs, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '[]'::jsonb, 0) RETURNING *`,
    [fieldId, code, name, shortAlias, slaMinutes, feeAmount, feeLabel, feeNote]
  );
  return mapService(rows[0]);
}

// feeManual: 1 khi nguoi dung da sua le phi bang tay -> migration khong ghi de nua.
async function updateInfo(client, serviceId, { name, shortAlias, slaMinutes, feeAmount, feeLabel, feeNote, feeManual }) {
  const { rows } = await client.query(
    `UPDATE services SET name = ?, short_alias = ?, sla_minutes = ?, fee_amount = ?, fee_label = ?, fee_note = ?, fee_manual = ?
     WHERE id = ? RETURNING *`,
    [name, shortAlias, slaMinutes, feeAmount, feeLabel, feeNote, feeManual, serviceId]
  );
  return mapService(rows[0]);
}

async function updateRequiredDocs(client, serviceId, docs) {
  const { rows } = await client.query(
    `UPDATE services SET required_docs = ?::jsonb WHERE id = ? RETURNING *`,
    [JSON.stringify(docs), serviceId]
  );
  return mapService(rows[0]);
}

async function setActive(client, serviceId, isActive) {
  const { rows } = await client.query(
    `UPDATE services SET is_active = ? WHERE id = ? RETURNING *`,
    [isActive ? 1 : 0, serviceId]
  );
  return mapService(rows[0]);
}

// ===== Quan ly Linh vuc (nang cap 11/2026) =====
// Kem so quay (chua xoa) va so thu tuc de giao dien hien thi + chan xoa khi dang duoc dung.
async function listFieldsWithUsage(client) {
  const { rows } = await client.query(
    `SELECT sf.*,
       (SELECT COUNT(*) FROM counters c WHERE c.field_id = sf.id AND c.is_deleted = 0)::int AS counter_count,
       (SELECT COUNT(*) FROM services s WHERE s.field_id = sf.id)::int AS service_count,
       (SELECT COUNT(*) FROM services s WHERE s.field_id = sf.id AND s.is_active = 1)::int AS active_service_count
     FROM service_fields sf ORDER BY sf.id ASC`
  );
  return rows;
}

async function findFieldById(client, fieldId) {
  const { rows } = await client.query('SELECT * FROM service_fields WHERE id = ?', [fieldId]);
  return rows[0] || null;
}

async function insertField(client, { code, name, ticketPrefix }) {
  const { rows } = await client.query(
    'INSERT INTO service_fields (code, name, ticket_prefix) VALUES (?, ?, ?) RETURNING *',
    [code, name, ticketPrefix]
  );
  return rows[0];
}

async function updateFieldInfo(client, fieldId, { name, ticketPrefix }) {
  const { rows } = await client.query(
    'UPDATE service_fields SET name = ?, ticket_prefix = ? WHERE id = ? RETURNING *',
    [name, ticketPrefix, fieldId]
  );
  return rows[0] || null;
}

// Tong so tham chieu (ke ca quay da xoa mem va thu tuc da an) - FK ON DELETE RESTRICT se chan
// neu con tham chieu, kiem tra truoc de bao loi de hieu thay vi loi 23503.
async function countFieldReferences(client, fieldId) {
  const { rows } = await client.query(
    `SELECT (SELECT COUNT(*) FROM counters WHERE field_id = ?)::int AS counters,
            (SELECT COUNT(*) FROM services WHERE field_id = ?)::int AS services`,
    [fieldId, fieldId]
  );
  return rows[0];
}

async function deleteField(client, fieldId) {
  await client.query('DELETE FROM service_fields WHERE id = ?', [fieldId]);
}

module.exports = {
  listFieldsWithUsage, findFieldById, insertField, updateFieldInfo, countFieldReferences, deleteField,
  listFields, listServices, findServiceById, searchServices,
  listForManage, lockById, insertService, updateInfo, updateRequiredDocs, setActive
};
