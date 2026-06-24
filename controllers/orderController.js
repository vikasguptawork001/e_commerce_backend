const { pool }         = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const Razorpay         = require('razorpay');
const crypto           = require('crypto');
const nodemailer       = require('nodemailer');

const tryParse = (val, fallback) => {
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
  } catch {
    return fallback;
  }
};

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────
// Email Transporter — FIXED
// ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  tls:    { rejectUnauthorized: false },
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Startup pe verify karo
transporter.verify((error) => {
  if (error) console.error('❌ Email transporter error:', error.message);
  else       console.log('✅ Email transporter ready!');
});

// ─────────────────────────────────────────
// Admin Notification Email
// ─────────────────────────────────────────
const sendAdminOrderNotification = async ({ orderId, customer_name, customer_email, customer_phone, items, total, address, paymentId }) => {
  const itemRows = items.map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
        <strong>${i.product_name}</strong>
        ${i.color ? `<br/><span style="font-size:12px;color:#888;">Color: ${i.color}</span>` : ''}
        ${i.size  ? `<br/><span style="font-size:12px;color:#888;">Size: ${i.size}</span>`   : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#555;">${i.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#FF3E6C;">
        Rs.${(i.price * i.quantity).toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;text-align:center;">
        <div style="font-size:44px;margin-bottom:8px;">🛒</div>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">New Order Received!</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">
          Order #${orderId} — Admin Notification
        </p>
      </div>

      <!-- Order Info -->
      <div style="background:#FFF0F4;padding:20px 32px;border-bottom:1px solid #ffe0e8;">
        <table style="width:100%;">
          <tr>
            <td>
              <p style="margin:0;font-size:13px;color:#888;">Order ID</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#FF3E6C;">#${orderId}</p>
            </td>
            <td style="text-align:center;">
              <p style="margin:0;font-size:13px;color:#888;">Total Amount</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#333;">Rs.${Number(total).toLocaleString('en-IN')}</p>
            </td>
            <td style="text-align:right;">
              <p style="margin:0;font-size:13px;color:#888;">Payment</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0A7D56;">✅ Paid</p>
            </td>
          </tr>
        </table>
        ${paymentId ? `<p style="margin:12px 0 0;font-size:12px;color:#aaa;">Payment ID: ${paymentId}</p>` : ''}
      </div>

      <div style="padding:32px;">

        <!-- Customer Info -->
        <h3 style="font-size:15px;color:#333;margin:0 0 12px;">👤 Customer Details</h3>
        <div style="background:#f8f8f8;padding:16px;border-radius:10px;font-size:13px;color:#555;line-height:2;border-left:3px solid #FF3E6C;margin:0 0 24px;">
          <strong>Name:</strong> ${customer_name}<br/>
          <strong>Email:</strong> <a href="mailto:${customer_email}" style="color:#FF3E6C;">${customer_email}</a><br/>
          ${customer_phone ? `<strong>Phone:</strong> ${customer_phone}<br/>` : ''}
          <strong>Address:</strong> ${address}
        </div>

        <!-- Items Table -->
        <h3 style="font-size:15px;color:#333;margin:0 0 12px;">🛍️ Order Items</h3>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Product</th>
              <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Qty</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr style="background:#FFF0F4;">
              <td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px;color:#333;">Total:</td>
              <td style="padding:14px 16px;text-align:right;font-weight:700;font-size:17px;color:#FF3E6C;">
                Rs.${Number(total).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Action Button -->
        <div style="text-align:center;margin:28px 0 0;">
          <a href="http://localhost:3000/admin"
            style="display:inline-block;background:linear-gradient(135deg,#FF3E6C,#ff6b9d);color:#fff;padding:14px 32px;border-radius:25px;font-size:15px;font-weight:700;text-decoration:none;">
            🔧 View in Admin Dashboard →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#bbb;">
          &copy; 2026 E-Commerce Store — Admin Notification<br/>
          Auto-sent to ${process.env.GMAIL_USER}
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from:    `"E-Commerce Store" <${process.env.GMAIL_USER}>`,
    to:      process.env.GMAIL_USER,
    subject: `🛒 New Order #${orderId} — Rs.${Number(total).toLocaleString('en-IN')} — ${customer_name}`,
    html,
  });
};

// ─────────────────────────────────────────
// User Order Confirmation Email
// ─────────────────────────────────────────
const sendOrderConfirmationEmail = async ({ to, name, orderId, items, total, address, paymentId }) => {
  const itemRows = items.map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
        <strong>${i.product_name || i.name}</strong>
        ${i.color ? `<br/><span style="font-size:12px;color:#888;">Color: ${i.color}</span>` : ''}
        ${i.size  ? `<br/><span style="font-size:12px;color:#888;">Size: ${i.size}</span>`   : ''}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#555;">${i.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#FF3E6C;">
        Rs.${(i.price * i.quantity).toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#FF3E6C 0%,#ff6b9d 100%);padding:36px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">🎉</div>
        <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">Order Confirmed!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">
          Thank you for shopping with us, ${name}!
        </p>
      </div>

      <!-- Order Info -->
      <div style="background:#FFF0F4;padding:20px 32px;border-bottom:1px solid #ffe0e8;">
        <table style="width:100%;">
          <tr>
            <td>
              <p style="margin:0;font-size:13px;color:#888;">Order ID</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#FF3E6C;">#${orderId}</p>
            </td>
            <td style="text-align:center;">
              <p style="margin:0;font-size:13px;color:#888;">Status</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0A7D56;">✅ Confirmed</p>
            </td>
            <td style="text-align:right;">
              <p style="margin:0;font-size:13px;color:#888;">Total Paid</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#333;">Rs.${Number(total).toLocaleString('en-IN')}</p>
            </td>
          </tr>
        </table>
        ${paymentId ? `<p style="margin:12px 0 0;font-size:12px;color:#aaa;">Payment ID: ${paymentId}</p>` : ''}
      </div>

      <div style="padding:32px;">
        <p style="font-size:15px;color:#333;margin:0 0 8px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
          Your order has been successfully placed and payment is confirmed.
          We will notify you at this email for every update. 🚚
        </p>

        <!-- Order Journey -->
        <h3 style="font-size:15px;color:#333;margin:0 0 16px;">📍 Order Journey</h3>
        <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
          <tr>
            <td style="text-align:center;width:33%;">
              <div style="width:40px;height:40px;background:#FF3E6C;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">✅</div>
              <p style="margin:6px 0 0;font-size:12px;font-weight:700;color:#FF3E6C;">Confirmed</p>
            </td>
            <td style="padding-bottom:20px;">
              <div style="height:2px;background:#e0e0e0;"></div>
            </td>
            <td style="text-align:center;width:33%;">
              <div style="width:40px;height:40px;background:#e0e0e0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;">🚚</div>
              <p style="margin:6px 0 0;font-size:12px;color:#aaa;">Shipped</p>
            </td>
            <td style="padding-bottom:20px;">
              <div style="height:2px;background:#e0e0e0;"></div>
            </td>
            <td style="text-align:center;width:33%;">
              <div style="width:40px;height:40px;background:#e0e0e0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;">📦</div>
              <p style="margin:6px 0 0;font-size:12px;color:#aaa;">Delivered</p>
            </td>
          </tr>
        </table>

        <!-- Items -->
        <h3 style="font-size:15px;color:#333;margin:0 0 12px;">🛍️ Order Items</h3>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
          <thead>
            <tr style="background:#f8f8f8;">
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Product</th>
              <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Qty</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr style="background:#FFF0F4;">
              <td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px;color:#333;">Total Paid:</td>
              <td style="padding:14px 16px;text-align:right;font-weight:700;font-size:17px;color:#FF3E6C;">
                Rs.${Number(total).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Address -->
        <h3 style="font-size:15px;color:#333;margin:24px 0 10px;">📍 Delivery Address</h3>
        <div style="background:#f8f8f8;padding:16px;border-radius:10px;font-size:13px;color:#555;line-height:1.8;border-left:3px solid #FF3E6C;">
          ${address}
        </div>

        <!-- Email Updates -->
        <div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:10px;padding:16px;margin:24px 0 0;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#1565C0;">📧 You will receive emails for:</p>
          <ul style="margin:10px 0 0;padding-left:20px;font-size:13px;color:#555;line-height:2;">
            <li>✅ <strong>Order Confirmed</strong> — Yeh email</li>
            <li>🚚 <strong>Order Shipped</strong> — Jab ship ho</li>
            <li>🎉 <strong>Order Delivered</strong> — Jab deliver ho</li>
            <li>❌ <strong>Order Cancelled</strong> — Agar cancel ho</li>
          </ul>
        </div>

        <p style="font-size:13px;color:#aaa;margin-top:24px;line-height:1.6;">
          Need help? Contact us at
          <a href="mailto:${process.env.GMAIL_USER}" style="color:#FF3E6C;text-decoration:none;">
            ${process.env.GMAIL_USER}
          </a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#bbb;">
          &copy; 2026 E-Commerce Store. All rights reserved.<br/>
          This email was sent to ${to}
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from:    `"E-Commerce Store" <${process.env.GMAIL_USER}>`,
    to,
    subject: `🎉 Order Confirmed #${orderId} - Your order is placed!`,
    html,
  });
};

// ─────────────────────────────────────────
// Status Update Email
// ─────────────────────────────────────────
const sendStatusUpdateEmail = async ({ to, name, orderId, status, address }) => {
  const statusConfig = {
    confirmed: {
      emoji: '✅', label: 'Order Confirmed', color: '#0A7D56', bg: '#E6FBF4',
      msg: 'Your order has been confirmed and is being prepared for shipment.',
      next: 'We will notify you when your order is shipped.',
      steps: { confirmed: true, shipped: false, delivered: false },
    },
    shipped: {
      emoji: '🚚', label: 'Order Shipped', color: '#1565C0', bg: '#E3F2FD',
      msg: 'Great news! Your order is on its way to you.',
      next: 'You will receive another email once your order is delivered.',
      steps: { confirmed: true, shipped: true, delivered: false },
    },
    delivered: {
      emoji: '🎉', label: 'Order Delivered', color: '#6A1B9A', bg: '#F3E5F5',
      msg: 'Your order has been successfully delivered. We hope you love your purchase!',
      next: 'Please leave a review on the product page. Your feedback helps others!',
      steps: { confirmed: true, shipped: true, delivered: true },
    },
    cancelled: {
      emoji: '❌', label: 'Order Cancelled', color: '#C62828', bg: '#FFEBEE',
      msg: 'Your order has been cancelled as requested.',
      next: 'If payment was made, refund will be processed within 5-7 business days.',
      steps: { confirmed: false, shipped: false, delivered: false },
    },
  };

  const info = statusConfig[status] || {
    emoji: '📦', label: status, color: '#333', bg: '#f8f8f8',
    msg: 'Your order status has been updated.',
    next: 'Login to your account to check the latest status.',
    steps: { confirmed: false, shipped: false, delivered: false },
  };

  const stepDot = (done, icon, label) => `
    <td style="text-align:center;width:25%;">
      <div style="width:36px;height:36px;background:${done ? '#FF3E6C' : '#e0e0e0'};border-radius:50%;
           display:inline-flex;align-items:center;justify-content:center;font-size:16px;
           color:${done ? '#fff' : '#bbb'};">${done ? '✓' : icon}</div>
      <p style="margin:6px 0 0;font-size:11px;font-weight:${done ? '700' : '400'};
         color:${done ? '#FF3E6C' : '#aaa'};">${label}</p>
    </td>
  `;

  const isCancelled = status === 'cancelled';

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <div style="background:linear-gradient(135deg,#FF3E6C 0%,#ff6b9d 100%);padding:36px 32px;text-align:center;">
        <div style="font-size:52px;margin-bottom:8px;">${info.emoji}</div>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">${info.label}</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Order #${orderId}</p>
      </div>

      <div style="background:${info.bg};padding:16px 32px;border-bottom:1px solid #f0f0f0;text-align:center;">
        <p style="margin:0;font-size:15px;color:${info.color};font-weight:700;">
          ${info.emoji} Status: <span style="text-transform:capitalize;">${status}</span>
        </p>
      </div>

      <div style="padding:32px;">
        <p style="font-size:15px;color:#333;margin:0 0 8px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">${info.msg}</p>

        <div style="background:#f8f8f8;border-left:4px solid ${info.color};padding:16px;border-radius:8px;margin:0 0 24px;">
          <p style="margin:0;font-size:14px;color:#333;">
            <strong>Order ID:</strong>
            <span style="color:#FF3E6C;font-size:16px;font-weight:700;"> #${orderId}</span>
          </p>
          <p style="margin:6px 0 0;font-size:14px;color:#333;">
            <strong>Status:</strong>
            <span style="color:${info.color};font-weight:700;text-transform:capitalize;"> ${status}</span>
          </p>
        </div>

        ${!isCancelled ? `
        <h3 style="font-size:15px;color:#333;margin:0 0 16px;">📍 Order Tracking</h3>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
          <tr>
            ${stepDot(info.steps.confirmed, '✅', 'Confirmed')}
            <td style="text-align:center;padding:0 2px;padding-bottom:24px;">
              <div style="height:2px;background:${info.steps.shipped ? '#FF3E6C' : '#e0e0e0'};"></div>
            </td>
            ${stepDot(info.steps.shipped, '🚚', 'Shipped')}
            <td style="text-align:center;padding:0 2px;padding-bottom:24px;">
              <div style="height:2px;background:${info.steps.delivered ? '#FF3E6C' : '#e0e0e0'};"></div>
            </td>
            ${stepDot(info.steps.delivered, '📦', 'Delivered')}
          </tr>
        </table>
        ` : `
        <div style="background:#FFEBEE;border:1px solid #EF9A9A;border-radius:10px;padding:16px;margin:0 0 24px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#C62828;font-weight:600;">❌ This order has been cancelled</p>
        </div>
        `}

        <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:10px;padding:16px;margin:0 0 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#856404;">💡 What's next?</p>
          <p style="margin:6px 0 0;font-size:13px;color:#666;line-height:1.6;">${info.next}</p>
        </div>

        ${address ? `
        <h3 style="font-size:15px;color:#333;margin:0 0 10px;">📍 Delivery Address</h3>
        <div style="background:#f8f8f8;padding:14px 16px;border-radius:10px;font-size:13px;color:#555;line-height:1.8;border-left:3px solid #FF3E6C;margin:0 0 24px;">
          ${address}
        </div>
        ` : ''}

        <p style="font-size:13px;color:#aaa;margin:0;line-height:1.6;">
          Need help? Contact us at
          <a href="mailto:${process.env.GMAIL_USER}" style="color:#FF3E6C;text-decoration:none;">
            ${process.env.GMAIL_USER}
          </a>
        </p>
      </div>

      <div style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:12px;color:#bbb;">
          &copy; 2026 E-Commerce Store. All rights reserved.<br/>
          This email was sent to ${to}
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from:    `"E-Commerce Store" <${process.env.GMAIL_USER}>`,
    to,
    subject: `${info.emoji} Order #${orderId} - ${info.label}`,
    html,
  });
};

