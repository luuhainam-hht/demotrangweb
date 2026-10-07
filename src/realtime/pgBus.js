// =====================================================================================
// Kenh su kien dung chung giua NHIEU ban chay cua ung dung qua Postgres LISTEN/NOTIFY.
//
// Van de: WebSocket chi day su kien toi trinh duyet dang noi vao CHINH tien trinh Node phat ra
// su kien. Khi cung luc chay 2 ban (VD web tren Render + ban Docker tai Trung tam) va ca 2 cung
// tro vao 1 CSDL Neon, can bo goi so tren ban Render thi Bang LED dang mo tu ban Docker KHONG
// biet gi - du lieu trong CSDL van dung nhung man hinh dung im.
//
// Giai phap: moi lan wsHub.broadcast() -> NOTIFY 1 kenh trong Postgres. Moi ban chay LISTEN
// kenh do, nhan su kien cua ban KHAC (bo qua su kien cua chinh minh bang INSTANCE_ID) roi day
// tiep cho trinh duyet cua minh. Khong can Redis hay dich vu nao them - dung chinh CSDL Neon.
//
// Luu y quan trong voi Neon:
//   - LISTEN chi chay tren ket noi TRUC TIEP. Chuoi ket noi qua PgBouncer (host co "-pooler")
//     chay che do transaction, LISTEN bi bo qua im lang -> tu dong bo "-pooler" khoi host.
//   - Giu 1 ket noi LISTEN thuong truc nghia la compute Neon KHONG tu ngu trong luc ung dung
//     dang chay. Tat bang REALTIME_BUS=off neu chi chay 1 ban duy nhat va muon tiet kiem gio
//     compute cua goi Free.
//   - NOTIFY gioi han 8000 byte/thong diep -> thong diep qua lon chi gui phan "tom tat" (trinh
//     duyet chi can biet loai su kien de tu tai lai du lieu).
// =====================================================================================
const crypto = require('crypto');
const { Client } = require('pg');

const CHANNEL = 'hcc_realtime';
const MAX_PAYLOAD_BYTES = 7500;
const INSTANCE_ID = process.env.INSTANCE_ID || `${require('os').hostname()}-${crypto.randomBytes(3).toString('hex')}`;

let client = null;
let enabled = false;
let connected = false;
let stopping = false;
let reconnectDelay = 1000;
let onRemoteEvent = () => {};
const stats = { published: 0, received: 0, lastError: null, connectedAt: null };

function isEnabledByEnv() {
  return !/^(off|false|0|no)$/i.test(String(process.env.REALTIME_BUS || '').trim());
}

// Neon: ep-xxx-pooler.region.aws.neon.tech -> ep-xxx.region.aws.neon.tech (ket noi truc tiep).
function toDirectConnectionString(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.includes('-pooler.')) u.hostname = u.hostname.replace('-pooler.', '.');
    return u.toString();
  } catch (e) { return url; }
}

function buildClientConfig() {
  const url = process.env.DATABASE_URL;
  const forcedSsl = String(process.env.DB_SSL || '').toLowerCase();
  const sslEnabled = url ? forcedSsl !== 'false' : forcedSsl === 'true';
  const ssl = sslEnabled ? { rejectUnauthorized: false } : false;
  if (url) return { connectionString: toDirectConnectionString(url), ssl, keepAlive: true, connectionTimeoutMillis: 20000 };
  return {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'smart_queue', user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '', ssl, keepAlive: true, connectionTimeoutMillis: 20000
  };
}

// Tach rieng de test duoc: dong goi su kien, cat gon neu vuot gioi han cua NOTIFY.
function encode(type, payload) {
  const full = JSON.stringify({ origin: INSTANCE_ID, type, payload });
  if (Buffer.byteLength(full, 'utf8') <= MAX_PAYLOAD_BYTES) return full;
  return JSON.stringify({ origin: INSTANCE_ID, type, payload: { truncated: true } });
}

function decode(text) {
  try {
    const msg = JSON.parse(text);
    if (!msg || typeof msg.type !== 'string') return null;
    return msg;
  } catch (e) { return null; }
}

async function connect() {
  if (stopping) return;
  const c = new Client(buildClientConfig());
  c.on('error', (err) => {
    // Neon ngu / mang chap chon: ghi nhan roi tu ket noi lai, KHONG de tien trinh sap.
    stats.lastError = err.message;
    connected = false;
  });
  c.on('end', () => {
    connected = false;
    if (!stopping) scheduleReconnect();
  });
  c.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;
    const data = decode(msg.payload);
    if (!data || data.origin === INSTANCE_ID) return; // su kien cua chinh minh da phat roi
    stats.received += 1;
    try { onRemoteEvent(data.type, data.payload); } catch (e) { console.error('[pgBus] Loi xu ly su kien:', e.message); }
  });
  try {
    await c.connect();
    await c.query(`LISTEN ${CHANNEL}`);
    client = c;
    connected = true;
    reconnectDelay = 1000;
    stats.connectedAt = new Date().toISOString();
    console.log(`[pgBus] Dang lang nghe kenh ${CHANNEL} (instance ${INSTANCE_ID}).`);
  } catch (err) {
    stats.lastError = err.message;
    connected = false;
    try { await c.end(); } catch (_) { /* bo qua */ }
    scheduleReconnect();
  }
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (reconnectTimer || stopping) return;
  const wait = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, wait);
  if (reconnectTimer.unref) reconnectTimer.unref();
}

function start(handler) {
  if (!isEnabledByEnv()) {
    console.log('[pgBus] Tat (REALTIME_BUS=off) - su kien realtime chi trong 1 tien trinh.');
    return;
  }
  enabled = true;
  onRemoteEvent = handler || onRemoteEvent;
  connect();
}

// Phat su kien cho cac ban chay khac. Khong bao gio nem loi ra ngoai: realtime giua cac ban chay
// la tinh nang "co thi tot", khong duoc lam hong thao tac nghiep vu da ghi CSDL thanh cong.
function publish(type, payload) {
  if (!enabled || !connected || !client) return;
  stats.published += 1;
  client.query('SELECT pg_notify($1, $2)', [CHANNEL, encode(type, payload)])
    .catch((err) => { stats.lastError = err.message; });
}

async function stop() {
  stopping = true;
  if (client) { try { await client.end(); } catch (_) { /* bo qua */ } }
}

function status() {
  return { enabled, connected, instanceId: INSTANCE_ID, channel: CHANNEL, ...stats };
}

module.exports = { start, publish, stop, status, encode, decode, toDirectConnectionString, INSTANCE_ID, CHANNEL };
