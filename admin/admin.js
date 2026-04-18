/**
 * admin.js — Chaltus Salon Admin Panel
 * Vanilla JS, no frameworks.
 */
'use strict';

const API = '';  // same origin

// ── Helpers ────────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

let token = localStorage.getItem('chaltus_admin_token') || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
    ...opts,
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

async function apiUpload(path, formData) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

function fmt(date) {
  if (!date) return '—';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(s) {
  return `<span class="status status--${s}">${s}</span>`;
}

function escHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Confirm modal
function confirm(msg) {
  return new Promise(resolve => {
    const overlay = $('#confirm-modal');
    $('#confirm-msg').textContent = msg;
    overlay.hidden = false;
    const yes = $('#confirm-yes');
    const no  = $('#confirm-no');
    const done = (v) => { overlay.hidden = true; yes.replaceWith(yes.cloneNode(true)); no.replaceWith(no.cloneNode(true)); resolve(v); };
    $('#confirm-yes').addEventListener('click', () => done(true),  { once: true });
    $('#confirm-no').addEventListener('click',  () => done(false), { once: true });
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function logout() {
  token = '';
  localStorage.removeItem('chaltus_admin_token');
  $('#app').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-screen').style.display = '';
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  const body = JSON.stringify({ username: $('#l-user').value, password: $('#l-pass').value });
  const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error; err.hidden = false; return; }
  token = data.token;
  localStorage.setItem('chaltus_admin_token', token);
  $('#topbar-user').textContent = data.username;
  bootApp();
});

$('#logout-btn').addEventListener('click', logout);

// ── Tab navigation ─────────────────────────────────────────────────────────────
const TAB_TITLES = { dashboard: 'Dashboard', bookings: 'Bookings', gallery: 'Gallery', stylists: 'Stylists', services: 'Services', subscribers: 'Subscribers', settings: 'Settings' };

function switchTab(tab) {
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  $$('.panel').forEach(el => el.classList.toggle('active', el.dataset.panel === tab));
  $('#page-title').textContent = TAB_TITLES[tab] ?? tab;
  if (tab === 'dashboard')   loadDashboard();
  if (tab === 'bookings')    loadBookings();
  if (tab === 'gallery')     loadGallery();
  if (tab === 'stylists')    loadStylists();
  if (tab === 'services')    loadServices();
  if (tab === 'subscribers') loadSubscribers();
  // close mobile sidebar
  $('#sidebar').classList.remove('open');
}

$$('.nav-item[data-tab]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); switchTab(el.dataset.tab); });
});

$('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#sidebar-close').addEventListener('click', () => $('#sidebar').classList.remove('open'));

// Collapsible form cards
$$('.collapsible-head').forEach(head => {
  head.addEventListener('click', () => head.closest('.card').classList.toggle('collapsed'));
});

// ── Dashboard ──────────────────────────────────────────────────────────────────
let chartTrend = null;
let chartServices = null;

// Set today's date in the actions bar
const dashDate = $('#dash-date');
if (dashDate) {
  dashDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// "View all" shortcut on dashboard
document.addEventListener('click', e => {
  const link = e.target.closest('[data-tab]');
  if (link && link.classList.contains('dash-view-all')) {
    e.preventDefault();
    switchTab(link.dataset.tab);
  }
});

async function loadDashboard() {
  const d = await apiFetch('/api/stats');
  if (!d) return;
  $('#stat-total').textContent     = d.total;
  $('#stat-pending').textContent   = d.pending;
  $('#stat-confirmed').textContent = d.confirmed;
  $('#stat-today').textContent     = d.today;
  $('#stat-revenue').textContent   = '$' + (d.revenue ?? 0).toLocaleString();
  updatePendingBadge(d.pending);
  renderBookingRows($('#recent-table tbody'), d.recent, true);
  renderCharts(d);
}

function renderCharts(d) {
  // ── Trend: bookings over last 30 days ──
  const trendCanvas = $('#chart-bookings-trend');
  if (trendCanvas) {
    // Build full 30-day label array
    const days = [];
    const counts = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      days.push(dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const found = (d.byDay || []).find(r => r.day && r.day.slice(0,10) === key);
      counts.push(found ? parseInt(found.c, 10) : 0);
    }
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Bookings',
          data: counts,
          borderColor: '#b89b6a',
          backgroundColor: 'rgba(184,155,106,0.12)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#b89b6a',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,10,10,0.85)',
            titleColor: '#b89b6a',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
          }
        },
        scales: {
          x: {
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, maxTicksLimit: 8 },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 }, stepSize: 1 },
            grid: { color: 'rgba(255,255,255,0.06)' },
          }
        }
      }
    });
  }

  // ── Doughnut: bookings by service ──
  const serviceCanvas = $('#chart-services');
  if (serviceCanvas && d.byService && d.byService.length) {
    const palette = ['#b89b6a','#d4b896','#8a7350','#e8d5b0','#6b5a3e','#f0e6d0'];
    if (chartServices) chartServices.destroy();
    chartServices = new Chart(serviceCanvas, {
      type: 'doughnut',
      data: {
        labels: d.byService.map(r => r.service || 'Other'),
        datasets: [{
          data: d.byService.map(r => parseInt(r.c, 10)),
          backgroundColor: palette,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 2,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255,255,255,0.6)',
              font: { size: 11 },
              padding: 12,
              boxWidth: 12,
              boxHeight: 12,
            }
          },
          tooltip: {
            backgroundColor: 'rgba(10,10,10,0.85)',
            titleColor: '#b89b6a',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
          }
        }
      }
    });
  }
}

