const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const MAX_ADDRESSES = 5;

function mapAddress(row) {
  if (!row) return null;
  return {
    id:           row.id,
    name:         row.name,
    email:        row.email,
    phone:        row.phone,
    alt_phone:    row.alt_phone || '',
    address:      row.address,
    landmark:     row.landmark || '',
    city:         row.city,
    state:        row.state,
    pincode:      row.pincode,
    gst_number:   row.gst_number || '',
    company_name: row.company_name || '',
    created_at:   row.created_at,
  };
}

// GET /api/user/addresses
const getAddresses = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, addresses: rows.map(mapAddress) });
});

// POST /api/user/addresses
const createAddress = asyncHandler(async (req, res) => {
  const {
    name, email, phone, alt_phone, address, landmark,
    city, state, pincode, gst_number, company_name,
  } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !address?.trim()
      || !city?.trim() || !state?.trim() || !pincode?.trim()) {
    return res.status(400).json({ success: false, message: 'All required address fields must be filled' });
  }

  if (!/^\d{10}$/.test(String(phone).trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
  }

  if (!/^\d{6}$/.test(String(pincode).trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit pincode' });
  }

  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM user_addresses WHERE user_id = ?',
    [req.user.id]
  );

  if (Number(count) >= MAX_ADDRESSES) {
    return res.status(400).json({
      success: false,
      message: `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add a new address.`,
    });
  }

  const [[dup]] = await pool.query(
    `SELECT id FROM user_addresses
     WHERE user_id = ? AND address = ? AND city = ? AND pincode = ? LIMIT 1`,
    [req.user.id, address.trim(), city.trim(), pincode.trim()]
  );

  if (dup) {
    const [[existing]] = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [dup.id]);
    return res.json({ success: true, address: mapAddress(existing), duplicate: true });
  }

  const [result] = await pool.query(
    `INSERT INTO user_addresses
      (user_id, name, email, phone, alt_phone, address, landmark, city, state, pincode, gst_number, company_name)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      req.user.id,
      name.trim(),
      email.trim(),
      phone.trim(),
      alt_phone?.trim() || null,
      address.trim(),
      landmark?.trim() || null,
      city.trim(),
      state.trim(),
      pincode.trim(),
      gst_number?.trim() || null,
      company_name?.trim() || null,
    ]
  );

  const [[row]] = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, address: mapAddress(row) });
});

// DELETE /api/user/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [result] = await pool.query(
    'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );

  if (!result.affectedRows) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  res.json({ success: true, message: 'Address deleted' });
});

module.exports = { getAddresses, createAddress, deleteAddress };
