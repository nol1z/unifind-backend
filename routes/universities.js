// routes/universities.js
const router = require('express').Router();
const db = require('../config/db');
const { auth, adminOnly, optionalAuth } = require('../middleware/auth');

// ── GET /api/universities  (list, search, filter, paginate)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      q, type, region, field, rating_min, dtm_min, dtm_max,
      sort = 'rating', order = 'desc', page = 1, limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    const wheres = ['u.is_active = true'];

    if (q) {
      params.push(`%${q}%`);
      wheres.push(`(u.name ILIKE $${params.length} OR u.description ILIKE $${params.length})`);
    }
    if (type)       { params.push(type);       wheres.push(`u.type = $${params.length}`); }
    if (region)     { params.push(region);      wheres.push(`r.slug = $${params.length}`); }
    if (field)      { params.push(field);       wheres.push(`u.field = $${params.length}`); }
    if (rating_min) { params.push(rating_min);  wheres.push(`u.rating >= $${params.length}`); }
    if (dtm_min)    { params.push(dtm_min);     wheres.push(`u.dtm_min >= $${params.length}`); }
    if (dtm_max)    { params.push(dtm_max);     wheres.push(`u.dtm_min <= $${params.length}`); }

    const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const sortMap = {
      rating: 'u.rating DESC, u.rating_count DESC',
      dtm_asc: 'u.dtm_min ASC',
      dtm_desc: 'u.dtm_min DESC',
      name: 'u.name ASC',
      newest: 'u.created_at DESC',
    };
    const orderBy = sortMap[sort] || 'u.rating DESC';

    params.push(limit, offset);
    const dataQ = `
      SELECT u.*, r.slug as region_slug,
        r.name_en as region_en, r.name_uz as region_uz, r.name_ru as region_ru,
        CASE WHEN fl.id IS NOT NULL THEN true ELSE false END as is_sponsored
      FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      LEFT JOIN featured_listings fl ON fl.university_id = u.id
        AND fl.is_active = true AND fl.ends_at > NOW()
      ${whereClause}
      ORDER BY is_sponsored DESC, ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countQ = `
      SELECT COUNT(*) FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      ${whereClause}
    `;

    const [data, count] = await Promise.all([
      db.query(dataQ, params),
      db.query(countQ, params.slice(0, -2))
    ]);

    res.json({
      data: data.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count.rows[0].count / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/universities/featured
router.get('/featured', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.*, r.slug as region_slug, r.name_en as region_en
    FROM universities u
    LEFT JOIN regions r ON u.region_id = r.id
    WHERE u.is_featured = true AND u.is_active = true
    ORDER BY u.rating DESC LIMIT 10
  `);
  res.json(rows);
});

// ── GET /api/universities/dtm?score=165&region=&field=
router.get('/dtm', async (req, res) => {
  try {
    const { score, region, field } = req.query;
    if (!score) return res.status(400).json({ error: 'Score required' });

    const params = [parseInt(score)];
    const wheres = ['u.is_active = true', 'u.dtm_min <= $1'];
    if (region) { params.push(region); wheres.push(`r.slug = $${params.length}`); }
    if (field)  { params.push(field);  wheres.push(`u.field = $${params.length}`); }

    const qualify = await db.query(`
      SELECT u.*, r.slug as region_slug, r.name_en as region_en
      FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      WHERE ${wheres.join(' AND ')}
      ORDER BY u.dtm_min DESC, u.rating DESC
    `, params);

    // Also get "close" — within 10 points above score
    const closeParams = [parseInt(score), parseInt(score) + 10];
    const closeWheres = ['u.is_active = true', 'u.dtm_min > $1', 'u.dtm_min <= $2'];
    if (region) { closeParams.push(region); closeWheres.push(`r.slug = $${closeParams.length}`); }
    if (field)  { closeParams.push(field);  closeWheres.push(`u.field = $${closeParams.length}`); }

    const close = await db.query(`
      SELECT u.*, r.slug as region_slug, r.name_en as region_en
      FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      WHERE ${closeWheres.join(' AND ')}
      ORDER BY u.dtm_min ASC
    `, closeParams);

    res.json({ qualify: qualify.rows, close: close.rows, score: parseInt(score) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/universities/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`
      SELECT u.*, r.slug as region_slug, r.name_en as region_en,
             r.name_uz as region_uz, r.name_ru as region_ru
      FROM universities u
      LEFT JOIN regions r ON u.region_id = r.id
      WHERE u.id = $1 AND u.is_active = true
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: 'University not found' });
    const uni = rows[0];

    // Fetch related data in parallel
    const [majors, partners, admissions, reviews] = await Promise.all([
      db.query('SELECT * FROM majors WHERE university_id=$1 ORDER BY name', [id]),
      db.query('SELECT * FROM partners WHERE university_id=$1', [id]),
      db.query('SELECT * FROM admissions WHERE university_id=$1 ORDER BY year DESC LIMIT 1', [id]),
      db.query(`
        SELECT r.*, u.name as reviewer_name, u.avatar_url
        FROM reviews r LEFT JOIN users u ON r.user_id = u.id
        WHERE r.university_id=$1 AND r.is_approved=true
        ORDER BY r.created_at DESC LIMIT 10
      `, [id])
    ]);

    // Log page view
    await db.query(`
      INSERT INTO page_views (university_id, user_id, ip_address)
      VALUES ($1,$2,$3)
    `, [id, req.user?.id || null, req.ip]);

    res.json({
      ...uni,
      majors: majors.rows,
      partners: partners.rows,
      admissions: admissions.rows[0] || null,
      reviews: reviews.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/universities/:id/reviews
router.post('/:id/reviews', auth, async (req, res) => {
  const { id } = req.params;
  const { overall_rating, teaching_rating, facility_rating,
          campus_rating, employ_rating, body, year_of_study } = req.body;

  if (!overall_rating || overall_rating < 1 || overall_rating > 5)
    return res.status(400).json({ error: 'Rating 1-5 required' });

  try {
    const existing = await db.query(
      'SELECT id FROM reviews WHERE university_id=$1 AND user_id=$2', [id, req.user.id]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'You already reviewed this university' });

    const { rows } = await db.query(`
      INSERT INTO reviews
        (university_id, user_id, overall_rating, teaching_rating, facility_rating,
         campus_rating, employ_rating, body, year_of_study)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [id, req.user.id, overall_rating, teaching_rating, facility_rating,
        campus_rating, employ_rating, body, year_of_study]);

    // Update university average rating
    await db.query(`
      UPDATE universities SET
        rating = (SELECT AVG(overall_rating) FROM reviews WHERE university_id=$1 AND is_approved=true),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE university_id=$1 AND is_approved=true)
      WHERE id=$1
    `, [id]);

    res.status(201).json({ message: 'Review submitted for approval', review: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/universities/:id/compare  (for compare page)
router.get('/compare/batch', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 3);
  if (ids.length < 2) return res.status(400).json({ error: 'At least 2 IDs required' });

  const { rows } = await db.query(`
    SELECT u.*, r.name_en as region_en
    FROM universities u
    LEFT JOIN regions r ON u.region_id = r.id
    WHERE u.id = ANY($1::uuid[])
  `, [ids]);
  res.json(rows);
});

module.exports = router;
