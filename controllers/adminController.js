const bcrypt = require('bcryptjs');
const { pool }         = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { resolveImageToCloudinary } = require('../utils/imageUpload');

// ── Nodemailer setup ──────────────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [[totals]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'seller')          AS total_sellers,
      (SELECT COUNT(*) FROM users WHERE role = 'customer')        AS total_customers,
      (SELECT COUNT(*) FROM products WHERE is_active = 1)         AS total_products,
      (SELECT COUNT(*) FROM orders)                               AS total_orders,
      (SELECT COALESCE(SUM(total_amount), 0)
       FROM orders WHERE status != 'cancelled')                   AS total_revenue,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending')      AS pending_orders,
      (SELECT COUNT(*) FROM contact_messages WHERE status = 'unread') AS unread_messages
  `);

  const [monthly] = await pool.query(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') AS month,
      COUNT(*)                          AS orders,
      SUM(total_amount)                 AS revenue
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month
    ORDER BY month ASC
  `);

  const [topSellers] = await pool.query(`
    SELECT
      u.id, u.name, sp.shop_name,
      COUNT(DISTINCT p.id)                    AS products,
      COALESCE(SUM(oi.price * oi.quantity), 0) AS revenue
    FROM users u
    JOIN seller_profiles sp    ON sp.user_id  = u.id
    LEFT JOIN products p       ON p.seller_id = u.id
    LEFT JOIN order_items oi   ON oi.seller_id = u.id
    WHERE u.role = 'seller'
    GROUP BY u.id, u.name, sp.shop_name
    ORDER BY revenue DESC
    LIMIT 5
  `);

  res.json({ success: true, totals, monthly, topSellers });
});

// GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where    = '';
  const params = [];
  if (role) { where = 'WHERE u.role = ?'; params.push(role); }

  const [users] = await pool.query(`
    SELECT
      u.id, u.name, u.email, u.role, u.is_active, u.created_at,
      sp.shop_name, sp.is_verified,
      (SELECT COUNT(*) FROM products WHERE seller_id = u.id) AS product_count
    FROM users u
    LEFT JOIN seller_profiles sp ON sp.user_id = u.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  res.json({ success: true, users });
});

// PUT /api/admin/users/:id/toggle
const toggleUserActive = asyncHandler(async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT id, is_active FROM users WHERE id = ?', [req.params.id]
  );
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  await pool.query(
    'UPDATE users SET is_active = ? WHERE id = ?',
    [!user.is_active, user.id]
  );
  res.json({
    success: true,
    message: `User ${user.is_active ? 'deactivated' : 'activated'} successfully`,
  });
});

const DEFAULT_RESET_PASSWORD = 'welcome123';

// PUT /api/admin/users/:id/reset-password
const resetUserPassword = asyncHandler(async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [req.params.id]
  );
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin passwords cannot be reset from this panel',
    });
  }

  const hashed = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

  res.json({
    success: true,
    message: `Password for ${user.name || user.email} reset to "${DEFAULT_RESET_PASSWORD}"`,
    defaultPassword: DEFAULT_RESET_PASSWORD,
  });
});

// PUT /api/admin/sellers/:id/verify
const verifySeller = asyncHandler(async (req, res) => {
  await pool.query(
    'UPDATE seller_profiles SET is_verified = TRUE WHERE user_id = ?',
    [req.params.id]
  );
  res.json({ success: true, message: 'Seller verified successfully' });
});

// POST /api/admin/users
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, shop_name, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }

  const [[exists]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists) {
    return res.status(409).json({ success: false, message: 'This email already exists' });
  }

  const hashed   = await bcrypt.hash(password || 'password123', 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
    [name, email, hashed, role || 'seller']
  );

  if (role === 'seller' && shop_name) {
    await pool.query(
      'INSERT INTO seller_profiles (user_id, shop_name, phone) VALUES (?,?,?)',
      [result.insertId, shop_name, phone || null]
    );
  }

  res.status(201).json({ success: true, message: 'User created successfully', userId: result.insertId });
});

const getCategories = asyncHandler(async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY name');
  res.json({ success: true, categories: cats });
});

const getAllCategories = asyncHandler(async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, categories: cats });
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, emoji } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await pool.query(
    'INSERT INTO categories (name, slug, emoji) VALUES (?,?,?)',
    [name, slug, emoji || '🛍️']
  );
  res.status(201).json({ success: true, message: 'Category created successfully' });
});

const toggleCategory = asyncHandler(async (req, res) => {
  const [[cat]] = await pool.query(
    'SELECT id, is_active FROM categories WHERE id = ?', [req.params.id]
  );
  if (!cat) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  await pool.query(
    'UPDATE categories SET is_active = ? WHERE id = ?',
    [cat.is_active ? 0 : 1, req.params.id]
  );
  res.json({
    success: true,
    is_active: !cat.is_active,
    message: `Category ${!cat.is_active ? 'activated' : 'deactivated'} successfully`,
  });
});

const trackView = asyncHandler(async (req, res) => {
  const { path, page } = req.body;
  const pagePath = path || page || '/';
  const ip       = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const user_id  = req.user?.id || null;
  await pool.query(
    'INSERT INTO page_views (page, ip, user_id) VALUES (?,?,?)',
    [pagePath, ip, user_id]
  );
  res.json({ success: true });
});

const getPageViews = asyncHandler(async (req, res) => {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM page_views');
  const [[{ today }]] = await pool.query(
    'SELECT COUNT(*) AS today FROM page_views WHERE DATE(created_at) = CURDATE()'
  );
  const [topPages] = await pool.query(`
    SELECT
      pv.page,
      COUNT(*) AS views,
      COALESCE(
        (SELECT p.name FROM products p WHERE pv.page = CONCAT('/product/', p.id) LIMIT 1),
        (SELECT p.name FROM products p WHERE pv.page = CONCAT('/product/', p.slug) LIMIT 1),
        ''
      ) AS product_name
    FROM page_views pv
    GROUP BY pv.page
    ORDER BY views DESC
    LIMIT 10
  `);
  const [daily] = await pool.query(`
    SELECT DATE(created_at) AS date, COUNT(*) AS views
    FROM page_views
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY date ORDER BY date ASC
  `);
  res.json({ success: true, total, today, topPages, daily });
});

// ══════════════════════════════════════════
//  CONTACT MESSAGES
// ══════════════════════════════════════════
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required' });
  }

  await pool.query(
    `INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?,?,?,?,?)`,
    [name, email, phone || null, subject || null, message]
  );

  // Send notification email to admin
  try {
    await transporter.sendMail({
      from: `"E-Com Contact Form" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `📩 New Message: ${subject || 'General Inquiry'} — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#FF3E6C,#FF7043);padding:24px;color:white;">
            <h2 style="margin:0;">📩 New Customer Message</h2>
          </div>
          <div style="padding:24px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
            <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
            <div style="background:#f7fafc;border-left:4px solid #FF3E6C;border-radius:6px;padding:16px;margin:16px 0;">
              <p style="margin:0;">${message}</p>
            </div>
            <p style="color:#718096;font-size:12px;">Reply from Admin Dashboard → Inquiry Page</p>
          </div>
        </div>
      `,
    });
    console.log('✅ Admin notification email sent from:', email);
  } catch (emailErr) {
    console.error('❌ Admin notification email failed:', emailErr.message);
  }

  res.status(201).json({ success: true, message: 'Message sent successfully! We will reply within 24 hours.' });
});

const getContactMessages = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let where = '';
  const params = [];
  if (status) { where = 'WHERE status = ?'; params.push(status); }

  const [messages] = await pool.query(
    `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC`, params
  );
  const [[{ unread }]] = await pool.query(
    `SELECT COUNT(*) AS unread FROM contact_messages WHERE status = 'unread'`
  );
  res.json({ success: true, messages, unread });
});

const markMessageRead = asyncHandler(async (req, res) => {
  await pool.query(`UPDATE contact_messages SET status = 'read' WHERE id = ?`, [req.params.id]);
  res.json({ success: true, message: 'Marked as read' });
});

