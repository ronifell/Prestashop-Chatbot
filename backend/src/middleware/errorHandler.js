import logger from '../utils/logger.js';

/**
 * Global error handling middleware
 */
export function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Ha ocurrido un error interno. Por favor, inténtalo de nuevo.'
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
  });
}
