// Cai giay to cho tung thu tuc (trang Quan tri + trang Quay): chuan hoa du lieu, phan quyen
// theo vai tro/linh vuc quay, xung dot khi 2 nguoi cung sua, ghi Audit. Mock DB nhu cac test khac.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const db = require('../src/config/db');
const authService = require('../src/services/authService');
const serviceRepo = require('../src/repositories/serviceRepository');
const wsHub = require('../src/websocket/wsHub');
const serviceDocs = require('../src/services/serviceDocsService');

const SESSIONS = {
  'tok-admin': { staffId: 'u-admin', role: 'SUPER_ADMIN', fullName: 'Admin' },
  'tok-manager': { staffId: 'u-manager', role: 'MANAGER', fullName: 'Truong TT' },
  'tok-officer': { staffId: 'u-officer', role: 'OFFICER', fullName: 'Can bo quay 1' },
  'tok-supervisor': { staffId: 'u-sup', role: 'SUPERVISOR', fullName: 'Dieu phoi' }
};

let services;
let counters;
let auditLogs;
let broadcasts;

beforeEach(() => {
  services = [
    { id: 1, code: 'KHAISINH', name: 'Đăng ký khai sinh', field_id: 10, field_name: 'Hộ tịch', updated_at: '2026-10-01T00:00:00.000Z',
      required_docs: [{ code: 'CCCD', name: 'CCCD', mandatory: true }] },
    { id: 2, code: 'SANGTEN', name: 'Sang tên', field_id: 20, field_name: 'Đất đai', updated_at: '2026-10-01T00:00:00.000Z',
      required_docs: [{ code: 'GCNQSDD', name: 'Sổ đỏ', mandatory: true }] }
  ];
  counters = [{ id: 5, officer_id: 'u-officer', field_id: 10, is_deleted: 0 }];
  auditLogs = [];
  broadcasts = [];

  authService.verifyToken = async (token) => SESSIONS[token] || null;
  serviceRepo.listServices = async () => services.map((s) => ({ ...s }));
  serviceRepo.listAllServices = async () => services.map((s) => ({ ...s }));
  wsHub.broadcast = (type, payload) => broadcasts.push({ type, payload });

  const query = async (sql, params = []) => {
    if (sql.includes('SELECT DISTINCT field_id FROM counters')) {
      return { rows: counters.filter((c) => c.officer_id === params[0] && c.is_deleted === 0).map((c) => ({ field_id: c.field_id })) };
    }
    if (sql.includes('FROM services WHERE id = ? FOR UPDATE')) {
      const s = services.find((x) => x.id === params[0]);
      return { rows: s ? [{ ...s, required_docs: JSON.stringify(s.required_docs) }] : [] };
    }
    if (sql.startsWith('UPDATE services SET required_docs')) {
      const s = services.find((x) => x.id === params[1]);
      s.required_docs = JSON.parse(params[0]);
      s.updated_at = '2026-10-21T12:00:00.000Z';
      return { rows: [{ updated_at: s.updated_at }] };
    }
    if (sql.includes('INSERT INTO audit_logs')) { auditLogs.push(params); return { rows: [] }; }
    throw new Error(`Cau SQL khong duoc gia lap: ${sql}`);
  };
  db.pool.query = query;
  db.withTransaction = async (fn) => fn({ query });

  ['../src/routes/adminRoutes', '../src/routes/counterRoutes', '../src/middleware/auth']
    .forEach((p) => delete require.cache[require.resolve(p)]);
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../src/routes/adminRoutes'));
  app.use('/api', require('../src/routes/counterRoutes'));
  return app;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ---------------- Chuan hoa du lieu ----------------
test('normalizeDocs: trim ten, mac dinh bat buoc, giu ma cu, tu sinh ma tu ten (bo dau) cho giay to moi', () => {
  const docs = serviceDocs.normalizeDocs([
    { code: 'cccd', name: '  CCCD   bản chính ' },
    { name: 'Tờ khai đăng ký khai sinh', mandatory: false, note: ' Lấy ở kệ A ' },
    { name: 'Tờ khai đăng ký khai sinh (bản 2)' }
  ]);
  assert.deepEqual(docs[0], { code: 'CCCD', name: 'CCCD bản chính', mandatory: true });
  assert.deepEqual(docs[1], { code: 'TO_KHAI_DANG_KY_KHAI_SINH', name: 'Tờ khai đăng ký khai sinh', mandatory: false, note: 'Lấy ở kệ A' });
  assert.equal(docs[2].code, 'TO_KHAI_DANG_KY_KHAI_SINH_BAN');
});

test('normalizeDocs: tu choi ten rong, ma trung, ma sai dinh dang, mandatory khong phai boolean', () => {
  assert.throws(() => serviceDocs.normalizeDocs([{ name: '   ' }]), /ten khong duoc de trong/);
  assert.throws(() => serviceDocs.normalizeDocs([{ code: 'A1', name: 'x' }, { code: 'a1', name: 'y' }]), /bi trung/);
  assert.throws(() => serviceDocs.normalizeDocs([{ code: 'CÓ DẤU', name: 'x' }]), /chi gom chu khong dau/);
  assert.throws(() => serviceDocs.normalizeDocs([{ name: 'x', mandatory: 'yes' }]), /true\/false/);
  assert.throws(() => serviceDocs.normalizeDocs('abc'), /phai la mang/);
  assert.throws(() => serviceDocs.normalizeDocs([{ name: 'Sổ đỏ' }, { name: ' sổ  ĐỎ ' }]), /bi trung voi giay to khac/);
  assert.throws(() => serviceDocs.normalizeDocs(Array.from({ length: 41 }, (_, i) => ({ name: `G${i}` }))), /toi da 40/);
});

test('normalizeDocs: ma tu sinh khong de trung voi ma nhap tay cua giay to khac', () => {
  const docs = serviceDocs.normalizeDocs([{ name: 'Sổ đỏ' }, { code: 'SO_DO', name: 'Khác' }]);
  assert.equal(docs[1].code, 'SO_DO');
  assert.equal(docs[0].code, 'SO_DO_2');
});

// ---------------- Trang Quan tri ----------------
test('PUT /api/admin/services/:id/required-docs: MANAGER luu duoc, ghi Audit kem truoc/sau, phat su kien realtime', async () => {
  const res = await request(buildApp()).put('/api/admin/services/2/required-docs').set(auth('tok-manager'))
    .send({ docs: [{ code: 'GCNQSDD', name: 'Sổ đỏ bản chính', mandatory: true }, { name: 'Bản đồ thửa đất', mandatory: false }], expectedUpdatedAt: '2026-10-01T00:00:00.000Z' });
  assert.equal(res.status, 200);
  assert.equal(res.body.requiredDocs.length, 2);
  assert.equal(res.body.requiredDocs[1].mandatory, false);
  assert.equal(services[1].required_docs[1].code, 'BAN_DO_THUA_DAT');
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0][1], 'UPDATE_SERVICE_DOCS');
  const payload = JSON.parse(auditLogs[0][5]);
  assert.equal(payload.before.length, 1);
  assert.equal(payload.after.length, 2);
  assert.deepEqual(broadcasts.map((b) => b.type), ['SERVICE_DOCS_UPDATED']);
});

