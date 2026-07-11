/**
 * ══════════════════════════════════════════════════════
 * FINAL ADMIN TOOL (Create / Update / Partial Update)
 * Usage: node scripts/createAdmin.js <target_email> <password_or_null> <new_email_optional>
 * ══════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const [,, TARGET_EMAIL, PASSWORD, NEW_EMAIL] = process.argv;

async function main() {
  if (!TARGET_EMAIL) {
    console.log('\n❌ Error: Kam se kam email dena zaroori hai!');
    console.log('💡 Usage Examples:');
    console.log('1. Naya Admin: node scripts/createAdmin.js test@mail.com pass123');
    console.log('2. Password Update: node scripts/createAdmin.js old@mail.com nayaPass123');
    console.log('3. Sirf Email Update: node scripts/createAdmin.js old@mail.com null naya@mail.com');
    console.log('4. Dono Update: node scripts/createAdmin.js old@mail.com nayaPass123 naya@mail.com\n');
    process.exit(1);
  }

  const pool = await mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME     || 'ecommerce_db',
  });

  try {
    const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [TARGET_EMAIL]);

    if (!existing) {
      // 🆕 CREATE MODE: Agar user nahi hai to naya banao
      if (!PASSWORD || PASSWORD === 'null') {
        console.log('❌ Error: Naya admin banane ke liye password chahiye!');
        process.exit(1);
      }
      const hashed = await bcrypt.hash(PASSWORD, 12);
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'admin', 1)`,
        ['Admin User', TARGET_EMAIL, hashed]
      );
      console.log(`✅ SUCCESS: Naya Admin (${TARGET_EMAIL}) bana diya gaya!`);
    } else {
      // 🆙 UPDATE MODE: Agar mil gaya to update karo
      let updateFields = [];
      let queryParams = [];

      // Email update check
      if (NEW_EMAIL && NEW_EMAIL !== 'null') {
        updateFields.push('email = ?');
        queryParams.push(NEW_EMAIL);
      }

      // Password update check
      if (PASSWORD && PASSWORD !== 'null') {
        const hashed = await bcrypt.hash(PASSWORD, 12);
        updateFields.push('password = ?');
        queryParams.push(hashed);
      }

      if (updateFields.length === 0) {
        console.log('⚠️ Kuch badalne ke liye nahi mila. Arguments check karein.');
        process.exit(0);
      }

      queryParams.push(existing.id);
      await pool.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, queryParams);

      console.log(`✅ SUCCESS: Admin (${TARGET_EMAIL}) update ho gaya!`);
      if (NEW_EMAIL) console.log(`📧 New Email: ${NEW_EMAIL}`);
      if (PASSWORD !== 'null') console.log(`🔑 Password: ${PASSWORD} (Updated)`);
    }

  } catch (err) {
    console.error('❌ Database Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();