const replyToMessage = asyncHandler(async (req, res) => {
  const { reply } = req.body;
  if (!reply) {
    return res.status(400).json({ success: false, message: 'Reply text required' });
  }

  // Fetch user data
  const [[msg]] = await pool.query(
    `SELECT name, email, subject, message FROM contact_messages WHERE id = ?`,
    [req.params.id]
  );
  if (!msg) {
    return res.status(404).json({ success: false, message: 'Message not found' });
  }

  // Save in DB
  await pool.query(
    `UPDATE contact_messages SET reply = ?, status = 'replied' WHERE id = ?`,
    [reply, req.params.id]
  );

  // Send reply email to user
  try {
    await transporter.sendMail({
      from: `"E-Com Support" <${process.env.GMAIL_USER}>`,
      to: msg.email,
      subject: `Re: ${msg.subject || 'Your Inquiry'} — E-Com Support`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#FF3E6C,#FF7043);padding:24px;color:white;">
            <h2 style="margin:0;">E-Com Support Team</h2>
<p style="margin:6px 0 0;opacity:0.85;font-size:13px;">Your inquiry has been answered!</p>          </div>
          <div style="padding:24px;">
            <p>Hello <strong>${msg.name}</strong>,</p>
            <p style="color:#4a5568;font-size:14px;">You contacted us regarding: <em>"${msg.subject || 'General Inquiry'}"</em></p>
            <div style="background:#f7fafc;border-left:4px solid #a0aec0;border-radius:6px;padding:16px;margin:16px 0;">
              <strong style="color:#718096;font-size:11px;text-transform:uppercase;">Your Message:</strong>
              <p style="margin:8px 0 0;color:#718096;font-style:italic;">${msg.message}</p>
            </div>
            <div style="background:#fff5f7;border-left:4px solid #FF3E6C;border-radius:6px;padding:16px;margin:16px 0;">
              <strong style="color:#FF3E6C;font-size:11px;text-transform:uppercase;">Our Reply:</strong>
              <p style="margin:8px 0 0;color:#2d3748;line-height:1.7;">${reply}</p>
            </div>
<p>If you have any more questions, feel free to contact us again. 😊</p>
            <p style="color:#4a5568;">Thank you,<br/><strong>E-Com Support Team</strong></p>
          </div>
          <div style="background:#f7fafc;padding:14px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0;">
This email was sent automatically
          </div>
        </div>
      `,
    });
    console.log('✅ Reply email sent to:', msg.email);
  } catch (emailErr) {
    console.error('❌ Reply email failed:', emailErr.message);
  }

  res.json({ success: true, message: 'Reply saved successfully!' });
});

const deleteContactMessage = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Message deleted' });
});

const getMyMessages = asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required' });
  }
  const [messages] = await pool.query(
    `SELECT id, name, subject, message, reply, status, created_at
     FROM contact_messages WHERE email = ? ORDER BY created_at DESC`,
    [email]
  );
  res.json({ success: true, messages });
});

// ══════════════════════════════════════════
//  ADS
// ══════════════════════════════════════════

const getAds = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const [ads] = await pool.query(`
    SELECT * FROM ads WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY created_at DESC
  `, [today, today]);
  res.json({ success: true, ads });
});

const getAdminAds = asyncHandler(async (req, res) => {
  const [ads] = await pool.query('SELECT * FROM ads ORDER BY created_at DESC');
  res.json({ success: true, ads });
});

const createAd = asyncHandler(async (req, res) => {
  const { title, description, image_url, link_url, type, position, bg_color, text_color, start_date, end_date } = req.body;
  const cloudImage = image_url ? await resolveImageToCloudinary(image_url) : '';
  const [result] = await pool.query(
    `INSERT INTO ads (title, description, image_url, link_url, type, position, bg_color, text_color, start_date, end_date)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [title||'', description||'', cloudImage, link_url||'',
     type||'banner', position||'home_top', bg_color||'#FF3E6C', text_color||'#ffffff',
     start_date||null, end_date||null]
  );
  res.status(201).json({ success: true, id: result.insertId, message: 'Ad created!' });
});

const updateAd = asyncHandler(async (req, res) => {
  const { title, description, image_url, link_url, type, position, bg_color, text_color, is_active, start_date, end_date } = req.body;
  const cloudImage = image_url ? await resolveImageToCloudinary(image_url) : '';
  await pool.query(
    `UPDATE ads SET title=?, description=?, image_url=?, link_url=?, type=?, position=?,
     bg_color=?, text_color=?, is_active=?, start_date=?, end_date=? WHERE id=?`,
    [title, description, cloudImage, link_url, type, position,
     bg_color, text_color, is_active?1:0, start_date||null, end_date||null, req.params.id]
  );
  res.json({ success: true, message: 'Ad updated!' });
});

const deleteAd = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM ads WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Ad deleted!' });
});

