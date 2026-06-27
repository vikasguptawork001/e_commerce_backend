const { pool }         = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

async function resolveProductId(idOrSlug) {
  if (/^\d+$/.test(String(idOrSlug))) {
    return Number(idOrSlug);
  }
  const [[row]] = await pool.query(
    'SELECT id FROM products WHERE slug = ?',
    [idOrSlug]
  );
  if (!row) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  return row.id;
}

/** User must have a delivered order containing this product */
async function assertReviewEligible(userId, productId) {
  const [[row]] = await pool.query(`
    SELECT o.id
    FROM orders o
    INNER JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = ?
      AND oi.product_id = ?
      AND o.status = 'delivered'
    LIMIT 1
  `, [userId, productId]);

  if (!row) {
    const err = new Error(
      'You can only review products from orders that have been delivered.'
    );
    err.statusCode = 403;
    throw err;
  }
}

// GET /api/products/:id/reviews
const getReviews = asyncHandler(async (req, res) => {
  const productId = await resolveProductId(req.params.id);

  const [reviews] = await pool.query(`
    SELECT r.*, u.name AS reviewer_name
    FROM reviews r
    JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `, [productId]);

  res.json({ success: true, reviews });
});

// POST /api/products/:id/reviews
const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const productId = await resolveProductId(req.params.id);
  const userId    = req.user.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5',
    });
  }

  await assertReviewEligible(userId, productId);

  const [[existing]] = await pool.query(
    'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?',
    [productId, userId]
  );

  if (existing) {
    await pool.query(
      'UPDATE reviews SET rating = ?, comment = ? WHERE product_id = ? AND user_id = ?',
      [rating, comment || '', productId, userId]
    );
  } else {
    await pool.query(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?,?,?,?)',
      [productId, userId, rating, comment || '']
    );
  }

  res.json({ success: true, message: 'Review submitted' });
});

// DELETE /api/products/:id/reviews
const deleteReview = asyncHandler(async (req, res) => {
  const productId = await resolveProductId(req.params.id);
  const userId    = req.user.id;

  await pool.query(
    'DELETE FROM reviews WHERE product_id = ? AND user_id = ?',
    [productId, userId]
  );

  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { getReviews, addReview, deleteReview };
