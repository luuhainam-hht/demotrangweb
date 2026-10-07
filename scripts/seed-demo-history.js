#!/usr/bin/env node
// =====================================================================================
// Sinh DU LIEU LICH SU MAU (N tuan) de trinh dien cac bao cao moi: Du bao luong khach (Erlang C),
// Thu tuc vuot SLA, Muc do hai long. Ve sinh ra deu o QUA KHU (truoc hom nay) va o trang thai
// ket thuc (COMPLETED / CANCELLED / EXPIRED_EOD) nen KHONG anh huong hang doi dang chay.
//
//   node scripts/seed-demo-history.js                 -> 8 tuan, ghi vao CSDL trong .env
//   node scripts/seed-demo-history.js --weeks 12
//   node scripts/seed-demo-history.js --clear         -> xoa du lieu mau da sinh (danh dau DEMO)
//
// AN TOAN: tu choi chay vao Neon (CSDL that dang demo tren Render) tru khi them --allow-remote.
// Moi ve mau duoc danh dau event_data.demo = true trong ticket_status_history de xoa duoc.
// =====================================================================================
require('dotenv').config();
const crypto = require('crypto');
const { Client } = require('pg');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

const WEEKS = Math.min(26, Math.max(1, Number(opt('--weeks', 8))));
const url = process.env.DATABASE_URL;
if (url && /neon\.tech/.test(url) && !flag('--allow-remote')) {
  console.error('Tu choi: DATABASE_URL dang tro toi Neon. Them --allow-remote neu chac chan muon ghi du lieu mau len Neon.');
  process.exit(1);
}

function client() {
  const forced = String(process.env.DB_SSL || '').toLowerCase();
  const ssl = (url ? forced !== 'false' : forced === 'true') ? { rejectUnauthorized: false } : false;
  return url ? new Client({ connectionString: url, ssl }) : new Client({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'smart_queue', user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '', ssl
  });
}

// Bo sinh so ngau nhien co hat giong (ket qua lap lai duoc giua cac lan chay).
let seed = 20261007;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
// Phan bo Poisson (Knuth) - so cong dan den trong 1 gio.
function poisson(lambda) { const L = Math.exp(-lambda); let k = 0; let p = 1; do { k += 1; p *= rand(); } while (p > L); return k - 1; }

// Luong khach trung binh/gio theo gio trong ngay (dinh sang 8-10h, dinh chieu 14-15h) va theo thu.
const HOURLY = { 7: 2, 8: 9, 9: 11, 10: 8, 11: 4, 13: 5, 14: 8, 15: 7, 16: 4 };
const WEEKDAY_FACTOR = { 1: 1.35, 2: 1.0, 3: 0.95, 4: 1.0, 5: 1.15 };
const FIELD_SHARE = { HOTICH: 0.5, DATDAI: 0.3, KINHDOANH: 0.2 };
const COMMENTS = {
  5: ['Cán bộ hướng dẫn rất tận tình', 'Nhanh gọn, không phải chờ lâu', 'Rất hài lòng', null, null],
  4: ['Khá nhanh', 'Hướng dẫn dễ hiểu', null, null],
  3: ['Chờ hơi lâu', null, null],
  2: ['Phải bổ sung giấy tờ nhiều lần', 'Thời gian chờ quá lâu'],
  1: ['Chờ rất lâu mà không được giải thích']
};

async function clear(c) {
  const { rows } = await c.query(`SELECT DISTINCT ticket_id FROM ticket_status_history WHERE event_data->>'demo' = 'true'`);
  const ids = rows.map((r) => r.ticket_id);
  if (ids.length) await c.query('DELETE FROM tickets WHERE id = ANY($1)', [ids]);
  console.log(`Da xoa ${ids.length} ve du lieu mau.`);
}

