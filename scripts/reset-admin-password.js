// Dat lai mat khau 1 tai khoan nhan vien (mac dinh: superadmin).
//   node scripts/reset-admin-password.js              -> reset 'superadmin', tu sinh mat khau tam
//   node scripts/reset-admin-password.js manager01    -> reset tai khoan khac
//   node scripts/reset-admin-password.js superadmin MatKhauMoi123   -> tu chon mat khau
// Mat khau moi se bi buoc doi o lan dang nhap ke tiep; khoa tam & phien cu deu bi xoa.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { validatePassword, BCRYPT_COST } = require('../src/utils/passwordPolicy');

function tempPassword() {
  // 12 ky tu, chac chan co chu va so (dap ung passwordPolicy)
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (set) => set[crypto.randomInt(set.length)];
  let s = pick(letters) + pick(digits);
  for (let i = 0; i < 10; i++) s += pick(letters + digits);
  return s;
}

async function main() {
  const username = process.argv[2] || 'superadmin';
  const password = process.argv[3] || tempPassword();
  validatePassword(password);

  const forced = String(process.env.DB_SSL || '').toLowerCase();
  const ssl = process.env.DATABASE_URL ? forced !== 'false' && { rejectUnauthorized: false } : forced === 'true' && { rejectUnauthorized: false };
  const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl })
    : new Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'smart_queue',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl
      });

  await client.connect();
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await client.query(
      `UPDATE staff SET password_hash = $1, must_change_password = 1, is_active = 1,
              failed_login_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE username = $2 RETURNING id, username, role`,
      [hash, username]
    );
    if (!rows[0]) throw new Error(`Khong tim thay tai khoan "${username}".`);
    await client.query('DELETE FROM staff_sessions WHERE staff_id = $1', [rows[0].id]);
    console.log(`Da dat lai mat khau cho "${rows[0].username}" (${rows[0].role}).`);
    console.log(`Mat khau tam: ${password}`);
    console.log('Dang nhap bang mat khau nay, he thong se bat buoc ban doi mat khau moi.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Loi:', e.message); process.exit(1); });
