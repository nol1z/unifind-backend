# UniFind Backend API

University discovery platform backend for Uzbekistan.
Built with Node.js + Express + PostgreSQL.

---

## Quick Start (5 steps)

### Step 1 — Install Node.js & PostgreSQL
- Download Node.js 18+: https://nodejs.org
- Download PostgreSQL 15+: https://www.postgresql.org/download
- During PostgreSQL install, set a password for the `postgres` user — remember it

### Step 2 — Create the database
Open pgAdmin or psql and run:
```sql
CREATE DATABASE unifind;
```

### Step 3 — Configure environment
```bash
cd unifind-backend
cp .env.example .env
```
Open `.env` and update these values:
```
DB_PASSWORD=your_postgres_password
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=YourStrongPassword123!
JWT_SECRET=change_this_to_a_long_random_string_at_least_64_chars
```

### Step 4 — Install & setup
```bash
npm install
node database/setup.js    # Creates all tables
node database/seed.js     # Creates admin user + sample data
```

### Step 5 — Run
```bash
npm run dev       # Development (auto-restarts on changes)
npm start         # Production
```

Server starts at: http://localhost:5000

---

## Admin Panel

Open your browser: **http://localhost:5000/admin**

Login with the email and password from your `.env` file.

### What you can do in the Admin Panel:
| Section | What it does |
|---------|-------------|
| Dashboard | Overview stats, charts, pending reviews |
| Universities | Add, edit, hide/show any university |
| Users | See all students, ban/unban accounts |
| Reviews | Approve or reject student reviews |
| Revenue | Manage featured listings (monetization) |
| Analytics | See top views, DTM search trends |
| API Docs | Full reference of all API endpoints |
| Settings | Configure API URL and token |

---

## API Endpoints

Base URL: `http://localhost:5000`

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new student |
| POST | /api/auth/login | Login → returns JWT token |
| POST | /api/auth/refresh | Refresh expired token |
| POST | /api/auth/logout | Logout (invalidate refresh token) |
| GET | /api/auth/me | Get current user (🔒) |
| PATCH | /api/auth/me | Update profile (🔒) |

### Universities
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/universities | List with filters + pagination |
| GET | /api/universities/featured | Featured universities |
| GET | /api/universities/dtm?score=165 | DTM matching |
| GET | /api/universities/:id | Full detail page data |
| POST | /api/universities/:id/reviews | Submit review (🔒) |

#### Filter params for GET /api/universities:
- `q` — search query
- `type` — state / private / international
- `region` — region slug (e.g. tashkent_city)
- `field` — economics / engineering / medicine / it / law
- `rating_min` — minimum rating (e.g. 4.0)
- `dtm_max` — maximum DTM score filter
- `sort` — rating / dtm_asc / dtm_desc / name / newest
- `page` — page number (default 1)
- `limit` — results per page (default 20)

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/search?q=medicine | Search universities + majors |

### Regions
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/regions | All regions with university count |
| GET | /api/regions/:slug | Single region |

### User (🔒 requires token)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users/saved | Get saved universities |
| POST | /api/users/saved/:id | Save a university |
| DELETE | /api/users/saved/:id | Unsave |
| GET | /api/users/comparisons | Get saved comparisons |
| POST | /api/users/comparisons | Save a comparison |

### Admin (🛡️ admin role required)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/stats | Dashboard stats |
| GET | /api/admin/analytics | Traffic + search analytics |
| GET | /api/admin/users | All users (paginated) |
| PATCH | /api/admin/users/:id | Ban/unban user |
| GET | /api/admin/universities | All universities |
| POST | /api/admin/universities | Create university |
| PUT | /api/admin/universities/:id | Update university |
| DELETE | /api/admin/universities/:id | Soft delete |
| GET | /api/admin/reviews | Pending/approved reviews |
| PATCH | /api/admin/reviews/:id | Approve or reject review |
| GET | /api/admin/regions | All regions |
| POST | /api/admin/featured | Create featured listing |

---

## Connecting the Frontend

In your `unifind_v3.html`, replace the hardcoded `UNIS` array with API calls:

```javascript
// Replace: const ALL_UNIS = [...UNIS, ...MORE_UNIS];
// With:

const API_BASE = 'http://localhost:5000';

async function fetchUniversities(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/api/universities?${params}`);
  const data = await res.json();
  return data.data; // array of universities
}

async function fetchDTMMatches(score, region, field) {
  const res = await fetch(`${API_BASE}/api/universities/dtm?score=${score}&region=${region}&field=${field}`);
  return res.json(); // { qualify: [], close: [] }
}

async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  localStorage.setItem('uf_token', data.token);
  localStorage.setItem('uf_user', JSON.stringify(data.user));
  return data;
}

async function saveUniversity(universityId) {
  const token = localStorage.getItem('uf_token');
  await fetch(`${API_BASE}/api/users/saved/${universityId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}
```

---

## Deployment (go live)

### Option A — Railway (easiest, ~$5/month)
1. Push code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add PostgreSQL plugin → copy DATABASE_URL
4. Set environment variables in Railway dashboard
5. Done — Railway gives you a public URL

### Option B — Render (free tier available)
1. Push to GitHub
2. render.com → New Web Service → connect repo
3. Add PostgreSQL database
4. Set env vars → Deploy

### Option C — VPS (DigitalOcean/Hetzner)
```bash
# On your server:
git clone your-repo
cd unifind-backend
npm install --production
npm install -g pm2
pm2 start server.js --name unifind-api
pm2 save
pm2 startup
```
Then set up Nginx as reverse proxy for port 5000.

---

## Project Structure
```
unifind-backend/
├── server.js              # Entry point
├── package.json
├── .env.example           # Copy to .env
├── config/
│   └── db.js             # PostgreSQL connection pool
├── middleware/
│   ├── auth.js           # JWT verification
│   ├── errorHandler.js   # Global error handler
│   ├── rateLimiter.js    # Rate limiting configs
│   └── upload.js         # File upload (multer)
├── routes/
│   ├── auth.js           # Register, login, refresh
│   ├── universities.js   # CRUD + DTM + reviews
│   ├── users.js          # Saved, comparisons
│   ├── regions.js        # Region list
│   ├── search.js         # Full-text search
│   └── admin.js          # Admin-only routes
├── database/
│   ├── schema.sql        # All table definitions
│   ├── setup.js          # Run once to create tables
│   └── seed.js           # Admin user + sample data
├── admin/
│   └── index.html        # Admin panel UI
└── uploads/              # Uploaded images
```

---

## Security Checklist before going live
- [ ] Change JWT_SECRET to a random 64+ character string
- [ ] Change ADMIN_PASSWORD to a strong password
- [ ] Set NODE_ENV=production
- [ ] Enable SSL on your database connection
- [ ] Set CORS_ORIGINS to only your actual domain
- [ ] Use HTTPS (handled by Railway/Render automatically)

---

Built for UniFind — Uzbekistan's #1 University Discovery Platform
