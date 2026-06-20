const fs   = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');

const FOLDER = () => process.env.CLOUDINARY_FOLDER || 'ecommerce_images';

const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com');

const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER(), resource_type: 'image', ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

const uploadFromUrl = (url, options = {}) =>
  cloudinary.uploader.upload(url, { folder: FOLDER(), resource_type: 'image', ...options });

const uploadFromPath = (filePath, options = {}) =>
  cloudinary.uploader.upload(filePath, { folder: FOLDER(), resource_type: 'image', ...options });

/** Upload file buffer, remote URL, data URI, or legacy /uploads path → Cloudinary secure URL */
const resolveImageToCloudinary = async (source) => {
  if (!source || typeof source !== 'string') return '';

  const trimmed = source.trim();
  if (!trimmed) return '';

  if (isCloudinaryUrl(trimmed)) return trimmed;

  if (trimmed.startsWith('data:')) {
    const result = await uploadFromUrl(trimmed);
    return result.secure_url;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const result = await uploadFromUrl(trimmed);
    return result.secure_url;
  }

  if (trimmed.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, '../uploads', path.basename(trimmed));
    if (fs.existsSync(localPath)) {
      const result = await uploadFromPath(localPath);
      return result.secure_url;
    }
  }

  return trimmed;
};

const resolveImagesToCloudinary = async (sources) => {
  const list = Array.isArray(sources) ? sources : [sources];
  const resolved = await Promise.all(list.map(resolveImageToCloudinary));
  return resolved.filter(Boolean);
};

module.exports = {
  isCloudinaryUrl,
  uploadBuffer,
  uploadFromUrl,
  uploadFromPath,
  resolveImageToCloudinary,
  resolveImagesToCloudinary,
};
