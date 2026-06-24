const { pool, connectDB } = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','seller','customer') NOT NULL DEFAULT 'customer',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_profiles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE,
  shop_name   VARCHAR(150) NOT NULL,
  shop_desc   TEXT,
  phone       VARCHAR(20),
  address     TEXT,
  gst_number  VARCHAR(20),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(100) NOT NULL UNIQUE,
  emoji      VARCHAR(10),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  seller_id      INT NOT NULL,
  category_id    INT NOT NULL,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  brand          VARCHAR(100),
  price          DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  stock          INT DEFAULT 0,
  sizes          JSON,
  colors         JSON,
  images         JSON,
  tags           JSON,
  is_active      BOOLEAN DEFAULT TRUE,
  avg_rating     DECIMAL(3,1) DEFAULT 0.0,
  rating_count   INT DEFAULT 0,
  has_disclaimer TINYINT DEFAULT 0,
  slug           VARCHAR(300) DEFAULT NULL,
  hsn_code       VARCHAR(50) DEFAULT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  customer_id    INT,
  customer_name  VARCHAR(100) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(20),
  address        TEXT NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  status         ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  payment_method VARCHAR(50) DEFAULT 'COD',
  payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  notes          TEXT,
  gst_number     VARCHAR(20) DEFAULT NULL,
  company_name   VARCHAR(150) DEFAULT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  product_id   INT NOT NULL,
  seller_id    INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  quantity     INT NOT NULL,
  size         VARCHAR(20),
  color        VARCHAR(50),
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id    INT,
  rating     TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(15) DEFAULT NULL,
  subject VARCHAR(100) DEFAULT NULL,
  message TEXT NOT NULL,
  status ENUM('unread','read','replied') DEFAULT 'unread',
  reply TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page VARCHAR(255) NOT NULL,
  ip VARCHAR(100) DEFAULT NULL,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ads (
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
);

CREATE TABLE IF NOT EXISTS hero_banners (
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
);
`;

async function seed() {
  await connectDB();

  console.log('📦 Tables bana raha hoon...');
  for (const stmt of schema.split(';').filter(s => s.trim())) {
    await pool.query(stmt);
  }
  console.log('✅ Sab tables ban gayi');

  const { ensureSchema } = require('./ensureSchema');
  await ensureSchema();

  // Categories seed
  const cats = [
    ['Women',       'women',       '👗'],
    ['Men',         'men',         '👕'],
    ['Kids',        'kids',        '🧸'],
    ['Home',        'home',        '🏠'],
    ['Beauty',      'beauty',      '💄'],
    ['Shoes',       'shoes',       '👟'],
    ['Electronics', 'electronics', '📱'],
  ];
  for (const [name, slug, emoji] of cats) {
    await pool.query(
      'INSERT IGNORE INTO categories (name, slug, emoji) VALUES (?,?,?)',
      [name, slug, emoji]
    );
  }
  console.log('✅ Categories seeded');

  // ── Admin user ──
  const adminPass = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT IGNORE INTO users (name, email, password, role)
     VALUES ('Admin User', 'admin@ecommerce.com', ?, 'admin')`,
    [adminPass]
  );

  // ── Normal user ──
  const userPass = await bcrypt.hash('user123', 10);
  await pool.query(
    `INSERT IGNORE INTO users (name, email, password, role)
     VALUES ('Test User', 'user@ecommerce.com', ?, 'customer')`,
    [userPass]
  );

  // ── Admin ko seller bhi banate hain products add karne ke liye ──
  const [[adminRow]] = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    ['admin@ecommerce.com']
  );
  const adminId = adminRow.id;

  await pool.query(
    `INSERT IGNORE INTO seller_profiles (user_id, shop_name, shop_desc, phone, is_verified)
     VALUES (?, 'E-Commerce Store', 'Official store', '9876543210', TRUE)`,
    [adminId]
  );

  console.log('✅ Admin & User seeded');

  // ── Sample products ──
  const [[womenCat]] = await pool.query(
    'SELECT id FROM categories WHERE slug = ?', ['women']
  );

  const sampleProducts = [
    {
      name: 'Floral Maxi Dress',
      brand: 'StyleCo',
      price: 799, orig: 1999, stock: 50,
      desc: 'Beautiful floral print maxi dress',
      image: 'https://images.unsplash.com/photo-1572804013427-4d7ca7268217?w=400&q=80',
      sizes: ['S','M','L','XL'], tags: ['Trending','New'],
    },
    {
      name: 'Embroidered Kurta Set',
      brand: 'Ethnic Charm',
      price: 999, orig: 2299, stock: 35,
      desc: 'Gorgeous embroidered kurta set',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80',
      sizes: ['S','M','L','XL'], tags: ['Bestseller'],
    },
  ];

  for (const p of sampleProducts) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await pool.query(
      `INSERT IGNORE INTO products
       (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags, slug)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        adminId, womenCat.id,
        p.name, p.desc, p.brand,
        p.price, p.orig, p.stock,
        JSON.stringify(p.sizes),
        JSON.stringify([p.image]),
        JSON.stringify(p.tags),
        slug,
      ]
    );
  }

  console.log('✅ Sample products seeded');
  console.log('\n🎉 Database ready hai!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin → admin@ecommerce.com / admin123');
  console.log('  User  → user@ecommerce.com  / user123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});