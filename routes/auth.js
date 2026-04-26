// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const signRefresh = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

// ── POST /api/auth/register
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, language, theme } = req.body;
  try {
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(`
      INSERT INTO users (name, email, password, language, theme)
      VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, created_at
    `, [name, email, hash, language || 'en', theme || 'dark']);

    const user = rows[0];
    const token   = signToken(user.id, user.role);
    const refresh = signRefresh(user.id);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO refresh_tokens(user_id,token,expires_at) VALUES($1,$2,$3)',
      [user.id, refresh, expiresAt]);

    res.status(201).json({ token, refresh, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows } = await db.query(
      'SELECT id,name,email,password,role,is_active FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);

    const token   = signToken(user.id, user.role);
    const refresh = signRefresh(user.id);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO refresh_tokens(user_id,token,expires_at) VALUES($1,$2,$3)',
      [user.id, refresh, expiresAt]);

    const { password: _, ...safeUser } = user;
    res.json({ token, refresh, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const { rows } = await db.query(
      'SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()', [refresh]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const userRes = await db.query('SELECT id,role FROM users WHERE id=$1', [decoded.id]);
    if (!userRes.rows.length) return res.status(401).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const token = signToken(user.id, user.role);
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  const { refresh } = req.body;
  if (refresh) await db.query('DELETE FROM refresh_tokens WHERE token=$1', [refresh]);
  res.json({ message: 'Logged out' });
});

// ── GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id,name,email,role,avatar_url,language,theme,dtm_score,field,region_pref,budget,created_at FROM users WHERE id=$1',
    [req.user.id]);
  res.json(rows[0]);
});

// ── PATCH /api/auth/me
router.patch('/me', auth, async (req, res) => {
  const { name, language, theme, dtm_score, field, region_pref, budget } = req.body;
  const { rows } = await db.query(`
    UPDATE users SET
      name=COALESCE($1,name), language=COALESCE($2,language),
      theme=COALESCE($3,theme), dtm_score=COALESCE($4,dtm_score),
      field=COALESCE($5,field), region_pref=COALESCE($6,region_pref),
      budget=COALESCE($7,budget)
    WHERE id=$8 RETURNING id,name,email,role,language,theme,dtm_score,field,region_pref,budget
  `, [name, language, theme, dtm_score, field, region_pref, budget, req.user.id]);
  res.json(rows[0]);
});

module.exports = router;
