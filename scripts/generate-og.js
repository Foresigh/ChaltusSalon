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
    <!-- Subtle vignette gradient -->
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#080808"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>

  <!-- Gold border frame — top/bottom thick bars -->
  <rect x="0" y="0"    width="${W}" height="14" fill="#b89b6a"/>
  <rect x="0" y="${H-14}" width="${W}" height="14" fill="#b89b6a"/>
  <!-- Gold border frame — left/right bars -->
  <rect x="0"     y="0" width="14" height="${H}" fill="#b89b6a"/>
  <rect x="${W-14}" y="0" width="14" height="${H}" fill="#b89b6a"/>

  <!-- Inner hairline border -->
  <rect x="26" y="26" width="${W-52}" height="${H-52}"
        fill="none" stroke="#b89b6a" stroke-width="0.8" opacity="0.45"/>

  <!-- ── LEFT PANEL: Scissors icon ──────────────────────────── -->
  <!-- Vertical gold divider -->
  <rect x="440" y="60" width="1.5" height="${H-120}" fill="#b89b6a" opacity="0.4"/>

  <!-- Scissors centered in left panel (x=227, y=315) -->
  <g transform="translate(227,315)">
    <!-- Upper blade -->
    <line x1="-100" y1="-28" x2="105" y2="-5"
          stroke="#b89b6a" stroke-width="8" stroke-linecap="round"/>
    <!-- Lower blade -->
    <line x1="-100" y1="28"  x2="105" y2="5"
          stroke="#b89b6a" stroke-width="8" stroke-linecap="round"/>
    <!-- Upper ring handle -->
    <circle cx="-118" cy="-40" r="25"
            fill="none" stroke="#b89b6a" stroke-width="7"/>
    <!-- Lower ring handle -->
    <circle cx="-118" cy="40" r="25"
            fill="none" stroke="#b89b6a" stroke-width="7"/>
    <!-- Pivot rivet -->
    <circle cx="0" cy="0" r="8" fill="#b89b6a"/>
    <!-- Small shine dot on pivot -->
    <circle cx="-3" cy="-3" r="2.5" fill="#d4b98a"/>
  </g>

  <!-- SALON tag under scissors -->
  <text x="227" y="420"
    font-family="Arial,Helvetica,sans-serif"
    font-size="13" font-weight="700"
    fill="#b89b6a" text-anchor="middle" letter-spacing="5">
    HAIR SALON
  </text>
  <text x="227" y="444"
    font-family="Arial,Helvetica,sans-serif"
    font-size="12" font-weight="400"
    fill="#666666" text-anchor="middle" letter-spacing="3">
    SALT LAKE CITY, UTAH
  </text>

  <!-- ── RIGHT PANEL: Name + identity ──────────────────────── -->

  <!-- CHALTU'S — large serif name -->
  <text x="820" y="230"
    font-family="Georgia,'Times New Roman',serif"
    font-size="115" font-weight="400"
    fill="#ffffff" text-anchor="middle" letter-spacing="6">
    CHALTU
  </text>

  <!-- Gold rule under name -->
  <rect x="490" y="252" width="660" height="3" fill="#b89b6a"/>

  <!-- LUXURY HAIR SALON — large gold, most prominent -->
  <text x="820" y="320"
    font-family="Arial,Helvetica,sans-serif"
    font-size="42" font-weight="700"
    fill="#b89b6a" text-anchor="middle" letter-spacing="8">
    LUXURY HAIR SALON
  </text>

  <!-- Tagline -->
  <text x="820" y="390"
    font-family="Arial,Helvetica,sans-serif"
    font-size="20" font-weight="400"
    fill="#777777" text-anchor="middle" letter-spacing="3">
    EXPERT BRAIDING &amp; NATURAL HAIR CARE
  </text>

  <!-- Service dots -->
  <text x="820" y="448"
    font-family="Arial,Helvetica,sans-serif"
    font-size="15" font-weight="400"
    fill="#555555" text-anchor="middle" letter-spacing="2">
    Box Braids  ·  Knotless  ·  Locs  ·  Cornrows  ·  Twists
  </text>

  <!-- URL bar at bottom -->
  <rect x="0" y="${H-68}" width="${W}" height="54" fill="#0d0d0d"/>
  <rect x="0" y="${H-68}" width="${W}" height="2"  fill="#b89b6a"/>
  <text x="${W/2}" y="${H-32}"
    font-family="Arial,Helvetica,sans-serif"
    font-size="19" font-weight="700"
    fill="#b89b6a" text-anchor="middle" letter-spacing="5">
    CHALTUSALON.COM
  </text>
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
