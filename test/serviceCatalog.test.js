// UC-60 / UC-61: validator + service nghiep vu (khong can Postgres that - mock repository).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const { normalizeRequiredDocs, normalizeServiceInfo, normalizeNewService } = require('../src/utils/serviceDocs');

// ---------- Validator ----------
test('required_docs: hop le giu note, bo note rong, ma viet hoa', () => {
  const out = normalizeRequiredDocs([
    { code: ' cccd ', name: ' CCCD ', mandatory: true, note: '  Ban chinh ' },
    { code: 'ANH', name: 'Anh 3x4', mandatory: false, note: '' }
  ]);
  assert.deepEqual(out, [
    { code: 'CCCD', name: 'CCCD', mandatory: true, note: 'Ban chinh' },
    { code: 'ANH', name: 'Anh 3x4', mandatory: false }
  ]);
});

test('required_docs: tu choi rong, trung ma, thieu mandatory, ma sai', () => {
  assert.throws(() => normalizeRequiredDocs([]), /it nhat 1/);
  assert.throws(() => normalizeRequiredDocs('x'), /mang/);
  assert.throws(() => normalizeRequiredDocs([{ code: 'A1', name: 'a', mandatory: true }, { code: 'a1', name: 'b', mandatory: true }]), /trung/);
  assert.throws(() => normalizeRequiredDocs([{ code: 'A1', name: 'a', mandatory: 'yes' }]), /Bat buoc/);
  assert.throws(() => normalizeRequiredDocs([{ code: '1x', name: 'a', mandatory: true }]), /ma giay to/);
  assert.throws(() => normalizeRequiredDocs([{ code: 'A1', name: '  ', mandatory: true }]), /ten giay to/);
});

test('thong tin + le phi: kiem tra SLA va le phi', () => {
  const ok = normalizeServiceInfo({ name: 'Khai sinh', slaMinutes: '20', feeAmount: '30000', feeLabel: '30.000 d' });
  assert.equal(ok.slaMinutes, 20);
  assert.equal(ok.feeAmount, 30000);
  assert.equal(ok.feeNote, null);
  assert.throws(() => normalizeServiceInfo({ name: 'x', slaMinutes: 0, feeAmount: 0 }), /SLA/);
  assert.throws(() => normalizeServiceInfo({ name: 'x', slaMinutes: 5, feeAmount: -1 }), /Le phi/);
  assert.throws(() => normalizeServiceInfo({ name: '', slaMinutes: 5, feeAmount: 0 }), /Ten thu tuc/);
});

test('thu tuc moi: can ma + linh vuc', () => {
  assert.throws(() => normalizeNewService({ code: 'x', name: 'a', slaMinutes: 5, fieldId: 1 }), /Ma thu tuc/);
  assert.throws(() => normalizeNewService({ code: 'AB', name: 'a', slaMinutes: 5 }), /linh vuc/);
  assert.equal(normalizeNewService({ code: 'ab', name: 'a', slaMinutes: 5, fieldId: 2 }).code, 'AB');
});

// ---------- Service ----------
let svc; let repo; let counterRepo; let auditRepo; let audits; let writes; let current;
const T = '2026-10-01T00:00:00.000Z';

beforeEach(() => {
  for (const k of Object.keys(require.cache)) {
    if (k.includes('serviceCatalogService')) delete require.cache[k];
  }
  db.withTransaction = async (fn) => fn({});
  repo = require('../src/repositories/serviceRepository');
  counterRepo = require('../src/repositories/counterRepository');
  auditRepo = require('../src/repositories/auditRepository');
  audits = []; writes = [];
  current = {
    id: 5, code: 'KS', name: 'Khai sinh', field_id: 1, field_name: 'Ho tich', field_code: 'HT', is_active: 1,
    required_docs: [{ code: 'CCCD', name: 'CCCD', mandatory: true }], fee_amount: 0, fee_label: null, fee_note: null,
    fee_manual: 0, sla_minutes: 15, updated_at: T
  };
  repo.lockById = async () => current;
  repo.updateRequiredDocs = async (_c, _id, docs) => { writes.push(['docs', docs]); return { ...current, required_docs: docs, updated_at: '2026-10-02T00:00:00.000Z' }; };
  repo.updateInfo = async (_c, _id, data) => { writes.push(['info', data]); return { ...current, updated_at: '2026-10-02T00:00:00.000Z' }; };
  repo.setActive = async (_c, _id, a) => { writes.push(['active', a]); return { ...current, is_active: a ? 1 : 0, updated_at: '2026-10-02T00:00:00.000Z' }; };
  auditRepo.insertLog = async (_c, row) => { audits.push(row); };
  counterRepo.listAll = async () => [{ id: 1, officer_id: 'off-1', field_id: 1 }, { id: 2, officer_id: 'off-2', field_id: 2 }];
  svc = require('../src/services/serviceCatalogService');
});

