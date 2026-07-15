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

  const [userTable] = await pool.query("SHOW TABLES LIKE 'users'");
  if (userTable.length) {
    const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'phone'");
    if (!userCols.length) {
      await safeQuery('ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL');
      try {
        await pool.query('CREATE UNIQUE INDEX idx_users_phone ON users (phone)');
      } catch (err) {
        if (err.code !== 'ER_DUP_KEYNAME') throw err;
      }
    }
  }

  const [productTable] = await pool.query("SHOW TABLES LIKE 'products'");
  if (productTable.length) {
    const productColumns = [
      'ALTER TABLE products ADD COLUMN avg_rating DECIMAL(3,1) DEFAULT 0.0',
      'ALTER TABLE products ADD COLUMN rating_count INT DEFAULT 0',
      'ALTER TABLE products ADD COLUMN has_disclaimer TINYINT DEFAULT 0',
      'ALTER TABLE products ADD COLUMN slug VARCHAR(300) DEFAULT NULL',
      'ALTER TABLE products ADD COLUMN hsn_code VARCHAR(50) DEFAULT NULL',
      'ALTER TABLE products ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00',
      'ALTER TABLE products ADD COLUMN color_variants JSON DEFAULT NULL',
      'ALTER TABLE products ADD COLUMN is_free_size TINYINT DEFAULT 1',
    ];
    for (const sql of productColumns) {
      await safeQuery(sql);
    }
  }

  const [orderTable] = await pool.query("SHOW TABLES LIKE 'orders'");
  if (orderTable.length) {
    const orderColumns = [
      'ALTER TABLE orders ADD COLUMN gst_number VARCHAR(20) DEFAULT NULL',
      'ALTER TABLE orders ADD COLUMN company_name VARCHAR(150) DEFAULT NULL',
      'ALTER TABLE orders ADD COLUMN razorpay_payment_id VARCHAR(191) DEFAULT NULL',
      'ALTER TABLE orders ADD COLUMN razorpay_order_id VARCHAR(100) DEFAULT NULL',
    ];
    for (const sql of orderColumns) {
      await safeQuery(sql);
    }
    try {
      await pool.query(
        'CREATE UNIQUE INDEX idx_orders_razorpay_payment_id ON orders (razorpay_payment_id)'
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      alt_phone VARCHAR(20) DEFAULT NULL,
      address TEXT NOT NULL,
      landmark VARCHAR(255) DEFAULT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      pincode VARCHAR(10) NOT NULL,
      gst_number VARCHAR(20) DEFAULT NULL,
      company_name VARCHAR(150) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_addresses_user (user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_wishlist_user_product (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Database schema verified');
}

module.exports = { ensureSchema };
