const express = require('express');
const upload = require('../middleware/fileUpload');
const quizController = require('../controllers/quiz');

const router = express.Router();

/**
 * @swagger
 * /quiz/upload:
 *   post:
 *     summary: Upload a PDF or DOCX file for quiz generation.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 file:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     mimetype:
 *                       type: string
 *                     uploadTime:
 *                       type: string
 *       400:
 *         description: Bad request or file type/size error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 */
// PUBLIC_INTERFACE
router.post(
  '/upload',
  (req, res, next) => {
    upload.single('file')(req, res, function (err) {
      if (err) {
        // Handle multer-specific errors
        if (err instanceof require('multer').MulterError) {
          let errorMessage;
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              errorMessage = 'File too large. Max 10MB allowed.';
              break;
            case 'LIMIT_UNEXPECTED_FILE':
              errorMessage = 'Only .pdf and .docx files are allowed!';
              break;
            default:
              errorMessage = err.message;
              break;
          }
          return res.status(400).json({ status: 'error', message: errorMessage });
        } else {
          // Other errors
          return res.status(500).json({ status: 'error', message: 'An unexpected error occurred during upload.' });
        }
      }
      next();
    });
  },
  quizController.uploadFile
);

module.exports = router;
