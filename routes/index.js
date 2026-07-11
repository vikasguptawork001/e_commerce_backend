const express = require('express');
const router  = express.Router();

const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

const { register, login, getMe, updatePassword, getPublicKeyHandler } = require('../controllers/authController');

const {
  getProducts, getProduct,
  getSellerProducts, createProduct, updateProduct, deleteProduct,
  getSellerAnalytics, toggleStock,
} = require('../controllers/productController');

const {
  createRazorpayOrder, verifyAndPlaceOrder, placeOrder,
  getUserOrders, getSellerOrders, updateOrderStatus, getAllOrders, getPaymentHistory,
} = require('../controllers/orderController');

const {
  getDashboard, getUsers, toggleUserActive, resetUserPassword, verifySeller,
  createUser, getCategories, getAllCategories, createCategory,
  toggleCategory, updateCategory, deleteCategory, trackView, getPageViews,
  sendContactMessage, getContactMessages, markMessageRead,
  replyToMessage, deleteContactMessage,
  getMyMessages,
  getAds, getAdminAds, createAd, updateAd, deleteAd, toggleAd,
  getBanners, getAdminBanners, createBanner, updateBanner, deleteBanner, toggleBanner,
} = require('../controllers/adminController');

const {
  getReviews, addReview, deleteReview,
} = require('../controllers/reviewController');

const { getAddresses, createAddress, deleteAddress } = require('../controllers/addressController');
const { getWishlist, toggleWishlist } = require('../controllers/wishlistController');

const { uploadImage } = require('../controllers/uploadController');

// ══════════════════════════════════════════
//  ADS ROUTES
// ══════════════════════════════════════════
router.get   ('/ads',                        getAds);
router.get   ('/admin/ads',                  protect, adminOnly, getAdminAds);
router.post  ('/admin/ads',                  protect, adminOnly, createAd);
router.put   ('/admin/ads/:id',              protect, adminOnly, updateAd);
router.delete('/admin/ads/:id',              protect, adminOnly, deleteAd);
router.patch ('/admin/ads/:id/toggle',       protect, adminOnly, toggleAd);

// ══════════════════════════════════════════
//  BANNER ROUTES
// ══════════════════════════════════════════
router.get   ('/banners',                        getBanners);
router.get   ('/admin/banners',                  protect, adminOnly, getAdminBanners);
router.post  ('/admin/banners',                  protect, adminOnly, createBanner);
router.put   ('/admin/banners/:id',              protect, adminOnly, updateBanner);
router.delete('/admin/banners/:id',              protect, adminOnly, deleteBanner);
router.patch ('/admin/banners/:id/toggle',       protect, adminOnly, toggleBanner);

// ══════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════
router.get ('/auth/public-key',       getPublicKeyHandler);
router.post('/auth/register',        register);
router.post('/auth/login',           login);
router.get ('/auth/me',              protect, getMe);
router.put ('/auth/update-password', protect, updatePassword);

// ══════════════════════════════════════════
//  PUBLIC PRODUCT ROUTES
// ══════════════════════════════════════════
router.get('/products',     getProducts);
router.get('/products/:id', getProduct);
router.get('/categories',   getCategories);

// ══════════════════════════════════════════
//  REVIEW ROUTES
// ══════════════════════════════════════════
router.get   ('/products/:id/reviews', getReviews);
router.post  ('/products/:id/reviews', protect, addReview);
router.delete('/products/:id/reviews', protect, deleteReview);

// ══════════════════════════════════════════
//  CONTACT ROUTES
// ══════════════════════════════════════════
router.post('/contact',        sendContactMessage);
router.get ('/contact/check',  getMyMessages);

// ══════════════════════════════════════════
//  SELLER/PRODUCT ROUTES (admin only)
// ══════════════════════════════════════════
router.get   ('/seller/products',          protect, adminOnly, getSellerProducts);
router.post  ('/seller/products',          protect, adminOnly, upload.array('images', 5), createProduct);
router.put   ('/seller/products/:id',      protect, adminOnly, upload.array('images', 5), updateProduct);
router.delete('/seller/products/:id',      protect, adminOnly, deleteProduct);
router.get   ('/seller/analytics',         protect, adminOnly, getSellerAnalytics);
router.get   ('/seller/orders',            protect, adminOnly, getSellerOrders);
router.put   ('/seller/orders/:id/status', protect, adminOnly, updateOrderStatus);

// ══════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════
router.get  ('/admin/dashboard',                   protect, adminOnly, getDashboard);
router.get  ('/admin/products',                    protect, adminOnly, getSellerProducts);
router.get  ('/admin/users',                       protect, adminOnly, getUsers);
router.post ('/admin/users',                       protect, adminOnly, createUser);
router.put  ('/admin/users/:id/toggle',            protect, adminOnly, toggleUserActive);
router.put  ('/admin/users/:id/reset-password',    protect, adminOnly, resetUserPassword);
router.put  ('/admin/sellers/:id/verify',          protect, adminOnly, verifySeller);
router.get  ('/admin/orders',                      protect, adminOnly, getAllOrders);
router.get  ('/admin/payments',                    protect, adminOnly, getPaymentHistory);
router.put  ('/admin/orders/:id/status',           protect, adminOnly, updateOrderStatus);
router.post ('/admin/categories',                  protect, adminOnly, createCategory);
router.get  ('/admin/categories',                  protect, adminOnly, getAllCategories);
router.put  ('/admin/categories/:id',              protect, adminOnly, updateCategory);
router.delete('/admin/categories/:id',             protect, adminOnly, deleteCategory);
router.put  ('/admin/categories/:id/toggle',       protect, adminOnly, toggleCategory);
router.patch('/admin/products/:id/toggle-stock',   protect, adminOnly, toggleStock);
router.get  ('/admin/page-views',                  protect, adminOnly, getPageViews);

// ── Image upload (Cloudinary) ──
router.post('/upload/image', protect, adminOnly, upload.single('image'), uploadImage);

// ── Contact Messages (Admin) ──
router.get   ('/admin/contact-messages',           protect, adminOnly, getContactMessages);
router.put   ('/admin/contact-messages/:id/read',  protect, adminOnly, markMessageRead);
router.put   ('/admin/contact-messages/:id/reply', protect, adminOnly, replyToMessage);
router.delete('/admin/contact-messages/:id',       protect, adminOnly, deleteContactMessage);

// ── Track route ──
router.post('/track/view', trackView);

// ══════════════════════════════════════════
//  ORDER ROUTES
// ══════════════════════════════════════════
router.post('/orders/create-razorpay-order', protect, createRazorpayOrder);
router.post('/orders/verify-payment',        protect, verifyAndPlaceOrder);
router.post('/orders',                       protect, placeOrder);
router.get ('/user/orders',                  protect, getUserOrders);

// ══════════════════════════════════════════
//  USER ADDRESSES (max 5)
// ══════════════════════════════════════════
router.get   ('/user/addresses',        protect, getAddresses);
router.post  ('/user/addresses',        protect, createAddress);
router.delete('/user/addresses/:id',    protect, deleteAddress);

// ══════════════════════════════════════════
//  USER WISHLIST
// ══════════════════════════════════════════
router.get ('/user/wishlist',              protect, getWishlist);
router.post('/user/wishlist/:productId',  protect, toggleWishlist);

module.exports = router;