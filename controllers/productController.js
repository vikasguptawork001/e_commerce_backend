const { pool }         = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  uploadBuffer,
  resolveImageToCloudinary,
  resolveImagesToCloudinary,
  isCloudinaryUrl,
} = require('../utils/imageUpload');

const tryParse = (val, fallback) => {
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
  } catch {
    return fallback;
  }
};

const parseSizesInput = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [val];
};

const fixImageUrl = (url) => {
  if (!url) return url;
  if (isCloudinaryUrl(url) || url.startsWith('http')) return url;
  const localhostMatch = url.match(/https?:\/\/[^/]+(\/uploads\/.+)/);
  if (localhostMatch) return localhostMatch[1];
  return url;
};

const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
};

const buildLegacyVariants = (colors, images) => {
  const colorNames = toArray(colors);
  const imgList = Array.isArray(images) ? images : tryParse(images, []);
  return colorNames.map((name, i) => ({
    name,
    images: imgList[i] ? [fixImageUrl(imgList[i])] : [],
  })).filter(v => v.name);
};

const normalizeColorVariants = (variants) => {
  if (!Array.isArray(variants)) return [];
  return variants
    .map(v => {
      const stockNum = v.stock !== undefined && v.stock !== null && v.stock !== ''
        ? Math.max(0, Number(v.stock) || 0)
        : undefined;
      return {
        name: String(v.name || '').trim(),
        images: (Array.isArray(v.images) ? v.images : [])
          .map(fixImageUrl)
          .filter(Boolean)
          .slice(0, 3),
        ...(stockNum !== undefined ? { stock: stockNum } : {}),
      };
    })
    .filter(v => v.name && v.images.length > 0);
};

const sumColorVariantStock = (variants) => {
  if (!Array.isArray(variants) || !variants.length) return null;
  const withStock = variants.filter(v => v.stock !== undefined && v.stock !== null);
  if (!withStock.length) return null;
  return withStock.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
};

const deriveFromVariants = (variants) => {
  const normalized = normalizeColorVariants(variants);
  return {
    color_variants: normalized,
    colors: normalized.map(v => v.name),
    images: normalized.map(v => v.images[0] || ''),
  };
};

const parseColorVariantsInput = async (raw) => {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(parsed)) return null;

  const withUrls = [];
  for (const v of parsed) {
    const name = String(v.name || '').trim();
    if (!name) continue;
    const rawImages = Array.isArray(v.images) ? v.images.filter(Boolean).slice(0, 3) : [];
    const images = rawImages.length
      ? await resolveImagesToCloudinary(rawImages)
      : [];
    if (!images.length) continue;
    const entry = { name, images };
    if (v.stock !== undefined && v.stock !== null && v.stock !== '') {
      entry.stock = Math.max(0, Number(v.stock) || 0);
    }
    withUrls.push(entry);
  }
  return withUrls.length ? withUrls : null;
};

const parseGstPercent = (val, fallback = 5) => {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0 || n > 28) return fallback;
  return Math.round(n * 100) / 100;
};

const parseFreeSize = (val, fallback = true) => {
  if (val === undefined || val === null || val === '') return fallback;
  return val === true || val === 'true' || val === 1 || val === '1';
};

const sanitizeSizesForFreeSize = (sizes, isFreeSize) => {
  if (!Array.isArray(sizes) || !isFreeSize) return sizes;
  return sizes.map(s => {
    if (typeof s === 'object' && s !== null) {
      const { size, quantity } = s;
      return { size, quantity: quantity !== undefined ? Number(quantity) : 0 };
    }
    return s;
  });
};

const parseProduct = (p) => {
  const colors = tryParse(p.colors, []);
  const images = tryParse(p.images, []).map(fixImageUrl);
  let color_variants = tryParse(p.color_variants, null);

  if (!Array.isArray(color_variants) || !color_variants.length) {
    color_variants = buildLegacyVariants(colors, images);
  } else {
    color_variants = normalizeColorVariants(color_variants);
  }

  const derived = deriveFromVariants(color_variants);

  return {
    ...p,
    sizes:  tryParse(p.sizes,  []),
    colors: derived.colors.length ? derived.colors : colors,
    images: derived.images.length ? derived.images : images,
    color_variants,
    tags:   tryParse(p.tags,   []),
    gst_percent: parseGstPercent(p.gst_percent, 5),
    has_disclaimer: p.has_disclaimer === 1 || p.has_disclaimer === true ? 1 : 0,
    is_free_size: p.is_free_size === undefined || p.is_free_size === null
      ? true
      : (p.is_free_size === 1 || p.is_free_size === true),
  };
};