function updatePendingBadge(n) {
  const b = $('#pending-badge');
  if (n > 0) { b.textContent = n; b.hidden = false; } else { b.hidden = true; }
}

// ── Bookings ───────────────────────────────────────────────────────────────────
const SCHEDULE_SLOTS = [
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM',
  '12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM',
  '4:00 PM','4:30 PM','5:00 PM','5:30 PM'
];

let schedDate = new Date();
schedDate.setHours(0,0,0,0);

function todayStr() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
}

function dateToStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── View toggle ───────────────────────────────────────────────────────────────
$('#view-list-btn').addEventListener('click', () => {
  $('#view-list-btn').classList.add('active');
  $('#view-schedule-btn').classList.remove('active');
  $('#booking-list-view').hidden = false;
  $('#booking-schedule-view').hidden = true;
});
$('#view-schedule-btn').addEventListener('click', () => {
  $('#view-schedule-btn').classList.add('active');
  $('#view-list-btn').classList.remove('active');
  $('#booking-schedule-view').hidden = false;
  $('#booking-list-view').hidden = true;
  loadSchedule();
});

// ── List view ─────────────────────────────────────────────────────────────────
async function loadBookings() {
  const status  = $('#booking-filter-status').value;
  const date    = $('#booking-filter-date').value;
  const stylist = $('#booking-filter-stylist').value;
  const params  = new URLSearchParams();
  if (status)  params.set('status', status);
  if (date)    params.set('date', date);
  if (stylist) params.set('stylist', stylist);
  const data = await apiFetch(`/api/bookings?${params}`);
  if (!data) return;
  renderBookingRows($('#bookings-table tbody'), data, false);
}

async function populateStylistFilter() {
  const data = await apiFetch('/api/stylists');
  if (!data) return;
  const sel = $('#booking-filter-stylist');
  data.forEach(s => {
    const o = document.createElement('option');
    o.value = s.name; o.textContent = s.name;
    sel.appendChild(o);
  });
}

