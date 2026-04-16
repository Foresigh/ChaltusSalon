/**
 * server.js — Chaltu's Salon Express backend
 * Start: node server.js   |   Dev: npm run dev
 */
'use strict';

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const cors       = require('cors');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const { pool, initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Email setup ──────────────────────────────────────────────────────────────
// Set EMAIL_USER + EMAIL_PASS (Gmail App Password) in Railway env vars to enable.
// Without them the booking still saves — emails are just skipped.
const SALON_EMAIL = process.env.EMAIL_USER || '';
const mailer = SALON_EMAIL ? nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SALON_EMAIL, pass: process.env.EMAIL_PASS || '' }
}) : null;
if (mailer) {
  console.log('✔  Email configured — notifications will send to', SALON_EMAIL);
} else {
  console.warn('⚠  EMAIL_USER not set — email notifications are disabled');
}

async function sendBookingEmails(booking) {
  if (!mailer) return; // email not configured — silent skip
  const { client_name, client_email, client_phone, service_name,
          stylist_name, preferred_date, preferred_time, message, id } = booking;

  const dateLabel = new Date(preferred_date + 'T12:00:00').toLocaleDateString('en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Notify Chaltu ────────────────────────────────────────────────────────
  mailer.sendMail({
    from: `"Chaltus Salon" <${SALON_EMAIL}>`,
    to: SALON_EMAIL,
    subject: `New Booking Request #${id} — ${client_name}`,
    html: `
      <h2>New Booking Request</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
        <tr><td style="padding:6px 16px 6px 0;color:#666">Client</td><td><strong>${client_name}</strong></td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Phone</td><td>${client_phone}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Email</td><td>${client_email || '—'}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Service</td><td>${service_name}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Stylist</td><td>${stylist_name}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Date</td><td>${dateLabel}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#666">Time</td><td>${preferred_time}</td></tr>
        ${message ? `<tr><td style="padding:6px 16px 6px 0;color:#666">Notes</td><td>${message}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;font-size:13px;color:#888">Booking ID: #${id} · Reply to this email or call the client to confirm.</p>
    `
  }).then(() => console.log('✔  Salon notification sent')).catch(e => console.error('✗  Salon email failed:', e.message));

  // ── Confirm to customer (only if they provided an email) ─────────────────
  if (!client_email) return;
  mailer.sendMail({
    from: `"Chaltus Salon" <${SALON_EMAIL}>`,
    to: client_email,
    subject: `Your appointment request at Chaltus Salon — ${dateLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">We received your request!</h2>
        <p style="color:#555;margin-top:0">We'll call or text you within 24 hours to confirm.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <table style="border-collapse:collapse;font-size:15px;width:100%">
          <tr><td style="padding:6px 0;color:#888;width:110px">Service</td><td><strong>${service_name}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#888">Stylist</td><td>${stylist_name}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Date</td><td>${dateLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Time</td><td>${preferred_time}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:14px;color:#555">
          <strong>Chaltus Salon</strong><br>
          1524 S State St, Salt Lake City, UT 84115<br>
          <a href="tel:+18013763976" style="color:#111">(801) 376-3976</a>
        </p>
        <p style="font-size:12px;color:#aaa">Need to change your request? Call or text us at (801) 376-3976.</p>
      </div>
    `
  }).then(() => console.log('✔  Customer confirmation sent to', client_email)).catch(e => console.error('✗  Customer email failed:', e.message));
}
const JWT_SECRET    = process.env.JWT_SECRET || 'chaltus-salon-2024-change-in-prod';
const USE_CLOUDINARY = !!process.env.CLOUDINARY_URL;

// Cloudinary config (auto-reads CLOUDINARY_URL env var)
if (USE_CLOUDINARY) {
  console.log('☁️  Cloudinary storage enabled');
}

// Ensure local uploads directory exists (used when Cloudinary is not set)
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

// ── Multer — memory storage so we can pipe to Cloudinary or save to disk ──────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    cb(ok.includes(path.extname(file.originalname).toLowerCase()) ? null : new Error('Images only'), true);
  }
});

// Save file: Cloudinary in production, local disk in dev
async function saveFile(buffer, originalname) {
  if (USE_CLOUDINARY) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'chaltus-salon', resource_type: 'image' },
        (err, res) => err ? reject(err) : resolve(res)
      );
      stream.end(buffer);
    });
    return { filename: result.public_id, url: result.secure_url };
  } else {
    const ext  = path.extname(originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), buffer);
    return { filename: name, url: `/uploads/${name}` };
  }
}

// Delete file: Cloudinary or local disk
async function deleteFile(filename) {
  if (USE_CLOUDINARY) {
    await cloudinary.uploader.destroy(filename).catch(() => {});
  } else {
    const fp = path.join(UPLOADS, filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
}

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
// url is stored directly in DB (Cloudinary URL or /uploads/filename)
const toGalleryItem = (i) => ({ ...i, url: i.url || `/uploads/${i.filename}` });

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
    const { filename, url } = await saveFile(req.file.buffer, req.file.originalname);
    const { rows } = await pool.query(
      'INSERT INTO gallery (filename, url, alt_text, label) VALUES ($1, $2, $3, $4) RETURNING *',
      [filename, url, alt_text, label]
    );
    res.json(toGalleryItem(rows[0]));
  } catch (err) {
    console.error('Gallery upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
    await deleteFile(item.filename);
    await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// STYLISTS
// ════════════════════════════════════════════════════════════════════════════════
const toStylist = (s) => ({ ...s, photo_url: s.photo_url || (s.photo ? `/uploads/${s.photo}` : null) });

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
    let photo = '', photo_url = '';
    if (req.file) {
      const saved = await saveFile(req.file.buffer, req.file.originalname);
      photo = saved.filename; photo_url = saved.url;
    }
    const { rows } = await pool.query(
      'INSERT INTO stylists (name, role, description, photo, photo_url, order_index) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, role, description, photo, photo_url, order_index]
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
    let photo = ex.photo, photo_url = ex.photo_url || '';
    if (req.file) {
      const saved = await saveFile(req.file.buffer, req.file.originalname);
      photo = saved.filename; photo_url = saved.url;
    }
    await pool.query(
      'UPDATE stylists SET name=$1,role=$2,description=$3,photo=$4,photo_url=$5,order_index=$6,active=$7 WHERE id=$8',
      [name, role, description, photo, photo_url, order_index, active, req.params.id]
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

// GET /api/availability?date=YYYY-MM-DD&stylist=Name
// - Specific stylist: returns that stylist's booked slots
// - No preference / omitted: returns slots where EVERY stylist is booked
app.get('/api/availability', async (req, res) => {
  const { date, stylist } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    if (stylist && stylist !== 'Any stylist') {
      // Block slots booked by this specific stylist
      const { rows } = await pool.query(
        `SELECT preferred_time FROM bookings
         WHERE preferred_date = $1 AND stylist_name = $2
           AND status IS DISTINCT FROM 'cancelled'`,
        [date, stylist]
      );
      return res.json({ booked: rows.map(r => r.preferred_time) });
    }

    // No preference: block a slot only when every stylist is taken
    // Fetch all stylist names and all bookings for this date in parallel
    const [stylistRes, bookingRes] = await Promise.all([
      pool.query(`SELECT name FROM stylists WHERE active = 1`),
      pool.query(
        `SELECT preferred_time, stylist_name FROM bookings
         WHERE preferred_date = $1 AND status IS DISTINCT FROM 'cancelled'
           AND stylist_name != 'Any stylist'`,
        [date]
      )
    ]);

    const allStylists = stylistRes.rows.map(r => r.name);
    if (allStylists.length === 0) return res.json({ booked: [] });

    // Build a map: time -> Set of booked stylist names
    const bookedMap = {};
    bookingRes.rows.forEach(({ preferred_time, stylist_name }) => {
      if (!bookedMap[preferred_time]) bookedMap[preferred_time] = new Set();
      bookedMap[preferred_time].add(stylist_name);
    });

    // A slot is fully blocked only when every stylist has a booking at that time
    const fullyBooked = Object.entries(bookedMap)
      .filter(([, names]) => allStylists.every(s => names.has(s)))
      .map(([time]) => time);

    res.json({ booked: fullyBooked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { client_name, client_email = '', client_phone, service_name,
            stylist_name = 'Any stylist', preferred_date, preferred_time, message = '' } = req.body;
    if (!client_name || !client_phone || !service_name || !preferred_date || !preferred_time)
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_name,client_email,client_phone,service_name,stylist_name,preferred_date,preferred_time,message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [client_name, client_email, client_phone, service_name, stylist_name, preferred_date, preferred_time, message]
    );
    const booking = rows[0];
    // Fire-and-forget — don't block the response on email delivery
    sendBookingEmails(booking);
    res.json({ id: booking.id, message: "Booking request received! We'll confirm within 24 hours." });
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

// ── Start — listen first, then init DB ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Chaltus Salon running → http://localhost:${PORT}`);
  console.log(`🔧 Admin panel         → http://localhost:${PORT}/admin\n`);
  console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);

  // Init DB after server is already accepting connections
  initDB()
    .then(() => console.log('✔  Database ready'))
    .catch(err => console.error('❌  Database init failed:', err.message, err.stack));
});
