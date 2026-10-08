// Kiem tra du lieu le phi (src/data/serviceFees.js) - nguon duy nhat ghi vao CSDL qua migration.
// Tien bac hien cho nguoi dan nen moi thu tuc PHAI co du lieu, co nguon, va migration phai ghi dung.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { SERVICE_FEES, FEE_SOURCES, getServiceFee, formatFeeAmount } = require('../src/data/serviceFees');

test('serviceFees: moi thu tuc trong seed CSDL deu co muc le phi', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const start = schema.indexOf('INSERT INTO services');
  const seedBlock = schema.slice(start, schema.indexOf('ON CONFLICT', start));
  const codes = [...seedBlock.matchAll(/WHERE code='[A-Z]+'\),\s*'([A-Z_]+)'/g)].map((m) => m[1]);
  assert.ok(codes.length >= 14, `chi doc duoc ${codes.length} thu tuc tu schema.sql`);
  for (const code of codes) {
    assert.ok(getServiceFee(code), `thieu le phi cho thu tuc ${code}`);
  }
});

test('serviceFees: so tien hop le, co chu hien thi, giai thich va nguon ton tai', () => {
  for (const [code, f] of Object.entries(SERVICE_FEES)) {
    assert.ok(Number.isFinite(f.amount) && f.amount >= 0, `${code}: amount khong hop le`);
    assert.ok(f.label && f.label.length <= 80, `${code}: label rong hoac qua dai (cot VARCHAR(80))`);
    assert.ok(f.note && f.note.length > 20, `${code}: thieu giai thich`);
    assert.ok(['VERIFIED', 'PARTIAL'].includes(f.status), `${code}: status la`);
    assert.ok(f.sources.length > 0, `${code}: khong co nguon`);
    for (const k of f.sources) assert.ok(FEE_SOURCES[k], `${code}: nguon ${k} khong ton tai`);
  }
  for (const s of Object.values(FEE_SOURCES)) assert.match(s.url, /^https:\/\//);
});

test('serviceFees: thu tuc dat dai KHONG hien 1 con so co dinh de gay hieu nham', () => {
  for (const code of ['SANGTEN', 'TACHTHUA', 'CHUYENMDSDD']) {
    assert.doesNotMatch(SERVICE_FEES[code].label, /^\d[\d.]* đ$/, `${code} phai la chu (theo gia tri dat)`);
  }
});

test('formatFeeAmount: 0 dong hien "Miễn phí", so tien co dau cham hang nghin', () => {
  assert.equal(formatFeeAmount(0), 'Miễn phí');
  assert.equal(formatFeeAmount('100000.00'), '100.000 đ');
});

test('updateServiceFees: them cot neu thieu va cap nhat dung tung thu tuc', async () => {
  const db = require('../src/config/db');
  const calls = [];
  db.pool.query = async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; };
  const { updateServiceFees } = require('../src/migrations/runMigrations');
  await updateServiceFees();
  assert.ok(calls.some((c) => /ADD COLUMN IF NOT EXISTS fee_label/.test(c.sql)));
  assert.ok(calls.some((c) => /ADD COLUMN IF NOT EXISTS fee_note/.test(c.sql)));
  const updates = calls.filter((c) => /^\s*UPDATE services/.test(c.sql));
  assert.equal(updates.length, Object.keys(SERVICE_FEES).length);
  const sangTen = updates.find((c) => c.params[3] === 'SANGTEN');
  assert.equal(sangTen.params[0], SERVICE_FEES.SANGTEN.amount);
  assert.equal(sangTen.params[1], SERVICE_FEES.SANGTEN.label);
});
