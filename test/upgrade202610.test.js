// Kiem thu cac phan nang cap 10/2026 (ham thuan, khong can Postgres that):
//   - Du bao + Erlang C (forecastService)
//   - Nhieu khung gio/ngay, nghi trua (kioskHours)
//   - Dong goi su kien realtime giua cac ban chay (pgBus)
//   - Chuan hoa du lieu danh gia hai long + ma thiet bi
const { test } = require('node:test');
const assert = require('node:assert/strict');

const forecast = require('../src/services/forecastService');
const kioskHours = require('../src/services/kioskHours');
const pgBus = require('../src/realtime/pgBus');
const feedbackService = require('../src/services/feedbackService');
const deviceService = require('../src/services/deviceService');

// ---------------- Erlang C ----------------
test('erlangC: 1 quay (M/M/1) -> xac suat phai cho = rho', () => {
  // M/M/1: P(cho) = rho = lambda/mu
  assert.ok(Math.abs(forecast.erlangC(1, 0.6) - 0.6) < 1e-9);
});

test('erlangC: gia tri chuan sach giao khoa (c=2, a=1 Erlang) = 1/3', () => {
  assert.ok(Math.abs(forecast.erlangC(2, 1) - 1 / 3) < 1e-9);
});

test('erlangC: qua tai (a >= c) -> chac chan phai cho', () => {
  assert.equal(forecast.erlangC(3, 3), 1);
  assert.equal(forecast.erlangC(3, 5), 1);
});

test('expectedWaitMinutes: M/M/1 lambda=3/h, AHT 10p -> Wq = rho/(mu-lambda) = 10 phut', () => {
  // mu = 6/h, rho = 0.5, Wq = 0.5/(6-3) h = 10 phut
  assert.ok(Math.abs(forecast.expectedWaitMinutes(1, 3, 10) - 10) < 1e-9);
});

test('requiredCounters: tang luong khach thi so quay can mo khong giam', () => {
  let prev = 0;
  for (const lambda of [1, 3, 6, 10, 15, 20]) {
    const c = forecast.requiredCounters(lambda, 15, 10);
    assert.ok(c >= prev, `lambda=${lambda} -> ${c} < ${prev}`);
    // Tai luong a = lambda*AHT/60 bat buoc < c (neu khong hang doi tang vo han)
    assert.ok(c > (lambda * 15) / 60);
    prev = c;
  }
  assert.equal(forecast.requiredCounters(0, 15, 10), 0);
});

test('buildForecast: trung binh theo so tuan + xac dinh gio cao diem', () => {
  const rows = [
    { field_id: 1, field_name: 'Hộ tịch', hour: 8, total: 40 },
    { field_id: 2, field_name: 'Đất đai', hour: 8, total: 16 },
    { field_id: 1, field_name: 'Hộ tịch', hour: 14, total: 24 }
  ];
  const f = forecast.buildForecast({ rows, weeks: 8, ahtByField: { 1: 12, 2: 30 }, targetWaitMinutes: 15 });
  assert.equal(f.hours.length, 2);
  assert.equal(f.hours[0].hour, 8);
  assert.equal(f.hours[0].expected, 7); // (40 + 16) / 8
  assert.equal(f.peak.hour, 8);
  assert.equal(f.expectedTotal, 10); // 7 + 3
  const dat = f.hours[0].byField.find((x) => x.fieldId === 2);
  assert.equal(dat.expected, 2);
  assert.ok(dat.countersNeeded >= 1);
});

// ---------------- Nhieu khung gio / nghi trua ----------------
const SLOT_CFG = { enforced: true, openTime: '07:30', closeTime: '17:00', workingDays: '1,2,3,4,5', timeSlots: '07:30-11:30, 13:30-17:00' };
const at = (iso) => new Date(iso);

test('parseTimeSlots: hop le / sai dinh dang / chong lan', () => {
  assert.deepEqual(kioskHours.parseTimeSlots('13:30-17:00,07:30-11:30'), [[450, 690], [810, 1020]]);
  assert.equal(kioskHours.parseTimeSlots(''), null);
  assert.equal(kioskHours.parseTimeSlots('07:30-11:30,11:00-12:00'), null);
  assert.equal(kioskHours.parseTimeSlots('11:30-07:30'), null);
  assert.equal(kioskHours.parseTimeSlots('7h30-11h'), null);
});

