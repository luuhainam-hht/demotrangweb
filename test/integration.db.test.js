// Kiem thu TICH HOP voi PostgreSQL THAT (nang cap 10/2026). Chi chay khi co bien TEST_DATABASE_URL
// (VD CI GitHub Actions co service postgres, hoac may dev):
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hcc_test npm test
// CANH BAO: CSDL nay bi XOA SACH va tao lai - tuyet doi khong tro vao Neon that.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const URL_ = process.env.TEST_DATABASE_URL;
const skip = !URL_ ? 'Bo qua: chua dat TEST_DATABASE_URL' : (/neon\.tech/.test(URL_) ? 'Tu choi chay tren Neon' : false);

let pool; let feedbackService; let deviceService; let analytics; let queueEngine;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.DB_SSL = 'false';
  process.env.REALTIME_BUS = 'off';
  const { Client } = require('pg');
  const c = new Client({ connectionString: URL_ });
  await c.connect();
  await c.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await c.end();
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'db', 'init.js')], { env: process.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  await require('../src/migrations/runMigrations').run();
  ({ pool } = require('../src/config/db'));
  feedbackService = require('../src/services/feedbackService');
  deviceService = require('../src/services/deviceService');
  analytics = require('../src/services/analyticsService');
  queueEngine = require('../src/services/queueEngine');
});

after(async () => { if (!skip) setTimeout(() => process.exit(0), 50); });

test('vong doi ve that: cap so -> goi -> tiep nhan -> hoan tat -> danh gia 1 lan', { skip }, async () => {
  const { rows: svc } = await pool.query(`SELECT id FROM services WHERE code = 'KHAISINH'`);
  const created = await queueEngine.createTicket({ serviceId: svc[0].id });
  const ticket = created.ticket;
  assert.equal(ticket.status, 'QUEUED');

  // Chua hoan tat thi chua duoc danh gia
  await assert.rejects(() => feedbackService.submitFeedback(ticket.id, { rating: 5 }), /hoan tat|tiep nhan/i);

  const officer = '44444444-4444-4444-8444-444444444444';
  const called = await queueEngine.callNext(ticket.counter_id, officer);
  assert.equal(called.ticket.id, ticket.id);
  await queueEngine.acceptTicket(ticket.id, officer);
  await queueEngine.completeTicket(ticket.id, officer);
  queueEngine.clearNoShowTimeout && queueEngine.clearNoShowTimeout(ticket.id);

  const fb = await feedbackService.submitFeedback(ticket.id, { rating: 4, comment: '  Tốt  ' });
  assert.equal(fb.rating, 4);
  await assert.rejects(() => feedbackService.submitFeedback(ticket.id, { rating: 5 }), /da duoc danh gia/);

  const { rows } = await pool.query('SELECT officer_id, comment FROM ticket_feedback WHERE ticket_id = ?', [ticket.id]);
  assert.equal(rows[0].officer_id, officer);
  assert.equal(rows[0].comment, 'Tốt');

  const report = await feedbackService.getSatisfactionReport(7);
  assert.equal(report.responses, 1);
  assert.equal(report.avgRating, 4);
});

test('heartbeat thiet bi: tao moi, cap nhat, danh dau OFFLINE khi im lang', { skip }, async () => {
  await deviceService.heartbeat({ deviceType: 'LED_BOARD', deviceCode: 'LED-TEST-01' });
  await deviceService.heartbeat({ deviceType: 'LED_BOARD', deviceCode: 'LED-TEST-01', status: 'DEGRADED' });
  let list = await deviceService.list();
  assert.equal(list.find((d) => d.device_code === 'LED-TEST-01').status, 'DEGRADED');
  await pool.query(`UPDATE device_health SET last_heartbeat_at = now() - interval '1 hour' WHERE device_code = 'LED-TEST-01'`);
  assert.equal(await deviceService.sweepOffline(), 1);
  list = await deviceService.list();
  assert.equal(list[0].status, 'OFFLINE'); // OFFLINE xep dau danh sach
});

