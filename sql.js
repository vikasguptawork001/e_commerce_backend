// CREATE DATABASE IF NOT EXISTS ecommerce_db
//   CHARACTER SET utf8mb4
//   COLLATE utf8mb4_unicode_ci;

// USE ecommerce_db;

// CREATE TABLE IF NOT EXISTS users (
//   id         INT           AUTO_INCREMENT PRIMARY KEY,
//   name       VARCHAR(100)  NOT NULL,
//   email      VARCHAR(150)  NOT NULL UNIQUE,
//   password   VARCHAR(255)  NOT NULL,
//   role       ENUM('admin','seller','customer') NOT NULL DEFAULT 'customer',
//   is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
//   created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
//   updated_at DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// CREATE TABLE IF NOT EXISTS seller_profiles (
//   id          INT          AUTO_INCREMENT PRIMARY KEY,
//   user_id     INT          NOT NULL UNIQUE,
//   shop_name   VARCHAR(150) NOT NULL,
//   shop_desc   TEXT,
//   phone       VARCHAR(20),
//   address     TEXT,
//   gst_number  VARCHAR(20),
//   is_verified BOOLEAN      NOT NULL DEFAULT FALSE,
//   created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
// );



// CREATE TABLE IF NOT EXISTS categories (
//   id         INT          AUTO_INCREMENT PRIMARY KEY,
//   name       VARCHAR(100) NOT NULL UNIQUE,
//   slug       VARCHAR(100) NOT NULL UNIQUE,
//   emoji      VARCHAR(10),
//   is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
//   created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
// );


// CREATE TABLE IF NOT EXISTS products (
//   id             INT           AUTO_INCREMENT PRIMARY KEY,
//   seller_id      INT           NOT NULL,
//   category_id    INT           NOT NULL,
//   name           VARCHAR(255)  NOT NULL,
//   description    TEXT,
//   brand          VARCHAR(100),
//   price          DECIMAL(10,2) NOT NULL,
//   original_price DECIMAL(10,2) NOT NULL,
//   stock          INT           NOT NULL DEFAULT 0,
//   sizes          JSON,
//   colors         JSON,
//   images         JSON,
//   tags           JSON,
//   is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
//   created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
//   updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (seller_id)   REFERENCES users(id)      ON DELETE CASCADE,
//   FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
// );


// CREATE TABLE IF NOT EXISTS orders (
//   id             INT           AUTO_INCREMENT PRIMARY KEY,
//   customer_id    INT,
//   customer_name  VARCHAR(100)  NOT NULL,
//   customer_email VARCHAR(150)  NOT NULL,
//   customer_phone VARCHAR(20),
//   address        TEXT          NOT NULL,
//   total_amount   DECIMAL(10,2) NOT NULL,
//   status         ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
//   payment_method VARCHAR(50)   NOT NULL DEFAULT 'COD',
//   payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
//   notes          TEXT,
//   created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
//   updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
// );


// CREATE TABLE IF NOT EXISTS order_items (
//   id           INT           AUTO_INCREMENT PRIMARY KEY,
//   order_id     INT           NOT NULL,
//   product_id   INT           NOT NULL,
//   seller_id    INT           NOT NULL,
//   product_name VARCHAR(255)  NOT NULL,
//   price        DECIMAL(10,2) NOT NULL,
//   quantity     INT           NOT NULL,
//   size         VARCHAR(20),
//   color        VARCHAR(50),
//   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
//   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
//   FOREIGN KEY (seller_id)  REFERENCES users(id)    ON DELETE RESTRICT
// );

// CREATE TABLE IF NOT EXISTS reviews (
//   id         INT          AUTO_INCREMENT PRIMARY KEY,
//   product_id INT          NOT NULL,
//   user_id    INT,
//   user_name  VARCHAR(100) NOT NULL,
//   rating     TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
//   comment    TEXT,
//   created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
//   FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL
// );


// INSERT INTO categories (name, slug, emoji) VALUES
//   ('Women',       'women',       '👗'),
//   ('Men',         'men',         '👕'),
//   ('Kids',        'kids',        '🧸'),
//   ('Home',        'home',        '🏠'),
//   ('Beauty',      'beauty',      '💄'),
//   ('Shoes',       'shoes',       '👟'),
//   ('Electronics', 'electronics', '📱');
  
  
//   INSERT INTO users (name, email, password, role) VALUES
// (
//   'Admin User',
//   'admin@ecommerce.com',
//   'admin123',
//   'admin'
// );


// INSERT INTO users (name, email, password, role) VALUES
// (
//   'Demo Seller',
//   'seller@ecommerce.com',
//   'seller123',
//   'seller'
// );

// SET @seller = (SELECT id FROM users WHERE email = 'seller@ecommerce.com');
// SET @women  = (SELECT id FROM categories WHERE slug = 'women');
// SET @men    = (SELECT id FROM categories WHERE slug = 'men');
// SET @kids   = (SELECT id FROM categories WHERE slug = 'kids');
// SET @home   = (SELECT id FROM categories WHERE slug = 'home');
// SET @beauty = (SELECT id FROM categories WHERE slug = 'beauty');
// SET @shoes  = (SELECT id FROM categories WHERE slug = 'shoes');
// SET @elec   = (SELECT id FROM categories WHERE slug = 'electronics');


// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @women,
//   'Floral Maxi Dress',
//   'Beautiful floral print maxi dress perfect for all occasions',
//   'StyleCo', 799.00, 1999.00, 50,
//   '["XS","S","M","L","XL"]',
//   '["https://images.unsplash.com/photo-1572804013427-4d7ca7268217?w=400&q=80"]',
//   '["Trending","New"]'
// ),
// (
//   @seller, @women,
//   'Embroidered Kurta Set',
//   'Gorgeous embroidered kurta set perfect for festivals',
//   'Ethnic Charm', 999.00, 2299.00, 35,
//   '["S","M","L","XL"]',
//   '["https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80"]',
//   '["Bestseller","New"]'
// ),
// (
//   @seller, @women,
//   'High Waist Palazzo',
//   'Comfortable and stylish palazzo for everyday wear',
//   'Trendy', 549.00, 1099.00, 40,
//   '["S","M","L","XL"]',
//   '["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80"]',
//   '["Sale"]'
// );



// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @men,
//   'Slim Fit Chinos',
//   'Classic slim fit chinos for casual and semi-formal occasions',
//   'UrbanFit', 1299.00, 2499.00, 30,
//   '["28","30","32","34","36"]',
//   '["https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80"]',
//   '["Bestseller"]'
// ),
// (
//   @seller, @men,
//   'Classic Oxford Shirt',
//   'Timeless oxford shirt for formal and casual occasions',
//   'FormalEdge', 899.00, 1799.00, 0,
//   '["S","M","L","XL","XXL"]',
//   '["https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=400&q=80"]',
//   '[]'
// );


// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @shoes,
//   'Running Sneakers',
//   'High performance running sneakers with superior cushioning',
//   'SportX', 1899.00, 3999.00, 25,
//   '["6","7","8","9","10","11"]',
//   '["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80"]',
//   '["Trending","Sale"]'
// ),
// (
//   @seller, @shoes,
//   'Block Heel Sandals',
//   'Stylish block heel sandals perfect for parties',
//   'Heels & More', 1199.00, 2499.00, 20,
//   '["36","37","38","39","40","41"]',
//   '["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80"]',
//   '["New"]'
// );


// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @elec,
//   'TWS Earbuds',
//   'Premium true wireless earbuds with active noise cancellation',
//   'SoundPro', 1499.00, 3999.00, 60,
//   '["One Size"]',
//   '["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80"]',
//   '["Bestseller","Sale"]'
// );


// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @home,
//   'Ceramic Coffee Mug Set',
//   'Beautiful handcrafted ceramic coffee mug set',
//   'CozyHome', 449.00, 899.00, 45,
//   '["Set of 2","Set of 4"]',
//   '["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80"]',
//   '["Sale"]'
// ),
// (
//   @seller, @home,
//   'Aromatherapy Candle Set',
//   'Premium aromatherapy candles for relaxation',
//   'ZenHome', 699.00, 1299.00, 30,
//   '["3 Pack","6 Pack"]',
//   '["https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?w=400&q=80"]',
//   '["Trending","New"]'
// );


// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @beauty,
//   'Vitamin C Serum',
//   'Advanced vitamin C serum for glowing and radiant skin',
//   'GlowSkin', 599.00, 1200.00, 55,
//   '["30ml","50ml"]',
//   '["https://images.unsplash.com/photo-1600428863056-16e7f3f3beac?w=400&q=80"]',
//   '["Trending"]'
// );

// INSERT INTO products
//   (seller_id, category_id, name, description, brand, price, original_price, stock, sizes, images, tags)
// VALUES
// (
//   @seller, @kids,
//   'Cartoon Print T-shirt',
//   'Cute and comfortable cartoon print t-shirt for kids',
//   'KiddieWear', 299.00, 599.00, 70,
//   '["2-3Y","4-5Y","6-7Y","8-9Y"]',
//   '["https://images.unsplash.com/photo-1471286174890-9c112ac19400?w=400&q=80"]',
//   '["New"]'
// );

// INSERT INTO orders
//   (customer_name, customer_email, customer_phone, address, total_amount, status, payment_method)
// VALUES (
//   'Rahul Sharma',
//   'rahul@email.com',
//   '9876543210',
//   '123 MG Road, Connaught Place, New Delhi - 110001',
//   1598.00,
//   'delivered',
//   'COD'
// );


// INSERT INTO order_items
//   (order_id, product_id, seller_id, product_name, price, quantity)
// VALUES (
//   LAST_INSERT_ID(),
//   (SELECT id FROM products WHERE name = 'Floral Maxi Dress' LIMIT 1),
//   (SELECT id FROM users WHERE email = 'seller@ecommerce.com'),
//   'Floral Maxi Dress',
//   799.00,
//   2
// );


// SELECT 'users'       AS Table_Name, COUNT(*) AS Total FROM users
// UNION ALL
// SELECT 'categories'  AS Table_Name, COUNT(*) AS Total FROM categories
// UNION ALL
// SELECT 'products'    AS Table_Name, COUNT(*) AS Total FROM products
// UNION ALL
// SELECT 'orders'      AS Table_Name, COUNT(*) AS Total FROM orders
// UNION ALL
// SELECT 'order_items' AS Table_Name, COUNT(*) AS Total FROM order_items;