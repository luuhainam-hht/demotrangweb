// =====================================================================================
// Tinh trang he thong cho Admin (tab Giam sat) va /api/health/deep:
//   - CSDL dang dung la Neon hay Postgres trong Docker/may tai cho, do tre 1 truy van, dung luong.
//   - Kenh realtime giua cac ban chay (Postgres LISTEN/NOTIFY).
//   - Trang thai dong bo Docker <-> Neon neu dang bat sao chep logic (logical replication):
//       + phia Neon (publisher): cac replication slot + do tre
//       + phia Docker (subscriber): cac subscription + thoi diem nhan du lieu gan nhat
// Moi truy van thong ke deu boc try/catch: thieu quyen (VD goi Free) thi bo qua muc do.
// =====================================================================================
const os = require('os');
const { pool } = require('../config/db');
const pgBus = require('../realtime/pgBus');
const pkg = require('../../package.json');

function describeDatabaseTarget() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const host = new URL(url).hostname;
      return { kind: host.endsWith('.neon.tech') ? 'NEON' : 'REMOTE', host: host.replace(/^([^.]{4})[^.]*/, '$1***') };
    } catch (e) { return { kind: 'REMOTE', host: 'unknown' }; }
  }
  return { kind: 'LOCAL', host: process.env.DB_HOST || 'localhost' };
}

async function safeQuery(sql, params) {
  try { return (await pool.query(sql, params)).rows; } catch (e) { return null; }
}

async function collect() {
  const started = Date.now();
  let dbOk = true;
  let dbError = null;
  try { await pool.query('SELECT 1'); } catch (e) { dbOk = false; dbError = e.message; }
  const latencyMs = Date.now() - started;

  const [version, size, slots, subs, counts] = dbOk ? await Promise.all([
    safeQuery(`SELECT current_setting('server_version') AS v`),
    safeQuery(`SELECT pg_size_pretty(pg_database_size(current_database())) AS s`),
    safeQuery(`SELECT slot_name, active,
                 pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
               FROM pg_replication_slots WHERE slot_type = 'logical'`),
    safeQuery(`SELECT s.subname, s.subenabled, st.last_msg_receipt_time, st.latest_end_time
               FROM pg_subscription s LEFT JOIN pg_stat_subscription st ON st.subid = s.oid
               WHERE s.subdbid = (SELECT oid FROM pg_database WHERE datname = current_database())`),
    safeQuery(`SELECT (SELECT COUNT(*) FROM tickets) AS tickets, (SELECT COUNT(*) FROM staff) AS staff,
                      (SELECT COUNT(*) FROM audit_logs) AS audit_logs`)
  ]) : [null, null, null, null, null];

  return {
    app: { name: pkg.name, version: pkg.version, node: process.version, uptimeSeconds: Math.round(process.uptime()), host: os.hostname() },
    database: {
      ok: dbOk, error: dbError, latencyMs, ...describeDatabaseTarget(),
      serverVersion: version && version[0] ? version[0].v : null,
      size: size && size[0] ? size[0].s : null,
      rows: counts && counts[0] ? Object.fromEntries(Object.entries(counts[0]).map(([k, v]) => [k, Number(v)])) : null
    },
    replication: {
      publisherSlots: slots || [],
      subscriptions: subs || []
    },
    realtimeBus: pgBus.status(),
    websocketClients: require('../websocket/wsHub').clientCount(),
    time: new Date().toISOString()
  };
}

module.exports = { collect, describeDatabaseTarget };
