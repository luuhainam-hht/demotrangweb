#!/usr/bin/env node
// =====================================================================================
// CONG CU DONG BO CSDL: PostgreSQL trong Docker  <->  Neon (neon.com)
//
//   node scripts/db-sync.js status            So sanh 2 CSDL: ket noi, do tre, so dong tung bang, trang thai sao chep
//   node scripts/db-sync.js backup [neon|local|both]   Sao luu (pg_dump) vao thu muc backups/
//   node scripts/db-sync.js pull               Neon  -> Docker  (ghi de Docker; tu sao luu Docker truoc)
//   node scripts/db-sync.js push --yes         Docker -> Neon   (ghi de Neon;  tu sao luu Neon truoc)
//   node scripts/db-sync.js replica:setup      Bat SAO CHEP REALTIME Neon -> Docker (logical replication)
//   node scripts/db-sync.js replica:status     Xem do tre / trang thai sao chep
//   node scripts/db-sync.js replica:stop       Tat sao chep realtime (giu nguyen du lieu da chep)
//   node scripts/db-sync.js promote            Bien ban Docker thanh CSDL chinh (tat sao chep + chinh lai bo dem ID)
//   node scripts/db-sync.js fix-sequences [neon|local]  Chinh bo dem cot IDENTITY = MAX(id)
//   node scripts/db-sync.js watch              Tien trinh nen cho container "sync" (theo SYNC_MODE)
//
// Bien moi truong:
//   NEON_DATABASE_URL   chuoi ket noi Neon (mac dinh lay DATABASE_URL neu do la Neon)
//   LOCAL_DATABASE_URL  chuoi ket noi Postgres trong Docker
//                       (mac dinh postgresql://postgres:hcc_local_2026@localhost:5433/smart_queue)
//   SYNC_MODE           watch: replica (mac dinh) | pull | push | off
//   SYNC_INTERVAL_MINUTES  chu ky pull/push/kiem tra (mac dinh 15)
//   SYNC_ACTIVE_HOURS   khung gio dong bo, VD 06:30-18:30 (ngoai gio khong cham Neon de Neon duoc ngu)
//   BACKUP_DIR, BACKUP_KEEP (mac dinh ./backups, giu 14 ban moi loai)
//
// Vi sao co 2 kieu dong bo (xem docs/DOCKER-NEON-SYNC.md):
//   - replica  : Neon la CSDL CHINH (web Render ghi vao). Docker nhan moi thay doi gan nhu tuc thi
//                qua logical replication -> ban sao du phong tai Trung tam, xem bao cao khi mat Internet.
//   - pull/push: chep nguyen khoi theo chu ky (snapshot). Don gian, khong can bat gi tren Neon,
//                nhung GHI DE ben dich - khong tron du lieu 2 chieu.
// Khong lam dong bo 2 chieu (ca 2 cung ghi): so thu tu (A-101...) cap theo ngay se trung nhau,
// hai ben deu "dung" nhung khong the gop lai ma khong mat du lieu.
// =====================================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');

const PUBLICATION = 'hcc_pub';
const SUBSCRIPTION = 'hcc_sub';
const SLOT = 'hcc_sub_slot';

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
const BACKUP_KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 14));

