// =====================================================================================
// THONG KE THEO THOI GIAN (11/2026) - tab "Thong ke" trang quan tri (SUPER_ADMIN, MANAGER).
// Gom ve theo: khung GIO trong ngay | NGAY | TUAN | THANG, trong khoang [from, to] (ngay VN),
// loc tuy chon theo linh vuc. Moi ky tra: tong ve, hoan tat, da yeu cau bo sung giay to, huy/vang/
// het han, ve uu tien, AWT/AHT trung binh, ty le dung SLA, diem hai long TB.
//
// Mui gio: CSDL Neon chay UTC -> moi phep loc/gom deu quy doi sang gio Viet Nam (Asia/Ho_Chi_Minh)
// de "ngay 14/11" la ngay 14/11 theo gio VN, khong lech 7 tieng.
// Trung binh (AWT/AHT/diem) tinh lai o tong tu TONG + SO LUONG (khong lay trung binh cua trung binh).
// =====================================================================================
const { pool } = require('../config/db');

const TZ = 'Asia/Ho_Chi_Minh';
const GROUPS = ['hour', 'day', 'week', 'month'];
// Gioi han do dai khoang thoi gian theo kieu gom de truy van khong qua nang.
const MAX_DAYS = { hour: 366, day: 366, week: 731, month: 1830 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s) {
  if (!DATE_RE.test(String(s || ''))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

function validateRange({ from, to, group }) {
  const g = GROUPS.includes(group) ? group : 'day';
  const f = parseDate(from);
  const t = parseDate(to);
  if (!f || !t) throw new Error('Ngày không hợp lệ (định dạng YYYY-MM-DD).');
  if (t < f) throw new Error('"Đến ngày" phải sau hoặc bằng "Từ ngày".');
  const days = Math.round((t - f) / 86400000) + 1;
  if (days > MAX_DAYS[g]) throw new Error(`Khoảng thời gian quá dài cho kiểu gom này (tối đa ${MAX_DAYS[g]} ngày).`);
  return { from: f, to: t, group: g, days };
}

// Nhan ky (key) theo kieu gom - dung chung cho SQL va cho viec dien ky trong.
function mondayOf(d) { const wd = (d.getUTCDay() + 6) % 7; return addDays(d, -wd); }
function bucketKeys(group, from, to) {
  const keys = [];
  if (group === 'hour') { for (let h = 0; h < 24; h += 1) keys.push(String(h)); return keys; }
  if (group === 'day') { for (let d = from; d <= to; d = addDays(d, 1)) keys.push(iso(d)); return keys; }
  if (group === 'week') { for (let d = mondayOf(from); d <= to; d = addDays(d, 7)) keys.push(iso(d)); return keys; }
  let y = from.getUTCFullYear(); let m = from.getUTCMonth();
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth())) {
    keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1; if (m === 12) { m = 0; y += 1; }
  }
  return keys;
}

function bucketLabel(group, key) {
  if (group === 'hour') return `${String(key).padStart(2, '0')}:00–${String(Number(key) + 1).padStart(2, '0')}:00`;
  if (group === 'day') { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`; }
  if (group === 'week') {
    const s = parseDate(key); const e = addDays(s, 6);
    const f = (x) => `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    return `Tuần ${f(s)}–${f(e)}/${e.getUTCFullYear()}`;
  }
  const [y, m] = key.split('-'); return `Tháng ${Number(m)}/${y}`;
}

const num = (v) => Number(v) || 0;
const round1 = (v) => Math.round(v * 10) / 10;

// rows: ket qua SQL (key, total, completed, supp, cancelled, priority, awt_sum, awt_n, aht_sum,
// aht_n, on_time, late, rating_sum, rating_n). Ham thuan -> test duoc khong can DB.
function shapeRow(r) {
  const total = num(r.total);
  const slaN = num(r.on_time) + num(r.late);
  return {
    total,
    completed: num(r.completed),
    suppRequested: num(r.supp),
    cancelled: num(r.cancelled),
    priority: num(r.priority),
    completionRate: total ? round1((num(r.completed) / total) * 100) : null,
    awtMinutes: num(r.awt_n) ? round1(num(r.awt_sum) / num(r.awt_n) / 60) : null,
    ahtMinutes: num(r.aht_n) ? round1(num(r.aht_sum) / num(r.aht_n) / 60) : null,
    onTimeRate: slaN ? round1((num(r.on_time) / slaN) * 100) : null,
    avgRating: num(r.rating_n) ? Math.round((num(r.rating_sum) / num(r.rating_n)) * 100) / 100 : null,
    ratingCount: num(r.rating_n)
  };
}

