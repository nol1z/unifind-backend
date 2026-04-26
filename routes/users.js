// routes/users.js
const router = require('express').Router();
const db = require('../config/db');
const { auth } = require('../middleware/auth');

// ── GET /api/users/saved
router.get('/saved', auth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.*, r.name_en as region_en, r.slug as region_slug
    FROM saved_universities s
    JOIN universities u ON s.university_id = u.id
    LEFT JOIN regions r ON u.region_id = r.id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
  `, [req.user.id]);
  res.json(rows);
});

// ── POST /api/users/saved/:universityId
router.post('/saved/:universityId', auth, async (req, res) => {
  try {
    await db.query(`
      INSERT INTO saved_universities (user_id, university_id) VALUES ($1,$2)
      ON CONFLICT DO NOTHING
    `, [req.user.id, req.params.universityId]);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/users/saved/:universityId
router.delete('/saved/:universityId', auth, async (req, res) => {
  await db.query(
    'DELETE FROM saved_universities WHERE user_id=$1 AND university_id=$2',
    [req.user.id, req.params.universityId]
  );
  res.json({ saved: false });
});

// ── GET /api/users/comparisons
router.get('/comparisons', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM comparisons WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
    [req.user.id]
  );
  res.json(rows);
});

// ── POST /api/users/comparisons
router.post('/comparisons', auth, async (req, res) => {
  const { university_ids, name } = req.body;
  if (!university_ids || university_ids.length < 2)
    return res.status(400).json({ error: 'At least 2 universities required' });
  const { rows } = await db.query(
    'INSERT INTO comparisons (user_id, university_ids, name) VALUES ($1,$2,$3) RETURNING *',
    [req.user.id, university_ids, name || null]
  );
  res.status(201).json(rows[0]);
});

// ── POST /api/users/dtm  (log DTM search)
router.post('/dtm', async (req, res) => {
  const { score, subject1, score1, subject2, score2, subject3, score3,
          region_f, field_f, results_cnt } = req.body;
  await db.query(`
    INSERT INTO dtm_searches (user_id,score,subject1,score1,subject2,score2,subject3,score3,region_f,field_f,results_cnt)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [req.user?.id || null, score, subject1, score1, subject2, score2, subject3, score3,
      region_f, field_f, results_cnt]);
  res.json({ logged: true });
});

module.exports = router;