// ---------------------------------------------------------------- cau hinh ket noi
function neonUrl() {
  const u = process.env.NEON_DATABASE_URL || (/neon\.tech/.test(process.env.DATABASE_URL || '') ? process.env.DATABASE_URL : '');
  return u ? withSslIfRemote(u) : '';
}
function localUrl() {
  return process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:hcc_local_2026@localhost:5433/smart_queue';
}
function isLocalHost(host) { return ['localhost', '127.0.0.1', 'db', '::1'].includes(host) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host); }
// Neon bat buoc SSL: dam bao chuoi co sslmode cho ca pg_dump/psql (libpq) lan Postgres subscriber.
function withSslIfRemote(url) {
  try {
    const u = new URL(url);
    if (!isLocalHost(u.hostname) && !u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch (e) { return url; }
}
function mask(url) {
  try { const u = new URL(url); if (u.password) u.password = '***'; return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`; } catch (e) { return '(chuoi ket noi khong hop le)'; }
}
// Thu vien `pg` (Node) khong hieu het tham so libpq (channel_binding...) -> bo bot khi dung pg.
function pgConfig(url) {
  const u = new URL(url);
  const remote = !isLocalHost(u.hostname);
  const sslmode = u.searchParams.get('sslmode');
  ['sslmode', 'channel_binding', 'sslrootcert'].forEach((k) => u.searchParams.delete(k));
  const ssl = remote || (sslmode && sslmode !== 'disable') ? { rejectUnauthorized: false } : false;
  return { connectionString: u.toString(), ssl, connectionTimeoutMillis: 30000, keepAlive: true };
}

async function withClient(url, fn) {
  const c = new Client(pgConfig(url));
  c.on('error', () => {});
  await c.connect();
  try { return await fn(c); } finally { await c.end().catch(() => {}); }
}

function requireNeon() {
  const u = neonUrl();
  if (!u) throw new Error('Chua co NEON_DATABASE_URL (hoac DATABASE_URL tro toi Neon) trong file .env.');
  return u;
}

// ---------------------------------------------------------------- tien ich
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('vi-VN', { hour12: false })}]`, ...a);
function stamp() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function run(cmd, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let err = '';
    child.stdout.on('data', (d) => { if (!quiet) process.stdout.write(d); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => reject(new Error(`Khong chay duoc ${cmd}: ${e.message}. Can cai PostgreSQL client (pg_dump/pg_restore) hoac chay trong container sync.`)));
    child.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`${cmd} loi (ma ${code}): ${err.trim().split('\n').slice(-5).join(' | ')}`))));
  });
}

const TABLE_ORDER_SQL = `
  SELECT c.relname AS table_name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`;

async function listTables(c) { return (await c.query(TABLE_ORDER_SQL)).rows.map((r) => r.table_name); }

async function describe(url) {
  const started = Date.now();
  return withClient(url, async (c) => {
    const latencyMs = Date.now() - started;
    const version = (await c.query(`SELECT current_setting('server_version') AS v, current_setting('wal_level') AS wal`)).rows[0];
    const tables = await listTables(c);
    const counts = {};
    for (const t of tables) counts[t] = Number((await c.query(`SELECT COUNT(*) AS n FROM "${t}"`)).rows[0].n);
    let lastTicket = null;
    if (tables.includes('tickets')) lastTicket = (await c.query('SELECT MAX(updated_at) AS m FROM tickets')).rows[0].m;
    let subs = [];
    try {
      subs = (await c.query(`SELECT s.subname, s.subenabled, st.last_msg_receipt_time FROM pg_subscription s
        LEFT JOIN pg_stat_subscription st ON st.subid = s.oid
        WHERE s.subdbid = (SELECT oid FROM pg_database WHERE datname = current_database())`)).rows;
    } catch (e) { /* khong co quyen doc pg_subscription */ }
    let slots = [];
    try {
      slots = (await c.query(`SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
        FROM pg_replication_slots WHERE slot_type = 'logical'`)).rows;
    } catch (e) { /* bo qua */ }
    return { ok: true, latencyMs, version: version.v, walLevel: version.wal, tables, counts, lastTicket, subs, slots };
  }).catch((err) => ({ ok: false, error: err.message }));
}