function buildSeries(group, from, to, rows) {
  const byKey = new Map(rows.map((r) => [String(r.key), r]));
  let keys = bucketKeys(group, from, to);
  // Khung gio: chi hien gio lam viec thong thuong (6h-18h) + gio nao co du lieu.
  if (group === 'hour') keys = keys.filter((k) => (Number(k) >= 6 && Number(k) <= 18) || byKey.has(k));
  const sum = {};
  ['total', 'completed', 'supp', 'cancelled', 'priority', 'awt_sum', 'awt_n', 'aht_sum', 'aht_n', 'on_time', 'late', 'rating_sum', 'rating_n']
    .forEach((f) => { sum[f] = rows.reduce((a, r) => a + num(r[f]), 0); });
  return {
    group,
    from: iso(from),
    to: iso(to),
    rows: keys.map((k) => ({ key: k, label: bucketLabel(group, k), ...shapeRow(byKey.get(k) || {}) })),
    summary: shapeRow(sum)
  };
}

async function getTimeSeries({ from, to, group, fieldId }) {
  const r = validateRange({ from, to, group });
  const lt = `(t.created_at AT TIME ZONE '${TZ}')`;
  const keyExpr = {
    hour: `EXTRACT(HOUR FROM ${lt})::int::text`,
    day: `to_char(${lt}, 'YYYY-MM-DD')`,
    week: `to_char(date_trunc('week', ${lt}), 'YYYY-MM-DD')`,
    month: `to_char(${lt}, 'YYYY-MM')`
  }[r.group];
  const params = [iso(r.from), iso(addDays(r.to, 1))];
  let fieldFilter = '';
  if (fieldId !== undefined && fieldId !== null && String(fieldId) !== '') {
    const fid = Number(fieldId);
    if (!Number.isInteger(fid) || fid <= 0) throw new Error('Lĩnh vực không hợp lệ.');
    fieldFilter = 'AND sv.field_id = ?';
    params.push(fid);
  }
  const { rows } = await pool.query(`
    SELECT ${keyExpr} AS key,
      COUNT(*) AS total,
      SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN sp.ticket_id IS NOT NULL OR t.status = 'SUPP_PENDING' THEN 1 ELSE 0 END) AS supp,
      SUM(CASE WHEN t.status IN ('CANCELLED','EXPIRED_EOD') THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN t.is_priority = 1 THEN 1 ELSE 0 END) AS priority,
      SUM(CASE WHEN t.called_at IS NOT NULL THEN EXTRACT(EPOCH FROM (t.called_at - t.created_at)) ELSE 0 END) AS awt_sum,
      SUM(CASE WHEN t.called_at IS NOT NULL THEN 1 ELSE 0 END) AS awt_n,
      SUM(COALESCE(t.handling_duration_seconds, 0)) AS aht_sum,
      SUM(CASE WHEN t.handling_duration_seconds IS NOT NULL THEN 1 ELSE 0 END) AS aht_n,
      SUM(CASE WHEN t.sla_status = 'ON_TIME' THEN 1 ELSE 0 END) AS on_time,
      SUM(CASE WHEN t.sla_status = 'LATE' THEN 1 ELSE 0 END) AS late,
      SUM(COALESCE(f.rating, 0)) AS rating_sum,
      SUM(CASE WHEN f.rating IS NOT NULL THEN 1 ELSE 0 END) AS rating_n
    FROM tickets t
    JOIN services sv ON sv.id = t.service_id
    LEFT JOIN ticket_feedback f ON f.ticket_id = t.id
    LEFT JOIN (SELECT DISTINCT ticket_id FROM ticket_status_history WHERE to_status = 'SUPP_PENDING') sp ON sp.ticket_id = t.id
    WHERE ${lt} >= ?::timestamp AND ${lt} < ?::timestamp ${fieldFilter}
    GROUP BY 1
  `, params);
  return buildSeries(r.group, r.from, r.to, rows);
}

module.exports = { getTimeSeries, validateRange, buildSeries, bucketKeys, bucketLabel, shapeRow };
