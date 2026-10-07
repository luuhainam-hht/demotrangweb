// =====================================================================================
// Danh gia muc do hai long cua cong dan sau moi luot giao dich (huong phat trien trung han
// trong bao cao: "bo sung mot chieu du lieu quan trong cho he thong bao cao").
//
// Nguyen tac:
//   - Khong dang nhap, khong ten/SDT: cong dan danh gia ngay tren trang theo-doi.html (mo bang
//     ma QR tren phieu STT). ID ve (UUID ngau nhien) dong vai tro chia khoa nhu luong theo doi.
//   - Chi danh gia duoc ve DA HOAN TAT, moi ve 1 lan (UNIQUE ticket_id), trong 48 gio.
//   - Ket qua gan voi quay + can bo da xu ly (lay tu ticket_status_history luc COMPLETED).
// =====================================================================================
const { pool, withTransaction } = require('../config/db');
const { ValidationError } = require('../utils/validate');

const FEEDBACK_WINDOW_HOURS = 48;
const COMMENT_MAX = 500;

function normalizeRating(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new ValidationError('Muc danh gia phai la so nguyen tu 1 den 5.');
  return n;
}

function normalizeComment(value) {
  if (value === undefined || value === null) return null;
  // Bo ky tu dieu khien, gop khoang trang - binh luan hien lai tren Dashboard.
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, COMMENT_MAX) : null;
}

async function getFeedbackForTicket(ticketId) {
  const { rows } = await pool.query('SELECT rating, created_at FROM ticket_feedback WHERE ticket_id = ?', [ticketId]);
  return rows[0] || null;
}

async function submitFeedback(ticketId, { rating, comment }) {
  const r = normalizeRating(rating);
  const c = normalizeComment(comment);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status, counter_id, completed_at FROM tickets WHERE id = ? FOR UPDATE`, [ticketId]
    );
    const t = rows[0];
    if (!t) { const e = new ValidationError('Khong tim thay ve.'); e.status = 404; throw e; }
    if (t.status !== 'COMPLETED') throw new ValidationError('Chi danh gia duoc sau khi ho so da duoc tiep nhan xong.');
    if (t.completed_at && Date.now() - new Date(t.completed_at).getTime() > FEEDBACK_WINDOW_HOURS * 3600 * 1000) {
      throw new ValidationError('Da qua thoi han danh gia (48 gio sau khi hoan tat).');
    }
    const { rows: officerRows } = await client.query(
      `SELECT officer_id FROM ticket_status_history WHERE ticket_id = ? AND to_status = 'COMPLETED'
       ORDER BY created_at DESC LIMIT 1`, [ticketId]
    );
    const officerId = officerRows[0] ? officerRows[0].officer_id : null;
    const { rows: inserted } = await client.query(
      `INSERT INTO ticket_feedback (ticket_id, rating, comment, counter_id, officer_id)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (ticket_id) DO NOTHING RETURNING id, rating, created_at`,
      [ticketId, r, c, t.counter_id, officerId]
    );
    if (!inserted[0]) throw new ValidationError('Ve nay da duoc danh gia roi. Cam on ban!');
    return { ticketId, rating: r, counterId: t.counter_id, createdAt: inserted[0].created_at };
  });
}

// Bao cao muc do hai long trong N ngay gan nhat.
async function getSatisfactionReport(days = 30) {
  const d = Math.min(365, Math.max(1, Number(days) || 30));
  const since = `now() - (?::int * interval '1 day')`;
  const [overall, dist, byOfficer, byService, recent] = await Promise.all([
    pool.query(`
      SELECT COUNT(f.id) AS responses, ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
        SUM(CASE WHEN f.rating >= 4 THEN 1 ELSE 0 END) AS satisfied,
        (SELECT COUNT(*) FROM tickets WHERE status = 'COMPLETED' AND completed_at >= ${since}) AS completed
      FROM ticket_feedback f WHERE f.created_at >= ${since}`, [d, d]),
    pool.query(`SELECT rating, COUNT(*) AS cnt FROM ticket_feedback WHERE created_at >= ${since} GROUP BY rating`, [d]),
    pool.query(`
      SELECT s.full_name, COUNT(f.id) AS responses, ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
      FROM ticket_feedback f JOIN staff s ON s.id = f.officer_id
      WHERE f.created_at >= ${since}
      GROUP BY s.full_name ORDER BY avg_rating DESC, responses DESC`, [d]),
    pool.query(`
      SELECT sv.name AS service_name, COUNT(f.id) AS responses, ROUND(AVG(f.rating)::numeric, 2) AS avg_rating
      FROM ticket_feedback f JOIN tickets t ON t.id = f.ticket_id JOIN services sv ON sv.id = t.service_id
      WHERE f.created_at >= ${since}
      GROUP BY sv.name ORDER BY avg_rating ASC, responses DESC`, [d]),
    pool.query(`
      SELECT f.rating, f.comment, f.created_at, t.ticket_number, c.code AS counter_code
      FROM ticket_feedback f JOIN tickets t ON t.id = f.ticket_id LEFT JOIN counters c ON c.id = f.counter_id
      WHERE f.created_at >= ${since} AND f.comment IS NOT NULL
      ORDER BY f.created_at DESC LIMIT 20`, [d])
  ]);
  const o = overall.rows[0] || {};
  const responses = Number(o.responses) || 0;
  const completed = Number(o.completed) || 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dist.rows.forEach((r) => { distribution[Number(r.rating)] = Number(r.cnt); });
  return {
    days: d,
    responses,
    completed,
    responseRatePercent: completed > 0 ? Number(((responses / completed) * 100).toFixed(1)) : 0,
    avgRating: o.avg_rating !== null && o.avg_rating !== undefined ? Number(o.avg_rating) : null,
    csatPercent: responses > 0 ? Number(((Number(o.satisfied) / responses) * 100).toFixed(1)) : null,
    distribution,
    byOfficer: byOfficer.rows.map((r) => ({ fullName: r.full_name, responses: Number(r.responses), avgRating: Number(r.avg_rating) })),
    byService: byService.rows.map((r) => ({ serviceName: r.service_name, responses: Number(r.responses), avgRating: Number(r.avg_rating) })),
    recentComments: recent.rows
  };
}

module.exports = { submitFeedback, getFeedbackForTicket, getSatisfactionReport, normalizeRating, normalizeComment, FEEDBACK_WINDOW_HOURS };
