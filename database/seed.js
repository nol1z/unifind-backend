// database/seed.js — Seeds admin user + 10 sample universities
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('🌱 Seeding UniFind database...');

  // Admin user
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@UniFind2025!', 12);
  await pool.query(`
    INSERT INTO users (name, email, password, role, is_verified, is_active)
    VALUES ($1, $2, $3, 'admin', true, true)
    ON CONFLICT (email) DO UPDATE SET password = $3
  `, [
    process.env.ADMIN_NAME || 'UniFind Admin',
    process.env.ADMIN_EMAIL || 'admin@unifind.uz',
    hash
  ]);
  console.log('✅ Admin user created:', process.env.ADMIN_EMAIL || 'admin@unifind.uz');

  // Get region IDs
  const { rows: regions } = await pool.query('SELECT id, slug FROM regions');
  const rMap = {};
  regions.forEach(r => rMap[r.slug] = r.id);

  // Sample universities
  const unis = [
    {
      name: 'National University of Uzbekistan', short_name: 'NUUz',
      region: 'tashkent_city', type: 'state', emoji: '🏛️',
      website: 'https://nuu.uz', dtm_min: 180,
      tuition_min: 8000000, tuition_max: 18000000, tuition_currency: 'UZS',
      programs_count: 85, established: 1918, rating: 4.6,
      field: 'economics', is_featured: true,
      description: 'The oldest and largest university in Uzbekistan, established in 1918.'
    },
    {
      name: 'Westminster International University', short_name: 'WIUT',
      region: 'tashkent_city', type: 'international', emoji: '🇬🇧',
      website: 'https://wiut.uz', dtm_min: 160,
      tuition_min: 4500, tuition_max: 7500, tuition_currency: 'USD',
      programs_count: 24, established: 2002, rating: 4.8,
      field: 'economics', is_featured: true,
      description: 'British university offering internationally recognised degrees.'
    },
    {
      name: 'Turin Polytechnic University in Tashkent', short_name: 'TTPU',
      region: 'tashkent_city', type: 'international', emoji: '🇮🇹',
      website: 'https://polito.uz', dtm_min: 155,
      tuition_min: 3800, tuition_max: 6200, tuition_currency: 'USD',
      programs_count: 18, established: 2009, rating: 4.7,
      field: 'engineering', is_featured: true,
      description: 'Italian polytechnic offering world-class engineering education.'
    },
    {
      name: 'Tashkent Medical Academy', short_name: 'TMA',
      region: 'tashkent_city', type: 'state', emoji: '🏥',
      website: 'https://tma.uz', dtm_min: 175,
      tuition_min: 9000000, tuition_max: 22000000, tuition_currency: 'UZS',
      programs_count: 15, established: 1920, rating: 4.5,
      field: 'medicine', is_featured: true,
      description: 'Premier medical institution of Uzbekistan since 1920.'
    },
    {
      name: 'Tashkent University of IT', short_name: 'TUIT',
      region: 'tashkent_city', type: 'state', emoji: '💻',
      website: 'https://tuit.uz', dtm_min: 162,
      tuition_min: 7500000, tuition_max: 16000000, tuition_currency: 'UZS',
      programs_count: 30, established: 2002, rating: 4.4,
      field: 'it', is_featured: false,
      description: "Uzbekistan's specialized IT university."
    },
    {
      name: 'Samarkand State University', short_name: 'SamDU',
      region: 'samarkand', type: 'state', emoji: '🕌',
      website: 'https://samdu.uz', dtm_min: 158,
      tuition_min: 7000000, tuition_max: 15000000, tuition_currency: 'UZS',
      programs_count: 70, established: 1927, rating: 4.3,
      field: 'economics', is_featured: false,
      description: 'One of the oldest universities in Central Asia.'
    },
  ];

  for (const u of unis) {
    const regionId = rMap[u.region];
    const { rows } = await pool.query(`
      INSERT INTO universities
        (name, short_name, region_id, type, emoji, website, dtm_min,
         tuition_min, tuition_max, tuition_currency, programs_count,
         established, rating, field, is_featured, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      u.name, u.short_name, regionId, u.type, u.emoji, u.website, u.dtm_min,
      u.tuition_min, u.tuition_max, u.tuition_currency, u.programs_count,
      u.established, u.rating, u.field, u.is_featured, u.description
    ]);

    if (rows.length) {
      const uid = rows[0].id;
      // Add sample majors
      const majors = [
        { name: 'Computer Science', dtm_min: u.dtm_min + 5, form: 'contract', field: 'it' },
        { name: 'Economics', dtm_min: u.dtm_min + 2, form: 'both', field: 'economics' },
        { name: 'Law', dtm_min: u.dtm_min + 8, form: 'contract', field: 'law' },
      ];
      for (const m of majors) {
        await pool.query(`
          INSERT INTO majors (university_id, name, dtm_min, form, field)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING
        `, [uid, m.name, m.dtm_min, m.form, m.field]);
      }
    }
  }

  console.log(`✅ ${unis.length} universities seeded`);
  console.log('\n🎉 Database seeded successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin login:');
  console.log('  Email:   ', process.env.ADMIN_EMAIL || 'admin@unifind.uz');
  console.log('  Password:', process.env.ADMIN_PASSWORD || 'Admin@UniFind2025!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await pool.end();
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
