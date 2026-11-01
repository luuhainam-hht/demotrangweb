// Quan ly Linh vuc (nang cap 11/2026): them / sua / xoa linh vuc tu trang quan tri.
// Mock repository, khong can Postgres that.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const wsHub = require('../src/websocket/wsHub');

let svc; let repo; let auditRepo; let fields; let audits; let refs;

beforeEach(() => {
  for (const k of Object.keys(require.cache)) {
    if (k.includes('fieldService')) delete require.cache[k];
  }
  db.withTransaction = async (fn) => fn({});
  wsHub.broadcast = () => {};
  repo = require('../src/repositories/serviceRepository');
  auditRepo = require('../src/repositories/auditRepository');
  fields = [
    { id: 1, code: 'HOTICH', name: 'Ho tich', ticket_prefix: 'A' },
    { id: 2, code: 'DATDAI', name: 'Dat dai', ticket_prefix: 'B' }
  ];
  audits = [];
  refs = { counters: 0, services: 0 };
  repo.listFields = async () => fields;
  repo.findFieldById = async (_c, id) => fields.find((f) => f.id === id) || null;
  repo.insertField = async (_c, { code, name, ticketPrefix }) => {
    if (fields.some((f) => f.code === code)) { const e = new Error('dup'); e.code = '23505'; e.detail = 'Key (code)=(X) already exists.'; throw e; }
    const row = { id: fields.length + 1, code, name, ticket_prefix: ticketPrefix };
    fields.push(row); return row;
  };
  repo.updateFieldInfo = async (_c, id, { name, ticketPrefix }) => ({ ...fields.find((f) => f.id === id), name, ticket_prefix: ticketPrefix });
  repo.countFieldReferences = async () => refs;
  repo.deleteField = async (_c, id) => { fields = fields.filter((f) => f.id !== id); };
  auditRepo.insertLog = async (_c, row) => { audits.push(row); };
  svc = require('../src/services/fieldService');
});

test('them linh vuc: tu sinh ma tu ten (bo dau) va tu chon chu cai con trong', async () => {
  const f = await svc.createField({ name: 'Lao động - Thương binh xã hội' }, 'admin-1');
  assert.equal(f.code, 'LAODONG');
  assert.equal(f.ticket_prefix, 'C');
  assert.equal(audits[0].action, 'FIELD_CREATED');
  assert.equal(audits[0].targetType, 'SERVICE');
});

test('them linh vuc: chu cai tu nhap, viet hoa', async () => {
  const f = await svc.createField({ name: 'Xay dung', code: 'xay_dung', ticketPrefix: 'x' }, 'admin-1');
  assert.equal(f.code, 'XAY_DUNG');
  assert.equal(f.ticket_prefix, 'X');
});

test('them linh vuc: bao loi de hieu khi trung ma / thieu ten / chu cai sai', async () => {
  await assert.rejects(() => svc.createField({ name: 'Ho tich 2', code: 'HOTICH' }, 'a'), /Mã lĩnh vực đã tồn tại/);
  await assert.rejects(() => svc.createField({ name: '  ' }, 'a'), /tên lĩnh vực/);
  await assert.rejects(() => svc.createField({ name: 'X', ticketPrefix: '12' }, 'a'), /1 chữ cái/);
});

test('sua linh vuc: giu chu cai cu khi bo trong', async () => {
  const f = await svc.updateField(1, { name: 'Ho tich - Tu phap', ticketPrefix: '' }, 'a');
  assert.equal(f.name, 'Ho tich - Tu phap');
  assert.equal(f.ticket_prefix, 'A');
  assert.equal(audits[0].action, 'FIELD_UPDATED');
});

test('xoa linh vuc: chan khi con quay/thu tuc, cho phep khi trong', async () => {
  refs = { counters: 2, services: 6 };
  await assert.rejects(() => svc.deleteField(1, 'a'), /Không thể xóa/);
  assert.equal(fields.length, 2);
  refs = { counters: 0, services: 0 };
  await svc.deleteField(2, 'a');
  assert.equal(fields.length, 1);
  assert.equal(audits[0].action, 'FIELD_DELETED');
});
