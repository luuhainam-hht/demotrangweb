#!/usr/bin/env node
// Chay truoc khi khoi dong server trong Docker: CSDL rong (lan dau "docker compose up" voi
// APP_DB_TARGET=local) -> tu nap db/schema.sql + du lieu mau. CSDL da co bang -> khong lam gi
// (cac thay doi sau do do src/migrations/runMigrations.js tu chay khi server khoi dong).
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
const forced = String(process.env.DB_SSL || '').toLowerCase();
const ssl = (url ? forced !== 'false' : forced === 'true') ? { rejectUnauthorized: false } : false;

async function main() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const c = url ? new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000 }) : new Client({
      host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME || 'smart_queue',
      user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '', ssl, connectionTimeoutMillis: 20000
    });
    c.on('error', () => {});
    try {
      await c.connect();
      const { rows } = await c.query(`SELECT to_regclass('public.tickets') AS t`);
      await c.end();
      if (rows[0].t) { console.log('[ensure-schema] CSDL da co cau truc bang.'); return; }
      console.log('[ensure-schema] CSDL rong -> nap db/schema.sql + du lieu mau...');
      const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'db', 'init.js')], { stdio: 'inherit', env: process.env });
      if (r.status !== 0) process.exit(r.status || 1);
      return;
    } catch (err) {
      try { await c.end(); } catch (_) { /* bo qua */ }
      console.log(`[ensure-schema] Chua ket noi duoc CSDL (lan ${attempt}/10): ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error('[ensure-schema] Khong ket noi duoc CSDL sau 10 lan thu.');
  process.exit(1);
}
main();
