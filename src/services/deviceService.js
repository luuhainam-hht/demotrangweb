// =====================================================================================
// Giam sat thiet bi dau cuoi (Kiosk, Bang LED, Loa PA) qua tin hieu "heartbeat".
//
// Bang device_health da co trong thiet ke CSDL (muc 5.5.12 bao cao) nhung truoc day chua co ma
// nguon nao doc/ghi. Nay: trang display.html / Kiosk gui heartbeat moi 30-60 giay; tien trinh
// nen danh dau OFFLINE khi qua DEVICE_OFFLINE_SECONDS khong nhan duoc tin hieu va bao ngay len
// Admin Control Tower qua WebSocket (su kien DEVICE_HEALTH_CHANGED).
// =====================================================================================
const { pool } = require('../config/db');
const configService = require('../config/configService');
const wsHub = require('../websocket/wsHub');
const { ValidationError } = require('../utils/validate');

const DEVICE_TYPES = ['KIOSK', 'PA_SPEAKER', 'LED_BOARD'];
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const MAX_DEVICES = 200; // chong spam tao hang loat thiet bi ao qua endpoint cong khai

function normalizeDevice({ deviceType, deviceCode, status }) {
  const type = String(deviceType || '').trim().toUpperCase();
  const code = String(deviceCode || '').trim().toUpperCase();
  if (!DEVICE_TYPES.includes(type)) throw new ValidationError(`Loai thiet bi phai la mot trong: ${DEVICE_TYPES.join(', ')}.`);
  if (!CODE_PATTERN.test(code)) throw new ValidationError('Ma thiet bi chi gom chu in hoa, so, "-" hoac "_" (2-40 ky tu).');
  const st = String(status || 'ONLINE').toUpperCase();
  return { type, code, status: ['ONLINE', 'DEGRADED'].includes(st) ? st : 'ONLINE' };
}

async function heartbeat(input) {
  const { type, code, status } = normalizeDevice(input);
  const { rows: existing } = await pool.query(
    'SELECT status FROM device_health WHERE device_type = ? AND device_code = ?', [type, code]
  );
  if (!existing[0]) {
    const { rows: cnt } = await pool.query('SELECT COUNT(*) AS n FROM device_health');
    if (Number(cnt[0].n) >= MAX_DEVICES) throw new ValidationError('Da dat gioi han so thiet bi duoc giam sat.');
  }
  await pool.query(
    `INSERT INTO device_health (device_type, device_code, status, last_heartbeat_at)
     VALUES (?, ?, ?, now())
     ON CONFLICT (device_type, device_code) DO UPDATE SET status = EXCLUDED.status, last_heartbeat_at = now()`,
    [type, code, status]
  );
  const before = existing[0] ? existing[0].status : null;
  if (before !== status) {
    wsHub.broadcast(wsHub.EVENTS.DEVICE_HEALTH_CHANGED, { deviceType: type, deviceCode: code, status, previous: before });
  }
  return { deviceType: type, deviceCode: code, status };
}

// Danh dau OFFLINE cac thiet bi im lang qua lau. Chay dinh ky tu server.js.
async function sweepOffline() {
  let threshold = 120;
  try { threshold = Number(await configService.get('DEVICE_OFFLINE_SECONDS')) || 120; } catch (e) { /* CSDL cu */ }
  const { rows } = await pool.query(
    `UPDATE device_health SET status = 'OFFLINE'
     WHERE status <> 'OFFLINE' AND last_heartbeat_at < now() - (?::int * interval '1 second')
     RETURNING device_type, device_code`, [threshold]
  );
  rows.forEach((r) => wsHub.broadcast(wsHub.EVENTS.DEVICE_HEALTH_CHANGED, {
    deviceType: r.device_type, deviceCode: r.device_code, status: 'OFFLINE'
  }));
  return rows.length;
}

async function list() {
  const { rows } = await pool.query(
    `SELECT d.id, d.device_type, d.device_code, d.status, d.last_heartbeat_at, c.code AS counter_code,
            EXTRACT(EPOCH FROM (now() - d.last_heartbeat_at))::int AS silent_seconds
     FROM device_health d LEFT JOIN counters c ON c.id = d.counter_id
     ORDER BY CASE d.status WHEN 'OFFLINE' THEN 0 WHEN 'DEGRADED' THEN 1 ELSE 2 END, d.device_type, d.device_code`
  );
  return rows;
}

module.exports = { heartbeat, sweepOffline, list, normalizeDevice, DEVICE_TYPES };