// ─────────────────────────────────────────
// POST /api/orders/create-razorpay-order
// ─────────────────────────────────────────
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', receipt } = req.body;
  if (!amount) return res.status(400).json({ success: false, message: 'Amount is required' });

  const order = await razorpay.orders.create({
    amount:  Math.round(amount * 100),
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
  });

  res.json({
    success:  true,
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    key:      process.env.RAZORPAY_KEY_ID,
  });
});

// ─────────────────────────────────────────
// POST /api/orders/verify-payment
// ─────────────────────────────────────────
const verifyAndPlaceOrder = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    customer_name, customer_email, customer_phone,
    address, items,
  } = req.body;

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  if (!customer_name || !customer_email || !address || !items?.length) {
    return res.status(400).json({ success: false, message: 'Order details incomplete' });
  }

  let total = 0;
  const enriched = [];

  for (const item of items) {
    const [[product]] = await pool.query(
      'SELECT id, name, price, stock, sizes, seller_id FROM products WHERE id = ? AND is_active = 1',
      [item.product_id]
    );
    if (!product) return res.status(400).json({ success: false, message: `Product not found: ${item.product_id}` });
    
    // Size-wise stock check
    const productSizes = tryParse(product.sizes, []);
    if (productSizes.length > 0 && item.size) {
      const sizeObj = productSizes.find(s => 
        typeof s === 'object' && s !== null && s.size?.toLowerCase() === item.size.toLowerCase()
      );
      if (sizeObj) {
        if (sizeObj.quantity < item.quantity) {
          return res.status(400).json({ success: false, message: `${product.name} (Size: ${item.size}) does not have enough stock` });
        }
      } else {
        const isLegacy = productSizes.every(s => typeof s !== 'object');
        if (!isLegacy) {
          return res.status(400).json({ success: false, message: `Size ${item.size} is not available for ${product.name}` });
        }
      }
    }

    if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
    total += product.price * item.quantity;
    enriched.push({ ...item, product, price: product.price });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRes] = await conn.query(`
      INSERT INTO orders
        (customer_id, customer_name, customer_email, customer_phone,
         address, total_amount, payment_method, payment_status, status, notes)
      VALUES (?,?,?,?,?,?,'Razorpay','paid','confirmed',?)
    `, [
      req.user?.id || null,
      customer_name, customer_email, customer_phone || null,
      address, total,
      `Razorpay Order: ${razorpay_order_id} | Payment: ${razorpay_payment_id}`,
    ]);

    const orderId = orderRes.insertId;

    for (const item of enriched) {
      await conn.query(`
        INSERT INTO order_items
          (order_id, product_id, seller_id, product_name, price, quantity, size, color)
        VALUES (?,?,?,?,?,?,?,?)
      `, [orderId, item.product.id, item.product.seller_id, item.product.name,
          item.price, item.quantity, item.size || null, item.color || null]);

      // Deduct size-wise stock
      const productSizes = tryParse(item.product.sizes, []);
      let updatedSizes = productSizes;
      let hasUpdatedSizeStock = false;
      
      if (productSizes.length > 0 && item.size) {
        updatedSizes = productSizes.map(s => {
          if (typeof s === 'object' && s !== null && s.size?.toLowerCase() === item.size.toLowerCase()) {
            hasUpdatedSizeStock = true;
            return {
              ...s,
              quantity: Math.max(0, s.quantity - item.quantity)
            };
          }
          return s;
        });
      }
      
      if (hasUpdatedSizeStock) {
        await conn.query('UPDATE products SET stock = stock - ?, sizes = ? WHERE id = ?',
          [item.quantity, JSON.stringify(updatedSizes), item.product.id]);
      } else {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product.id]);
      }
    }

    await conn.commit();

    const emailItems = enriched.map(i => ({
      product_name: i.product.name,
      quantity:     i.quantity,
      size:         i.size  || null,
      color:        i.color || null,
      price:        i.price,
    }));

    // ✅ User ko confirmation email
    sendOrderConfirmationEmail({
      to: customer_email, name: customer_name,
      orderId, items: emailItems, total, address,
      paymentId: razorpay_payment_id,
    }).catch(err => console.error('User confirmation email error:', err));

    // ✅ Admin ko notification email
    sendAdminOrderNotification({
      orderId, customer_name, customer_email,
      customer_phone, items: emailItems, total, address,
      paymentId: razorpay_payment_id,
    }).catch(err => console.error('Admin notification email error:', err));

    res.status(201).json({
      success: true, orderId, total,
      paymentId: razorpay_payment_id,
      message: 'Order placed successfully!',
    });

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────
// GET /api/user/orders
// ─────────────────────────────────────────
const getUserOrders = asyncHandler(async (req, res) => {
  const [orders] = await pool.query(`
    SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
           o.address, o.total_amount, o.status, o.payment_method,
           o.payment_status, o.notes, o.created_at
    FROM orders o WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `, [req.user.id]);

  for (const order of orders) {
    const [items] = await pool.query(`
      SELECT oi.*, p.images AS product_images, p.hsn_code
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [order.id]);

    order.items = items.map(item => {
      let image = '';
      try {
        const raw  = item.product_images;
        const imgs = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
        image = imgs[0] || '';
      } catch { image = ''; }
      const { product_images, ...rest } = item;
      return { ...rest, image, hsn_code: item.hsn_code };
    });
  }

  res.json({ success: true, orders });
});

// ─────────────────────────────────────────
// POST /api/orders (legacy COD)
// ─────────────────────────────────────────
const placeOrder = asyncHandler(async (req, res) => {
  const { customer_name, customer_email, customer_phone, address, items, payment_method = 'COD', notes } = req.body;

  if (!customer_name || !customer_email || !address || !items?.length) {
    return res.status(400).json({ success: false, message: 'Required fields missing' });
  }

  let total = 0;
  const enriched = [];

  for (const item of items) {
    const [[product]] = await pool.query(
      'SELECT id, name, price, stock, sizes, seller_id FROM products WHERE id = ? AND is_active = 1',
      [item.product_id]
    );
    if (!product) return res.status(400).json({ success: false, message: 'Product not found' });
    
    // Size-wise stock check
    const productSizes = tryParse(product.sizes, []);
    if (productSizes.length > 0 && item.size) {
      const sizeObj = productSizes.find(s => 
        typeof s === 'object' && s !== null && s.size?.toLowerCase() === item.size.toLowerCase()
      );
      if (sizeObj) {
        if (sizeObj.quantity < item.quantity) {
          return res.status(400).json({ success: false, message: `${product.name} (Size: ${item.size}) does not have enough stock` });
        }
      } else {
        const isLegacy = productSizes.every(s => typeof s !== 'object');
        if (!isLegacy) {
          return res.status(400).json({ success: false, message: `Size ${item.size} is not available for ${product.name}` });
        }
      }
    }

    if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
    total += product.price * item.quantity;
    enriched.push({ ...item, product, price: product.price });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRes] = await conn.query(`
      INSERT INTO orders
        (customer_id, customer_name, customer_email, customer_phone,
         address, total_amount, payment_method, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `, [req.user?.id || null, customer_name, customer_email,
        customer_phone || null, address, total, payment_method, notes || null]);

    const orderId = orderRes.insertId;

    for (const item of enriched) {
      await conn.query(`
        INSERT INTO order_items
          (order_id, product_id, seller_id, product_name, price, quantity, size, color)
        VALUES (?,?,?,?,?,?,?,?)
      `, [orderId, item.product.id, item.product.seller_id, item.product.name,
          item.price, item.quantity, item.size || null, item.color || null]);

      // Deduct size-wise stock
      const productSizes = tryParse(item.product.sizes, []);
      let updatedSizes = productSizes;
      let hasUpdatedSizeStock = false;
      
      if (productSizes.length > 0 && item.size) {
        updatedSizes = productSizes.map(s => {
          if (typeof s === 'object' && s !== null && s.size?.toLowerCase() === item.size.toLowerCase()) {
            hasUpdatedSizeStock = true;
            return {
              ...s,
              quantity: Math.max(0, s.quantity - item.quantity)
            };
          }
          return s;
        });
      }
      
      if (hasUpdatedSizeStock) {
        await conn.query('UPDATE products SET stock = stock - ?, sizes = ? WHERE id = ?',
          [item.quantity, JSON.stringify(updatedSizes), item.product.id]);
      } else {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product.id]);
      }
    }

    await conn.commit();

    const emailItems = enriched.map(i => ({
      product_name: i.product.name,
      quantity:     i.quantity,
      size:         i.size  || null,
      color:        i.color || null,
      price:        i.price,
    }));

    // ✅ User ko email
    sendOrderConfirmationEmail({
      to: customer_email, name: customer_name,
      orderId, items: emailItems, total, address, paymentId: null,
    }).catch(err => console.error('User order email error:', err));

    // ✅ Admin ko email
    sendAdminOrderNotification({
      orderId, customer_name, customer_email,
      customer_phone, items: emailItems, total, address, paymentId: null,
    }).catch(err => console.error('Admin order email error:', err));

    res.status(201).json({ success: true, orderId, total, message: 'Order placed successfully!' });

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────
// GET /api/seller/orders
// ─────────────────────────────────────────
const getSellerOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset   = (Number(page) - 1) * Number(limit);
  const sellerId = req.user.id;
  let where    = 'WHERE oi.seller_id = ?';
  const params = [sellerId];
  if (status) { where += ' AND o.status = ?'; params.push(status); }

  const [orders] = await pool.query(`
    SELECT DISTINCT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.address, o.total_amount, o.status, o.payment_method, o.payment_status, o.created_at,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND seller_id = ?) AS item_count
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `, [sellerId, ...params, Number(limit), offset]);

  for (const order of orders) {
    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?',
      [order.id, sellerId]
    );
    order.items = items;
  }

  res.json({ success: true, orders, page: Number(page), limit: Number(limit) });
});

// ─────────────────────────────────────────
// PUT /api/admin/orders/:id/status
// ─────────────────────────────────────────
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
  }

  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (req.user.role === 'seller') {
    const [[hasItem]] = await pool.query(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?',
      [order.id, req.user.id]
    );
    if (!hasItem) return res.status(403).json({ success: false, message: 'This is not your order' });
  }

  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);

  // ✅ User ko status update email
  if (order.customer_email) {
    sendStatusUpdateEmail({
      to:      order.customer_email,
      name:    order.customer_name,
      orderId: order.id,
      status,
      address: order.address,
    }).catch(err => console.error('Status update email error:', err));
  }

  res.json({ success: true, message: `Order status updated to "${status}"` });
});

// ─────────────────────────────────────────
// GET /api/admin/orders
// ─────────────────────────────────────────
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let where    = '';
  const params = [];
  if (status) { where = 'WHERE o.status = ?'; params.push(status); }

  const [orders] = await pool.query(`
    SELECT o.*, COUNT(oi.id) AS item_count
    FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
    ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  for (const order of orders) {
    const [items] = await pool.query(`
      SELECT oi.*, p.images AS product_images, p.hsn_code
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [order.id]);

    order.items = items.map(item => {
      let image = '';
      try {
        const raw  = item.product_images;
        const imgs = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
        image = imgs[0] || '';
      } catch { image = ''; }
      const { product_images, ...rest } = item;
      return { ...rest, image, hsn_code: item.hsn_code };
    });
  }

  res.json({ success: true, orders });
});

module.exports = {
  createRazorpayOrder, verifyAndPlaceOrder, placeOrder,
  getUserOrders, getSellerOrders, updateOrderStatus, getAllOrders,
};