function renderBookingRows(tbody, rows, compact) {
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No bookings found.</td></tr>`; return; }
  tbody.innerHTML = rows.map(b => `
    <tr class="booking-row" data-id="${b.id}" style="cursor:pointer;">
      ${compact ? '' : `<td>#${b.id}</td>`}
      <td><strong>${escHTML(b.client_name)}</strong><br><span style="font-size:.75rem;color:var(--gray-400)">${escHTML(b.client_email)}</span></td>
      ${compact ? '' : `<td>${escHTML(b.client_phone)}</td>`}
      <td>${escHTML(b.service_name)}</td>
      ${compact ? '' : `<td>${escHTML(b.stylist_name)}</td>`}
      <td>${fmt(b.preferred_date)}</td>
      <td><strong>${escHTML(b.preferred_time)}</strong></td>
      <td>${statusBadge(b.status)}</td>
      ${compact ? '' : `<td style="max-width:140px;font-size:.78rem;color:var(--gray-500)">${escHTML(b.message)}</td>`}
      <td>
        <div style="display:flex;gap:.25rem;flex-wrap:wrap">
          ${compact ? '' : `
          <select class="select-sm status-select" data-id="${b.id}">
            <option ${b.status==='pending'   ? 'selected':''} value="pending">Pending</option>
            <option ${b.status==='confirmed' ? 'selected':''} value="confirmed">Confirmed</option>
            <option ${b.status==='completed' ? 'selected':''} value="completed">Completed</option>
            <option ${b.status==='cancelled' ? 'selected':''} value="cancelled">Cancelled</option>
          </select>`}
          <button class="btn-icon del-booking" data-id="${b.id}" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.booking-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.status-select') || e.target.closest('.del-booking')) return;
      const id = row.dataset.id;
      const b  = rows.find(r => String(r.id) === id);
      if (b) openBookingModal(b);
    });
  });

  tbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      await apiFetch(`/api/bookings/${sel.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
      const badge = sel.closest('tr').querySelector('.status');
      if (badge) { badge.className = `status status--${sel.value}`; badge.textContent = sel.value; }
    });
  });

  tbody.querySelectorAll('.del-booking').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!await confirm('Delete this booking permanently?')) return;
      await apiFetch(`/api/bookings/${btn.dataset.id}`, { method: 'DELETE' });
      btn.closest('tr').remove();
    });
  });
}

$('#booking-filter-status').addEventListener('change', loadBookings);
$('#booking-filter-stylist').addEventListener('change', loadBookings);
$('#booking-filter-date').addEventListener('change', loadBookings);
$('#booking-today-btn').addEventListener('click', () => {
  $('#booking-filter-date').value = todayStr();
  loadBookings();
});
$('#booking-filter-clear').addEventListener('click', () => {
  $('#booking-filter-status').value  = '';
  $('#booking-filter-stylist').value = '';
  $('#booking-filter-date').value    = '';
  loadBookings();
});
$('#booking-refresh').addEventListener('click', loadBookings);

// ── Schedule view ─────────────────────────────────────────────────────────────
async function loadSchedule() {
  const dateStr = dateToStr(schedDate);
  const label   = schedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  $('#sched-date-label').textContent = label;

  const [stylists, bookings] = await Promise.all([
    apiFetch('/api/stylists'),
    apiFetch(`/api/bookings?date=${dateStr}`)
  ]);
  if (!stylists || !bookings) return;

  // Build lookup: "stylist|time" -> booking
  const lookup = {};
  bookings.forEach(b => { lookup[`${b.stylist_name}|${b.preferred_time}`] = b; });

  const cols = stylists.map(s => s.name);
  if (!cols.length) { $('#sched-wrap').innerHTML = '<p class="empty-state">No stylists found.</p>'; return; }

  let html = `<table class="sched-table">
    <thead><tr><th class="sched-time-col">Time</th>${cols.map(c => `<th>${escHTML(c)}</th>`).join('')}</tr></thead>
    <tbody>`;

  SCHEDULE_SLOTS.forEach(slot => {
    html += `<tr><td class="sched-time-cell">${slot}</td>`;
    cols.forEach(stylist => {
      const b = lookup[`${stylist}|${slot}`];
      if (b) {
        html += `<td class="sched-cell sched-cell--${b.status}" data-id="${b.id}">
          <span class="sched-name">${escHTML(b.client_name)}</span>
          <span class="sched-svc">${escHTML(b.service_name)}</span>
          <span class="sched-phone">${escHTML(b.client_phone)}</span>
        </td>`;
      } else {
        html += `<td class="sched-cell sched-cell--empty"></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  $('#sched-wrap').innerHTML = html;

  // Click cell to open modal
  $$('.sched-cell[data-id]', $('#sched-wrap')).forEach(cell => {
    cell.addEventListener('click', () => {
      const b = bookings.find(r => String(r.id) === cell.dataset.id);
      if (b) openBookingModal(b);
    });
  });
}

