/**
 * generate-og.js
 * Generates og-image.jpg (1200×630) and favicon files.
 * Run once: node scripts/generate-og.js
 */
'use strict';

const sharp = require('sharp');
const path  = require('path');

const W = 1200;
const H = 630;

/* ── OG Image ────────────────────────────────────────────────────────────── */
const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="48%" r="48%">
      <stop offset="0%"   stop-color="#1e1e1e"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Outer border -->
  <rect x="36" y="36" width="${W-72}" height="${H-72}" fill="none" stroke="#222" stroke-width="1"/>

  <!-- Gold corner marks -->
  <line x1="36"       y1="36"       x2="100"      y2="36"       stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="36"       y1="36"       x2="36"       y2="100"      stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="${W-36}"  y1="36"       x2="${W-100}"  y2="36"       stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="${W-36}"  y1="36"       x2="${W-36}"   y2="100"      stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="36"       y1="${H-36}"  x2="100"      y2="${H-36}"  stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="36"       y1="${H-36}"  x2="36"       y2="${H-100}" stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="${W-36}"  y1="${H-36}"  x2="${W-100}"  y2="${H-36}"  stroke="#b89b6a" stroke-width="1.5"/>
  <line x1="${W-36}"  y1="${H-36}"  x2="${W-36}"   y2="${H-100}" stroke="#b89b6a" stroke-width="1.5"/>

  <!-- Location -->
  <text x="${W/2}" y="112" font-family="Georgia,serif" font-size="13" fill="#555" text-anchor="middle" letter-spacing="6">SALT LAKE CITY · UTAH</text>
  <line x1="490" y1="132" x2="710" y2="132" stroke="#252525" stroke-width="1"/>

  <!-- Wordmark -->
  <text x="${W/2}" y="284" font-family="Georgia,'Times New Roman',serif" font-size="108" fill="#fff" text-anchor="middle" letter-spacing="16">CHALTU</text>
  <text x="${W/2}" y="362" font-family="Georgia,'Times New Roman',serif" font-size="54"  fill="#fff" text-anchor="middle" letter-spacing="28">&amp; CO</text>

  <!-- Ornamental rule -->
  <line x1="424"      y1="394" x2="${W/2-18}" y2="394" stroke="#b89b6a" stroke-width="1"/>
  <polygon points="${W/2},383 ${W/2+8},394 ${W/2},405 ${W/2-8},394" fill="none" stroke="#b89b6a" stroke-width="1"/>
  <line x1="${W/2+18}" y1="394" x2="776"      y2="394" stroke="#b89b6a" stroke-width="1"/>

  <!-- Tagline -->
  <text x="${W/2}" y="446" font-family="Georgia,serif" font-size="22" font-style="italic" fill="#777" text-anchor="middle" letter-spacing="2">Expert Braiding &amp; Natural Hair Care</text>

  <!-- Services -->
  <text x="${W/2}" y="502" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3d3d3d" text-anchor="middle" letter-spacing="3">BOX BRAIDS · KNOTLESS · CORNROWS · LOCS · SEW-IN · SILK PRESS</text>

  <!-- URL -->
  <text x="${W/2}" y="566" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="#4a4a4a" text-anchor="middle" letter-spacing="3">chaltusalon.com</text>
</svg>`.trim();

/* ── Favicon SVG (square) ────────────────────────────────────────────────── */
function faviconSvg(size) {
  const r = size * 0.12;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#0a0a0a"/>
  <text x="${size/2}" y="${size*0.68}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="${size*0.56}"
        font-weight="400"
        fill="#ffffff"
        text-anchor="middle"
        letter-spacing="${size*0.04}">C</text>
  <line x1="${size*0.22}" y1="${size*0.80}" x2="${size*0.78}" y2="${size*0.80}"
        stroke="#b89b6a" stroke-width="${Math.max(1, size*0.025)}"/>
</svg>`.trim();
}

const ROOT = path.join(__dirname, '..');

async function run() {
  // OG image
  await sharp(Buffer.from(ogSvg))
    .jpeg({ quality: 93, mozjpeg: true })
    .toFile(path.join(ROOT, 'og-image.jpg'));
  console.log('✔  og-image.jpg  (1200×630)');

  // favicon 32×32 PNG
  await sharp(Buffer.from(faviconSvg(32)))
    .png()
    .toFile(path.join(ROOT, 'favicon.png'));
  console.log('✔  favicon.png   (32×32)');

  // Apple touch icon 180×180
  await sharp(Buffer.from(faviconSvg(180)))
    .png()
    .toFile(path.join(ROOT, 'apple-touch-icon.png'));
  console.log('✔  apple-touch-icon.png  (180×180)');

  // favicon.ico — embed 32×32 PNG inside ICO container
  const png32 = await sharp(Buffer.from(faviconSvg(32))).png().toBuffer();
  const ico = buildIco(png32);
  require('fs').writeFileSync(path.join(ROOT, 'favicon.ico'), ico);
  console.log('✔  favicon.ico   (32×32)');
}

// Minimal ICO writer (1 image, PNG data)
function buildIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);   // reserved
  header.writeUInt16LE(1, 2);   // type: icon
  header.writeUInt16LE(1, 4);   // image count

  const dir = Buffer.alloc(16);
  dir.writeUInt8(32, 0);        // width  (0 = 256, but 32 here)
  dir.writeUInt8(32, 1);        // height
  dir.writeUInt8(0,  2);        // colour count
  dir.writeUInt8(0,  3);        // reserved
  dir.writeUInt16LE(1, 4);      // colour planes
  dir.writeUInt16LE(32, 6);     // bits per pixel
  dir.writeUInt32LE(pngBuf.length, 8);       // size of image data
  dir.writeUInt32LE(header.length + dir.length, 12); // offset

  return Buffer.concat([header, dir, pngBuf]);
}

run().catch(err => { console.error('✗', err.message); process.exit(1); });