test('evaluate (2 ca): 12:00 Thu Hai -> dang nghi trua, mo lai 13:30 hom nay', () => {
  const r = kioskHours.evaluate(SLOT_CFG, at('2026-09-21T05:00:00Z')); // 12:00 VN
  assert.equal(r.open, false);
  assert.equal(r.onBreak, true);
  assert.match(r.message, /nghỉ giữa ca/);
  assert.equal(r.opensAt.time, '13:30');
  assert.equal(r.opensAt.offsetDays, 0);
  assert.match(r.hoursText, /07:30 – 11:30, 13:30 – 17:00/);
});

test('evaluate (2 ca): 14:00 mo cua, 17:30 het gio -> mo lai 07:30 ngay mai', () => {
  const open = kioskHours.evaluate(SLOT_CFG, at('2026-09-21T07:00:00Z'));
  assert.equal(open.open, true);
  assert.equal(open.closesAt, '17:00');
  const closed = kioskHours.evaluate(SLOT_CFG, at('2026-09-21T10:30:00Z'));
  assert.equal(closed.open, false);
  assert.equal(closed.onBreak, false);
  assert.equal(closed.opensAt.time, '07:30');
  assert.equal(closed.opensAt.offsetDays, 1);
});

test('evaluate: KIOSK_TIME_SLOTS sai -> quay ve 1 khung OPEN/CLOSE (khong khoa Trung tam)', () => {
  const r = kioskHours.evaluate({ ...SLOT_CFG, timeSlots: 'abc' }, at('2026-09-21T05:00:00Z'));
  assert.equal(r.open, true); // 12:00 nam trong 07:30-17:00
});

// ---------------- Realtime giua cac ban chay ----------------
test('pgBus.encode/decode: giu nguyen su kien va danh dau ban chay goc', () => {
  const text = pgBus.encode('CALL_NEXT', { ticket: { ticket_number: 'A-101' } });
  const msg = pgBus.decode(text);
  assert.equal(msg.type, 'CALL_NEXT');
  assert.equal(msg.origin, pgBus.INSTANCE_ID);
  assert.equal(msg.payload.ticket.ticket_number, 'A-101');
});

test('pgBus.encode: thong diep vuot gioi han NOTIFY (8000 byte) -> chi gui ban tom tat', () => {
  const big = { ticketIds: Array.from({ length: 2000 }, (_, i) => `id-${i}-xxxxxxxxxxxxxxxx`) };
  const text = pgBus.encode('EOD_PURGE', big);
  assert.ok(Buffer.byteLength(text) < 8000);
  assert.deepEqual(pgBus.decode(text).payload, { truncated: true });
});

test('pgBus.toDirectConnectionString: bo "-pooler" cua Neon de LISTEN hoat dong', () => {
  const url = 'postgresql://u:p@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  assert.equal(new URL(pgBus.toDirectConnectionString(url)).hostname, 'ep-cool-123.ap-southeast-1.aws.neon.tech');
  assert.equal(pgBus.decode('khong phai json'), null);
});

// ---------------- Danh gia hai long + thiet bi ----------------
test('feedback: chi nhan diem nguyen 1-5, lam sach gop y', () => {
  assert.equal(feedbackService.normalizeRating('5'), 5);
  assert.throws(() => feedbackService.normalizeRating(0));
  assert.throws(() => feedbackService.normalizeRating(4.5));
  assert.throws(() => feedbackService.normalizeRating('abc'));
  assert.equal(feedbackService.normalizeComment('  rat \n\n tot  '), 'rat tot');
  assert.equal(feedbackService.normalizeComment('   '), null);
  assert.equal(feedbackService.normalizeComment('x'.repeat(900)).length, 500);
});

test('device: chuan hoa ma thiet bi, tu choi loai/ma la', () => {
  assert.deepEqual(deviceService.normalizeDevice({ deviceType: 'led_board', deviceCode: 'led-sanh-01' }),
    { type: 'LED_BOARD', code: 'LED-SANH-01', status: 'ONLINE' });
  assert.equal(deviceService.normalizeDevice({ deviceType: 'KIOSK', deviceCode: 'K1', status: 'degraded' }).status, 'DEGRADED');
  assert.throws(() => deviceService.normalizeDevice({ deviceType: 'PHONE', deviceCode: 'X1' }));
  assert.throws(() => deviceService.normalizeDevice({ deviceType: 'KIOSK', deviceCode: '<script>' }));
  // Thiet bi khong duoc tu bao OFFLINE (chi he thong danh dau)
  assert.equal(deviceService.normalizeDevice({ deviceType: 'KIOSK', deviceCode: 'K1', status: 'OFFLINE' }).status, 'ONLINE');
});
