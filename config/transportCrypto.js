const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const keysDir = path.join(__dirname, '../keys');
let publicKey;
let privateKey;

const loadKeys = () => {
  if (publicKey && privateKey) return;

  if (process.env.RSA_PUBLIC_KEY && process.env.RSA_PRIVATE_KEY) {
    publicKey  = process.env.RSA_PUBLIC_KEY.replace(/\\n/g, '\n');
    privateKey = process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n');
    return;
  }

  const pubPath  = path.join(keysDir, 'public.pem');
  const privPath = path.join(keysDir, 'private.pem');

  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    publicKey  = fs.readFileSync(pubPath, 'utf8');
    privateKey = fs.readFileSync(privPath, 'utf8');
    return;
  }

  const { publicKey: pub, privateKey: priv } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(pubPath, pub);
  fs.writeFileSync(privPath, priv, { mode: 0o600 });
  publicKey  = pub;
  privateKey = priv;
};

const getPublicKey = () => {
  loadKeys();
  return publicKey;
};

const decryptField = (encryptedBase64) => {
  if (!encryptedBase64) return null;
  loadKeys();
  const buffer = Buffer.from(encryptedBase64, 'base64');
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  ).toString('utf8');
};

/** Accept plain or RSA-encrypted fields from the client */
const resolveField = (body, field) => {
  const encryptedKey = `encrypted${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  if (body?.[encryptedKey]) return decryptField(body[encryptedKey]);
  return body?.[field] ?? null;
};

module.exports = { getPublicKey, decryptField, resolveField };