$('#sched-prev').addEventListener('click',    () => { schedDate.setDate(schedDate.getDate()-1); loadSchedule(); });
$('#sched-next').addEventListener('click',    () => { schedDate.setDate(schedDate.getDate()+1); loadSchedule(); });
$('#sched-today').addEventListener('click',   () => { schedDate = new Date(); schedDate.setHours(0,0,0,0); loadSchedule(); });
$('#sched-refresh').addEventListener('click', () => loadSchedule());

// ── Booking detail modal ──────────────────────────────────────────────────────
let modalBookingId = null;

function openBookingModal(b) {
  modalBookingId = b.id;
  $('#modal-title').textContent = `Booking #${b.id} — ${b.client_name}`;
  $('#modal-status-select').value = b.status;
  const dateLabel = new Date(b.preferred_date + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  $('#modal-body').innerHTML = `
    <div class="modal-detail-grid">
      <div class="modal-detail-row"><span class="modal-detail-key">Client</span><span class="modal-detail-val"><strong>${escHTML(b.client_name)}</strong></span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Phone</span><span class="modal-detail-val"><a href="tel:${escHTML(b.client_phone)}">${escHTML(b.client_phone)}</a></span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Email</span><span class="modal-detail-val">${b.client_email ? `<a href="mailto:${escHTML(b.client_email)}">${escHTML(b.client_email)}</a>` : '—'}</span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Service</span><span class="modal-detail-val">${escHTML(b.service_name)}</span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Stylist</span><span class="modal-detail-val">${escHTML(b.stylist_name)}</span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Date</span><span class="modal-detail-val">${dateLabel}</span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Time</span><span class="modal-detail-val"><strong>${escHTML(b.preferred_time)}</strong></span></div>
      <div class="modal-detail-row"><span class="modal-detail-key">Status</span><span class="modal-detail-val">${statusBadge(b.status)}</span></div>
      ${b.message ? `<div class="modal-detail-row"><span class="modal-detail-key">Notes</span><span class="modal-detail-val">${escHTML(b.message)}</span></div>` : ''}
      <div class="modal-detail-row"><span class="modal-detail-key">Booked</span><span class="modal-detail-val">${new Date(b.created_at).toLocaleString('en-US')}</span></div>
    </div>`;
  $('#booking-modal').hidden = false;
}

$('#modal-close').addEventListener('click',  () => { $('#booking-modal').hidden = true; });
$('#modal-cancel-btn').addEventListener('click', () => { $('#booking-modal').hidden = true; });
$('#booking-modal').addEventListener('click', e => { if (e.target === $('#booking-modal')) $('#booking-modal').hidden = true; });

$('#modal-save-btn').addEventListener('click', async () => {
  const newStatus = $('#modal-status-select').value;
  await apiFetch(`/api/bookings/${modalBookingId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
  $('#booking-modal').hidden = true;
  // Refresh whichever view is active
  if (!$('#booking-list-view').hidden) loadBookings();
  else loadSchedule();
});

// ── Gallery ────────────────────────────────────────────────────────────────────
let pendingFiles = [];

async function loadGallery() {
  const items = await apiFetch('/api/gallery');
  if (!items) return;
  const grid = $('#gallery-admin-grid');
  if (!items.length) { grid.innerHTML = '<div class="empty-state">No photos yet — upload your first one above.</div>'; return; }
  grid.innerHTML = items.map(i => `
    <div class="gallery-thumb" data-id="${i.id}">
      <img src="${escHTML(i.url)}" alt="${escHTML(i.alt_text)}" loading="lazy" />
      <div class="gallery-thumb__overlay">
        <span class="gallery-thumb__label">${escHTML(i.label || i.alt_text || 'No label')}</span>
        <button class="btn btn-sm btn-danger del-gallery" data-id="${i.id}">Delete</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.del-gallery').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!await confirm('Delete this photo from the gallery?')) return;
      const res = await apiFetch(`/api/gallery/${btn.dataset.id}`, { method: 'DELETE' });
      if (res?.ok) btn.closest('.gallery-thumb').remove();
    });
  });
}

