// Kiem tra du lieu dau vao cho UC-60 (quan ly danh muc thu tuc) va UC-61 (cai giay to cho thu tuc).
// Dat rieng khoi service de test duoc ma khong can CSDL, va de route/service dung chung 1 bo luat.
//
// Cau truc required_docs (JSONB) - xem Hinh 5.2 trong bao cao:
//   [ { code, name, mandatory: boolean, note? }, ... ]
//   mandatory = true  -> giay Bat buoc: thieu thi KHONG cap so (REJECTED)
//   mandatory = false -> giay Khong bat buoc: thieu van cap so, chi nhac nho
const { ValidationError } = require('./validate');

const MAX_DOCS = 30;
const DOC_CODE_RE = /^[A-Z][A-Z0-9_]{1,29}$/;
const SERVICE_CODE_RE = /^[A-Z][A-Z0-9_]{1,29}$/;
const MAX_FEE_AMOUNT = 9999999999.99; // DECIMAL(12,2)

function cleanText(value, label, { min = 0, max }) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length < min) throw new ValidationError(`${label} khong duoc de trong.`);
  if (text.length > max) throw new ValidationError(`${label} toi da ${max} ky tu.`);
  return text;
}

// Chuan hoa + kiem tra danh sach giay to. Tra ve mang moi (khong giu truong la), nem ValidationError
// kem thong bao ro rang theo tung dong de giao dien chi dung cho sai.
function normalizeRequiredDocs(input) {
  if (!Array.isArray(input)) throw new ValidationError('Danh sach giay to phai la mang.');
  if (input.length === 0) throw new ValidationError('Thu tuc can it nhat 1 giay to.');
  if (input.length > MAX_DOCS) throw new ValidationError(`Moi thu tuc toi da ${MAX_DOCS} giay to.`);

  const seen = new Set();
  return input.map((raw, index) => {
    const pos = `Giay to thu ${index + 1}`;
    if (!raw || typeof raw !== 'object') throw new ValidationError(`${pos}: du lieu khong hop le.`);

    const code = String(raw.code === undefined || raw.code === null ? '' : raw.code).trim().toUpperCase();
    if (!DOC_CODE_RE.test(code)) {
      throw new ValidationError(`${pos}: ma giay to chi gom chu in hoa, so, dau gach duoi (2-30 ky tu, bat dau bang chu).`);
    }
    if (seen.has(code)) throw new ValidationError(`${pos}: ma giay to "${code}" bi trung.`);
    seen.add(code);

    const name = cleanText(raw.name, `${pos}: ten giay to`, { min: 1, max: 255 });
    if (typeof raw.mandatory !== 'boolean') {
      throw new ValidationError(`${pos}: phai chon Bat buoc hay Khong bat buoc.`);
    }
    const note = cleanText(raw.note, `${pos}: ghi chu`, { max: 255 });

    const doc = { code, name, mandatory: raw.mandatory };
    if (note) doc.note = note;
    return doc;
  });
}

function parseFeeAmount(value) {
  const n = Number(value === '' || value === undefined || value === null ? 0 : value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_FEE_AMOUNT) {
    throw new ValidationError('Le phi phai la so tu 0 den 9.999.999.999.');
  }
  return Math.round(n * 100) / 100;
}

function parseSla(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1440) {
    throw new ValidationError('Thoi gian xu ly (SLA) phai la so phut nguyen tu 1 den 1440.');
  }
  return n;
}

// Thong tin chung + le phi cua thu tuc (UC-60 "sua").
function normalizeServiceInfo(input) {
  const body = input || {};
  const name = cleanText(body.name, 'Ten thu tuc', { min: 1, max: 255 });
  const shortAlias = cleanText(body.shortAlias, 'Ten goi tat', { max: 80 }) || null;
  const feeLabel = cleanText(body.feeLabel, 'Chu ngan le phi', { max: 80 }) || null;
  const feeNote = cleanText(body.feeNote, 'Giai thich le phi', { max: 2000 }) || null;
  return {
    name,
    shortAlias,
    slaMinutes: parseSla(body.slaMinutes),
    feeAmount: parseFeeAmount(body.feeAmount),
    feeLabel,
    feeNote
  };
}

function normalizeNewService(input) {
  const body = input || {};
  const code = String(body.code === undefined || body.code === null ? '' : body.code).trim().toUpperCase();
  if (!SERVICE_CODE_RE.test(code)) {
    throw new ValidationError('Ma thu tuc chi gom chu in hoa, so, dau gach duoi (2-30 ky tu, bat dau bang chu).');
  }
  const fieldId = Number(body.fieldId);
  if (!Number.isInteger(fieldId) || fieldId < 1) throw new ValidationError('Vui long chon linh vuc.');
  return { code, fieldId, ...normalizeServiceInfo(body) };
}

module.exports = {
  MAX_DOCS, DOC_CODE_RE, SERVICE_CODE_RE,
  normalizeRequiredDocs, normalizeServiceInfo, normalizeNewService
};