// ---------------------------------------------------------------- status
async function cmdStatus() {
  const n = neonUrl();
  const l = localUrl();
  log(`Neon : ${n ? mask(n) : '(chua cau hinh)'}`);
  log(`Docker: ${mask(l)}`);
  const [neon, local] = await Promise.all([n ? describe(n) : { ok: false, error: 'chua cau hinh' }, describe(l)]);
  const line = (name, d) => (d.ok
    ? `${name.padEnd(7)} OK  ${String(d.latencyMs).padStart(4)} ms  PostgreSQL ${d.version.split(' ')[0]}  wal_level=${d.walLevel}  ve moi nhat: ${d.lastTicket ? new Date(d.lastTicket).toLocaleString('vi-VN') : '-'}`
    : `${name.padEnd(7)} LOI ${d.error}`);
  console.log(`\n${line('Neon', neon)}\n${line('Docker', local)}\n`);
  if (neon.ok && local.ok) {
    const all = [...new Set([...neon.tables, ...local.tables])].sort();
    console.log('Bang'.padEnd(26), 'Neon'.padStart(8), 'Docker'.padStart(8), ' Ket qua');
    let diff = 0;
    for (const t of all) {
      const a = neon.counts[t]; const b = local.counts[t];
      const same = a === b;
      if (!same) diff += 1;
      console.log(t.padEnd(26), String(a ?? '-').padStart(8), String(b ?? '-').padStart(8), same ? ' khop' : ' LECH');
    }
    console.log(diff === 0 ? '\n=> Hai CSDL KHOP so dong o moi bang.' : `\n=> ${diff} bang lech so dong.`);
  }
  if (local.ok && local.subs.length) {
    local.subs.forEach((s) => console.log(`Sao chep realtime: ${s.subname} ${s.subenabled ? 'DANG CHAY' : 'TAM DUNG'}, nhan du lieu gan nhat: ${s.last_msg_receipt_time ? new Date(s.last_msg_receipt_time).toLocaleString('vi-VN') : '-'}`));
  }
  if (neon.ok && neon.slots.length) neon.slots.forEach((s) => console.log(`Slot tren Neon: ${s.slot_name} ${s.active ? 'dang ket noi' : 'CHUA ket noi'} - tre ${s.lag}`));
  return { neon, local };
}

// ---------------------------------------------------------------- backup
function pruneBackups(prefix) {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.dump')).sort();
  files.slice(0, Math.max(0, files.length - BACKUP_KEEP)).forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}