test('PUT /api/admin/services/:id/required-docs: OFFICER khong vao duoc API quan tri (403)', async () => {
  const res = await request(buildApp()).put('/api/admin/services/1/required-docs').set(auth('tok-officer')).send({ docs: [] });
  assert.equal(res.status, 403);
});

test('PUT /api/admin/services/:id/required-docs: ban cu (expectedUpdatedAt khac) -> 409, khong ghi de', async () => {
  const res = await request(buildApp()).put('/api/admin/services/1/required-docs').set(auth('tok-admin'))
    .send({ docs: [{ name: 'X' }], expectedUpdatedAt: '2026-09-01T00:00:00.000Z' });
  assert.equal(res.status, 409);
  assert.equal(services[0].required_docs[0].code, 'CCCD');
  assert.equal(auditLogs.length, 0);
});

test('PUT /api/admin/services/:id/required-docs: thu tuc khong ton tai -> 404; du lieu sai -> 400', async () => {
  const app = buildApp();
  const r404 = await request(app).put('/api/admin/services/99/required-docs').set(auth('tok-admin')).send({ docs: [] });
  assert.equal(r404.status, 404);
  const r400 = await request(app).put('/api/admin/services/1/required-docs').set(auth('tok-admin')).send({ docs: [{ name: '' }] });
  assert.equal(r400.status, 400);
});