test('bao cao SLA + du bao chay duoc tren CSDL that', { skip }, async () => {
  const sla = await analytics.getSlaBreaches(30);
  assert.ok(Array.isArray(sla));
  const f = await analytics.getForecast({ weeks: 4 });
  assert.match(f.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(f.hours));
});

test('quet ma quay lai (UC-09) tren CSDL that: FIFO giua nguoi quay lai, truoc ve thuong, doi quay khi quay cu da dong', { skip }, async () => {
  const officer = '44444444-4444-4444-8444-444444444444';
  await pool.query(`UPDATE counters SET status = 'CLOSED', active_ticket_id = NULL`);
  await pool.query(`UPDATE tickets SET status = 'EXPIRED_EOD' WHERE status IN ('QUEUED','CALLING','PROCESSING','SUPP_PENDING')`);
  const { rows: cs } = await pool.query(`SELECT id FROM counters WHERE code IN ('QUAY-01','QUAY-02') ORDER BY code`);
  const [q1, q2] = cs.map((c) => c.id);
  await pool.query(`UPDATE counters SET status = 'OPEN' WHERE id = ?`, [q1]);
  const { rows: svc } = await pool.query(`SELECT id FROM services WHERE code = 'KHAISINH'`);

  // 2 nguoi lay so, ca 2 deu bi yeu cau bo sung
  const sup = [];
  for (let i = 0; i < 2; i++) {
    const t = (await queueEngine.createTicket({ serviceId: svc[0].id })).ticket;
    assert.equal(t.counter_id, q1);
    await queueEngine.callNext(q1, officer);
    queueEngine.clearNoShowTimeout(t.id);
    await queueEngine.acceptTicket(t.id, officer);
    const r = await queueEngine.requestSupplement(t.id, ['CCCD'], officer);
    sup.push(r.ticket);
  }
  // 2 nguoi khac dang cho binh thuong
  const n1 = (await queueEngine.createTicket({ serviceId: svc[0].id })).ticket;
  const n2 = (await queueEngine.createTicket({ serviceId: svc[0].id })).ticket;

  await queueEngine.reentryScan(sup[0].reentry_qr_token);
  await queueEngine.reentryScan(sup[1].reentry_qr_token);
  await assert.rejects(() => queueEngine.reentryScan(sup[0].reentry_qr_token), /không hợp lệ/);

  const order = (await pool.query(
    `SELECT id FROM tickets WHERE counter_id = ? AND status = 'QUEUED' ORDER BY is_priority DESC, queue_position ASC, created_at ASC`, [q1]
  )).rows.map((r) => r.id);
  assert.deepEqual(order, [sup[0].id, sup[1].id, n1.id, n2.id]);

  // ve moi cap sau van xep cuoi hang
  const n3 = (await queueEngine.createTicket({ serviceId: svc[0].id })).ticket;
  assert.ok(n3.queue_position > n2.queue_position);

  // Quay cu dong trong luc cong dan di bo sung -> quay lai thi sang quay dang mo cung linh vuc
  const t = (await queueEngine.callNext(q1, officer)).ticket;
  queueEngine.clearNoShowTimeout(t.id);
  await queueEngine.acceptTicket(t.id, officer);
  const s3 = (await queueEngine.requestSupplement(t.id, ['CCCD'], officer)).ticket;
  await pool.query(`UPDATE counters SET status = 'CLOSED' WHERE id = ?`, [q1]);
  await pool.query(`UPDATE counters SET status = 'OPEN' WHERE id = ?`, [q2]);
  const back = await queueEngine.reentryScan(s3.reentry_qr_token);
  assert.equal(back.counter_id, q2);

  // Phieu cua hom truoc khong dung duoc nua
  const t4 = (await queueEngine.callNext(q2, officer)).ticket;
  queueEngine.clearNoShowTimeout(t4.id);
  await queueEngine.acceptTicket(t4.id, officer);
  const s4 = (await queueEngine.requestSupplement(t4.id, ['CCCD'], officer)).ticket;
  await pool.query(`UPDATE tickets SET created_at = created_at - interval '1 day' WHERE id = ?`, [s4.id]);
  await assert.rejects(() => queueEngine.reentryScan(s4.reentry_qr_token), /hết hạn/);
});
