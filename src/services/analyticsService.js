const { pool } = require('../config/db');
const configService = require('../config/configService');

// Luu y: Postgres khong co CURDATE()/TIMESTAMPDIFF()/HOUR() kieu MySQL - dung CURRENT_DATE,
// EXTRACT(EPOCH FROM (b - a)) de tinh so giay giua 2 timestamp, va EXTRACT(HOUR FROM col).
// AVG(double precision) phai ep ::numeric truoc khi ROUND(x, n) vi Postgres chi cho ROUND
// 2 tham so tren kieu numeric.

// ---- Phan he 1: Master Dashboard - Chi so tong quan (Top Metrics) ----
async function getTopMetrics() {
  const { rows } = await pool.query(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS total_today,
      ROUND((AVG(CASE WHEN DATE(created_at) = CURRENT_DATE AND called_at IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (called_at - created_at)) END) / 60.0)::numeric, 1) AS awt_minutes,
      ROUND((AVG(CASE WHEN DATE(created_at) = CURRENT_DATE AND handling_duration_seconds IS NOT NULL
                      THEN handling_duration_seconds END) / 60.0)::numeric, 1) AS aht_minutes,
      SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'SUPP_PENDING' THEN 1 ELSE 0 END) AS supp_pending_today,
      SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'CANCELLED' THEN 1 ELSE 0 END) AS no_show_cancelled_today,
      SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS denom_today
    FROM tickets
  `);
  const r = rows[0];
  const denom = Number(r.denom_today) || 0;
  const noShowRate = denom > 0 ? Number(((Number(r.no_show_cancelled_today) / denom) * 100).toFixed(1)) : 0;
  const suppRate = denom > 0 ? Number(((Number(r.supp_pending_today) / denom) * 100).toFixed(1)) : 0;
  return {
    totalServedToday: Number(r.total_today) || 0,
    awtMinutes: Number(r.awt_minutes) || 0,
    ahtMinutes: Number(r.aht_minutes) || 0,
    suppRatePercent: suppRate,
    noShowRatePercent: noShowRate
  };
}

// ---- Phan he 1: Queue Heatmap (Xanh/Vang/Do theo tai lượng tung quay) ----
async function getHeatmap() {
  const queueAlert = await configService.get('QUEUE_LENGTH_ALERT');
  const yellowMin = await configService.get('QUEUE_HEATMAP_YELLOW_MIN');
  const awtAlertMinutes = await configService.get('AWT_ALERT_MINUTES');

  const { rows } = await pool.query(`
    SELECT c.id AS counter_id, c.code, c.name, c.status, sf.name AS field_name,
      SUM(CASE WHEN t.status = 'QUEUED' THEN 1 ELSE 0 END) AS waiting_count,
      ROUND((AVG(CASE WHEN t.status = 'QUEUED' THEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) END) / 60.0)::numeric, 1) AS avg_wait_minutes
    FROM active_counters c
    JOIN service_fields sf ON sf.id = c.field_id
    LEFT JOIN tickets t ON t.counter_id = c.id AND t.status IN ('QUEUED','CALLING','PROCESSING')
    GROUP BY c.id, c.code, c.name, c.status, sf.name
    ORDER BY c.code ASC
  `);

  return rows.map((r) => {
    const waiting = Number(r.waiting_count) || 0;
    const awt = Number(r.avg_wait_minutes) || 0;
    let level = 'GREEN';
    if (waiting >= queueAlert || awt > awtAlertMinutes) level = 'RED';
    else if (waiting >= yellowMin) level = 'YELLOW';
    return { ...r, waiting_count: waiting, avg_wait_minutes: awt, level };
  });
}

// ---- Phan he 4: KPI Can bo tiep nhan (Nang suat xu ly + Danh gia SLA) ----
async function getOfficerKpi() {
  const { rows } = await pool.query(`
    SELECT s.id AS officer_id, s.full_name,
      SUM(CASE WHEN h.to_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN h.to_status = 'SUPP_PENDING' THEN 1 ELSE 0 END) AS supp_requested_count,
      ROUND(AVG(CASE WHEN h.to_status = 'COMPLETED' THEN t.handling_duration_seconds END) / 60.0, 1) AS avg_aht_minutes,
      SUM(CASE WHEN h.to_status = 'COMPLETED' AND t.sla_status = 'ON_TIME' THEN 1 ELSE 0 END) AS on_time_count
    FROM staff s
    JOIN ticket_status_history h ON h.officer_id = s.id
    JOIN tickets t ON t.id = h.ticket_id
    WHERE s.role = 'OFFICER'
    GROUP BY s.id, s.full_name
    ORDER BY completed_count DESC
  `);
  return rows.map((r) => ({
    ...r,
    completed_count: Number(r.completed_count) || 0,
    supp_requested_count: Number(r.supp_requested_count) || 0,
    on_time_count: Number(r.on_time_count) || 0
  }));
}

// ---- Phan he 4: Peak Hour Analysis ----
async function getPeakHourAnalysis() {
  const { rows } = await pool.query(`
    SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS ticket_count
    FROM tickets
    WHERE DATE(created_at) = CURRENT_DATE
    GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour ASC
  `);
  return rows.map((r) => ({ hour: Number(r.hour), ticket_count: Number(r.ticket_count) }));
}

// ---- Phan he 4: Chi so Chat luong Dich vu theo linh vuc (No-Show Rate + AWT) ----
async function getServiceQualityByField() {
  const { rows } = await pool.query(`
    SELECT sf.name AS field_name,
      COUNT(t.id) AS total,
      SUM(CASE WHEN t.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
      ROUND((AVG(CASE WHEN t.called_at IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (t.called_at - t.created_at)) END) / 60.0)::numeric, 1) AS avg_awt_minutes
    FROM tickets t
    JOIN services sv ON sv.id = t.service_id
    JOIN service_fields sf ON sf.id = sv.field_id
    WHERE DATE(t.created_at) = CURRENT_DATE
    GROUP BY sf.name
  `);
  return rows.map((r) => {
    const total = Number(r.total) || 0;
    const cancelled = Number(r.cancelled_count) || 0;
    return {
      ...r, total, cancelled_count: cancelled,
      no_show_rate_percent: total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0
    };
  });
}

async function getAuditLogs(limit) {
  const auditRepo = require('../repositories/auditRepository');
  return auditRepo.listRecent(pool, limit);
}

// ---- Thong ke nhanh trong ca lam cua chinh 1 Officer (hien tren counter.html) ----
async function getOfficerTodayStats(officerId) {
  const { rows } = await pool.query(`
    SELECT
      SUM(CASE WHEN h.to_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_today,
      ROUND((AVG(CASE WHEN h.to_status = 'COMPLETED' THEN t.handling_duration_seconds END) / 60.0)::numeric, 1) AS avg_aht_minutes
    FROM ticket_status_history h
    JOIN tickets t ON t.id = h.ticket_id
    WHERE h.officer_id = ? AND DATE(h.created_at) = CURRENT_DATE
  `, [officerId]);
  const r = rows[0] || {};
  return {
    completedToday: Number(r.completed_today) || 0,
    avgAhtMinutes: r.avg_aht_minutes !== null ? Number(r.avg_aht_minutes) : null
  };
}

// ---- Nang cap 10/2026: thu tuc thuong xuyen vuot nguong SLA (huong phat trien dai han) ----
// Doc tu tickets.sla_status (ON_TIME/LATE) do queueEngine ghi luc Hoan tat. Sap xep theo ty le
// tre giam dan de Truong Trung tam thay ngay thu tuc can cai tien quy trinh.
async function getSlaBreaches(days = 30) {
  const d = Math.min(365, Math.max(1, Number(days) || 30));
  const { rows } = await pool.query(`
    SELECT sv.code, sv.name AS service_name, sf.name AS field_name, sv.sla_minutes,
      COUNT(t.id) AS completed,
      SUM(CASE WHEN t.sla_status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
      ROUND((AVG(t.handling_duration_seconds) / 60.0)::numeric, 1) AS avg_handling_minutes,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY t.handling_duration_seconds) / 60.0)::numeric, 1) AS p90_handling_minutes
    FROM tickets t
    JOIN services sv ON sv.id = t.service_id
    JOIN service_fields sf ON sf.id = sv.field_id
    WHERE t.status = 'COMPLETED' AND t.completed_at >= now() - (?::int * interval '1 day')
      AND t.handling_duration_seconds IS NOT NULL
    GROUP BY sv.code, sv.name, sf.name, sv.sla_minutes
  `, [d]);
  return rows.map((r) => {
    const completed = Number(r.completed) || 0;
    const late = Number(r.late_count) || 0;
    return {
      code: r.code, serviceName: r.service_name, fieldName: r.field_name, slaMinutes: Number(r.sla_minutes),
      completed, lateCount: late,
      latePercent: completed > 0 ? Number(((late / completed) * 100).toFixed(1)) : 0,
      avgHandlingMinutes: r.avg_handling_minutes !== null ? Number(r.avg_handling_minutes) : null,
      p90HandlingMinutes: r.p90_handling_minutes !== null ? Number(r.p90_handling_minutes) : null
    };
  }).sort((a, b) => b.latePercent - a.latePercent || b.completed - a.completed);
}

// ---- Nang cap 10/2026: du bao luong cong dan + so quay can mo (Erlang C) ----
// date: 'YYYY-MM-DD' (gio Viet Nam) - mac dinh hom nay. Lay N tuan lich su TRUOC ngay do,
// cung thu trong tuan, tinh trung binh so ve theo tung gio va tung linh vuc.
async function getForecast({ date, weeks } = {}) {
  const { buildForecast } = require('./forecastService');
  const w = Math.min(26, Math.max(1, Number(weeks) || 8));
  const target = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date)
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tz = `'Asia/Ho_Chi_Minh'`;

  const { rows } = await pool.query(`
    SELECT sf.id AS field_id, sf.name AS field_name,
      EXTRACT(HOUR FROM (t.created_at AT TIME ZONE ${tz}))::int AS hour, COUNT(*) AS total
    FROM tickets t
    JOIN services sv ON sv.id = t.service_id
    JOIN service_fields sf ON sf.id = sv.field_id
    WHERE (t.created_at AT TIME ZONE ${tz})::date >= (?::date - (?::int * 7))
      AND (t.created_at AT TIME ZONE ${tz})::date < ?::date
      AND EXTRACT(ISODOW FROM (t.created_at AT TIME ZONE ${tz})) = EXTRACT(ISODOW FROM ?::date)
    GROUP BY sf.id, sf.name, hour
  `, [target, w, target, target]);

  const { rows: ahtRows } = await pool.query(`
    SELECT sv.field_id, AVG(t.handling_duration_seconds) / 60.0 AS aht
    FROM tickets t JOIN services sv ON sv.id = t.service_id
    WHERE t.handling_duration_seconds IS NOT NULL
      AND t.completed_at >= (?::date - (?::int * 7))
    GROUP BY sv.field_id
  `, [target, w]);
  const ahtByField = {};
  ahtRows.forEach((r) => { ahtByField[Number(r.field_id)] = Number(r.aht); });

  let fallbackAht = 15;
  try {
    const { rows: sla } = await pool.query('SELECT AVG(sla_minutes) AS avg FROM services WHERE is_active = 1');
    if (sla[0] && sla[0].avg) fallbackAht = Number(sla[0].avg);
  } catch (e) { /* giu mac dinh */ }
  let targetWaitMinutes = 15;
  try { targetWaitMinutes = Number(await configService.get('AWT_ALERT_MINUTES')) || 15; } catch (e) { /* giu mac dinh */ }

  const weekday = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][new Date(`${target}T00:00:00Z`).getUTCDay()];
  return { date: target, weekday, ...buildForecast({ rows, weeks: w, ahtByField, fallbackAht, targetWaitMinutes }) };
}

module.exports = {
  getTopMetrics, getHeatmap, getOfficerKpi, getPeakHourAnalysis,
  getServiceQualityByField, getAuditLogs, getOfficerTodayStats,
  getSlaBreaches, getForecast
};
