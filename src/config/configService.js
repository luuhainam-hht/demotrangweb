const { pool } = require('./db');

// Cache trong bo nho cho Dynamic Policy & Business Rules Engine.
// Duoc nap lai moi khi Admin cap nhat tham so (xem routes/adminRoutes.js).
let cache = null;

async function loadAll() {
  const { rows } = await pool.query('SELECT * FROM system_configs');
  cache = {};
  for (const row of rows) {
    cache[row.config_key] = row;
  }
  return cache;
}

async function get(key) {
  if (!cache) await loadAll();
  const row = cache[key];
  if (!row) throw new Error(`Tham so cau hinh khong ton tai: ${key}`);
  if (row.value_type === 'NUMBER') return Number(row.config_value);
  if (row.value_type === 'BOOLEAN') return row.config_value === 'true';
  if (row.value_type === 'JSON') return JSON.parse(row.config_value);
  return row.config_value;
}

async function getAll() {
  if (!cache) await loadAll();
  return cache;
}

// Rang buoc cho cac tham so kieu chuoi co dinh dang rieng (gio mo cua Kiosk...): ngan Admin nhap
// gia tri sai (VD "25:99") lam hong logic gio mo cua. Ham nhan (value, cache) va nem loi neu sai.
const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
function toMinutes(v) { const m = TIME_PATTERN.exec(String(v).trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
const STRING_VALIDATORS = {
  KIOSK_OPEN_TIME(value, c) {
    if (toMinutes(value) === null) throw new Error('Gio mo cua phai co dang HH:MM (VD 07:30).');
    const close = c.KIOSK_CLOSE_TIME && toMinutes(c.KIOSK_CLOSE_TIME.config_value);
    if (close !== null && close !== undefined && toMinutes(value) >= close) throw new Error('Gio mo cua phai som hon gio dong cua hien tai.');
  },
  KIOSK_CLOSE_TIME(value, c) {
    if (toMinutes(value) === null) throw new Error('Gio dong cua phai co dang HH:MM (VD 17:00).');
    const open = c.KIOSK_OPEN_TIME && toMinutes(c.KIOSK_OPEN_TIME.config_value);
    if (open !== null && open !== undefined && toMinutes(value) <= open) throw new Error('Gio dong cua phai muon hon gio mo cua hien tai.');
  },
  KIOSK_WORKING_DAYS(value) {
    const days = String(value).split(',').map((s) => s.trim());
    if (!days.length || days.some((d) => !/^[1-7]$/.test(d))) {
      throw new Error('Ngay lam viec phai la danh sach so tu 1 (Thu Hai) den 7 (Chu nhat), cach nhau bang dau phay. VD: 1,2,3,4,5');
    }
  },
  KIOSK_TIME_SLOTS(value) {
    // De trong = dung 1 khung KIOSK_OPEN_TIME - KIOSK_CLOSE_TIME.
    if (!String(value || '').trim()) return;
    // require tre de tranh vong phu thuoc configService <-> kioskHours.
    if (!require('../services/kioskHours').parseTimeSlots(value)) {
      throw new Error('Khung gio phai co dang "HH:MM-HH:MM", nhieu khung cach nhau dau phay, khong chong lan. VD: 07:30-11:30,13:30-17:00');
    }
  },
  WIFI_SECURITY(value) {
    if (!['WPA', 'WEP', 'nopass'].includes(String(value).trim())) throw new Error('Kieu bao mat Wi-Fi chi nhan: WPA, WEP hoac nopass.');
  },
  // Chatbot Mindtek (bot.mindtek.ai) - xem public/js/mindtek-chat.js va docs/CHATBOT-MINDTEK.md.
  CHATBOT_MODE(value) {
    if (!['internal', 'mindtek', 'both'].includes(String(value).trim())) {
      throw new Error('CHATBOT_MODE chi nhan: internal (chi tro ly noi bo), mindtek (chi bot Mindtek) hoac both (ca hai).');
    }
  },
  MINDTEK_BOT_ID(value) {
    if (String(value) !== '' && !MINDTEK_BOT_ID_PATTERN.test(String(value))) {
      throw new Error('MINDTEK_BOT_ID khong hop le. Dan Bot ID (chu, so, dau - hoac _) hoac dan nguyen doan ma nhung <script ... data-bot-id="..."> lay tu bot.mindtek.ai.');
    }
  }
};

// Chuan hoa gia tri truoc khi kiem tra: Admin co the dan NGUYEN doan ma nhung Mindtek
// (<script src="https://bot.mindtek.ai/embed.js" data-bot-id="abc..."></script>) hoac link
// https://bot.mindtek.ai/embed/abc... - tu tach lay dung Bot ID, khoi phai tu cat chuoi.
const MINDTEK_BOT_ID_PATTERN = /^[A-Za-z0-9_-]{4,100}$/;
const STRING_NORMALIZERS = {
  CHATBOT_MODE: (v) => String(v).trim().toLowerCase(),
  MINDTEK_BOT_ID(v) {
    const raw = String(v || '').trim();
    const fromAttr = /data-bot-id\s*=\s*["']?([A-Za-z0-9_-]+)/i.exec(raw);
    if (fromAttr) return fromAttr[1];
    const fromUrl = /\/(?:embed|bot|bots|chat)\/([A-Za-z0-9_-]{4,100})/i.exec(raw);
    if (fromUrl) return fromUrl[1];
    return raw;
  }
};

// Safe Limits Validation: ap dung rang buoc cung (Hard bounds) truoc khi luu.
async function set(key, value, updatedBy) {
  if (!cache) await loadAll();
  const row = cache[key];
  if (!row) throw new Error(`Tham so cau hinh khong ton tai: ${key}`);

  if (row.value_type === 'NUMBER') {
    const num = Number(value);
    if (Number.isNaN(num)) throw new Error(`Gia tri "${value}" khong phai la so hop le.`);
    if (row.min_bound !== null && num < Number(row.min_bound)) {
      throw new Error(`Gia tri ${num} nho hon bien do toi thieu cho phep (${row.min_bound}) cua ${key}.`);
    }
    if (row.max_bound !== null && num > Number(row.max_bound)) {
      throw new Error(`Gia tri ${num} vuot bien do toi da cho phep (${row.max_bound}) cua ${key}.`);
    }
  }

  if (STRING_NORMALIZERS[key]) value = STRING_NORMALIZERS[key](value);
  if (STRING_VALIDATORS[key]) STRING_VALIDATORS[key](value, cache);

  await pool.query(
    'UPDATE system_configs SET config_value = ?, updated_by = ? WHERE config_key = ?',
    [String(value), updatedBy || null, key]
  );
  await loadAll();
  return cache[key];
}

module.exports = { get, getAll, set, loadAll };