const toggleAd = asyncHandler(async (req, res) => {
  const [[ad]] = await pool.query('SELECT id, is_active FROM ads WHERE id = ?', [req.params.id]);
  if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
  await pool.query('UPDATE ads SET is_active = ? WHERE id = ?', [ad.is_active?0:1, ad.id]);
  res.json({ success: true, is_active: !ad.is_active });
});

// ══════════════════════════════════════════
//  HERO BANNERS
// ══════════════════════════════════════════

const getBanners = asyncHandler(async (req, res) => {
  const [banners] = await pool.query('SELECT * FROM hero_banners WHERE is_active = 1 ORDER BY sort_order ASC');
  res.json({ success: true, banners });
});

const getAdminBanners = asyncHandler(async (req, res) => {
  const [banners] = await pool.query('SELECT * FROM hero_banners ORDER BY sort_order ASC');
  res.json({ success: true, banners });
});

const createBanner = asyncHandler(async (req, res) => {
  const { title, subtitle, cta_text, cta_link, bg_gradient, image_url, sort_order } = req.body;
  const cloudImage = image_url ? await resolveImageToCloudinary(image_url) : '';
  const [result] = await pool.query(
    `INSERT INTO hero_banners (title, subtitle, cta_text, cta_link, bg_gradient, image_url, sort_order)
     VALUES (?,?,?,?,?,?,?)`,
    [title, subtitle||'', cta_text||'Shop Now', cta_link||'/home',
     bg_gradient||'linear-gradient(135deg, #FF3E6C 0%, #FF7043 100%)', cloudImage, sort_order||0]
  );
  res.status(201).json({ success: true, id: result.insertId });
});

const updateBanner = asyncHandler(async (req, res) => {
  const { title, subtitle, cta_text, cta_link, bg_gradient, image_url, sort_order, is_active } = req.body;
  const cloudImage = image_url ? await resolveImageToCloudinary(image_url) : '';
  await pool.query(
    `UPDATE hero_banners SET title=?, subtitle=?, cta_text=?, cta_link=?,
     bg_gradient=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
    [title, subtitle, cta_text, cta_link, bg_gradient, cloudImage, sort_order||0, is_active?1:0, req.params.id]
  );
  res.json({ success: true, message: 'Banner updated!' });
});

const deleteBanner = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM hero_banners WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Banner deleted!' });
});

const toggleBanner = asyncHandler(async (req, res) => {
  const [[b]] = await pool.query('SELECT id, is_active FROM hero_banners WHERE id=?', [req.params.id]);
  if (!b) return res.status(404).json({ success: false, message: 'Not found' });
  await pool.query('UPDATE hero_banners SET is_active=? WHERE id=?', [b.is_active?0:1, b.id]);
  res.json({ success: true, is_active: !b.is_active });
});

const updateCategory = asyncHandler(async (req, res) => {
  const { name, emoji } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await pool.query(
    'UPDATE categories SET name = ?, slug = ?, emoji = ? WHERE id = ?',
    [name, slug, emoji || '🛍️', req.params.id]
  );
  res.json({ success: true, message: 'Category updated successfully' });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const [[hasProducts]] = await pool.query('SELECT COUNT(*) AS count FROM products WHERE category_id = ?', [req.params.id]);
  if (hasProducts.count > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete category: it is assigned to ${hasProducts.count} products.`
    });
  }
  await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Category deleted successfully' });
});

module.exports = {
  getDashboard, getUsers, toggleUserActive, resetUserPassword, verifySeller, createUser,
  getCategories, getAllCategories, createCategory, toggleCategory, updateCategory, deleteCategory,
  trackView, getPageViews,
  sendContactMessage, getContactMessages, markMessageRead,
  replyToMessage, deleteContactMessage, getMyMessages,
  getAds, getAdminAds, createAd, updateAd, deleteAd, toggleAd,
  getBanners, getAdminBanners, createBanner, updateBanner, deleteBanner, toggleBanner,
};