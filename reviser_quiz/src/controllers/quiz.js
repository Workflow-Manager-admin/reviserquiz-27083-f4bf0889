const path = require('path');
const textExtractionService = require('../services/textExtraction');

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

    // Return both file info and text extraction result (or error)
    return res.status(200).json({
      status: 'success',
      file: fileInfo,
      textExtracted: textExtractionResult.text || null,
      textExtractionError: extractionError
    });
  }
}

module.exports = new QuizController();
