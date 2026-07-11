const isProduction = process.env.NODE_ENV === 'production';

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'https://e-commere-frontend-one.vercel.app'
];

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const fromEnv = parseAllowedOrigins();
  if (isProduction) return fromEnv;
  return [...new Set([...fromEnv, ...DEV_ORIGINS])];
}

function corsOriginCallback(origin, callback) {
  const allowed = getAllowedOrigins();

  if (!origin) {
    // Same-origin / server tools — allow in dev only
    if (isProduction) {
      return callback(new Error('CORS: Origin header required'));
    }
    return callback(null, true);
  }

  if (allowed.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS: Origin not allowed — ${origin}`));
}

function validateCorsConfig() {
  if (isProduction && !parseAllowedOrigins().length) {
    console.error('❌ ALLOWED_ORIGINS must be set in production (comma-separated URLs)');
    process.exit(1);
  }
}

module.exports = { corsOriginCallback, validateCorsConfig, getAllowedOrigins };
