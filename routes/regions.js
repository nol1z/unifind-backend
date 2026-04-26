// routes/regions.js
const router = require('express').Router();
const db = require('../config/db');

// GET /api/regions
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, COUNT(u.id) as university_count
      FROM regions r
      LEFT JOIN universities u ON u.region_id = r.id AND u.is_active = true
      GROUP BY r.id
      ORDER BY r.name_en
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/regions/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM regions WHERE slug = $1', [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Region not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