async function backup(which) {
  const url = which === 'neon' ? requireNeon() : localUrl();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${which}-${stamp()}.dump`);
  log(`Sao luu ${which} (${mask(url)}) -> ${path.relative(process.cwd(), file)}`);
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--no-subscriptions', '--schema=public', `--file=${file}`, `--dbname=${url}`], { quiet: true });
  pruneBackups(which);
  log(`Xong: ${(fs.statSync(file).size / 1024).toFixed(0)} KB (giu ${BACKUP_KEEP} ban gan nhat).`);
  return file;
}

async function cmdBackup(arg = 'both') {
  if (arg === 'neon' || arg === 'both') await backup('neon');
  if (arg === 'local' || arg === 'both') await backup('local');
}

// ---------------------------------------------------------------- snapshot pull / push
async function assertNoSubscription(url, label) {
  const subs = await withClient(url, async (c) => {
    try { return (await c.query(`SELECT subname FROM pg_subscription WHERE subdbid = (SELECT oid FROM pg_database WHERE datname = current_database())`)).rows; } catch (e) { return []; }
  });
  if (subs.length) throw new Error(`${label} dang bat sao chep realtime (${subs.map((s) => s.subname).join(', ')}). Chay "replica:stop" truoc khi ghi de bang snapshot.`);
}

async function restoreInto(targetUrl, dumpFile) {
  // Xoa sach schema public roi nap lai -> tranh loi phu thuoc (view/khoa ngoai vong) khi --clean.
  await withClient(targetUrl, async (c) => {
    // Ban dump (--schema=public) tu chua lenh CREATE SCHEMA public -> chi xoa, de pg_restore tao lai.
    await c.query('DROP SCHEMA IF EXISTS public CASCADE');
  });
  await run('pg_restore', ['--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', `--dbname=${targetUrl}`, dumpFile], { quiet: true });
}

async function snapshot(fromLabel, fromUrl, toLabel, toUrl) {
  await assertNoSubscription(toUrl, toLabel);
  // Day 1 ban sao (dang nhan du lieu tu Neon) nguoc len Neon la vo nghia va de gay vong lap.
  if (toLabel === 'Neon') await assertNoSubscription(fromUrl, 'Docker');
  // 1) Sao luu ben bi ghi de (neu ben do da co du lieu) - luon co duong lui.
  const hasData = await withClient(toUrl, async (c) => (await listTables(c)).length > 0).catch(() => false);
  if (hasData) await backup(toLabel === 'Neon' ? 'neon' : 'local');
  // 2) Chup ben nguon
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const tmp = path.join(BACKUP_DIR, `transfer-${stamp()}.dump`);
  log(`Chup du lieu ${fromLabel} (${mask(fromUrl)})...`);
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--no-publications', '--no-subscriptions', '--schema=public', `--file=${tmp}`, `--dbname=${fromUrl}`], { quiet: true });
  // 3) Nap vao ben dich trong 1 giao dich (loi giua chung -> khong ghi gi)
  log(`Nap vao ${toLabel} (${mask(toUrl)})...`);
  try { await restoreInto(toUrl, tmp); } finally { fs.unlinkSync(tmp); }
  await fixSequences(toUrl, toLabel);
  writeHistory({ action: `${fromLabel}->${toLabel}`, at: new Date().toISOString() });
  log(`Hoan tat dong bo ${fromLabel} -> ${toLabel}.`);
}

async function cmdPull() { await snapshot('Neon', requireNeon(), 'Docker', localUrl()); }

async function cmdPush(args) {
  if (!args.includes('--yes') && String(process.env.SYNC_PUSH_CONFIRM).toLowerCase() !== 'yes') {
    throw new Error('PUSH se GHI DE toan bo du lieu tren Neon (ca du lieu web Render dang dung). Them --yes de xac nhan. Ban sao luu Neon se duoc tao tu dong truoc khi ghi.');
  }
  await snapshot('Docker', localUrl(), 'Neon', requireNeon());
}

// ---------------------------------------------------------------- sequences
async function fixSequences(url, label = '') {
  return withClient(url, async (c) => {
    const { rows } = await c.query(`
      SELECT a.attrelid::regclass::text AS tbl, a.attname AS col, pg_get_serial_sequence(a.attrelid::regclass::text, a.attname) AS seq
      FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relkind = 'r' AND a.attidentity IN ('a','d') AND NOT a.attisdropped`);
    for (const r of rows) {
      if (!r.seq) continue;
      await c.query(`SELECT setval($1, COALESCE((SELECT MAX("${r.col}") FROM ${r.tbl}), 0) + 1, false)`, [r.seq]);
    }
    if (label) log(`Da chinh ${rows.length} bo dem ID (IDENTITY) tren ${label}.`);
    return rows.length;
  });
}

// ---------------------------------------------------------------- logical replication
async function ensurePublication(neon) {
  return withClient(neon, async (c) => {
    const wal = (await c.query(`SELECT current_setting('wal_level') AS w`)).rows[0].w;
    if (wal !== 'logical') {
      throw new Error('Neon chua bat Logical Replication (wal_level=' + wal + '). Vao Neon Console -> Project settings -> Logical Replication -> Enable, roi chay lai. Hoac dung SYNC_MODE=pull.');
    }
    const tables = await listTables(c);
    const exists = (await c.query('SELECT 1 FROM pg_publication WHERE pubname = $1', [PUBLICATION])).rows.length > 0;
    const list = tables.map((t) => `public."${t}"`).join(', ');
    if (!exists) {
      await c.query(`CREATE PUBLICATION ${PUBLICATION} FOR TABLE ${list}`);
      log(`Da tao publication ${PUBLICATION} tren Neon (${tables.length} bang).`);
      return { tables, added: tables };
    }
    const published = (await c.query(`SELECT tablename FROM pg_publication_tables WHERE pubname = $1 AND schemaname = 'public'`, [PUBLICATION])).rows.map((r) => r.tablename);
    const missing = tables.filter((t) => !published.includes(t));
    if (missing.length) {
      await c.query(`ALTER PUBLICATION ${PUBLICATION} ADD TABLE ${missing.map((t) => `public."${t}"`).join(', ')}`);
      log(`Them ${missing.length} bang moi vao publication: ${missing.join(', ')}`);
    }
    return { tables, added: missing };
  });
}

// Lay DDL cua cac bang (khong du lieu) tu Neon de tao tren Docker.
async function schemaOnlyFrom(neon, tables) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `schema-${stamp()}.dump`);
  const tArgs = tables ? tables.flatMap((t) => ['--table', `public."${t}"`]) : ['--schema=public'];
  await run('pg_dump', ['--format=custom', '--schema-only', '--no-owner', '--no-acl', '--no-publications', '--no-subscriptions', ...tArgs, `--file=${file}`, `--dbname=${neon}`], { quiet: true });
  return file;
}

// Cot moi tren Neon (do migration cua ung dung them vao) phai co tren Docker truoc, neu khong
// tien trinh sao chep dung lai voi loi "missing replicated column".
async function syncColumns(neon, local) {
  const q = `SELECT c.relname AS tbl, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`;
  const src = await withClient(neon, async (c) => (await c.query(q)).rows);
  const dst = await withClient(local, async (c) => (await c.query(q)).rows);
  const have = new Set(dst.map((r) => `${r.tbl}.${r.col}`));
  const haveTables = new Set(dst.map((r) => r.tbl));
  const missing = src.filter((r) => haveTables.has(r.tbl) && !have.has(`${r.tbl}.${r.col}`));
  if (!missing.length) return 0;
  await withClient(local, async (c) => {
    for (const m of missing) await c.query(`ALTER TABLE public."${m.tbl}" ADD COLUMN IF NOT EXISTS "${m.col}" ${m.typ}`);
  });
  log(`Them ${missing.length} cot moi vao Docker: ${missing.map((m) => `${m.tbl}.${m.col}`).join(', ')}`);
  return missing.length;
}

function subscriptionConninfo(neon) {
  // Postgres (libpq) trong container db dung chuoi nay de keo du lieu tu Neon.
  return withSslIfRemote(neon);
}

async function cmdReplicaSetup() {
  const neon = requireNeon();
  const local = localUrl();
  await withClient(local, async (c) => {
    const wal = (await c.query(`SELECT current_setting('max_replication_slots') AS s`)).rows[0];
    if (Number(wal.s) < 1) throw new Error('Postgres Docker chua cau hinh max_replication_slots (xem docker-compose.yml).');
  });
  const existing = await withClient(local, async (c) => (await c.query('SELECT 1 FROM pg_subscription WHERE subname = $1', [SUBSCRIPTION])).rows.length > 0);
  if (existing) { log('Sao chep realtime da bat san. Dung "replica:status" de xem.'); return; }

  await ensurePublication(neon);
  // CSDL Docker se duoc lam moi hoan toan tu Neon -> sao luu truoc.
  const hasData = await withClient(local, async (c) => (await listTables(c)).length > 0);
  if (hasData) await backup('local');
  log('Tao cau truc bang tren Docker tu Neon...');
  const schemaFile = await schemaOnlyFrom(neon);
  try { await restoreInto(local, schemaFile); } finally { fs.unlinkSync(schemaFile); }

  log('Tao subscription (Docker keo du lieu ban dau + nhan thay doi lien tuc tu Neon)...');
  await withClient(local, async (c) => {
    const conninfo = subscriptionConninfo(neon).replace(/'/g, "''");
    await c.query(`CREATE SUBSCRIPTION ${SUBSCRIPTION} CONNECTION '${conninfo}' PUBLICATION ${PUBLICATION}
                   WITH (copy_data = true, create_slot = true, slot_name = '${SLOT}', disable_on_error = false)`);
  });
  const ok = await waitInitialCopy(local, 180);
  log(ok ? 'Da chep xong du lieu ban dau. Tu gio moi thay doi tren Neon se tu dong ve Docker.'
    : 'Dang chep du lieu ban dau (CSDL lon hoac mang cham) - kiem tra lai bang "replica:status".');
}

async function waitInitialCopy(local, timeoutSec) {
  const until = Date.now() + timeoutSec * 1000;
  while (Date.now() < until) {
    const pending = await withClient(local, async (c) => Number((await c.query(`SELECT COUNT(*) AS n FROM pg_subscription_rel WHERE srsubstate NOT IN ('r','s')`)).rows[0].n));
    if (pending === 0) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// Bang moi / cot moi xuat hien tren Neon (sau khi ung dung chay migration) -> dua sang Docker.
async function replicaRefresh() {
  const neon = requireNeon();
  const local = localUrl();
  const { added } = await ensurePublication(neon);
  const localTables = await withClient(local, listTables);
  const newTables = (await withClient(neon, listTables)).filter((t) => !localTables.includes(t));
  if (newTables.length) {
    log(`Tao ${newTables.length} bang moi tren Docker: ${newTables.join(', ')}`);
    const f = await schemaOnlyFrom(neon, newTables);
    try { await run('pg_restore', ['--no-owner', '--no-acl', '--single-transaction', `--dbname=${local}`, f], { quiet: true }); } finally { fs.unlinkSync(f); }
  }
  const cols = await syncColumns(neon, local);
  if (added.length || newTables.length) {
    await withClient(local, (c) => c.query(`ALTER SUBSCRIPTION ${SUBSCRIPTION} REFRESH PUBLICATION WITH (copy_data = true)`));
    log('Da lam moi subscription.');
  }
  return { added: added.length, newTables: newTables.length, cols };
}

async function cmdReplicaStatus() {
  const local = localUrl();
  const rows = await withClient(local, async (c) => (await c.query(`
    SELECT s.subname, s.subenabled, st.received_lsn, st.last_msg_send_time, st.last_msg_receipt_time, st.latest_end_time,
      (SELECT COUNT(*) FROM pg_subscription_rel r WHERE r.srsubid = s.oid AND r.srsubstate NOT IN ('r','s')) AS tables_copying
    FROM pg_subscription s LEFT JOIN pg_stat_subscription st ON st.subid = s.oid AND st.relid IS NULL`)).rows);
  if (!rows.length) { log('Chua bat sao chep realtime. Chay: replica:setup'); return null; }
  for (const r of rows) {
    const lagSec = r.last_msg_send_time && r.last_msg_receipt_time ? Math.max(0, (new Date(r.last_msg_receipt_time) - new Date(r.last_msg_send_time)) / 1000) : null;
    log(`${r.subname}: ${r.subenabled ? 'DANG CHAY' : 'TAM DUNG'} | bang dang chep ban dau: ${r.tables_copying} | nhan gan nhat: ${r.last_msg_receipt_time ? new Date(r.last_msg_receipt_time).toLocaleString('vi-VN') : '-'}${lagSec !== null ? ` | tre mang ~${lagSec.toFixed(1)}s` : ''}`);
  }
  try {
    const errs = await withClient(local, async (c) => (await c.query(`SELECT subname, apply_error_count, sync_error_count FROM pg_stat_subscription_stats`)).rows);
    errs.filter((e) => Number(e.apply_error_count) || Number(e.sync_error_count)).forEach((e) => log(`CANH BAO ${e.subname}: ${e.apply_error_count} loi ap dung, ${e.sync_error_count} loi chep ban dau - xem log container db.`));
  } catch (e) { /* PG < 15 */ }
  return rows;
}

async function cmdReplicaStop({ dropSlotOnNeon = true } = {}) {
  const local = localUrl();
  const had = await withClient(local, async (c) => {
    const exists = (await c.query('SELECT 1 FROM pg_subscription WHERE subname = $1', [SUBSCRIPTION])).rows.length > 0;
    if (!exists) return false;
    await c.query(`ALTER SUBSCRIPTION ${SUBSCRIPTION} DISABLE`);
    // Tach slot khoi subscription roi tu xoa tren Neon (DROP SUBSCRIPTION co the treo neu Neon dang ngu).
    await c.query(`ALTER SUBSCRIPTION ${SUBSCRIPTION} SET (slot_name = NONE)`);
    await c.query(`DROP SUBSCRIPTION ${SUBSCRIPTION}`);
    return true;
  });
  if (!had) { log('Khong co sao chep realtime nao dang bat.'); return; }
  if (dropSlotOnNeon && neonUrl()) {
    // Slot bo roi tren Neon se giu WAL mai mai -> ton dung luong goi Free. Phai xoa.
    await withClient(neonUrl(), (c) => c.query(`SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name = $1 AND NOT active`, [SLOT]))
      .catch((e) => log(`Chua xoa duoc slot ${SLOT} tren Neon (${e.message}) - xoa tay trong Neon Console neu con.`));
  }
  log('Da tat sao chep realtime. Du lieu da chep tren Docker van giu nguyen.');
}

async function cmdPromote() {
  await cmdReplicaStop();
  await fixSequences(localUrl(), 'Docker');
  log('Docker da san sang lam CSDL chinh: dat APP_DB_TARGET=local trong .env roi "docker compose up -d app".');
}

// ---------------------------------------------------------------- lich su
function writeHistory(entry) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const f = path.join(BACKUP_DIR, 'sync-history.json');
    const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
    list.push(entry);
    fs.writeFileSync(f, JSON.stringify(list.slice(-200), null, 2));
  } catch (e) { /* khong quan trong */ }
}

// ---------------------------------------------------------------- khung gio hoat dong
// SYNC_ACTIVE_HOURS="06:30-18:30" (gio Viet Nam). De trong = hoat dong 24/7.
function inActiveHours(now = new Date()) {
  const spec = String(process.env.SYNC_ACTIVE_HOURS || '').trim();
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(spec);
  if (!m) return true;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const mi = Number(parts.find((p) => p.type === 'minute').value);
  const cur = h * 60 + mi;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = Number(m[3]) * 60 + Number(m[4]);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

async function setSubscriptionEnabled(on) {
  const changed = await withClient(localUrl(), async (c) => {
    const { rows } = await c.query('SELECT subenabled FROM pg_subscription WHERE subname = $1', [SUBSCRIPTION]);
    if (!rows[0] || rows[0].subenabled === on) return false;
    await c.query(`ALTER SUBSCRIPTION ${SUBSCRIPTION} ${on ? 'ENABLE' : 'DISABLE'}`);
    return true;
  });
  if (changed) log(on ? 'Vao khung gio hoat dong: BAT lai sao chep realtime.' : 'Ngoai khung gio hoat dong: TAM DUNG sao chep (de Neon duoc ngu).');
}

async function neonSlotExists() {
  return withClient(requireNeon(), async (c) => (await c.query('SELECT 1 FROM pg_replication_slots WHERE slot_name = $1', [SLOT])).rows.length > 0);
}

// ---------------------------------------------------------------- watch (container sync)
async function cmdWatch() {
  let mode = String(process.env.SYNC_MODE || 'replica').toLowerCase();
  // Web trong Docker dang GHI vao Postgres Docker -> khong duoc bien no thanh ban sao cua Neon
  // (subscription se de len du lieu that). Chi con push (neu xac nhan) hoac tat.
  if (String(process.env.APP_DB_TARGET || '').toLowerCase() === 'local' && ['replica', 'pull'].includes(mode)) {
    log(`APP_DB_TARGET=local: web dang ghi vao Postgres Docker nen KHONG the dung SYNC_MODE=${mode} (se ghi de du lieu).`);
    log('=> Chi sao luu dinh ky. Muon day len Neon: SYNC_MODE=push + SYNC_PUSH_CONFIRM=yes.');
    mode = 'backup-only';
  }
  const intervalMin = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 15));
  const backupHours = Math.max(1, Number(process.env.BACKUP_EVERY_HOURS || 24));
  log(`Tien trinh dong bo: SYNC_MODE=${mode}, chu ky ${intervalMin} phut, sao luu moi ${backupHours} gio.`);
  if (mode === 'off') { log('SYNC_MODE=off - khong lam gi.'); return new Promise(() => {}); }

  let lastBackup = 0;
  let effective = mode;
  const tick = async () => {
    try {
      // Ngoai khung gio hoat dong: KHONG cham vao Neon de compute Neon duoc ngu (goi Free chi co
      // 100 CU-gio/thang - chay 24/7 o 0.25 CU da ton ~182). Replica: tam dung subscription.
      if (!inActiveHours()) {
        if (effective === 'replica') await setSubscriptionEnabled(false);
        return;
      }
      if (effective === 'replica') await setSubscriptionEnabled(true);
      if (effective === 'replica') {
        const has = await withClient(localUrl(), async (c) => (await c.query('SELECT 1 FROM pg_subscription WHERE subname = $1', [SUBSCRIPTION])).rows.length > 0);
        if (!has) {
          try { await cmdReplicaSetup(); } catch (err) {
            log(`Khong bat duoc sao chep realtime: ${err.message}`);
            log('=> Tam chuyen sang che do PULL theo chu ky (van dong bo, chi khong tuc thi).');
            effective = 'pull';
          }
        } else if (!(await neonSlotExists())) {
          // Neon tu xoa slot khong hoat dong ~40 gio (VD may tat qua cuoi tuan) -> dung lai tu dau.
          log('Slot sao chep tren Neon da bi xoa (khong hoat dong lau). Thiet lap lai sao chep realtime...');
          await cmdReplicaStop({ dropSlotOnNeon: false });
          await cmdReplicaSetup();
        } else {
          await replicaRefresh();
          await cmdReplicaStatus();
        }
      }
      if (effective === 'pull') await cmdPull();
      if (effective === 'push') await cmdPush(['--yes-from-env']);
      if (Date.now() - lastBackup > backupHours * 3600 * 1000) {
        await cmdBackup(neonUrl() ? 'both' : 'local');
        lastBackup = Date.now();
      }
    } catch (err) {
      log(`Loi chu ky dong bo: ${err.message}`);
    }
  };
  // Che do replica: kiem tra moi phut (bang/cot moi do migration phai sang Docker som, neu khong
  // tien trinh sao chep dung cho). Che do pull/push: theo SYNC_INTERVAL_MINUTES.
  const loop = async () => {
    await tick();
    setTimeout(loop, (effective === 'replica' ? 60 : intervalMin * 60) * 1000);
  };
  await loop();
  return new Promise(() => {});
}

// ---------------------------------------------------------------- main
async function main() {
  const [cmd = 'status', ...args] = process.argv.slice(2);
  const commands = {
    status: cmdStatus,
    backup: () => cmdBackup(args[0] || 'both'),
    pull: cmdPull,
    push: () => cmdPush(args),
    'replica:setup': cmdReplicaSetup,
    'replica:status': cmdReplicaStatus,
    'replica:refresh': replicaRefresh,
    'replica:stop': () => cmdReplicaStop(),
    promote: cmdPromote,
    'fix-sequences': () => fixSequences(args[0] === 'neon' ? requireNeon() : localUrl(), args[0] === 'neon' ? 'Neon' : 'Docker'),
    watch: cmdWatch
  };
  if (!commands[cmd]) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(cmd === 'help' ? 0 : 1);
  }
  await commands[cmd]();
}

if (require.main === module) {
  main().then(() => { if (!['watch'].includes(process.argv[2])) process.exit(0); })
    .catch((err) => { console.error(`\nLOI: ${err.message}`); process.exit(1); });
}

module.exports = { withSslIfRemote, mask, pgConfig, isLocalHost, subscriptionConninfo, inActiveHours };
