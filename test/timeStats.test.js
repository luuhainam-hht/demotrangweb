const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('../src/services/timeStatsService');

test('Thong ke theo thoi gian: kiem tra khoang ngay', () => {
  assert.throws(() => ts.validateRange({ from: '2026-11-10', to: '2026-11-01', group: 'day' }), /sau hoặc bằng/);
  assert.throws(() => ts.validateRange({ from: '2026-02-30', to: '2026-03-01', group: 'day' }), /không hợp lệ/);
  assert.throws(() => ts.validateRange({ from: '2020-01-01', to: '2026-01-01', group: 'day' }), /quá dài/);
  assert.equal(ts.validateRange({ from: '2026-11-01', to: '2026-11-14', group: 'xx' }).group, 'day');
});

test('Thong ke theo thoi gian: dien ky trong va cong don dung', () => {
  const r = ts.validateRange({ from: '2026-11-01', to: '2026-11-03', group: 'day' });
  const out = ts.buildSeries('day', r.from, r.to, [
    { key: '2026-11-02', total: 10, completed: 8, supp: 1, cancelled: 1, awt_sum: 600, awt_n: 10, aht_sum: 2400, aht_n: 8, on_time: 6, late: 2, rating_sum: 9, rating_n: 2 }
  ]);
  assert.deepEqual(out.rows.map((x) => x.key), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(out.rows[0].total, 0);
  assert.equal(out.rows[1].label, '02/11/2026');
  assert.equal(out.rows[1].awtMinutes, 1);
  assert.equal(out.rows[1].ahtMinutes, 5);
  assert.equal(out.rows[1].onTimeRate, 75);
  assert.equal(out.summary.completionRate, 80);
  assert.equal(out.summary.avgRating, 4.5);
});

test('Thong ke theo thoi gian: tuan bat dau thu Hai, thang, khung gio', () => {
  const w = ts.bucketKeys('week', new Date('2026-11-12T00:00:00Z'), new Date('2026-11-20T00:00:00Z'));
  assert.deepEqual(w, ['2026-11-09', '2026-11-16']);
  assert.deepEqual(ts.bucketKeys('month', new Date('2026-11-12T00:00:00Z'), new Date('2027-01-02T00:00:00Z')), ['2026-11', '2026-12', '2027-01']);
  assert.equal(ts.bucketLabel('hour', '7'), '07:00–08:00');
  const r = ts.validateRange({ from: '2026-11-14', to: '2026-11-14', group: 'hour' });
  const out = ts.buildSeries('hour', r.from, r.to, [{ key: '20', total: 1 }]);
  assert.ok(out.rows.some((x) => x.key === '20'), 'gio ngoai 6-18 co du lieu van hien');
  assert.ok(!out.rows.some((x) => x.key === '3'));
});
