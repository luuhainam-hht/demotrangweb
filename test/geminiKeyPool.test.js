// Kiem tra kho nhieu API key Gemini (src/services/geminiKeyPool.js): doc cau hinh, xoay vong,
// tu chuyen key khi het han muc / key hong. Khong goi mang that.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GeminiKeyPool, parseKeys, classifyError, parseRetryDelayMs, mask } = require('../src/services/geminiKeyPool');

const err = (status, message = '') => Object.assign(new Error(message), { status });

test('parseKeys gop GEMINI_API_KEYS + GEMINI_API_KEY + GEMINI_API_KEY_n, bo trung va o trong', () => {
  const keys = parseKeys({
    GEMINI_API_KEYS: 'k1, k2;k3\n"k4"  ,,',
    GEMINI_API_KEY: 'k2',
    GEMINI_API_KEY_2: 'k6',
    GEMINI_API_KEY_1: 'k5',
    OTHER: 'x'
  });
  assert.deepEqual(keys, ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
  assert.deepEqual(parseKeys({}), []);
});

test('classifyError phan loai dung', () => {
  assert.equal(classifyError(err(429)), 'RATE_LIMIT');
  assert.equal(classifyError(err(400, 'RESOURCE_EXHAUSTED quota')), 'RATE_LIMIT');
  assert.equal(classifyError(err(403)), 'INVALID');
  assert.equal(classifyError(err(400, 'API key not valid. Please pass a valid API key.')), 'INVALID');
  assert.equal(classifyError(err(503)), 'SERVER');
  assert.equal(classifyError(new Error('fetch failed')), 'SERVER');
  assert.equal(classifyError(err(400, 'invalid argument')), 'OTHER');
  assert.equal(parseRetryDelayMs(err(429, '"retryDelay": "37s"')), 37000);
  assert.equal(mask('AIzaSyABCDEFGH1234'), 'AIza…1234');
});

test('round-robin chia deu cau hoi cho cac key', async () => {
  const pool = new GeminiKeyPool(['a', 'b', 'c']);
  const used = [];
  for (let i = 0; i < 6; i += 1) await pool.run(async (k) => { used.push(k); return k; }); // eslint-disable-line no-await-in-loop
  assert.deepEqual(used, ['a', 'b', 'c', 'a', 'b', 'c']);
});

test('key het han muc (429) -> tu chuyen key khac va key do nghi', async () => {
  let t = 1000;
  const pool = new GeminiKeyPool(['a', 'b'], { now: () => t });
  const tried = [];
  const out = await pool.run(async (k) => { tried.push(k); if (k === 'a') throw err(429); return `ok-${k}`; });
  assert.equal(out, 'ok-b');
  assert.deepEqual(tried, ['a', 'b']);
  // Cau ke tiep: 'a' dang nghi -> chi dung 'b'
  const tried2 = [];
  await pool.run(async (k) => { tried2.push(k); return k; });
  assert.deepEqual(tried2, ['b']);
  // Het 60s nghi -> 'a' duoc dung lai
  t += 61 * 1000;
  assert.ok(pool.status().every((s) => s.state === 'READY'));
});

test('loi noi dung (400 thuong) -> khong doi key, nem loi ngay', async () => {
  const pool = new GeminiKeyPool(['a', 'b']);
  const tried = [];
  await assert.rejects(pool.run(async (k) => { tried.push(k); throw err(400, 'invalid argument'); }));
  assert.deepEqual(tried, ['a']);
});

test('tat ca key deu loi -> nem loi cuoi; tat ca dang nghi van thu key sap het nghi', async () => {
  let t = 0;
  const pool = new GeminiKeyPool(['a', 'b'], { now: () => t });
  await assert.rejects(pool.run(async () => { throw err(429); }), (e) => e.status === 429);
  const tried = [];
  await pool.run(async (k) => { tried.push(k); return k; });
  assert.equal(tried.length, 1);
  assert.equal(pool.status().filter((s) => s.state === 'READY').length, 1);
});
