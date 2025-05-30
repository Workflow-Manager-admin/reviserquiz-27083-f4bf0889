const path = require('path');
const { v4: uuidv4 } = require('uuid');
const textExtractionService = require('../services/textExtraction');
const mcqGeneratorService = require('../services/mcqGenerator');

/**
 * In-memory quiz session store. quizId -> { mcqs, userAnswers: {}, ... }
 * Each session will last as long as the server is running.
 */
const quizSessions = {};

/**
 * Handles all quiz-related logic for file uploads, MCQ access, answer grading, and explanations.
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
    let quizId = null;
    if (textExtractionResult.text && !extractionError) {
      try {
        mcqResult = await mcqGeneratorService.generateMCQs(textExtractionResult.text);

        // Only if MCQs present, create session:
        if (mcqResult && Array.isArray(mcqResult.mcqs) && mcqResult.mcqs.length > 0) {
          quizId = uuidv4();
          quizSessions[quizId] = {
            mcqs: mcqResult.mcqs,
            userAnswers: {}, // index: {answer, correct, answeredAt}
            createdAt: new Date(),
          };
        }
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
      quizId: quizId || null // Add quizId if session made
    });
  }

  /**
   * Helper to get quiz session by id, or return error json.
   */
  getQuizSession(quizId, res) {
    const session = quizSessions[quizId];
    if (!quizId || !session) {
      res.status(404).json({
        status: 'error',
        message: 'Quiz session not found. Please upload a file to start a new quiz and note the quizId returned.'
      });
      return null;
    }
    return session;
  }

  // PUBLIC_INTERFACE
  /**
   * GET /quiz/:quizId/question/:index
   * Returns the MCQ (question/options only) for a quiz, hiding answer/explanation.
   */
  async getQuestion(req, res) {
    const { quizId, index } = req.params;
    // Validate quizId
    const session = this.getQuizSession(quizId, res);
    if (!session) return;
    // Validate index
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= session.mcqs.length) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid question index: ${index}`
      });
    }
    const mcq = session.mcqs[idx];
    if (!mcq) {
      return res.status(404).json({
        status: 'error',
        message: 'Question not found for this quiz session.'
      });
    }
    // Remove 'correctAnswer' and 'explanation' from MCQ sent to client
    const { correctAnswer, explanation, ...publicFields } = mcq;
    return res.status(200).json({
      status: 'success',
      question: publicFields,
      index: idx,
      totalQuestions: session.mcqs.length,
      quizId: quizId
    });
  }

  // PUBLIC_INTERFACE
  /**
   * POST /quiz/:quizId/answer/:index
   * Accepts { answer } in body. Returns whether answer was correct, and provides explanation.
   */
  async submitAnswer(req, res) {
    const { quizId, index } = req.params;
    const session = this.getQuizSession(quizId, res);
    if (!session) return;
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= session.mcqs.length) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid question index: ${index}`
      });
    }
    if (!req.body || typeof req.body.answer === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Missing answer in request body.'
      });
    }
    const mcq = session.mcqs[idx];
    // Accept either numeric or string answer, do case-insensitive match for string, strict for index/number
    const submitted = req.body.answer;
    let correct = false;

    // Determine correct answer (assuming MCQ object with 'correctAnswer')
    // Accept both index and string (text) for answers; check what format correctAnswer uses
    if (typeof mcq.correctAnswer !== 'undefined') {
      // If correctAnswer is index, compare directly
      if (typeof mcq.correctAnswer === 'number') {
        correct = submitted === mcq.correctAnswer || submitted == mcq.correctAnswer;
      } else if (typeof mcq.correctAnswer === 'string') {
        // If answer is a string (option text), do case-insensitive comparison
        correct =
          (typeof submitted === 'string' && submitted.trim().toLowerCase() === mcq.correctAnswer.trim().toLowerCase());
      }
    } else {
      // If no correct answer, error (bad API data)
      return res.status(500).json({
        status: 'error',
        message: 'Malformed MCQ data: no correctAnswer field.'
      });
    }

    // Save user's response
    session.userAnswers[idx] = {
      answer: submitted,
      correct,
      answeredAt: new Date().toISOString()
    };

    return res.status(200).json({
      status: 'success',
      correct,
      explanation: mcq.explanation || null,
      correctAnswer: mcq.correctAnswer, // (Optional) include for transparency, or comment to remove in prod
      userAnswer: submitted,
      index: idx,
    });
  }
}

module.exports = new QuizController();
