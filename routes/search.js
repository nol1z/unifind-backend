// routes/search.js
const router = require('express').Router();
const db = require('../config/db');

// GET /api/search?q=medicine&type=state&region=tashkent_city
router.get('/', async (req, res) => {
  try {
    const { q = '', type, region, dtm_max, limit = 20 } = req.query;
    if (!q.trim()) return res.json({ universities: [], majors: [] });

    const params = [`%${q}%`];
    const wheres = [
      'u.is_active = true',
      `(u.name ILIKE $1 OR u.description ILIKE $1 OR u.short_name ILIKE $1)`
    ];

    if (type)    { params.push(type);    wheres.push(`u.type = $${params.length}`); }
    if (region)  { params.push(region);  wheres.push(`r.slug = $${params.length}`); }
    if (dtm_max) { params.push(dtm_max); wheres.push(`u.dtm_min <= $${params.length}`); }

    params.push(limit);
    const { rows: universities } = await db.query(`
      SELECT u.id, u.name, u.short_name, u.emoji, u.type, u.rating, u.dtm_min,
             u.tuition_min, u.tuition_max, u.tuition_currency, u.programs_count,
             r.name_en as region_en, r.slug as region_slug
      FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      WHERE ${wheres.join(' AND ')}
      ORDER BY u.rating DESC
      LIMIT $${params.length}
    `, params);

    // Also search majors
    const { rows: majors } = await db.query(`
      SELECT m.name, m.dtm_min, m.form,
             u.id as university_id, u.name as university_name, u.emoji
      FROM majors m
      JOIN universities u ON m.university_id = u.id
      WHERE m.name ILIKE $1 AND u.is_active = true
      LIMIT 10
    `, [`%${q}%`]);

    res.json({ universities, majors, query: q });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