// ---------------- Trang Quay ----------------
test('GET /api/me/services: Officer chi thay thu tuc thuoc linh vuc quay minh; Admin thay tat ca', async () => {
  const app = buildApp();
  const officer = await request(app).get('/api/me/services').set(auth('tok-officer'));
  assert.deepEqual(officer.body.map((s) => s.id), [1]);
  const admin = await request(app).get('/api/me/services').set(auth('tok-admin'));
  assert.deepEqual(admin.body.map((s) => s.id), [1, 2]);
});

test('PUT /api/services/:id/required-docs: Officer sua duoc thu tuc linh vuc minh, bi chan (403) o linh vuc khac', async () => {
  const app = buildApp();
  const ok = await request(app).put('/api/services/1/required-docs').set(auth('tok-officer'))
    .send({ docs: [{ code: 'CCCD', name: 'CCCD', mandatory: true }, { name: 'Sổ hộ khẩu', mandatory: false }] });
  assert.equal(ok.status, 200);
  assert.equal(services[0].required_docs.length, 2);

  const denied = await request(app).put('/api/services/2/required-docs').set(auth('tok-officer')).send({ docs: [] });
  assert.equal(denied.status, 403);
  assert.equal(services[1].required_docs.length, 1);
});

test('PUT /api/services/:id/required-docs: MANAGER khong dung duoc API cua trang Quay (khong co quyen COUNTER_OPS)', async () => {
  const res = await request(buildApp()).put('/api/services/1/required-docs').set(auth('tok-manager')).send({ docs: [] });
  assert.equal(res.status, 403);
});

test('PUT /api/services/:id/required-docs: Officer bi go khoi quay (quay da xoa) thi mat quyen sua', async () => {
  counters[0].is_deleted = 1;
  const res = await request(buildApp()).put('/api/services/1/required-docs').set(auth('tok-officer')).send({ docs: [] });
  assert.equal(res.status, 403);
});

// ---------------- Them / sua / an-hien thu tuc (danh muc) ----------------
function catalogMocks() {
  const fields = [{ id: 10 }, { id: 20 }];
  let nextId = 100;
  const query = async (sql, params = []) => {
    if (sql.includes('SELECT id FROM service_fields WHERE id = ?')) return { rows: fields.filter((f) => f.id === params[0]) };
    if (sql.includes('WHERE lower(name) = lower(?)')) {
      return { rows: services.filter((s) => s.name.toLowerCase() === params[0].toLowerCase() && s.id !== params[1]) };
    }
    if (sql.includes('SELECT id FROM services WHERE code = ?')) return { rows: services.filter((s) => s.code === params[0]) };
    if (sql.startsWith('INSERT INTO services')) {
      const [fieldId, code, name, alias, sla, fee, feeLabel, feeNote, docs, active] = params;
      const id = nextId++;
      services.push({ id, field_id: fieldId, code, name, short_alias: alias, sla_minutes: sla, fee_amount: fee, fee_label: feeLabel, fee_note: feeNote, required_docs: JSON.parse(docs), is_active: active, updated_at: '2026-10-21T00:00:00.000Z' });
      return { rows: [{ id }] };
    }
    if (sql.includes('SELECT * FROM services WHERE id = ? FOR UPDATE') || sql.includes('SELECT id, code, is_active FROM services WHERE id = ? FOR UPDATE')) {
      return { rows: services.filter((s) => s.id === params[0]) };
    }
    if (sql.startsWith('UPDATE services SET is_active')) {
      services.find((s) => s.id === params[1]).is_active = params[0]; return { rows: [] };
    }
    if (sql.startsWith('UPDATE services SET')) {
      const id = params[params.length - 1];
      const s = services.find((x) => x.id === id);
      const cols = sql.slice('UPDATE services SET '.length, sql.indexOf(', updated_at')).split(', ').map((c) => c.split(' = ')[0]);
      cols.forEach((c, i) => { s[c] = params[i]; });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) { auditLogs.push(params); return { rows: [] }; }
    throw new Error(`Cau SQL khong duoc gia lap: ${sql}`);
  };
  db.pool.query = query;
  db.withTransaction = async (fn) => fn({ query });
  serviceRepo.findServiceById = async (_c, id) => { const s = services.find((x) => x.id === Number(id)); return s ? { ...s } : null; };
}

