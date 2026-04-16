/**
 * Chaltus Salon — script.js
 * Minimal JS: only what's necessary for CRO and UX.
 * No frameworks. No dependencies. Target: < 5kb.
 */

(function () {
  'use strict';

  /* ====================================================
     1. HEADER: scroll state (transparent → dark)
     ==================================================== */
  const header     = document.getElementById('site-header');
  const SCROLL_THRESHOLD = 80;

  function updateHeader() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  // Run on load in case page is refreshed mid-scroll
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });


  /* ====================================================
     2. MOBILE NAV TOGGLE
     ==================================================== */
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileLinks = mobileNav ? mobileNav.querySelectorAll('a') : [];

  function openNav() {
    hamburger.classList.add('open');
    mobileNav.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // prevent scroll behind overlay
  }

  function closeNav() {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      if (mobileNav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  // Close mobile nav when any link is clicked
  mobileLinks.forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav && mobileNav.classList.contains('open')) {
      closeNav();
    }
  });


  /* ====================================================
     3. STICKY MOBILE BOOK NOW
     Hide while user is already at the final CTA section
     so we don't show double CTAs.
     ==================================================== */
  const stickyBook = document.getElementById('sticky-book');
  const finalCta   = document.getElementById('booking');

  if (stickyBook && finalCta) {
    const hideStickyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            stickyBook.classList.add('hidden');
          } else {
            stickyBook.classList.remove('hidden');
          }
        });
      },
      { threshold: 0.1 }
    );
    hideStickyObserver.observe(finalCta);
  }


  /* ====================================================
     4. FADE-UP ANIMATIONS
     IntersectionObserver: no delays, max 200ms per brief.
     Only runs if user hasn't opted for reduced motion.
     ==================================================== */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fadeObserver;  // exposed so gallery loader can re-observe new elements

  if (!prefersReducedMotion) {
    const fadeEls = document.querySelectorAll('.fade-up');

    fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Unobserve after first animation to save memory
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    fadeEls.forEach(function (el) {
      fadeObserver.observe(el);
    });
  } else {
    // Accessibility: if reduced motion is preferred, show all elements immediately
    document.querySelectorAll('.fade-up').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // Now safe to load dynamic content (fadeObserver is set)
  initDynamic();


  /* ====================================================
     5. FOOTER YEAR — keep copyright current
     ==================================================== */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }


  /* ====================================================
     6. SMOOTH SCROLL for anchor links
     Polyfill for browsers that don't support CSS scroll-behavior
     ==================================================== */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      if (!targetId) return;

      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      closeNav(); // close mobile nav if open

      const headerHeight = header ? header.offsetHeight : 0;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  });


  /* ====================================================
     7. DYNAMIC CONTENT — loads from backend when served
        via Node.js. Falls back to static HTML if offline.
     ==================================================== */

  // Load services into price menu + booking form dropdown
  async function loadServices() {
    try {
      const res  = await fetch('/api/services');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.length) return;

      // Rebuild price menu
      const priceGrid = document.querySelector('.price-menu__grid');
      if (priceGrid) {
        const cats = {};
        data.forEach(function (s) { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
        priceGrid.innerHTML = Object.entries(cats).map(function ([cat, services]) {
          return `<div class="price-category">
            <h3 class="price-category__title">${cat}</h3>
            ${services.map(function (s) {
              const sig = s.name.toLowerCase().includes('ethiopian') ? '<span class="price-item__badge">Signature</span>' : '';
              const priceStr = s.price_is_from ? 'from $' + s.price : (s.price === 'Varies' ? 'Varies' : '$' + s.price);
              return `<div class="price-item ${sig ? 'price-item--featured' : ''}">
                <span class="price-item__name">${s.name}${sig}</span>
                <span class="price-item__duration">${s.duration}</span>
                <span class="price-item__price">${priceStr}</span>
              </div>`;
            }).join('')}
          </div>`;
        }).join('');
      }

    } catch (_) { /* offline — static HTML stays */ }
  }

  // Load stylists — render cards section + booking form dropdown
  async function loadStylists() {
    try {
      const res  = await fetch('/api/stylists');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.length) return;

      // Render stylist cards
      const grid = document.getElementById('stylists-grid');
      if (grid) {
        const delays = ['', ' delay-1', ' delay-2', ' delay-3'];
        grid.innerHTML = data.map(function (s, i) {
          const photoHtml = s.photo_url
            ? `<img src="${s.photo_url}" alt="${s.name} — Chaltus Salon" loading="lazy" width="600" height="800" />`
            : `<div class="stylist-card__photo-placeholder"></div>`;
          return `<article class="stylist-card fade-up${delays[i] || ''}">
            <div class="stylist-card__photo">${photoHtml}</div>
            <div class="stylist-card__bio">
              <span class="stylist-card__role">${s.role}</span>
              <h3 class="stylist-card__name">${s.name}</h3>
              ${s.description ? `<p class="stylist-card__desc">${s.description}</p>` : ''}
              <a href="#booking" class="btn btn-outline-dark">Book with ${s.name.split(' ')[0]}</a>
            </div>
          </article>`;
        }).join('');
        // Re-run fade observer on new elements
        if (typeof fadeObserver !== 'undefined' && fadeObserver) {
          grid.querySelectorAll('.fade-up').forEach(function (el) {
            fadeObserver.observe(el);
          });
        } else {
          grid.querySelectorAll('.fade-up').forEach(function (el) {
            el.classList.add('visible');
          });
        }
      }

    } catch (_) { /* offline */ }
  }

  // Load gallery from API — replaces static grid only if DB has valid items
  async function loadGallery() {
    try {
      const res  = await fetch('/api/gallery');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.length) return;  // keep static placeholders if empty

      // Filter out broken entries (no url)
      const items = data.filter(function (img) { return img.url; });
      if (!items.length) return;

      const grid = document.querySelector('.gallery-grid');
      if (!grid) return;

      grid.innerHTML = items.map(function (img) {
        return `<div class="gallery-item visible">
          <img src="${img.url}" alt="${img.alt_text || 'Chaltus Salon work'}" loading="lazy" width="500" height="667"
               onerror="this.closest('.gallery-item').style.display='none'" />
          ${img.label ? `<div class="gallery-item__label">${img.label}</div>` : ''}
        </div>`;
      }).join('');
    } catch (_) { /* offline */ }
  }

  // Init dynamic data (after DOM + fade observer are set up below)
  function initDynamic() {
    loadServices();
    loadStylists();
    loadGallery();
  }

  /* ====================================================
     8. BOOKING WIZARD
     Steps: Service → Stylist → Date/Time → Info → Confirm
     ==================================================== */
  (function () {
    var nextBtn   = document.getElementById('bw-next');
    if (!nextBtn) return; // wizard not present

    var backBtn   = document.getElementById('bw-back');
    var submitBtn = document.getElementById('bw-submit');
    var errEl     = document.getElementById('booking-error');
    var okEl      = document.getElementById('booking-success');
    var steps     = document.querySelectorAll('.bw-progress__step');

    var state = {
      step: 1,
      service: '', serviceLabel: '',
      stylist: 'No preference', stylistLabel: 'No preference',
      date: '', time: '',
      name: '', phone: '', email: '', notes: ''
    };

    var ALL_SLOTS = [
      '10:00 AM','10:30 AM','11:00 AM','11:30 AM',
      '12:00 PM','12:30 PM','1:00 PM','1:30 PM',
      '2:00 PM','2:30 PM','3:00 PM','3:30 PM',
      '4:00 PM','4:30 PM','5:00 PM','5:30 PM'
    ];

    function panel(n) { return document.getElementById('bw-panel-' + n); }

    function goToStep(n) {
      panel(state.step).hidden = true;
      panel(n).hidden = false;
      state.step = n;
      steps.forEach(function (s) {
        var sn = parseInt(s.dataset.step, 10);
        s.classList.toggle('done',   sn < n);
        s.classList.toggle('active', sn === n);
        s.classList.remove(sn > n ? 'done' : '');
        if (sn > n) { s.classList.remove('done'); s.classList.remove('active'); }
      });
      backBtn.hidden   = (n === 1);
      nextBtn.hidden   = (n === 5);
      submitBtn.hidden = (n !== 5);
      errEl.hidden = true;
      if (n === 3) initDateStep();
      if (n === 5) buildSummary();
    }

    /* ---- Step 3: date / time ---- */
    function initDateStep() {
      var d = document.getElementById('b-date');
      if (!d) return;
      d.min = new Date().toISOString().slice(0, 10);
      // Only attach once
      if (!d._wizardReady) {
        d._wizardReady = true;
        d.addEventListener('change', function () {
          var val = this.value;
          if (!val) return;
          var day = new Date(val + 'T12:00:00').getDay();
          if (day === 0 || day === 1) {
            document.getElementById('bw-slots').innerHTML =
              '<p class="bw-slots__hint">We\'re closed Sunday &amp; Monday — please pick Tue–Sat.</p>';
            state.date = ''; state.time = '';
            return;
          }
          state.date = val; state.time = '';
          loadSlots(val);
        });
      }
    }

    async function loadSlots(date) {
      var el = document.getElementById('bw-slots');
      el.innerHTML = '<p class="bw-slots__hint">Loading…</p>';
      var booked = [];
      try {
        var r = await fetch('/api/availability?date=' + date);
        if (r.ok) booked = (await r.json()).booked || [];
      } catch (_) {}
      el.innerHTML = '<div class="bw-slots__grid">' +
        ALL_SLOTS.map(function (slot) {
          var taken    = booked.indexOf(slot) !== -1;
          var selected = slot === state.time;
          return '<button type="button" class="bw-slot' +
            (taken ? '' : selected ? ' selected' : '') +
            '" data-slot="' + slot + '"' +
            (taken ? ' disabled aria-label="' + slot + ' — booked"' : '') +
            '>' + slot + '</button>';
        }).join('') + '</div>';
      el.querySelectorAll('.bw-slot:not([disabled])').forEach(function (btn) {
        btn.addEventListener('click', function () {
          el.querySelectorAll('.bw-slot').forEach(function (b) { b.classList.remove('selected'); });
          this.classList.add('selected');
          state.time = this.dataset.slot;
        });
      });
    }

    /* ---- Step 5: summary ---- */
    function buildSummary() {
      var rows = [
        ['Service',  state.serviceLabel],
        ['Stylist',  state.stylistLabel],
        ['Date',     formatDate(state.date)],
        ['Time',     state.time],
        ['Name',     state.name],
        ['Phone',    state.phone]
      ];
      if (state.email) rows.push(['Email', state.email]);
      if (state.notes) rows.push(['Notes', state.notes]);
      document.getElementById('bw-summary').innerHTML = rows.map(function (r) {
        return '<div class="bw-summary__row"><span class="bw-summary__key">' + r[0] +
               '</span><span class="bw-summary__val">' + r[1] + '</span></div>';
      }).join('');
    }

    function formatDate(s) {
      if (!s) return '';
      var p = s.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    /* ---- Validation ---- */
    function validate() {
      if (state.step === 1 && !state.service)  { showErr('Please select a service.'); return false; }
      if (state.step === 2 && !state.stylist)  { showErr('Please select a stylist.'); return false; }
      if (state.step === 3) {
        if (!state.date) { showErr('Please select a date.'); return false; }
        if (!state.time) { showErr('Please select a time.'); return false; }
      }
      if (state.step === 4) {
        var n = (document.getElementById('b-name').value  || '').trim();
        var p = (document.getElementById('b-phone').value || '').trim();
        if (!n) { showErr('Please enter your name.'); return false; }
        if (!p) { showErr('Please enter your phone number.'); return false; }
        state.name  = n;
        state.phone = p;
        state.email = (document.getElementById('b-email').value   || '').trim();
        state.notes = (document.getElementById('b-message').value || '').trim();
      }
      return true;
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      setTimeout(function () { errEl.hidden = true; }, 4000);
    }

    /* ---- Nav buttons ---- */
    nextBtn.addEventListener('click', function () {
      if (validate()) goToStep(state.step + 1);
    });
    backBtn.addEventListener('click', function () {
      errEl.hidden = true;
      goToStep(state.step - 1);
    });

    /* ---- Submit ---- */
    submitBtn.addEventListener('click', async function () {
      errEl.hidden = true; okEl.hidden = true;
      submitBtn.textContent = 'Sending…';
      submitBtn.disabled = true;
      try {
        var res  = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name:    state.name,
            client_phone:   state.phone,
            client_email:   state.email,
            service_name:   state.service,
            stylist_name:   state.stylist,
            preferred_date: state.date,
            preferred_time: state.time,
            message:        state.notes
          })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong.');
        okEl.textContent = '✓ ' + data.message;
        okEl.hidden = false;
        submitBtn.hidden = true;
        backBtn.hidden   = true;
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
        submitBtn.textContent = 'Confirm Booking →';
        submitBtn.disabled = false;
      }
    });

    /* ---- Load services into step 1 ---- */
    async function loadWizardServices() {
      var el = document.getElementById('bw-services-list');
      if (!el) return;
      try {
        var res  = await fetch('/api/services');
        if (!res.ok) throw new Error();
        var data = await res.json();
        var cats = {};
        data.forEach(function (s) { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
        el.innerHTML = Object.entries(cats).map(function (entry) {
          var cat = entry[0], services = entry[1];
          return '<p class="bw-service-category">' + cat + '</p>' +
            services.map(function (s) {
              var price = s.price_is_from ? 'from $' + s.price : (s.price === 'Varies' ? 'Varies' : '$' + s.price);
              return '<button type="button" class="bw-service-btn" data-value="' + s.name + '" data-label="' + s.name + '">' +
                '<span class="bw-service-btn__name">' + s.name + '</span>' +
                '<span class="bw-service-btn__meta">' + s.duration + ' · ' + price + '</span>' +
                '</button>';
            }).join('');
        }).join('');
        el.querySelectorAll('.bw-service-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            el.querySelectorAll('.bw-service-btn').forEach(function (b) { b.classList.remove('selected'); });
            this.classList.add('selected');
            state.service = this.dataset.value;
            state.serviceLabel = this.dataset.label;
          });
        });
        // Re-select if returning to step 1
        if (state.service) {
          var cur = el.querySelector('[data-value="' + state.service + '"]');
          if (cur) cur.classList.add('selected');
        }
      } catch (_) {
        el.innerHTML = '<p style="color:var(--gray-500);font-size:0.875rem;">Could not load services — please call us to book.</p>';
      }
    }

    /* ---- Load stylists into step 2 ---- */
    async function loadWizardStylists() {
      var el = document.getElementById('bw-stylist-list');
      if (!el) return;
      try {
        var res  = await fetch('/api/stylists');
        if (!res.ok) return;
        var data = await res.json();
        data.forEach(function (s) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'bw-stylist-card';
          btn.dataset.value = s.name;
          btn.dataset.label = s.name + ' — ' + s.role;
          var photo = s.photo_url
            ? '<img src="' + s.photo_url + '" alt="' + s.name + '" class="bw-stylist-card__photo" />'
            : '<span class="bw-stylist-card__photo bw-stylist-card__photo--placeholder" aria-hidden="true"></span>';
          btn.innerHTML = photo +
            '<span>' +
              '<span class="bw-stylist-card__name">' + s.name + '</span>' +
              '<span class="bw-stylist-card__role">' + s.role + '</span>' +
            '</span>';
          el.appendChild(btn);
        });
      } catch (_) {}
      el.querySelectorAll('.bw-stylist-card').forEach(function (btn) {
        btn.addEventListener('click', function () {
          el.querySelectorAll('.bw-stylist-card').forEach(function (b) { b.classList.remove('selected'); });
          this.classList.add('selected');
          state.stylist = this.dataset.value || 'No preference';
          state.stylistLabel = this.dataset.label || 'No preference';
        });
      });
    }

    loadWizardServices();
    loadWizardStylists();
  }());


  /* ====================================================
     9. CRO TRACKING HELPER (replace with your analytics)
     Fires a custom event when any .btn is clicked.
     Wire this into GA4 / GTM as needed.
     ==================================================== */
  document.querySelectorAll('.btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const label = btn.textContent.trim();
      const section = btn.closest('section') || btn.closest('[role]');
      const sectionId = section ? (section.id || section.getAttribute('aria-label') || 'unknown') : 'header';

      // Example GA4 event — uncomment and adapt when analytics is configured:
      // if (typeof gtag === 'function') {
      //   gtag('event', 'cta_click', {
      //     event_category: 'booking_cta',
      //     event_label: label,
      //     section: sectionId
      //   });
      // }

      // Console log for development — remove in production
      if (typeof console !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('[CRO] CTA click:', { label, section: sectionId });
      }
    });
  });

})();
