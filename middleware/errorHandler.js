// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err.message);

  // Postgres errors
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists (duplicate)' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record not found' });
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid UUID format' });

  // JWT errors
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });

  // Validation errors
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;
