const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/user/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT w.product_id, w.created_at,
            p.id, p.name, p.slug, p.brand, p.price, p.original_price,
            p.stock, p.images, p.colors, p.color_variants, p.sizes,
            p.has_disclaimer, p.hsn_code, p.gst_percent, p.is_free_size,
            COALESCE(c.slug, '') AS category_slug,
            COALESCE(AVG(r.rating), 0) AS avg_rating,
            COUNT(DISTINCT r.id) AS rating_count
     FROM wishlists w
     JOIN products p ON p.id = w.product_id AND p.is_active = 1
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE w.user_id = ?
     GROUP BY w.id, p.id
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );

  const productIds = rows.map(r => r.product_id);
  res.json({ success: true, productIds, items: rows });
});

// POST /api/user/wishlist/:productId — toggle
const toggleWishlist = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!productId) {
    return res.status(400).json({ success: false, message: 'Invalid product' });
  }

  const [[product]] = await pool.query(
    'SELECT id FROM products WHERE id = ? AND is_active = 1',
    [productId]
  );

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const [[existing]] = await pool.query(
    'SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?',
    [req.user.id, productId]
  );

  if (existing) {
    await pool.query('DELETE FROM wishlists WHERE id = ?', [existing.id]);
    return res.json({ success: true, added: false, productId });
  }

  await pool.query(
    'INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)',
    [req.user.id, productId]
  );

  res.json({ success: true, added: true, productId });
});

module.exports = { getWishlist, toggleWishlist };