const docs = [{ code: 'CCCD', name: 'CCCD', mandatory: true }, { code: 'ANH', name: 'Anh', mandatory: false }];
const admin = { staffId: 'a1', role: 'SUPERVISOR' };

test('UC-61: luu giay to, ghi audit UPDATE_SERVICE_DOCS, tra version moi', async () => {
  const out = await svc.updateDocs(5, docs, T, admin, 'doi quy dinh');
  assert.equal(writes[0][0], 'docs');
  assert.equal(audits[0].action, 'UPDATE_SERVICE_DOCS');
  assert.equal(audits[0].targetType, 'SERVICE');
  assert.equal(out.version, '2026-10-02T00:00:00.000Z');
  assert.equal(out.required_docs.length, 2);
});

test('UC-61: version cu -> 409, khong ghi gi', async () => {
  await assert.rejects(() => svc.updateDocs(5, docs, '2026-09-01T00:00:00.000Z', admin), (e) => e.status === 409);
  assert.equal(writes.length, 0);
});

test('UC-61: thieu version -> loi 400', async () => {
  await assert.rejects(() => svc.updateDocs(5, docs, undefined, admin), /version/);
});

test('UC-61: Officer chi sua linh vuc quay minh', async () => {
  await svc.updateDocs(5, docs, T, { staffId: 'off-1', role: 'OFFICER' });
  await assert.rejects(() => svc.updateDocs(5, docs, T, { staffId: 'off-2', role: 'OFFICER' }), (e) => e.status === 403);
  assert.equal(writes.length, 1);
});

test('UC-60: Officer khong duoc sua thong tin/le phi, an/hien, them moi', async () => {
  const off = { staffId: 'off-1', role: 'OFFICER' };
  await assert.rejects(() => svc.updateInfo(5, { name: 'x', slaMinutes: 5, feeAmount: 0 }, T, off), (e) => e.status === 403);
  await assert.rejects(() => svc.setActive(5, false, T, off), (e) => e.status === 403);
  await assert.rejects(() => svc.createService({ code: 'AB', name: 'x', slaMinutes: 5, fieldId: 1 }, off), (e) => e.status === 403);
});

test('UC-60: doi le phi -> fee_manual=1 + audit; khong doi le phi -> giu nguyen co', async () => {
  await svc.updateInfo(5, { name: 'Khai sinh', slaMinutes: 15, feeAmount: 30000, feeLabel: '30.000 d' }, T, admin);
  assert.equal(writes[0][1].feeManual, 1);
  assert.equal(audits[0].action, 'UPDATE_SERVICE');
  assert.equal(audits[0].payload.after.fee_amount, 30000);

  writes.length = 0;
  await svc.updateInfo(5, { name: 'Khai sinh moi', slaMinutes: 15, feeAmount: 0 }, T, admin);
  assert.equal(writes[0][1].feeManual, 0);
});

test('UC-60: hien thu tuc chua co giay to bi chan; an thi duoc', async () => {
  current.required_docs = [];
  await assert.rejects(() => svc.setActive(5, true, T, admin), /chua co giay to/);
  const out = await svc.setActive(5, false, T, admin);
  assert.equal(out.is_active, 0);
  assert.equal(audits[0].action, 'HIDE_SERVICE');
});

test('UC-60: them moi mac dinh an, ma trung -> loi 400', async () => {
  repo.insertService = async (_c, data) => ({ id: 9, ...data, is_active: 0, updated_at: T });
  const out = await svc.createService({ code: 'moi', name: 'Moi', slaMinutes: 10, fieldId: 1 }, admin);
  assert.equal(out.is_active, 0);
  assert.equal(audits[0].action, 'CREATE_SERVICE');
  repo.insertService = async () => { const e = new Error('dup'); e.code = '23505'; throw e; };
  await assert.rejects(() => svc.createService({ code: 'moi', name: 'Moi', slaMinutes: 10, fieldId: 1 }, admin), /da ton tai/);
});
