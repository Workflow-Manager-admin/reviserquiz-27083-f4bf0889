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
  /**
   * Handles file upload and quiz session creation.
   * Standardizes error propagation for middleware.
   */
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        const err = new Error('File upload failed: no file received.');
        err.status = 400;
        return next(err);
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
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Helper to get quiz session by id, or call next(error) if not found.
   */
  getQuizSession(quizId, next) {
    const session = quizSessions[quizId];
    if (!quizId || !session) {
      const err = new Error('Quiz session not found. Please upload a file to start a new quiz and note the quizId returned.');
      err.status = 404;
      return next(err);
    }
    return session;
  }

  // PUBLIC_INTERFACE
  /**
   * GET /quiz/:quizId/question/:index
   * Returns the MCQ (question/options only) for a quiz, hiding answer/explanation.
   */
  async getQuestion(req, res, next) {
    try {
      const { quizId, index } = req.params;
      // Validate quizId and session
      let session;
      try {
        session = this.getQuizSession(quizId, next);
        if (!session) return;
      } catch (err) {
        return next(err);
      }
      // Validate index
      const idx = parseInt(index, 10);
      if (isNaN(idx) || idx < 0 || idx >= session.mcqs.length) {
        const err = new Error(`Invalid question index: ${index}`);
        err.status = 400;
        return next(err);
      }
      const mcq = session.mcqs[idx];
      if (!mcq) {
        const err = new Error('Question not found for this quiz session.');
        err.status = 404;
        return next(err);
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
    } catch (err) {
      return next(err);
    }
  }

  // PUBLIC_INTERFACE
  /**
   * POST /quiz/:quizId/answer/:index
   * Accepts { answer } in body. Returns whether answer was correct, and provides explanation.
   */
  async submitAnswer(req, res, next) {
    try {
      const { quizId, index } = req.params;
      let session;
      try {
        session = this.getQuizSession(quizId, next);
        if (!session) return;
      } catch (err) {
        return next(err);
      }
      const idx = parseInt(index, 10);
      if (isNaN(idx) || idx < 0 || idx >= session.mcqs.length) {
        const err = new Error(`Invalid question index: ${index}`);
        err.status = 400;
        return next(err);
      }
      if (!req.body || typeof req.body.answer === 'undefined') {
        const err = new Error('Missing answer in request body.');
        err.status = 400;
        return next(err);
      }
      const mcq = session.mcqs[idx];
      // Accept either numeric or string answer, do case-insensitive match for string, strict for index/number
      const submitted = req.body.answer;
      let correct = false;

      // Determine correct answer (assuming MCQ object with 'correctAnswer')
      if (typeof mcq.correctAnswer !== 'undefined') {
        if (typeof mcq.correctAnswer === 'number') {
          correct = submitted === mcq.correctAnswer || submitted == mcq.correctAnswer;
        } else if (typeof mcq.correctAnswer === 'string') {
          correct =
            (typeof submitted === 'string' && submitted.trim().toLowerCase() === mcq.correctAnswer.trim().toLowerCase());
        }
      } else {
        const err = new Error('Malformed MCQ data: no correctAnswer field.');
        err.status = 500;
        return next(err);
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
    } catch (err) {
      return next(err);
    }
  }

  // PUBLIC_INTERFACE
  /**
   * GET /quiz/:quizId/progress
   * Returns progress/status of quiz session: number of questions answered out of total.
   */
  async getProgress(req, res, next) {
    try {
      const { quizId } = req.params;
      let session;
      try {
        session = this.getQuizSession(quizId, next);
        if (!session) return;
      } catch (err) {
        return next(err);
      }
      const totalQuestions = session.mcqs.length;
      const answered = Object.keys(session.userAnswers || {}).length;
      return res.status(200).json({
        status: 'success',
        quizId,
        answered,
        totalQuestions,
        progress: totalQuestions ? Math.round((answered / totalQuestions) * 100) : 0
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new QuizController();
