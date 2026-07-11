const SHIPPING_FREE_THRESHOLD = 999;
const SHIPPING_FEE = 49;

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const calcShipping = (subtotal) =>
  subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;

const tryParse = (val, fallback) => {
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
  } catch {
    return fallback;
  }
};

/**
 * Validate cart lines against DB prices/stock and compute authoritative totals.
 */
async function validateAndPriceItems(pool, items) {
  if (!Array.isArray(items) || !items.length) {
    const err = new Error('Cart is empty');
    err.statusCode = 400;
    throw err;
  }

  let subtotal = 0;
  const enriched = [];

  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity  = Number(item.quantity);

    if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      const err = new Error('Invalid cart item quantity');
      err.statusCode = 400;
      throw err;
    }

    const [[product]] = await pool.query(
      `SELECT id, name, price, stock, sizes, seller_id
       FROM products WHERE id = ? AND is_active = 1`,
      [productId]
    );

    if (!product) {
      const err = new Error(`Product not found: ${productId}`);
      err.statusCode = 400;
      throw err;
    }

    const productSizes = tryParse(product.sizes, []);

    if (productSizes.length > 0 && item.size) {
      const sizeObj = productSizes.find(s =>
        typeof s === 'object' && s !== null
        && s.size?.toLowerCase() === String(item.size).toLowerCase()
      );
      if (sizeObj) {
        if (sizeObj.quantity < quantity) {
          const err = new Error(`${product.name} (Size: ${item.size}) does not have enough stock`);
          err.statusCode = 400;
          throw err;
        }
      } else {
        const isLegacy = productSizes.every(s => typeof s !== 'object');
        if (!isLegacy) {
          const err = new Error(`Size ${item.size} is not available for ${product.name}`);
          err.statusCode = 400;
          throw err;
        }
      }
    }

    if (product.stock < quantity) {
      const err = new Error(`${product.name} is out of stock`);
      err.statusCode = 400;
      throw err;
    }

    const unitPrice = Number(product.price);
    subtotal += unitPrice * quantity;
    enriched.push({
      ...item,
      product_id: productId,
      quantity,
      product,
      price: unitPrice,
    });
  }

  subtotal = roundMoney(subtotal);
  const shipping = calcShipping(subtotal);
  const total    = roundMoney(subtotal + shipping);

  return { subtotal, shipping, total, enriched };
}

module.exports = {
  SHIPPING_FREE_THRESHOLD,
  SHIPPING_FEE,
  roundMoney,
  calcShipping,
  validateAndPriceItems,
  tryParse,
};
