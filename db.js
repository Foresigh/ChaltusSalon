/**
 * db.js — PostgreSQL setup & seeding
 * Uses the pg Pool. Call initDB() once on server start.
 */
'use strict';

const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ── Schema ────────────────────────────────────────────────────────────────────
async function initDB() {
  // Migrate existing tables — safe to run every boot
  await pool.query(`
    ALTER TABLE IF EXISTS gallery   ADD COLUMN IF NOT EXISTS url       TEXT DEFAULT '';
    ALTER TABLE IF EXISTS stylists  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
  `).catch(() => {}); // ignore if tables don't exist yet (first boot)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id       SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL,
      url        TEXT DEFAULT '',
      alt_text   TEXT DEFAULT '',
      label      TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stylists (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL,
      description TEXT DEFAULT '',
      photo       TEXT DEFAULT '',
      photo_url   TEXT DEFAULT '',
      order_index INTEGER DEFAULT 0,
      active      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS services (
      id            SERIAL PRIMARY KEY,
      category      TEXT NOT NULL,
      name          TEXT NOT NULL,
      duration      TEXT NOT NULL,
      price         TEXT NOT NULL,
      price_is_from INTEGER DEFAULT 0,
      order_index   INTEGER DEFAULT 0,
      active        INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id             SERIAL PRIMARY KEY,
      client_name    TEXT NOT NULL,
      client_email   TEXT DEFAULT '',
      client_phone   TEXT NOT NULL,
      service_name   TEXT NOT NULL,
      stylist_name   TEXT DEFAULT 'No preference',
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      message        TEXT DEFAULT '',
      status         TEXT DEFAULT 'pending',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Seed: admin user ────────────────────────────────────────────────────────
  const adminExists = (await pool.query('SELECT id FROM users WHERE username = $1', ['admin'])).rows[0];
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hash]);
    console.log('✔  Admin user created  →  username: admin  /  password: admin123');
    console.log('   ⚠  Change the password after first login (Settings tab).');
  }

  // ── Seed: Chaltu Newman stylist ─────────────────────────────────────────────
  const chaltuExists = (await pool.query('SELECT id FROM stylists WHERE name = $1', ['Chaltu Newman'])).rows[0];
  if (!chaltuExists) {
    // Copy her photo from /images into /uploads so it's served by Express
    const srcPhoto  = path.join(__dirname, 'images', 'ChaltuNewman.jpg');
    const destName  = 'ChaltuNewman.jpg';
    const destPhoto = path.join(__dirname, 'uploads', destName);
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (fs.existsSync(srcPhoto) && !fs.existsSync(destPhoto)) {
      fs.copyFileSync(srcPhoto, destPhoto);
    }
    await pool.query(
      'INSERT INTO stylists (name, role, description, photo, order_index) VALUES ($1, $2, $3, $4, $5)',
      [
        'Chaltu Newman',
        'Owner & Master Stylist · Paul Mitchell Graduate',
        'Founder of Chaltus Salon and a Paul Mitchell-trained master stylist. Chaltu specializes in protective braiding, natural hair care, loc services, and Ethiopian hair traditions — bringing precision craftsmanship to every appointment.',
        destName,
        1,
      ]
    );
    console.log('✔  Chaltu Newman added as master stylist.');
  }

  // ── Seed: services ───────────────────────────────────────────────────────────
  const svcCount = (await pool.query('SELECT COUNT(*) AS c FROM services')).rows[0].c;
  if (parseInt(svcCount, 10) === 0) {
    const rows = [
      // Braids & Protective Styles
      ['Braids & Protective Styles', 'Jumbo Box Braids',            '1 hr 30 min', '150',   0,  1],
      ['Braids & Protective Styles', '20" Small Box Braids',        '5 hr 30 min', '300',   1,  2],
      ['Braids & Protective Styles', '20" Medium Box Braids',       '4 hr 30 min', '200',   1,  3],
      ['Braids & Protective Styles', '20" Esh-Medium Box Braids',   '5 hr 30 min', '250',   1,  4],
      ['Braids & Protective Styles', 'Goddess Box Braids',          '5 hr 30 min', '210',   1,  5],
      ['Braids & Protective Styles', 'Knotless Braids',             '5 hr 30 min', '210',   1,  6],
      ['Braids & Protective Styles', 'Twists or Box Braids w/ Cuts','2 hr',        '75',    0,  7],
      ['Braids & Protective Styles', 'Box Braids Take Out',         '30 min',      '60',    0,  8],
      // Cornrows & Dutch Braids
      ['Cornrows & Dutch Braids', 'Medium Cornrows (Natural Hair)',  '1 hr',        '50',   0,  1],
      ['Cornrows & Dutch Braids', 'Cornrow Styles',                  '2 hr',        '70',   1,  2],
      ['Cornrows & Dutch Braids', '2 Dutch Braids with Extensions',  '30 min',      '50',   0,  3],
      ['Cornrows & Dutch Braids', 'Take Out Cornrows',               '1 hr',        '45',   0,  4],
      // Loc Services
      ['Loc Services', 'Half Head Dread Re-twist',             '2 hr',   '75',    0, 1],
      ['Loc Services', 'Full Head Dreads Re-twist',            '30 min', '90',    0, 2],
      ['Loc Services', 'Crochet Locking Method — Half Head',   '3 hr',   '150',   0, 3],
      ['Loc Services', 'Crochet Locking Method — Full Head',   '4 hr',   '200',   0, 4],
      // Sew-in & Crochet
      ['Sew-in & Crochet', 'Sew In',          '2 hr 30 min', '200', 0, 1],
      ['Sew-in & Crochet', 'Sew In Take Out', '1 hr',        '40',  0, 2],
      ['Sew-in & Crochet', 'Crochet Style',   '2 hr',        '150', 0, 3],
      // Natural Hair & Twists
      ['Natural Hair & Twists', 'Two Strand Twist — Natural, Full Head',    '1 hr 30 min', '80',  0, 1],
      ['Natural Hair & Twists', 'Two Strand Twist — Extensions, Full Head', '4 hr',        '200', 0, 2],
      ['Natural Hair & Twists', 'Silk Press or Straightening',              '1 hr 30 min', '70',  0, 3],
      ['Natural Hair & Twists', 'Hair Cuts',                                '40 min',      '40',  0, 4],
      // Wash & Style
      ['Wash & Style', 'Shampoo',             '15 min', '15', 0, 1],
      ['Wash & Style', 'Style',               '35 min', '30', 1, 2],
      ['Wash & Style', 'Shampoo and Blow Dry','1 hr',   '55', 0, 3],
      // Treatments & Beauty
      ['Treatments & Beauty', 'Ethiopian Butter Deep Conditioning', '1 hr',   '100',   0, 1],
      ['Treatments & Beauty', 'Eyebrow or Chin Waxing',             '30 min', '20',    0, 2],
      ['Treatments & Beauty', 'Miscellaneous Service',              '30 min', 'Varies',0, 3],
    ];
    for (const [cat, name, dur, price, from, ord] of rows) {
      await pool.query(
        'INSERT INTO services (category,name,duration,price,price_is_from,order_index) VALUES ($1,$2,$3,$4,$5,$6)',
        [cat, name, dur, price, from, ord]
      );
    }
    console.log(`✔  ${rows.length} services seeded.`);
  }
}

module.exports = { pool, initDB };