// GET /api/products — paginated with server-side filters
const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    sort,
    category,
    priceMin,
    priceMax,
    rating,
    inStock,
    page = 1,
    limit = 24,
  } = req.query;

  const pageNum  = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 24));
  const offset   = (pageNum - 1) * limitNum;

  const where  = ['p.is_active = 1'];
  const params = [];
  const having = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.tags LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  if (category && category !== 'all') {
    where.push('c.slug = ?');
    params.push(category);
  }

  if (priceMin !== undefined && priceMin !== '' && !Number.isNaN(Number(priceMin))) {
    where.push('p.price >= ?');
    params.push(Number(priceMin));
  }

  if (priceMax !== undefined && priceMax !== '' && !Number.isNaN(Number(priceMax))) {
    where.push('p.price <= ?');
    params.push(Number(priceMax));
  }

  if (inStock === '1' || inStock === 'true') {
    where.push('p.stock > 0');
  }

  const minRating = Number(rating);
  if (minRating > 0) {
    having.push('COALESCE(AVG(r.rating), 0) >= ?');
    params.push(minRating);
  }

  const orderMap = {
    'price-asc':  'p.price ASC',
    'price-desc': 'p.price DESC',
    'rating':     'avg_rating DESC',
    'discount':   '((p.original_price - p.price) / NULLIF(p.original_price, 0)) DESC',
    'newest':     'p.created_at DESC',
    'default':    'p.created_at DESC',
  };
  const orderBy = orderMap[sort] || orderMap.newest;

  const whereStr  = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const havingStr = having.length ? `HAVING ${having.join(' AND ')}` : '';

  const baseFrom = `
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON sp.user_id = u.id
    LEFT JOIN reviews r ON r.product_id = p.id
    ${whereStr}
    GROUP BY p.id
    ${havingStr}
  `;

  const [rows] = await pool.query(`
    SELECT p.*,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COALESCE(c.slug, '') AS category_slug,
      u.name AS seller_name,
      sp.shop_name,
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(DISTINCT r.id) AS rating_count
    ${baseFrom}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total FROM (
      SELECT p.id ${baseFrom}
    ) AS filtered_products
  `, params);

  res.json({
    success: true,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    products: rows.map(parseProduct),
  });
});

// GET /api/products/:slugOrId
const getProduct = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const isNumeric = /^\d+$/.test(param);
  const whereClause = isNumeric
    ? 'p.id = ? AND p.is_active = 1'
    : 'p.slug = ? AND p.is_active = 1';

  const [[product]] = await pool.query(`
    SELECT p.*,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COALESCE(c.slug, '') AS category_slug,
      u.name AS seller_name,
      sp.shop_name,
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(DISTINCT r.id) AS rating_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN seller_profiles sp ON sp.user_id = u.id
    LEFT JOIN reviews r ON r.product_id = p.id
    WHERE ${whereClause}
    GROUP BY p.id
  `, [param]);

  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const [reviews] = await pool.query(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 10', [product.id]
  );

  res.json({ success: true, product: parseProduct(product), reviews });
});

// GET /api/seller/products
const getSellerProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user.role === 'admin' ? (req.query.seller_id || null) : req.user.id;
  const where  = sellerId ? 'WHERE p.seller_id = ?' : '';
  const params = sellerId ? [sellerId] : [];

  const [rows] = await pool.query(`
    SELECT p.*,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(DISTINCT r.id) AS rating_count,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) AS total_sold
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN reviews r ON r.product_id = p.id
    ${where}
    GROUP BY p.id ORDER BY p.created_at DESC
  `, params);

  res.json({ success: true, products: rows.map(parseProduct) });
});

