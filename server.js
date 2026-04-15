/**
 * server.js — Chaltu's Salon Express backend
 * Start: node server.js   |   Dev: npm run dev
 */
'use strict';

const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const multer    = require('multer');
const cors      = require('cors');
const { pool, initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chaltus-salon-2024-change-in-prod';

// Ensure uploads directory exists
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving — ORDER MATTERS
app.use('/uploads', express.static(UPLOADS));
app.use('/images',  express.static(path.join(__dirname, 'images')));
app.use('/admin',   express.static(path.join(__dirname, 'admin')));
app.use(express.static(__dirname));

// ── Multer ─────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename:    (_req, file,  cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    cb(ok.includes(path.extname(file.originalname).toLowerCase()) ? null : new Error('Images only'), true);
  }
});

// ── Auth middleware ────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = (await pool.query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const user = (await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(400).json({ error: 'Current password is incorrect' });
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// GALLERY
// ════════════════════════════════════════════════════════════════════════════════
const toGalleryItem = (i) => ({ ...i, url: `/uploads/${i.filename}` });

app.get('/api/gallery', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM gallery ORDER BY created_at DESC');
    res.json(rows.map(toGalleryItem));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/gallery', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const { alt_text = '', label = '' } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO gallery (filename, alt_text, label) VALUES ($1, $2, $3) RETURNING *',
      [req.file.filename, alt_text, label]
    );
    res.json(toGalleryItem(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/gallery/:id', auth, async (req, res) => {
  try {
    const { alt_text, label } = req.body;
    await pool.query('UPDATE gallery SET alt_text = $1, label = $2 WHERE id = $3', [alt_text, label, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/gallery/:id', auth, async (req, res) => {
  try {
    const item = (await pool.query('SELECT filename FROM gallery WHERE id = $1', [req.params.id])).rows[0];
    if (!item) return res.status(404).json({ error: 'Not found' });
    const fp = path.join(UPLOADS, item.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// STYLISTS
// ════════════════════════════════════════════════════════════════════════════════
const toStylist = (s) => ({ ...s, photo_url: s.photo ? `/uploads/${s.photo}` : null });

app.get('/api/stylists', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stylists WHERE active = 1 ORDER BY order_index, id');
    res.json(rows.map(toStylist));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/stylists/all', auth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stylists ORDER BY order_index, id');
    res.json(rows.map(toStylist));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/stylists', auth, upload.single('photo'), async (req, res) => {
  try {
    const { name, role, description = '', order_index = 99 } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Name and role required' });
    const photo = req.file?.filename ?? '';
    const { rows } = await pool.query(
      'INSERT INTO stylists (name, role, description, photo, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, role, description, photo, order_index]
    );
    res.json(toStylist(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/stylists/:id', auth, upload.single('photo'), async (req, res) => {
  try {
    const ex = (await pool.query('SELECT * FROM stylists WHERE id = $1', [req.params.id])).rows[0];
    if (!ex) return res.status(404).json({ error: 'Not found' });
    const { name = ex.name, role = ex.role, description = ex.description,
            order_index = ex.order_index, active = ex.active } = req.body;
    const photo = req.file?.filename ?? ex.photo;
    await pool.query(
      'UPDATE stylists SET name=$1,role=$2,description=$3,photo=$4,order_index=$5,active=$6 WHERE id=$7',
      [name, role, description, photo, order_index, active, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/stylists/:id', auth, async (req, res) => {
  try {
    await pool.query('UPDATE stylists SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/services', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM services WHERE active = 1 ORDER BY category, order_index');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/services/all', auth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM services ORDER BY category, order_index');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/services', auth, async (req, res) => {
  try {
    const { category, name, duration, price, price_is_from = 0, order_index = 99 } = req.body;
    if (!category || !name || !duration || !price)
      return res.status(400).json({ error: 'category, name, duration and price are required' });
    const { rows } = await pool.query(
      'INSERT INTO services (category,name,duration,price,price_is_from,order_index) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [category, name, duration, price, price_is_from ? 1 : 0, order_index]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/services/:id', auth, async (req, res) => {
  try {
    const ex = (await pool.query('SELECT * FROM services WHERE id = $1', [req.params.id])).rows[0];
    if (!ex) return res.status(404).json({ error: 'Not found' });
    const { category = ex.category, name = ex.name, duration = ex.duration, price = ex.price,
            price_is_from = ex.price_is_from, order_index = ex.order_index, active = ex.active } = req.body;
    await pool.query(
      'UPDATE services SET category=$1,name=$2,duration=$3,price=$4,price_is_from=$5,order_index=$6,active=$7 WHERE id=$8',
      [category, name, duration, price, price_is_from ? 1 : 0, order_index, active, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/services/:id', auth, async (req, res) => {
  try {
    await pool.query('UPDATE services SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ════════════════════════════════════════════════════════════════════════════════
app.post('/api/bookings', async (req, res) => {
  try {
    const { client_name, client_email = '', client_phone, service_name,
            stylist_name = 'No preference', preferred_date, preferred_time, message = '' } = req.body;
    if (!client_name || !client_phone || !service_name || !preferred_date || !preferred_time)
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_name,client_email,client_phone,service_name,stylist_name,preferred_date,preferred_time,message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [client_name, client_email, client_phone, service_name, stylist_name, preferred_date, preferred_time, message]
    );
    res.json({ id: rows[0].id, message: "Booking request received! We'll confirm within 24 hours." });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const { status, date } = req.query;
    const where  = [];
    const params = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (date)   { params.push(date);   where.push(`preferred_date = $${params.length}`); }
    const sql = 'SELECT * FROM bookings' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const valid = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/bookings/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/stats', auth, async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [total, pending, confirmed, todayCount, recent] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM bookings'),
      pool.query("SELECT COUNT(*) AS c FROM bookings WHERE status='pending'"),
      pool.query("SELECT COUNT(*) AS c FROM bookings WHERE status='confirmed'"),
      pool.query('SELECT COUNT(*) AS c FROM bookings WHERE preferred_date = $1', [today]),
      pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 8'),
    ]);
    res.json({
      total:     parseInt(total.rows[0].c, 10),
      pending:   parseInt(pending.rows[0].c, 10),
      confirmed: parseInt(confirmed.rows[0].c, 10),
      today:     parseInt(todayCount.rows[0].c, 10),
      recent:    recent.rows,
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Start ──────────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Chaltus Salon running → http://localhost:${PORT}`);
      console.log(`🔧 Admin panel         → http://localhost:${PORT}/admin\n`);
    });
  })
  .catch(err => {
    console.error('❌  Database init failed:', err.message);
    process.exit(1);
  });
