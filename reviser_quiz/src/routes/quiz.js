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

/**
 * @swagger
 * /quiz/{quizId}/question/{index}:
 *   get:
 *     summary: Retrieve a single MCQ for a given quiz session (by quizId and question index).
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique quiz session ID returned by /upload.
 *       - in: path
 *         name: index
 *         required: true
 *         schema:
 *           type: integer
 *         description: The question index (0-based).
 *     responses:
 *       200:
 *         description: Returns the MCQ question (without correct answer/explanation).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 question:
 *                   type: object
 *                 index:
 *                   type: integer
 *                 totalQuestions:
 *                   type: integer
 *                 quizId:
 *                   type: string
 *       400:
 *         description: Invalid index or missing parameter.
 *       404:
 *         description: Quiz session or question not found.
 */
router.get('/:quizId/question/:index', quizController.getQuestion.bind(quizController));

/**
 * @swagger
 * /quiz/{quizId}/answer/{index}:
 *   post:
 *     summary: Submit an answer for a given MCQ in a quiz session.
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique quiz session ID.
 *       - in: path
 *         name: index
 *         required: true
 *         schema:
 *           type: integer
 *         description: The question index (0-based).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answer
 *             properties:
 *               answer:
 *                 type: string
 *                 description: The answer submitted (could be text or option index depending on quiz format).
 *     responses:
 *       200:
 *         description: Returns grading result and explanation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 correct:
 *                   type: boolean
 *                 explanation:
 *                   type: string
 *                 correctAnswer:
 *                   type: string
 *                 userAnswer:
 *                   type: string
 *                 index:
 *                   type: integer
 *       400:
 *         description: Invalid request or index.
 *       404:
 *         description: Quiz session or question not found.
 */
router.post('/:quizId/answer/:index', express.json(), quizController.submitAnswer.bind(quizController));

module.exports = router;
