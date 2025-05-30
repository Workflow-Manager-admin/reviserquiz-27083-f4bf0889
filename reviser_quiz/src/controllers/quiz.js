const path = require('path');

/**
 * Handles POST /quiz/upload file upload requests.
 * Sends back relevant info or error message on failure.
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

    // Only sending information back, actual processing (text extraction etc.) happens elsewhere
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadTime: new Date().toISOString(),
      message: 'File uploaded successfully.'
    };

    return res.status(200).json({
      status: 'success',
      file: fileInfo
    });
  }
}

module.exports = new QuizController();
