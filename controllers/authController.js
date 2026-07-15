const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { pool }         = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { getPublicKey, resolveField } = require('../config/transportCrypto');

const signToken = (id, role) =>
  jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// GET /api/auth/public-key
const getPublicKeyHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, publicKey: getPublicKey() });
});

// ─────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, role = 'customer', shop_name, phone } = req.body;
  const password = resolveField(req.body, 'password');

  if (!name || !email || !password || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, password, and phone number are required',
    });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be a valid 10-digit number',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
    });
  }

  const userRole = ['customer', 'seller'].includes(role) ? role : 'customer';

  const [[exists]] = await pool.query(
    'SELECT id FROM users WHERE email = ?', [email]
  );
  if (exists) {
    return res.status(409).json({
      success: false,
      message: 'This email is already registered',
    });
  }

  const [[phoneExists]] = await pool.query(
    'SELECT id FROM users WHERE phone = ?', [phone]
  );
  if (phoneExists) {
    return res.status(409).json({
      success: false,
      message: 'This phone number is already registered',
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, phone, password, role) VALUES (?,?,?,?,?)',
    [name, email, phone, hashed, userRole]
  );
  const userId = result.insertId;

  if (userRole === 'seller') {
    if (!shop_name) {
      return res.status(400).json({
        success: false,
        message: 'Shop name is required for seller registration',
      });
    }
    await pool.query(
      'INSERT INTO seller_profiles (user_id, shop_name, phone) VALUES (?,?,?)',
      [userId, shop_name, phone]
    );
  }

  const token = signToken(userId, userRole);
  res.status(201).json({
    success: true,
    token,
    user: { id: userId, name, email, role: userRole, phone },
  });
});

// ─────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const password = resolveField(req.body, 'password');

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const [[user]] = await pool.query(
    'SELECT id, name, email, phone, password, role, is_active FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact admin.',
    });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  let sellerProfile = null;
  if (user.role === 'seller') {
    const [[sp]] = await pool.query(
      'SELECT * FROM seller_profiles WHERE user_id = ?', [user.id]
    );
    sellerProfile = sp || null;
  }

  const token = signToken(user.id, user.role);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      sellerProfile,
    },
  });
});

// ─────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE id = ?',
    [req.user.id]
  );

  let sellerProfile = null;
  if (user.role === 'seller') {
    const [[sp]] = await pool.query(
      'SELECT * FROM seller_profiles WHERE user_id = ?', [user.id]
    );
    sellerProfile = sp || null;
  }

  res.json({ success: true, user: { ...user, sellerProfile } });
});

// ─────────────────────────────────────────
// PUT /api/auth/update-password
// ─────────────────────────────────────────
const updatePassword = asyncHandler(async (req, res) => {
  const currentPassword = resolveField(req.body, 'currentPassword');
  const newPassword     = resolveField(req.body, 'newPassword');
  
  const [[user]] = await pool.query(
    'SELECT password FROM users WHERE id = ?', [req.user.id]
  );

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long',
    });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { getPublicKeyHandler, register, login, getMe, updatePassword };