test('POST /api/admin/services: tao thu tuc moi (mac dinh AN), tu sinh ma tu ten, ghi Audit', async () => {
  catalogMocks();
  const res = await request(buildApp()).post('/api/admin/services').set(auth('tok-manager'))
    .send({ fieldId: 20, name: '  Đăng ký thay đổi chủ hộ kinh doanh ', shortAlias: 'đổi chủ hộ', slaMinutes: 20, feeAmount: 100000 });
  assert.equal(res.status, 201);
  assert.equal(res.body.code, 'DANG_KY_THAY_DOI_CHU_HO_KINH_D');
  assert.equal(res.body.name, 'Đăng ký thay đổi chủ hộ kinh doanh');
  assert.equal(res.body.is_active, 0);
  assert.equal(auditLogs[0][1], 'CREATE_SERVICE');
  assert.equal(broadcasts[0].payload.kind, 'CREATED');
});

test('POST /api/admin/services: tu choi ten trung, linh vuc khong ton tai, thoi gian sai, Officer khong duoc tao', async () => {
  catalogMocks();
  const app = buildApp();
  const dup = await request(app).post('/api/admin/services').set(auth('tok-admin')).send({ fieldId: 10, name: 'đăng ký KHAI SINH', slaMinutes: 15 });
  assert.equal(dup.status, 409);
  const noField = await request(app).post('/api/admin/services').set(auth('tok-admin')).send({ fieldId: 99, name: 'Moi', slaMinutes: 15 });
  assert.equal(noField.status, 400);
  const badSla = await request(app).post('/api/admin/services').set(auth('tok-admin')).send({ fieldId: 10, name: 'Moi', slaMinutes: 0 });
  assert.equal(badSla.status, 400);
  const officer = await request(app).post('/api/admin/services').set(auth('tok-officer')).send({ fieldId: 10, name: 'Moi', slaMinutes: 15 });
  assert.equal(officer.status, 403);
  assert.equal(services.length, 2);
});

test('POST /api/admin/services: khong cho dung ma cua 14 thu tuc goc (le phi do serviceFees.js quan ly)', async () => {
  catalogMocks();
  services = services.filter((s) => s.code !== 'KHAISINH');
  const res = await request(buildApp()).post('/api/admin/services').set(auth('tok-admin')).send({ fieldId: 10, name: 'Khai sinh moi', code: 'khaisinh', slaMinutes: 15 });
  assert.equal(res.status, 409);
});

test('PUT /api/admin/services/:id: sua ten/thoi gian; thu tuc goc khong sua duoc le phi', async () => {
  catalogMocks();
  const app = buildApp();
  const ok = await request(app).put('/api/admin/services/1').set(auth('tok-admin')).send({ name: 'Đăng ký khai sinh (đúng hạn)', slaMinutes: 12 });
  assert.equal(ok.status, 200);
  assert.equal(services[0].name, 'Đăng ký khai sinh (đúng hạn)');
  assert.equal(services[0].sla_minutes, 12);
  const fee = await request(app).put('/api/admin/services/1').set(auth('tok-admin')).send({ feeAmount: 5000 });
  assert.equal(fee.status, 400);
  assert.match(fee.body.error, /serviceFees\.js/);
});

test('POST /api/admin/services/:id/active: an thu tuc -> Kiosk khong cap so va khong mo checklist', async () => {
  catalogMocks();
  const app = buildApp();
  const hide = await request(app).post('/api/admin/services/1/active').set(auth('tok-supervisor')).send({ active: false });
  assert.equal(hide.status, 200);
  assert.equal(services[0].is_active, 0);
  assert.equal(auditLogs[0][1], 'HIDE_SERVICE');

  delete require.cache[require.resolve('../src/routes/kioskRoutes')];
  const kiosk = express();
  kiosk.use(express.json());
  kiosk.use('/api/kiosk', require('../src/routes/kioskRoutes'));
  const ticket = await request(kiosk).post('/api/kiosk/tickets').send({ serviceId: 1, confirmedDocCodes: ['CCCD'] });
  assert.equal(ticket.status, 404);
  const checklist = await request(kiosk).get('/api/kiosk/services/1/checklist');
  assert.equal(checklist.status, 404);
});
