// =====================================================================================
// Kho NHIEU API key Gemini, xoay vong tu dong (key rotation + failover).
//
// Vi sao: key mien phi cua Google AI Studio bi gioi han so lan goi / phut / ngay. Chi 1 key thi
// het han muc la Tro ly AI tren Kiosk "chet" ca ngay. Gop nhieu key (moi key mot tai khoan /
// project Google khac nhau) de chia tai va du phong.
//
// Cau hinh (.env / Render Environment) - dung 1 hoac ca 2 cach, trung lap tu loai bo:
//   GEMINI_API_KEYS=key1,key2,key3      (phan tach bang dau phay, cham phay, khoang trang, xuong dong)
//   GEMINI_API_KEY=key_don              (bien cu - van dung duoc)
//   GEMINI_API_KEY_1=..., GEMINI_API_KEY_2=...  (danh so - tien khi nhap tung o tren Render)
//
// Chien luoc:
//   - Round-robin: moi cau hoi bat dau tu key ke tiep -> chia deu han muc.
//   - 429 / RESOURCE_EXHAUSTED  -> key "nghi" COOLDOWN_RATE_LIMIT_MS (hoac dung retryDelay Google tra ve)
//   - 401 / 403 / API_KEY_INVALID -> key "nghi" COOLDOWN_INVALID_MS (coi nhu key hong, khoi thu lai lien tuc)
//   - 5xx / loi mang            -> key nghi ngan COOLDOWN_SERVER_MS, thu key khac ngay
//   - Loi khac (400 do noi dung...) -> khong doi key, nem loi luon (doi key cung vo ich)
// Module thuan, khong goi mang -> test doc lap (test/geminiKeyPool.test.js).
// =====================================================================================

const COOLDOWN_RATE_LIMIT_MS = 60 * 1000;
const COOLDOWN_INVALID_MS = 60 * 60 * 1000;
const COOLDOWN_SERVER_MS = 15 * 1000;

function parseKeys(env = process.env) {
  const raw = [];
  if (env.GEMINI_API_KEYS) raw.push(...String(env.GEMINI_API_KEYS).split(/[\s,;]+/));
  if (env.GEMINI_API_KEY) raw.push(String(env.GEMINI_API_KEY));
  Object.keys(env)
    .filter((k) => /^GEMINI_API_KEY_\d+$/.test(k))
    .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
    .forEach((k) => raw.push(String(env[k])));
  return [...new Set(raw.map((k) => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean))];
}

// Phan loai loi tra ve tu @google/genai ({ status, message }).
function classifyError(err) {
  const status = err && typeof err.status === 'number' ? err.status : null;
  const msg = String((err && err.message) || '');
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) return 'RATE_LIMIT';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|API key expired/i.test(msg)) return 'INVALID';
  if ((status && status >= 500) || /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(msg)) return 'SERVER';
  return 'OTHER';
}

// Google co the gui "retryDelay": "37s" trong chi tiet loi 429 -> nghi dung chung do.
function parseRetryDelayMs(err) {
  const m = String((err && err.message) || '').match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

function mask(key) {
  return key.length <= 8 ? '****' : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

class GeminiKeyPool {
  constructor(keys, { now = () => Date.now() } = {}) {
    this.now = now;
    this.entries = keys.map((key) => ({ key, cooldownUntil: 0, lastError: null, okCount: 0, failCount: 0 }));
    this.cursor = 0;
  }

  get size() { return this.entries.length; }

  // Thu tu thu key cho 1 cau hoi: bat dau tu con tro round-robin, key dang nghi xep cuoi
  // (neu TAT CA dang nghi thi van thu key sap het nghi som nhat, khong bo cuoc ngay).
  order() {
    const n = this.entries.length;
    if (n === 0) return [];
    const start = this.cursor % n;
    this.cursor = (this.cursor + 1) % n;
    const rotated = [...this.entries.slice(start), ...this.entries.slice(0, start)];
    const t = this.now();
    const ready = rotated.filter((e) => e.cooldownUntil <= t);
    const resting = rotated.filter((e) => e.cooldownUntil > t).sort((a, b) => a.cooldownUntil - b.cooldownUntil);
    return ready.length > 0 ? ready : resting.slice(0, 1);
  }

  markSuccess(entry) {
    entry.cooldownUntil = 0;
    entry.lastError = null;
    entry.okCount += 1;
  }

  // Tra ve true neu nen thu key khac.
  markFailure(entry, err) {
    const kind = classifyError(err);
    entry.failCount += 1;
    entry.lastError = kind;
    const t = this.now();
    if (kind === 'RATE_LIMIT') entry.cooldownUntil = t + (parseRetryDelayMs(err) || COOLDOWN_RATE_LIMIT_MS);
    else if (kind === 'INVALID') entry.cooldownUntil = t + COOLDOWN_INVALID_MS;
    else if (kind === 'SERVER') entry.cooldownUntil = t + COOLDOWN_SERVER_MS;
    return kind !== 'OTHER';
  }

  // Goi fn(key) lan luot qua cac key cho toi khi thanh cong.
  async run(fn) {
    const candidates = this.order();
    let lastErr = null;
    for (const entry of candidates) {
      try {
        const result = await fn(entry.key); // eslint-disable-line no-await-in-loop
        this.markSuccess(entry);
        return result;
      } catch (err) {
        lastErr = err;
        const shouldRotate = this.markFailure(entry, err);
        console.warn(`[gemini] key ${mask(entry.key)} loi ${classifyError(err)}${shouldRotate ? ' -> thu key khac' : ''}`);
        if (!shouldRotate) throw err;
      }
    }
    throw lastErr || new Error('Khong co API key Gemini kha dung.');
  }

  // Tinh trang (khong lo key) - dung cho log / trang Admin.
  status() {
    const t = this.now();
    return this.entries.map((e) => ({
      key: mask(e.key),
      state: e.cooldownUntil > t ? `RESTING_${e.lastError}` : 'READY',
      restSecondsLeft: e.cooldownUntil > t ? Math.ceil((e.cooldownUntil - t) / 1000) : 0,
      okCount: e.okCount,
      failCount: e.failCount
    }));
  }
}

module.exports = { GeminiKeyPool, parseKeys, classifyError, parseRetryDelayMs, mask };
