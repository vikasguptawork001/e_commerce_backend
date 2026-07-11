const { asyncHandler } = require('../middleware/errorHandler');
const { uploadBuffer } = require('../utils/imageUpload');

// POST /api/upload/image
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }

  const result = await uploadBuffer(req.file.buffer, {
    public_id: `img_${Date.now()}`,
  });

  res.json({
    success: true,
    url:     result.secure_url,
    publicId: result.public_id,
  });
});

module.exports = { uploadImage };
