const path = require('path');
const textExtractionService = require('../services/textExtraction');
const mcqGeneratorService = require('../services/mcqGenerator');

/**
 * Handles POST /quiz/upload file upload requests.
 * Now also extracts text from PDF/DOCX after file is uploaded.
 */
class QuizController {
  // PUBLIC_INTERFACE
  async uploadFile(req, res) {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'File upload failed: no file received.'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadTime: new Date().toISOString(),
      message: 'File uploaded successfully.'
    };

    // Attempt text extraction
    let textExtractionResult = { text: null };
    let extractionError = null;

    try {
      // Use stored file path - assume files are uploaded in 'uploads/' folder relative to project base
      const uploadRelativeFolder = path.join(process.cwd(), 'uploads');
      const filePath = path.isAbsolute(req.file.path)
        ? req.file.path
        : path.join(uploadRelativeFolder, req.file.filename);

      textExtractionResult = await textExtractionService.extractText(
        req.file.path,
        req.file.mimetype
      );
    } catch (err) {
      extractionError = err && err.message ? err.message : String(err);
    }

    // MCQ Generation step (only if text extraction succeeded and no extractionError)
    let mcqResult = null;
    let mcqError = null;
    if (textExtractionResult.text && !extractionError) {
      try {
        mcqResult = await mcqGeneratorService.generateMCQs(textExtractionResult.text);
      } catch (err) {
        mcqError = err && err.message ? err.message : String(err);
      }
    }

    // Return file info, text extraction result/error, and MCQ generation results/errors
    return res.status(200).json({
      status: 'success',
      file: fileInfo,
      textExtracted: textExtractionResult.text || null,
      textExtractionError: extractionError,
      mcqs: mcqResult && mcqResult.mcqs ? mcqResult.mcqs : null,
      mcqGenerationError: mcqError,
    });
  }
}

module.exports = new QuizController();
