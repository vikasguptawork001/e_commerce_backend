const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
require('dotenv').config();

const { connectDB }       = require('./config/db');
const { ensureSchema }    = require('./config/ensureSchema');
const { corsOriginCallback, validateCorsConfig } = require('./config/cors');
const routes           = require('./routes/index');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

validateCorsConfig();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legacy local uploads (migrated to Cloudinary on next save)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sab API routes
app.use('/api', routes);

// Unknown API routes return JSON (not SPA HTML)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Frontend static files serve karna (optional/robust check)
const frontendBuildPath = path.join(__dirname, '../Frontend/build');
const frontendIndexHtml = path.join(frontendBuildPath, 'index.html');

if (fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(frontendIndexHtml);
  });
} else {
  // If frontend is deployed separately, or not built yet
  app.get('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'ShopKart API is running. Frontend static build was not found.'
    });
  });
}

// Global error handler
app.use(errorHandler);

// Server start
const startServer = () => {
  const onListen = () => {
    console.log(`🚀 ShopKart API running on port ${PORT}`);
    console.log(`📋 Health: /health`);
  };

  const useHttps = process.env.USE_HTTPS === 'true';
  const keyPath  = process.env.SSL_KEY_PATH  || path.join(__dirname, 'keys/server.key');
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'keys/server.crt');

  if (useHttps && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    https.createServer({
      key:  fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }, app).listen(PORT, '0.0.0.0', onListen);
    console.log('🔒 HTTPS enabled');
  } else {
    app.listen(PORT, '0.0.0.0', onListen);
  }
};

connectDB().then(() => ensureSchema()).then(startServer);