async function main() {
  const c = client();
  await c.connect();
  try {
    if (flag('--clear')) return await clear(c);

    const { rows: services } = await c.query(`SELECT s.id, s.code, s.sla_minutes, f.id AS field_id, f.code AS field_code, f.ticket_prefix
      FROM services s JOIN service_fields f ON f.id = s.field_id WHERE s.is_active = 1`);
    const { rows: counters } = await c.query('SELECT id, field_id FROM counters WHERE is_deleted = 0');
    const { rows: officers } = await c.query(`SELECT id FROM staff WHERE role IN ('OFFICER','SUPER_ADMIN') AND is_active = 1`);
    if (!services.length || !counters.length || !officers.length) throw new Error('Thieu du lieu nen (thu tuc/quay/can bo). Hay chay npm run db:init truoc.');
    const { rows: hasFb } = await c.query(`SELECT to_regclass('ticket_feedback') AS t`);
    const feedbackTable = !!hasFb[0].t;

    const byField = {};
    services.forEach((s) => { (byField[s.field_code] = byField[s.field_code] || []).push(s); });

    // Ngay hom nay theo gio Viet Nam; sinh tu (hom nay - WEEKS*7) den hom qua.
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const base = new Date(`${todayVN}T00:00:00+07:00`);
    let created = 0;
    await c.query('BEGIN');
    for (let d = WEEKS * 7; d >= 1; d -= 1) {
      const day = new Date(base.getTime() - d * 86400000);
      // `day` la 00:00 gio Viet Nam -> cong 7 tieng roi doc thu theo UTC = thu theo gio Viet Nam.
      const vnDow = new Date(day.getTime() + 7 * 3600000).getUTCDay();
      const dow = vnDow === 0 ? 7 : vnDow;
      if (!WEEKDAY_FACTOR[dow]) continue;
      const seq = {};
      for (const [hourStr, mean] of Object.entries(HOURLY)) {
        const hour = Number(hourStr);
        for (const [fieldCode, share] of Object.entries(FIELD_SHARE)) {
          const list = byField[fieldCode];
          if (!list) continue;
          const n = poisson(mean * share * WEEKDAY_FACTOR[dow]);
          for (let i = 0; i < n; i += 1) {
            const svc = pick(list);
            const counter = pick(counters.filter((x) => x.field_id === svc.field_id)) || pick(counters);
            const officer = pick(officers);
            seq[svc.field_code] = (seq[svc.field_code] || 100) + 1;
            const createdAt = new Date(day.getTime() + (hour * 60 + Math.floor(rand() * 60)) * 60000);
            const waitMin = 3 + Math.floor(rand() * 25);
            const calledAt = new Date(createdAt.getTime() + waitMin * 60000);
            const r = rand();
            const status = r < 0.86 ? 'COMPLETED' : r < 0.93 ? 'CANCELLED' : 'EXPIRED_EOD';
            // He so thoi gian xu ly so voi SLA: Dat dai hay tre han hon (giong thuc te), Ho tich nhanh nhat.
            const [lo, span] = svc.field_code === 'DATDAI' ? [0.55, 0.75] : svc.field_code === 'KINHDOANH' ? [0.45, 0.6] : [0.4, 0.62];
            const handling = Math.round(svc.sla_minutes * 60 * (lo + rand() * span));
            const processingAt = new Date(calledAt.getTime() + 40000);
            const completedAt = new Date(processingAt.getTime() + handling * 1000);
            const id = crypto.randomUUID();
            const number = `${svc.ticket_prefix}-${seq[svc.field_code]}`;
            await c.query(
              `INSERT INTO tickets (id, ticket_number, service_id, counter_id, status, queue_position, created_at,
                 called_at, processing_at, completed_at, cancelled_at, handling_duration_seconds, sla_status, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$7)`,
              [id, number, svc.id, counter.id, status, seq[svc.field_code], createdAt,
                status === 'EXPIRED_EOD' ? null : calledAt,
                status === 'COMPLETED' ? processingAt : null,
                status === 'COMPLETED' ? completedAt : null,
                status === 'CANCELLED' ? calledAt : null,
                status === 'COMPLETED' ? handling : null,
                status === 'COMPLETED' ? (handling <= svc.sla_minutes * 60 ? 'ON_TIME' : 'LATE') : null]
            );
            await c.query(
              `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, counter_id, officer_id, event_data, created_at)
               VALUES ($1, NULL, 'QUEUED', $2, NULL, '{"demo":true}', $3)`, [id, counter.id, createdAt]
            );
            if (status !== 'EXPIRED_EOD') {
              await c.query(
                `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, counter_id, officer_id, event_data, created_at)
                 VALUES ($1, 'CALLING', $2, $3, $4, '{"demo":true}', $5)`,
                [id, status === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED', counter.id, status === 'COMPLETED' ? officer.id : null,
                  status === 'COMPLETED' ? completedAt : calledAt]
              );
            }
            if (feedbackTable && status === 'COMPLETED' && rand() < 0.45) {
              // Diem hai long giam khi phai cho lau hoac xu ly tre han.
              let score = 5 - (waitMin > 20 ? 1 : 0) - (handling > svc.sla_minutes * 60 ? 1 : 0) - (rand() < 0.15 ? 1 : 0);
              score = Math.max(1, Math.min(5, score + (rand() < 0.1 ? -1 : 0)));
              await c.query(
                `INSERT INTO ticket_feedback (ticket_id, rating, comment, counter_id, officer_id, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [id, score, pick(COMMENTS[score]), counter.id, officer.id, new Date(completedAt.getTime() + 120000)]
              );
            }
            created += 1;
          }
        }
      }
    }
    await c.query('COMMIT');
    console.log(`Da sinh ${created} ve lich su mau trong ${WEEKS} tuan (danh dau demo, xoa bang --clear).`);
  } catch (err) {
    try { await c.query('ROLLBACK'); } catch (_) { /* bo qua */ }
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((err) => { console.error('Loi:', err.message); process.exit(1); });