// Drag & drop
const zone = $('#upload-zone');
zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
});

$('#gallery-pick-btn').addEventListener('click', () => $('#gallery-file-input').click());
$('#gallery-file-input').addEventListener('change', e => handleFiles([...e.target.files]));

function handleFiles(files) {
  if (!files.length) return;
  pendingFiles = files;
  const status = $('#gallery-upload-status');
  status.className = 'upload-status';
  status.textContent = `${files.length} file(s) selected: ${files.map(f => f.name).join(', ')}`;
  $('#gallery-upload-btn').disabled = false;
}

$('#gallery-upload-btn').addEventListener('click', async () => {
  if (!pendingFiles.length) return;
  const alt   = $('#gallery-alt').value;
  const label = $('#gallery-label').value;
  const status = $('#gallery-upload-status');
  status.className = 'upload-status';
  status.textContent = 'Uploading…';

  let ok = 0; let lastErr = '';
  for (const file of pendingFiles) {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('alt_text', alt || file.name.replace(/\.[^.]+$/, ''));
    fd.append('label', label);
    const res = await apiUpload('/api/gallery', fd);
    if (res?.id) ok++;
    else if (res?.error) lastErr = res.error;
  }
  status.className = ok ? 'upload-status success' : 'upload-status error';
  status.textContent = ok
    ? `✓ ${ok} photo(s) uploaded successfully.`
    : `Upload failed — ${lastErr || 'try again.'}`;
  pendingFiles = [];
  $('#gallery-upload-btn').disabled = true;
  $('#gallery-file-input').value = '';
  $('#gallery-alt').value   = '';
  $('#gallery-label').value = '';
  loadGallery();
});

// ── Stylists ───────────────────────────────────────────────────────────────────
let editingStylistId = null;

async function loadStylists() {
  const list = await apiFetch('/api/stylists/all');
  if (!list) return;
  const el = $('#stylists-admin-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state">No stylists yet.</div>'; return; }
  el.innerHTML = list.map(s => `
    <div class="stylist-admin-card ${s.active ? '' : 'inactive'}" data-id="${s.id}">
      <img class="stylist-admin-card__photo" src="${escHTML(s.photo_url || '/images/placeholder-person.png')}" alt="${escHTML(s.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%23e9e9e9%22/><text x=%2250%%22 y=%2255%%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2216%22>${escHTML(s.name[0])}</text></svg>'" />
      <div class="stylist-admin-card__info">
        <div class="stylist-admin-card__name">${escHTML(s.name)}</div>
        <div class="stylist-admin-card__role">${escHTML(s.role)}</div>
      </div>
      <div class="stylist-admin-card__actions">
        <button class="btn btn-sm btn-outline edit-stylist" data-id="${s.id}">Edit</button>
        <button class="btn btn-sm ${s.active ? 'btn-danger' : 'btn-outline'} toggle-stylist" data-id="${s.id}" data-active="${s.active}">
          ${s.active ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.edit-stylist').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = list.find(x => x.id == btn.dataset.id);
      if (!s) return;
      editingStylistId = s.id;
      $('#stylist-id').value    = s.id;
      $('#sty-name').value      = s.name;
      $('#sty-role').value      = s.role;
      $('#sty-desc').value      = s.description;
      $('#sty-order').value     = s.order_index;
      if (s.photo_url) { const p = $('#sty-preview'); p.src = s.photo_url; p.hidden = false; }
      $('#stylist-submit-btn').textContent = 'Save Changes';
      $('#stylist-cancel-btn').hidden = false;
      $('#stylist-form').closest('.card').classList.remove('collapsed');
      $('#stylist-form').closest('.card').scrollIntoView({ behavior: 'smooth' });
    });
  });

  el.querySelectorAll('.toggle-stylist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active == '1' ? 0 : 1;
      await apiFetch(`/api/stylists/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ active }) });
      loadStylists();
    });
  });
}

