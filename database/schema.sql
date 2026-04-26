-- ================================================
-- UniFind Database Schema
-- PostgreSQL
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------
-- USERS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','university')),
  avatar_url  TEXT,
  language    VARCHAR(5) DEFAULT 'en',
  theme       VARCHAR(10) DEFAULT 'dark',
  dtm_score   INTEGER,
  field       VARCHAR(50),
  region_pref VARCHAR(50),
  budget      INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  last_login  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ------------------------------------------------
-- REGIONS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS regions (
  id         SERIAL PRIMARY KEY,
  slug       VARCHAR(50) UNIQUE NOT NULL,
  name_en    VARCHAR(100) NOT NULL,
  name_uz    VARCHAR(100) NOT NULL,
  name_ru    VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------
-- UNIVERSITIES
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS universities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  short_name      VARCHAR(20),
  region_id       INTEGER REFERENCES regions(id),
  type            VARCHAR(20) NOT NULL CHECK (type IN ('state','private','international')),
  emoji           VARCHAR(10) DEFAULT '🏛️',
  logo_url        TEXT,
  website         VARCHAR(255),
  rating          NUMERIC(3,2) DEFAULT 0,
  rating_count    INTEGER DEFAULT 0,
  programs_count  INTEGER DEFAULT 0,
  dtm_min         INTEGER,
  tuition_min     INTEGER,
  tuition_max     INTEGER,
  tuition_currency VARCHAR(10) DEFAULT 'UZS',
  established     INTEGER,
  description     TEXT,
  description_uz  TEXT,
  description_ru  TEXT,
  field           VARCHAR(50),
  is_featured     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_universities_region ON universities(region_id);
CREATE INDEX idx_universities_type   ON universities(type);
CREATE INDEX idx_universities_rating ON universities(rating DESC);
CREATE INDEX idx_universities_dtm    ON universities(dtm_min);

-- Full-text search index
CREATE INDEX idx_universities_search ON universities
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ------------------------------------------------
-- MAJORS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS majors (
  id            SERIAL PRIMARY KEY,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  name_uz       VARCHAR(150),
  name_ru       VARCHAR(150),
  dtm_min       INTEGER,
  form          VARCHAR(20) DEFAULT 'contract' CHECK (form IN ('contract','quota','both')),
  tuition       INTEGER,
  seats_quota   INTEGER DEFAULT 0,
  seats_contract INTEGER DEFAULT 0,
  duration_years INTEGER DEFAULT 4,
  field         VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_majors_university ON majors(university_id);
CREATE INDEX idx_majors_field      ON majors(field);

-- ------------------------------------------------
-- PARTNERS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id            SERIAL PRIMARY KEY,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  partner_name  VARCHAR(200) NOT NULL,
  partner_country VARCHAR(50),
  partner_url   TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partners_university ON partners(university_id);

-- ------------------------------------------------
-- ADMISSIONS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS admissions (
  id              SERIAL PRIMARY KEY,
  university_id   UUID REFERENCES universities(id) ON DELETE CASCADE,
  year            INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  app_open_date   DATE,
  app_close_date  DATE,
  exam_date       DATE,
  results_date    DATE,
  required_docs   TEXT[],
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------
-- REVIEWS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID REFERENCES universities(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  overall_rating  INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  teaching_rating INTEGER CHECK (teaching_rating BETWEEN 1 AND 5),
  facility_rating INTEGER CHECK (facility_rating BETWEEN 1 AND 5),
  campus_rating   INTEGER CHECK (campus_rating BETWEEN 1 AND 5),
  employ_rating   INTEGER CHECK (employ_rating BETWEEN 1 AND 5),
  body            TEXT,
  year_of_study   VARCHAR(30),
  is_verified     BOOLEAN DEFAULT FALSE,
  is_approved     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_university ON reviews(university_id);
CREATE INDEX idx_reviews_approved   ON reviews(is_approved);

-- ------------------------------------------------
-- SAVED UNIVERSITIES
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_universities (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, university_id)
);

CREATE INDEX idx_saved_user ON saved_universities(user_id);

-- ------------------------------------------------
-- COMPARISONS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS comparisons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  university_ids  UUID[] NOT NULL,
  name            VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comparisons_user ON comparisons(user_id);

-- ------------------------------------------------
-- DTM SEARCHES (analytics)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS dtm_searches (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  score       INTEGER NOT NULL,
  subject1    VARCHAR(50),
  score1      INTEGER,
  subject2    VARCHAR(50),
  score2      INTEGER,
  subject3    VARCHAR(50),
  score3      INTEGER,
  region_f    VARCHAR(50),
  field_f     VARCHAR(50),
  results_cnt INTEGER,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------
-- PAGE VIEWS (analytics)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS page_views (
  id            SERIAL PRIMARY KEY,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_views_university ON page_views(university_id);
CREATE INDEX idx_views_date       ON page_views(created_at);

-- ------------------------------------------------
-- FEATURED LISTINGS (monetization)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS featured_listings (
  id            SERIAL PRIMARY KEY,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  plan          VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic','premium','enterprise')),
  price_usd     NUMERIC(10,2),
  starts_at     TIMESTAMP NOT NULL,
  ends_at       TIMESTAMP NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------
-- REFRESH TOKENS
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_user  ON refresh_tokens(user_id);

-- ------------------------------------------------
-- AUTO-UPDATE updated_at trigger
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER universities_updated_at
  BEFORE UPDATE ON universities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------
-- SEED REGIONS
-- ------------------------------------------------
INSERT INTO regions (slug, name_en, name_uz, name_ru) VALUES
  ('tashkent_city',   'Tashkent City',   'Toshkent shahri',      'г. Ташкент'),
  ('tashkent_reg',    'Tashkent Region', 'Toshkent viloyati',    'Ташкентская обл.'),
  ('samarkand',       'Samarkand',       'Samarqand',            'Самарканд'),
  ('fergana',         'Fergana',         'Farg''ona',            'Фергана'),
  ('andijan',         'Andijan',         'Andijon',              'Андижан'),
  ('namangan',        'Namangan',        'Namangan',             'Наманган'),
  ('bukhara',         'Bukhara',         'Buxoro',               'Бухара'),
  ('kashkadarya',     'Kashkadarya',     'Qashqadaryo',          'Кашкадарья'),
  ('surkhandarya',    'Surkhandarya',    'Surxondaryo',          'Сурхандарья'),
  ('khorezm',         'Khorezm',         'Xorazm',               'Хорезм'),
  ('navoi',           'Navoi',           'Navoiy',               'Навои'),
  ('jizzakh',         'Jizzakh',         'Jizzax',               'Джизак'),
  ('syrdarya',        'Syrdarya',        'Sirdaryo',             'Сырдарья'),
  ('karakalpakstan',  'Karakalpakstan',  'Qoraqalpog''iston',   'Каракалпакстан')
ON CONFLICT (slug) DO NOTHING;
