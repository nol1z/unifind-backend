// routes/admin.js
const router = require('express').Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(auth, adminOnly);

// ── GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const [users, unis, reviews, views, dtm, saved] = await Promise.all([
    db.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE created_at > NOW()-INTERVAL\'7 days\') as week FROM users WHERE role=\'student\''),
    db.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_featured) as featured FROM universities'),
    db.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_approved=false) as pending FROM reviews'),
    db.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE created_at > NOW()-INTERVAL\'7 days\') as week FROM page_views'),
    db.query('SELECT COUNT(*) as total FROM dtm_searches'),
    db.query('SELECT COUNT(*) as total FROM saved_universities'),
  ]);
  res.json({
    users:     { total: +users.rows[0].total,   week: +users.rows[0].week },
    universities: { total: +unis.rows[0].total, featured: +unis.rows[0].featured },
    reviews:   { total: +reviews.rows[0].total, pending: +reviews.rows[0].pending },
    views:     { total: +views.rows[0].total,   week: +views.rows[0].week },
    dtm_searches: +dtm.rows[0].total,
    saved_total:  +saved.rows[0].total,
  });
});

// ── GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  const [topUnis, topSearches, daily] = await Promise.all([
    db.query(`
      SELECT u.name, u.short_name, COUNT(pv.id) as views
      FROM universities u
      LEFT JOIN page_views pv ON pv.university_id = u.id
        AND pv.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.id ORDER BY views DESC LIMIT 10
    `),
    db.query(`
      SELECT subject1 as subject, AVG(score)::int as avg_score, COUNT(*) as searches
      FROM dtm_searches WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY subject1 ORDER BY searches DESC LIMIT 10
    `),
    db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as views
      FROM page_views WHERE created_at > NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at) ORDER BY date
    `),
  ]);
  res.json({ topUnis: topUnis.rows, topSearches: topSearches.rows, daily: daily.rows });
});

// ── GET /api/admin/users
router.get('/users', async (req, res) => {
  const { page=1, limit=50, q, role } = req.query;
  const offset = (page-1)*limit;
  const wheres = [];
  const params = [];
  if (q) { params.push(`%${q}%`); wheres.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
  if (role) { params.push(role); wheres.push(`role=$${params.length}`); }
  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT id,name,email,role,is_active,is_verified,last_login,created_at
     FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  const cnt = await db.query(`SELECT COUNT(*) FROM users ${where}`, params.slice(0,-2));
  res.json({ data: rows, total: +cnt.rows[0].count });
});

// ── PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  const { is_active, role } = req.body;
  const { rows } = await db.query(
    'UPDATE users SET is_active=COALESCE($1,is_active), role=COALESCE($2,role) WHERE id=$3 RETURNING id,name,email,role,is_active',
    [is_active, role, req.params.id]
  );
  res.json(rows[0]);
});

// ── GET /api/admin/universities
router.get('/universities', async (req, res) => {
  const { page=1, limit=50, q } = req.query;
  const offset = (page-1)*limit;
  const params = q ? [`%${q}%`, limit, offset] : [limit, offset];
  const where  = q ? `WHERE u.name ILIKE $1` : '';
  const { rows } = await db.query(`
    SELECT u.*, r.name_en as region_en
    FROM universities u LEFT JOIN regions r ON u.region_id=r.id
    ${where} ORDER BY u.created_at DESC
    LIMIT $${params.length-1} OFFSET $${params.length}
  `, params);
  const cnt = await db.query(`SELECT COUNT(*) FROM universities ${where}`, q ? [`%${q}%`] : []);
  res.json({ data: rows, total: +cnt.rows[0].count });
});

// ── POST /api/admin/universities
router.post('/universities', async (req, res) => {
  const {
    name, short_name, region_id, type, emoji, website, dtm_min,
    tuition_min, tuition_max, tuition_currency, programs_count,
    established, description, field, is_featured
  } = req.body;
  const { rows } = await db.query(`
    INSERT INTO universities
      (name,short_name,region_id,type,emoji,website,dtm_min,tuition_min,tuition_max,
       tuition_currency,programs_count,established,description,field,is_featured)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
  `, [name,short_name,region_id,type,emoji,website,dtm_min,tuition_min,tuition_max,
      tuition_currency||'UZS',programs_count,established,description,field,is_featured||false]);
  res.status(201).json(rows[0]);
});

// ── PUT /api/admin/universities/:id
router.put('/universities/:id', async (req, res) => {
  const {
    name, short_name, region_id, type, emoji, website, dtm_min,
    tuition_min, tuition_max, tuition_currency, programs_count,
    established, description, field, is_featured, is_active
  } = req.body;
  const { rows } = await db.query(`
    UPDATE universities SET
      name=COALESCE($1,name), short_name=COALESCE($2,short_name),
      region_id=COALESCE($3,region_id), type=COALESCE($4,type),
      emoji=COALESCE($5,emoji), website=COALESCE($6,website),
      dtm_min=COALESCE($7,dtm_min), tuition_min=COALESCE($8,tuition_min),
      tuition_max=COALESCE($9,tuition_max), programs_count=COALESCE($10,programs_count),
      established=COALESCE($11,established), description=COALESCE($12,description),
      field=COALESCE($13,field), is_featured=COALESCE($14,is_featured),
      is_active=COALESCE($15,is_active)
    WHERE id=$16 RETURNING *
  `, [name,short_name,region_id,type,emoji,website,dtm_min,tuition_min,tuition_max,
      programs_count,established,description,field,is_featured,is_active,req.params.id]);
  res.json(rows[0]);
});

// ── DELETE /api/admin/universities/:id
router.delete('/universities/:id', async (req, res) => {
  await db.query('UPDATE universities SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ deleted: true });
});

// ── GET /api/admin/reviews (pending)
router.get('/reviews', async (req, res) => {
  const { approved } = req.query;
  const filter = approved === 'true' ? 'true' : 'false';
  const { rows } = await db.query(`
    SELECT r.*, u.name as uni_name, usr.name as reviewer
    FROM reviews r
    JOIN universities u ON r.university_id=u.id
    LEFT JOIN users usr ON r.user_id=usr.id
    WHERE r.is_approved=$1
    ORDER BY r.created_at DESC LIMIT 50
  `, [filter === 'true']);
  res.json(rows);
});

// ── PATCH /api/admin/reviews/:id
router.patch('/reviews/:id', async (req, res) => {
  const { is_approved } = req.body;
  const { rows } = await db.query(
    'UPDATE reviews SET is_approved=$1 WHERE id=$2 RETURNING *',
    [is_approved, req.params.id]
  );
  if (rows.length) {
    // Recalculate rating
    await db.query(`
      UPDATE universities SET
        rating=(SELECT COALESCE(AVG(overall_rating),0) FROM reviews WHERE university_id=$1 AND is_approved=true),
        rating_count=(SELECT COUNT(*) FROM reviews WHERE university_id=$1 AND is_approved=true)
      WHERE id=$1
    `, [rows[0].university_id]);
  }
  res.json(rows[0]);
});

// ── GET /api/admin/regions
router.get('/regions', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM regions ORDER BY name_en');
  res.json(rows);
});

// ── POST /api/admin/featured
router.post('/featured', async (req, res) => {
  const { university_id, plan, price_usd, starts_at, ends_at } = req.body;
  const { rows } = await db.query(`
    INSERT INTO featured_listings (university_id,plan,price_usd,starts_at,ends_at)
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [university_id, plan, price_usd, starts_at, ends_at]);
  await db.query('UPDATE universities SET is_featured=true WHERE id=$1', [university_id]);
  res.status(201).json(rows[0]);
});

module.exports = router;