// POST /api/seller/products
const createProduct = asyncHandler(async (req, res) => {
  const {
    name, description, brand, price, original_price,
    stock, category_id, sizes, colors, tags, has_disclaimer,
    hsn_code, gst_percent, color_variants, is_free_size,
  } = req.body;

  if (!name || !price || !original_price || !category_id) {
    return res.status(400).json({ success: false, message: 'name, price, original_price, and category_id are required' });
  }

  let images = [];
  let colorsArr = [];
  let variantsJson = null;

  const parsedVariants = await parseColorVariantsInput(color_variants);
  if (parsedVariants) {
    const derived = deriveFromVariants(parsedVariants);
    images = derived.images;
    colorsArr = derived.colors;
    variantsJson = JSON.stringify(derived.color_variants);
  } else if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(req.files.map(f => uploadBuffer(f.buffer)));
    images = uploaded.map(r => r.secure_url);
  } else if (req.body.images) {
    const raw = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    images = await resolveImagesToCloudinary(raw.filter(Boolean));
  }

  if (!parsedVariants) {
    colorsArr = toArray(colors);
    if (colorsArr.length && images.length) {
      const legacy = deriveFromVariants(buildLegacyVariants(colorsArr, images));
      variantsJson = JSON.stringify(legacy.color_variants);
    }
  }

  const gstVal = parseGstPercent(gst_percent, 5);
  const freeSizeVal = parseFreeSize(is_free_size, true) ? 1 : 0;

  const sizesParsed = sanitizeSizesForFreeSize(parseSizesInput(sizes), freeSizeVal === 1);
  let totalStock = Number(stock) || 0;
  if (sizesParsed.length > 0 && sizesParsed.some(s => typeof s === 'object' && s !== null)) {
    totalStock = sizesParsed.reduce((sum, s) => sum + (s.quantity !== undefined ? Number(s.quantity) : 0), 0);
  } else {
    const colorStock = sumColorVariantStock(parsedVariants);
    if (colorStock !== null) totalStock = colorStock;
  }

  const toArrayLegacy = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  const disclaimerVal = (has_disclaimer === '1' || has_disclaimer === 1 || has_disclaimer === true) ? 1 : 0;

  const [result] = await pool.query(`
    INSERT INTO products
      (seller_id, category_id, name, description, brand, price, original_price,
       stock, sizes, colors, images, tags, has_disclaimer, hsn_code, gst_percent, color_variants, is_free_size)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    req.user.id, category_id, name, description || '', brand || '',
    price, original_price, totalStock,
    JSON.stringify(sizesParsed),
    JSON.stringify(colorsArr.length ? colorsArr : toArrayLegacy(colors)),
    JSON.stringify(images),
    JSON.stringify(toArrayLegacy(tags)),
    disclaimerVal,
    hsn_code || null,
    gstVal,
    variantsJson,
    freeSizeVal,
  ]);

  const newId = result.insertId;
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '-' + newId;

  await pool.query('UPDATE products SET slug = ? WHERE id = ?', [slug, newId]);

  const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [newId]);
  res.status(201).json({ success: true, product: parseProduct(product) });
});

// PUT /api/seller/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);

  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (req.user.role !== 'admin' && product.seller_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'This is not your product' });
  }

  const {
    name, description, brand, price, original_price,
    stock, category_id, sizes, colors, tags, is_active, has_disclaimer,
    hsn_code, gst_percent, color_variants, is_free_size,
  } = req.body;

  let sizesParsed;
  let stockVal = product.stock;

  if (sizes !== undefined) {
    sizesParsed = parseSizesInput(sizes);
    if (sizesParsed.length > 0 && sizesParsed.some(s => typeof s === 'object' && s !== null)) {
      stockVal = sizesParsed.reduce((sum, s) => sum + (s.quantity !== undefined ? Number(s.quantity) : 0), 0);
    } else {
      stockVal = (stock !== undefined && stock !== '' && stock !== null)
        ? Number(stock)
        : Number(product.stock);
    }
  } else {
    sizesParsed = tryParse(product.sizes, []);
    const hasSizeObjs = sizesParsed.length > 0 && sizesParsed.some(s => typeof s === 'object' && s !== null);
    if (hasSizeObjs) {
      stockVal = sizesParsed.reduce((sum, s) => sum + (s.quantity !== undefined ? Number(s.quantity) : 0), 0);
    } else {
      stockVal = (stock !== undefined && stock !== '' && stock !== null)
        ? Number(stock)
        : Number(product.stock);
    }
  }

  let images = tryParse(product.images, []);
  let colorsArr = tryParse(product.colors, []);
  let variantsJson = product.color_variants;

  const parsedVariants = await parseColorVariantsInput(color_variants);
  if (parsedVariants) {
    const derived = deriveFromVariants(parsedVariants);
    images = derived.images;
    colorsArr = derived.colors;
    variantsJson = JSON.stringify(derived.color_variants);

    const hasSizeObjs = sizesParsed.length > 0 && sizesParsed.some(s => typeof s === 'object' && s !== null);
    if (!hasSizeObjs) {
      const colorStock = sumColorVariantStock(parsedVariants);
      if (colorStock !== null) stockVal = colorStock;
    }
  } else if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(req.files.map(f => uploadBuffer(f.buffer)));
    images = uploaded.map(r => r.secure_url);
  } else if (req.body.images) {
    const raw = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    images = await resolveImagesToCloudinary(raw.filter(Boolean));
  }

  const gstVal = gst_percent !== undefined && gst_percent !== ''
    ? parseGstPercent(gst_percent, parseGstPercent(product.gst_percent, 5))
    : parseGstPercent(product.gst_percent, 5);

  let isActiveVal = product.is_active;
  if (is_active !== undefined && is_active !== null && is_active !== '') {
    isActiveVal = (is_active === true || is_active === 'true' || is_active === 1 || is_active === '1') ? 1 : 0;
  }

  let disclaimerVal = product.has_disclaimer;
  if (has_disclaimer !== undefined && has_disclaimer !== null && has_disclaimer !== '') {
    disclaimerVal = (has_disclaimer === '1' || has_disclaimer === 1 || has_disclaimer === true) ? 1 : 0;
  }

  let freeSizeVal = product.is_free_size === undefined || product.is_free_size === null
    ? 1
    : (product.is_free_size === 1 || product.is_free_size === true ? 1 : 0);
  if (is_free_size !== undefined && is_free_size !== null && is_free_size !== '') {
    freeSizeVal = parseFreeSize(is_free_size, true) ? 1 : 0;
  }

  if (sizesParsed) {
    sizesParsed = sanitizeSizesForFreeSize(sizesParsed, freeSizeVal === 1);
  }

  const updatedName = name || product.name;
  const newSlug = updatedName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '-' + id;

  await pool.query(`
    UPDATE products SET
      name = ?, description = ?, brand = ?, price = ?,
      original_price = ?, stock = ?, category_id = ?,
      sizes = ?, colors = ?, images = ?, tags = ?,
      is_active = ?, slug = ?, has_disclaimer = ?,
      hsn_code = ?, gst_percent = ?, color_variants = ?, is_free_size = ?
    WHERE id = ?
  `, [
    updatedName,
    description    ?? product.description,
    brand          ?? product.brand,
    price          || product.price,
    original_price || product.original_price,
    stockVal,
    category_id    || product.category_id,
    JSON.stringify(sizesParsed),
    JSON.stringify(Array.isArray(colors) ? toArray(colors) : colorsArr),
    JSON.stringify(images),
    JSON.stringify(Array.isArray(tags)   ? tags   : tryParse(product.tags,   [])),
    isActiveVal,
    newSlug,
    disclaimerVal,
    hsn_code !== undefined ? hsn_code : product.hsn_code,
    gstVal,
    parsedVariants ? variantsJson : (variantsJson || null),
    freeSizeVal,
    id,
  ]);

  const [[updated]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  res.json({ success: true, product: parseProduct(updated) });
});

// DELETE /api/seller/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (req.user.role !== 'admin' && product.seller_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'This is not your product' });
  }

  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Product deleted successfully' });
});

// GET /api/seller/analytics
const getSellerAnalytics = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  const [[stats]] = await pool.query(`
    SELECT COUNT(DISTINCT p.id) AS total_products,
      COALESCE(SUM(oi.price * oi.quantity), 0) AS total_revenue,
      COUNT(DISTINCT oi.order_id) AS total_orders,
      COALESCE(SUM(oi.quantity), 0) AS total_units_sold
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    WHERE p.seller_id = ?
  `, [sellerId]);

  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month,
      SUM(oi.price * oi.quantity) AS revenue, COUNT(DISTINCT o.id) AS orders
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ? AND o.status != 'cancelled'
      AND o.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month ORDER BY month ASC
  `, [sellerId]);

  const [topProducts] = await pool.query(`
    SELECT p.id, p.name, p.price, p.images,
      SUM(oi.quantity) AS units_sold, SUM(oi.price * oi.quantity) AS revenue
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.seller_id = ?
    GROUP BY p.id ORDER BY units_sold DESC LIMIT 5
  `, [sellerId]);

  const [statusBreakdown] = await pool.query(`
    SELECT o.status, COUNT(DISTINCT o.id) AS count
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.seller_id = ? GROUP BY o.status
  `, [sellerId]);

  res.json({
    success: true, stats, monthly,
    topProducts: topProducts.map(p => ({ ...p, images: tryParse(p.images, []).map(fixImageUrl) })),
    statusBreakdown,
  });
});

// PATCH /api/admin/products/:id/toggle-stock
const toggleStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[product]] = await pool.query('SELECT id, stock, sizes FROM products WHERE id = ?', [id]);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  const newStock = product.stock > 0 ? 0 : 10;
  
  let updatedSizes = [];
  const productSizes = tryParse(product.sizes, []);
  if (productSizes.length > 0) {
    updatedSizes = productSizes.map(s => {
      if (typeof s === 'object' && s !== null) {
        return {
          ...s,
          quantity: newStock === 0 ? 0 : 5
        };
      }
      return s;
    });
  }
  
  if (productSizes.length > 0 && productSizes.some(s => typeof s === 'object' && s !== null)) {
    await pool.query('UPDATE products SET stock = ?, sizes = ? WHERE id = ?', [newStock, JSON.stringify(updatedSizes), id]);
  } else {
    await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
  }
  
  res.json({
    success: true,
    message: newStock === 0 ? 'Product marked as Out of Stock' : 'Product marked as In Stock',
    stock: newStock,
  });
});

module.exports = {
  getProducts, getProduct, getSellerProducts,
  createProduct, updateProduct, deleteProduct,
  getSellerAnalytics, toggleStock,
};