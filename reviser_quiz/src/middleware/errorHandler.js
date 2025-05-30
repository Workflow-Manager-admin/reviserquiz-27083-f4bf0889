'use strict';

// PUBLIC_INTERFACE
/**
 * Express error handling middleware that standardizes server error responses.
 * Handles thrown errors, malformed requests, and propagates status + messages.
 * Extend with custom handlers as needed for additional context.
 */
function errorHandler(err, req, res, next) {
  // Set status code
  let statusCode = err.statusCode || err.status || 500;

  // Express validation
  if (res.headersSent) {
    return next(err);
  }

  // Build error payload
  const payload = {
    status: 'error',
    message: err.message || 'Internal Server Error',
  };

  // Optionally add stack trace in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) {
    payload.stack = err.stack;
  }

  // Optionally handle structured errors (validation, etc)
  if (err.errors && Array.isArray(err.errors)) {
    payload.errors = err.errors;
  }

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
