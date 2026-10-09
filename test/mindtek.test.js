// Tich hop chatbot Mindtek (bot.mindtek.ai): chuan hoa + kiem tra Bot ID trong Cau hinh Tham so,
// API /api/chatbot/config cho trinh duyet, va CSP cua server.js khong chan embed.js/iframe Mindtek.
// Khong can Postgres that - gia lap pool.query nhu configService.test.js.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const db = require('../src/config/db');

let state;

beforeEach(() => {
  state = [
    { config_key: 'CHATBOT_MODE', config_value: 'both', value_type: 'STRING', min_bound: null, max_bound: null },
    { config_key: 'MINDTEK_BOT_ID', config_value: '', value_type: 'STRING', min_bound: null, max_bound: null }
  ];
  db.pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT')) return { rows: state.map((r) => ({ ...r })) };
    if (sql.startsWith('UPDATE')) {
      const [value, , key] = params;
      const row = state.find((r) => r.config_key === key);
      if (row) row.config_value = String(value);
      return { rows: [] };
    }
    throw new Error(`SQL chua gia lap: ${sql}`);
  };
  delete require.cache[require.resolve('../src/config/configService')];
  delete require.cache[require.resolve('../src/routes/chatbotRoutes')];
});

test('MINDTEK_BOT_ID: dan Bot ID tran -> luu nguyen', async () => {
  const cs = require('../src/config/configService');
  await cs.set('MINDTEK_BOT_ID', '  cm9x2abc_DEF-123  ');
  assert.equal(await cs.get('MINDTEK_BOT_ID'), 'cm9x2abc_DEF-123');
});

test('MINDTEK_BOT_ID: dan nguyen doan ma nhung <script> -> tu tach Bot ID', async () => {
  const cs = require('../src/config/configService');
  await cs.set('MINDTEK_BOT_ID', '<script src="https://bot.mindtek.ai/embed.js" data-bot-id="a1b2c3d4-e5f6" data-position="bottom-right"></script>');
  assert.equal(await cs.get('MINDTEK_BOT_ID'), 'a1b2c3d4-e5f6');
});

test('MINDTEK_BOT_ID: dan link /embed/<id> -> tu tach Bot ID', async () => {
  const cs = require('../src/config/configService');
  await cs.set('MINDTEK_BOT_ID', 'https://bot.mindtek.ai/embed/xyz98765?showWelcome=true');
  assert.equal(await cs.get('MINDTEK_BOT_ID'), 'xyz98765');
});

test('MINDTEK_BOT_ID: chuoi rac / chen ma -> tu choi; de trong -> cho phep (tat Mindtek)', async () => {
  const cs = require('../src/config/configService');
  await assert.rejects(cs.set('MINDTEK_BOT_ID', 'abc"><img src=x onerror=alert(1)>'), /khong hop le/);
  await cs.set('MINDTEK_BOT_ID', '');
  assert.equal(await cs.get('MINDTEK_BOT_ID'), '');
});

test('CHATBOT_MODE: chi nhan internal|mindtek|both (khong phan biet hoa thuong)', async () => {
  const cs = require('../src/config/configService');
  await cs.set('CHATBOT_MODE', ' Mindtek ');
  assert.equal(await cs.get('CHATBOT_MODE'), 'mindtek');
  await assert.rejects(cs.set('CHATBOT_MODE', 'gemini'), /CHATBOT_MODE chi nhan/);
});

function buildApp() {
  const app = express();
  app.use('/api/chatbot', require('../src/routes/chatbotRoutes'));
  return app;
}

test('GET /api/chatbot/config: chua co Bot ID -> ep ve internal', async () => {
  const res = await request(buildApp()).get('/api/chatbot/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.mode, 'internal');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('GET /api/chatbot/config: co Bot ID -> tra dung mode + Bot ID + origin', async () => {
  state[1].config_value = 'botABC123';
  state[0].config_value = 'mindtek';
  const res = await request(buildApp()).get('/api/chatbot/config');
  assert.deepEqual(res.body, { mode: 'mindtek', mindtekBotId: 'botABC123', mindtekOrigin: 'https://bot.mindtek.ai' });
});

test('server.js: CSP cho phep script + iframe + icon tu bot.mindtek.ai', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
  for (const d of ['script-src', 'frame-src', 'img-src']) {
    const m = new RegExp(`'${d}': \\[([^\\]]*)\\]`).exec(src);
    assert.ok(m, `thieu chi thi ${d}`);
    assert.match(m[1], /https:\/\/bot\.mindtek\.ai/, `${d} chua cho phep bot.mindtek.ai`);
  }
});

test('Widget noi bo khong dung ten class trung voi embed.js cua Mindtek', () => {
  const pub = path.join(__dirname, '..', 'public');
  const js = fs.readFileSync(path.join(pub, 'js', 'chatbot.js'), 'utf8');
  const css = fs.readFileSync(path.join(pub, 'css', 'common.css'), 'utf8');
  for (const cls of ['chatbot-widget', 'chatbot-close', 'chatbot-button', 'chatbot-iframe', 'chatbot-frame-wrapper']) {
    assert.ok(!new RegExp(`class="[^"]*\\b${cls}\\b`).test(js), `chatbot.js con dung class ${cls}`);
    assert.ok(!new RegExp(`\\.${cls}\\b`).test(css), `common.css con dinh nghia .${cls}`);
  }
});
