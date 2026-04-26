// server.js — UniFind Backend
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const morgan     = require('morgan');
const path       = require('path');

const { standard, strict } = require('./middleware/rateLimiter');
const errorHandler          = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin',   express.static(path.join(__dirname, 'admin')));

app.use('/api/', standard);
app.use('/api/auth/login',    strict);
app.use('/api/auth/register', strict);

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/universities', require('./routes/universities'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/regions',      require('./routes/regions'));
app.use('/api/search',       require('./routes/search'));
app.use('/api/admin',        require('./routes/admin'));

app.get('/health', (req, res) => res.json({
  status: 'ok', service: 'UniFind API', version: '1.0.0',
  time: new Date().toISOString(), env: process.env.NODE_ENV || 'development'
}));

app.use((req, res) =>
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('');
  console.log('  UniFind API Server');
  console.log('  ------------------');
  console.log(`  Running on   : http://localhost:${PORT}`);
  console.log(`  API          : http://localhost:${PORT}/api`);
  console.log(`  Admin Panel  : http://localhost:${PORT}/admin`);
  console.log(`  Health Check : http://localhost:${PORT}/health`);
  console.log(`  Environment  : ${process.env.NODE_ENV || 'development'}`);
  console.log('');
});

module.exports = app;
