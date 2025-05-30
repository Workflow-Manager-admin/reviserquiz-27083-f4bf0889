const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * TextExtractionService handles extraction of clean, structured text from PDF and DOCX files.
 */
class TextExtractionService {
  /**
   * PUBLIC_INTERFACE
   * Extracts text from a given file depending on file type.
   * @param {string} filePath Absolute or relative path to the uploaded file.
   * @param {string} mimeType MIME type of the uploaded file.
   * @returns {Promise<{text: string}>} Extracted text (if successful).
   * @throws {Error} On failure to extract text.
   */
  async extractText(filePath, mimeType) {
    if (!filePath || !mimeType) {
      throw new Error('Invalid file path or mime type for text extraction.');
    }

    try {
      if (mimeType === 'application/pdf') {
        // PDF Extraction
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        if (!data.text || !data.text.trim()) {
          throw new Error('No text content found in PDF');
        }
        return { text: data.text.trim() };
      } else if (
        // DOCX Extraction (Office Open XML)
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const docBuffer = fs.readFileSync(filePath);
        const { value } = await mammoth.extractRawText({ buffer: docBuffer });
        if (!value || !value.trim()) {
          throw new Error('No text content found in DOCX');
        }
        return { text: value.trim() };
      } else {
        throw new Error('Unsupported file type for extraction.');
      }
    } catch (err) {
      throw new Error(
        `Text extraction failed: ${
          err && err.message ? err.message : err
        }`
      );
    }
  }
}

module.exports = new TextExtractionService();
