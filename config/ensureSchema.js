const { pool } = require('./db');

async function safeQuery(sql) {
  try {
    await pool.query(sql);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') return;
    throw err;
  }
}

async function ensureSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS contact_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(15) DEFAULT NULL,
      subject VARCHAR(100) DEFAULT NULL,
      message TEXT NOT NULL,
      status ENUM('unread','read','replied') DEFAULT 'unread',
      reply TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS page_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page VARCHAR(255) NOT NULL,
      ip VARCHAR(100) DEFAULT NULL,
      user_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) DEFAULT NULL,
      description TEXT,
      image_url VARCHAR(500) DEFAULT NULL,
      link_url VARCHAR(500) DEFAULT NULL,
      type ENUM('banner','popup','text') DEFAULT 'banner',
      position ENUM('home_top','home_middle','home_bottom','all_pages') DEFAULT 'home_top',
      bg_color VARCHAR(20) DEFAULT '#FF3E6C',
      text_color VARCHAR(20) DEFAULT '#ffffff',
      is_active TINYINT DEFAULT 1,
      start_date DATE DEFAULT NULL,
      end_date DATE DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subtitle VARCHAR(300) DEFAULT NULL,
      cta_text VARCHAR(100) DEFAULT 'Shop Now',
      cta_link VARCHAR(300) DEFAULT '/home',
      bg_gradient VARCHAR(300) DEFAULT 'linear-gradient(135deg, #FF3E6C 0%, #FF7043 100%)',
      image_url VARCHAR(500) DEFAULT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  const [productTable] = await pool.query("SHOW TABLES LIKE 'products'");
  if (productTable.length) {
    const productColumns = [
      'ALTER TABLE products ADD COLUMN avg_rating DECIMAL(3,1) DEFAULT 0.0',
      'ALTER TABLE products ADD COLUMN rating_count INT DEFAULT 0',
      'ALTER TABLE products ADD COLUMN has_disclaimer TINYINT DEFAULT 0',
      'ALTER TABLE products ADD COLUMN slug VARCHAR(300) DEFAULT NULL',
      'ALTER TABLE products ADD COLUMN hsn_code VARCHAR(50) DEFAULT NULL',
    ];
    for (const sql of productColumns) {
      await safeQuery(sql);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      user_id INT DEFAULT NULL,
      rating TINYINT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Legacy seed had reviews.user_name NOT NULL — drop if present
  try {
    const [reviewCols] = await pool.query("SHOW COLUMNS FROM reviews LIKE 'user_name'");
    if (reviewCols.length) {
      await pool.query('ALTER TABLE reviews DROP COLUMN user_name');
    }
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }

  if (productTable.length) {
    const [missingSlugs] = await pool.query(
      "SELECT id, name FROM products WHERE slug IS NULL OR slug = ''"
    );
    for (const p of missingSlugs) {
      const base = String(p.name || 'product')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'product';
      await pool.query('UPDATE products SET slug = ? WHERE id = ?', [`${base}-${p.id}`, p.id]);
    }
  }

  console.log('✅ Database schema verified');
}

module.exports = { ensureSchema };