function resetStylistForm() {
  editingStylistId = null;
  $('#stylist-form').reset();
  $('#stylist-id').value = '';
  $('#sty-preview').hidden = true;
  $('#stylist-submit-btn').textContent = 'Add Stylist';
  $('#stylist-cancel-btn').hidden = true;
}

$('#sty-photo').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const p = $('#sty-preview');
  p.src = URL.createObjectURL(f);
  p.hidden = false;
});

$('#stylist-cancel-btn').addEventListener('click', resetStylistForm);

$('#stylist-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('name',        $('#sty-name').value);
  fd.append('role',        $('#sty-role').value);
  fd.append('description', $('#sty-desc').value);
  fd.append('order_index', $('#sty-order').value);
  const photo = $('#sty-photo').files[0];
  if (photo) fd.append('photo', photo);

  if (editingStylistId) {
    await fetch(`/api/stylists/${editingStylistId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: fd });
  } else {
    await fetch('/api/stylists', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  }
  resetStylistForm();
  loadStylists();
});

// ── Services ───────────────────────────────────────────────────────────────────
let editingServiceId = null;

async function loadServices() {
  const list = await apiFetch('/api/services/all');
  if (!list) return;
  const el = $('#services-admin-list');

  // Group by category
  const cats = {};
  list.forEach(s => { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });

  el.innerHTML = Object.entries(cats).map(([cat, services]) => `
    <div class="service-category-block card">
      <div class="card__head"><h2>${escHTML(cat)}</h2></div>
      <div class="card__body" style="padding:.5rem 1.25rem">
        ${services.map(s => `
          <div class="service-row ${s.active ? '' : 'inactive'}" data-id="${s.id}">
            <span class="service-row__name">${escHTML(s.name)}</span>
            <span class="service-row__duration">${escHTML(s.duration)}</span>
            <span class="service-row__price">${s.price_is_from ? 'from ' : ''}${s.price !== 'Varies' ? '$' : ''}${escHTML(s.price)}</span>
            <div class="service-row__actions">
              <button class="btn-icon edit-service" data-id="${s.id}" title="Edit">✏️</button>
              <button class="btn-icon toggle-service" data-id="${s.id}" data-active="${s.active}" title="${s.active ? 'Hide' : 'Show'}">${s.active ? '👁' : '🚫'}</button>
              <button class="btn-icon del-service" data-id="${s.id}" title="Delete">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Edit
  el.querySelectorAll('.edit-service').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = list.find(x => x.id == btn.dataset.id);
      if (!s) return;
      editingServiceId = s.id;
      $('#service-id').value   = s.id;
      $('#svc-category').value = s.category;
      $('#svc-name').value     = s.name;
      $('#svc-duration').value = s.duration;
      $('#svc-price').value    = s.price;
      $('#svc-from').checked   = !!s.price_is_from;
      $('#svc-order').value    = s.order_index;
      $('#service-submit-btn').textContent = 'Save Changes';
      $('#service-cancel-btn').hidden = false;
      $('#service-form').closest('.card').classList.remove('collapsed');
      $('#service-form').closest('.card').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Toggle active
  el.querySelectorAll('.toggle-service').forEach(btn => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active == '1' ? 0 : 1;
      await apiFetch(`/api/services/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ active }) });
      loadServices();
    });
  });

  // Delete
  el.querySelectorAll('.del-service').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!await confirm('Remove this service from the menu?')) return;
      await apiFetch(`/api/services/${btn.dataset.id}`, { method: 'DELETE' });
      loadServices();
    });
  });
}

