const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(422).json({
      errors: [err.message],
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(422).json({
      errors: err.errors.map(e => e.message),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(422).json({
      errors: ['Record already exists'],
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    errors: [message],
  });
};

module.exports = errorHandler;

