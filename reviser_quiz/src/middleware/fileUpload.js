const multer = require('multer');
const path = require('path');

// PUBLIC_INTERFACE
/**
 * Multer storage config - saves files to 'uploads/' directory.
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // You may want to ensure this folder exists in production
  },
  filename: function (req, file, cb) {
    // Use Date.now() and original name, avoid direct user input for file name
    const ext = path.extname(file.originalname);
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${safeBaseName}-${Date.now()}${ext}`);
  }
});

// Allowed file types
const allowedMimeTypes = [
  'application/pdf',                         // .pdf
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  // Some clients may send alternate mime for docx, add as needed
];

// PUBLIC_INTERFACE
/**
 * File filter function to restrict allowed file types for uploads.
 */
function fileFilter(req, file, cb) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only .pdf and .docx files are allowed!'));
  } else {
    cb(null, true);
  }
}

// Max file size: 10 MB by default
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_SIZE }
});

module.exports = upload;