function resetServiceForm() {
  editingServiceId = null;
  $('#service-form').reset();
  $('#service-id').value = '';
  $('#service-submit-btn').textContent = 'Add Service';
  $('#service-cancel-btn').hidden = true;
}

$('#service-cancel-btn').addEventListener('click', resetServiceForm);

$('#service-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    category:     $('#svc-category').value,
    name:         $('#svc-name').value,
    duration:     $('#svc-duration').value,
    price:        $('#svc-price').value,
    price_is_from: $('#svc-from').checked ? 1 : 0,
    order_index:  parseInt($('#svc-order').value) || 99,
  };
  if (editingServiceId) {
    await apiFetch(`/api/services/${editingServiceId}`, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await apiFetch('/api/services', { method: 'POST', body: JSON.stringify(body) });
  }
  resetServiceForm();
  loadServices();
});

// ── Settings ───────────────────────────────────────────────────────────────────
$('#pw-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#pw-msg');
  msg.hidden = true;
  if ($('#pw-new').value !== $('#pw-confirm').value) {
    msg.className = 'alert alert--error'; msg.textContent = 'Passwords do not match.'; msg.hidden = false; return;
  }
  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: $('#pw-current').value, newPassword: $('#pw-new').value }),
  });
  if (!res) return;
  msg.className = res.ok ? 'alert alert--success' : 'alert alert--error';
  msg.textContent = res.ok ? '✓ Password updated successfully.' : res.error;
  msg.hidden = false;
  if (res.ok) $('#pw-form').reset();
});

// ── Subscribers ────────────────────────────────────────────────────────────────
async function loadSubscribers() {
  const tbody = $('#sub-tbody');
  const count = $('#sub-count');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:2rem;">Loading…</td></tr>';

  const data = await apiFetch('/api/subscribers');
  if (!data) return;

  const badge = $('#subscribers-badge');
  if (badge) { badge.textContent = data.length; badge.hidden = data.length === 0; }
  if (count) count.textContent = `(${data.length})`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:2rem;">No subscribers yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(s => {
    const d = new Date(s.created_at);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<tr>
      <td><a href="mailto:${s.email}" style="color:inherit;">${s.email}</a></td>
      <td>${s.name || '<span style="color:var(--gray-400)">—</span>'}</td>
      <td style="text-transform:capitalize;">${s.source || 'website'}</td>
      <td style="color:var(--gray-400);white-space:nowrap;">${date}</td>
    </tr>`;
  }).join('');

  // CSV export
  const exportBtn = $('#sub-export-btn');
  if (exportBtn) {
    exportBtn.onclick = function () {
      const rows = [['Email', 'Name', 'Source', 'Signed Up']];
      data.forEach(s => rows.push([s.email, s.name || '', s.source || 'website', new Date(s.created_at).toISOString().slice(0,10)]));
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'subscribers.csv';
      a.click();
    };
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────────
function bootApp() {
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
  populateStylistFilter();
  switchTab('dashboard');
}

// Auto-login if token present
if (token) {
  // Quick verify by loading stats
  apiFetch('/api/stats').then(d => {
    if (d) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      $('#topbar-user').textContent = payload.username;
      bootApp();
    }
  });
}
