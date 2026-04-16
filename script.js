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
     8. BOOKING — calendar week view + grouped time slots
     Single screen, no steps.
     ==================================================== */
  (function () {
    var submitBtn = document.getElementById('booking-submit');
    if (!submitBtn) return;

    var errEl = document.getElementById('booking-error');
    var okEl  = document.getElementById('booking-success');

    var state = { date: '', time: '' };

    var SLOT_GROUPS = [
      { label: 'Morning',   slots: ['10:00 AM','10:30 AM','11:00 AM','11:30 AM'] },
      { label: 'Afternoon', slots: ['12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM'] },
      { label: 'Evening',   slots: ['4:00 PM','4:30 PM','5:00 PM','5:30 PM'] }
    ];

    /* ---- Calendar ---- */
    var calWeekStart = getWeekStart(new Date());

    function getWeekStart(d) {
      var date = new Date(d);
      date.setDate(date.getDate() - date.getDay()); // back to Sunday
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function renderCalendar() {
      var monthEl = document.getElementById('cal-month');
      var weekEl  = document.getElementById('cal-week');
      if (!monthEl || !weekEl) return;

      // Show month label based on Wednesday of the week
      var mid = new Date(calWeekStart);
      mid.setDate(mid.getDate() + 3);
      monthEl.textContent = mid.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      var today = new Date(); today.setHours(0, 0, 0, 0);
      var selectedMs = state.date ? new Date(state.date + 'T00:00:00').getTime() : -1;

      weekEl.innerHTML = '';
      for (var i = 0; i < 7; i++) {
        var day = new Date(calWeekStart);
        day.setDate(day.getDate() + i);

        var dow    = day.getDay(); // 0=Sun,1=Mon
        var isPast = day < today;
        var isClosed = dow === 0 || dow === 1;
        var isSelected = day.getTime() === selectedMs;
        var isToday    = day.getTime() === today.getTime();

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cal-day';
        if (isPast)     btn.classList.add('cal-day--past');
        if (isClosed)   btn.classList.add('cal-day--closed');
        if (isSelected) btn.classList.add('cal-day--selected');
        if (isToday)    btn.classList.add('cal-day--today');
        if (isPast || isClosed) btn.disabled = true;

        btn.innerHTML =
          '<span class="cal-day__name">' + day.toLocaleDateString('en-US', { weekday: 'short' }) + '</span>' +
          '<span class="cal-day__num">'  + day.getDate() + '</span>';

        if (!isPast && !isClosed) {
          // Build date string using LOCAL date parts to avoid UTC offset issues
          var ds = day.getFullYear() + '-' +
            String(day.getMonth() + 1).padStart(2, '0') + '-' +
            String(day.getDate()).padStart(2, '0');
          btn.dataset.date = ds;
          btn.addEventListener('click', function () {
            // Re-check at click-time in case the page has been open since yesterday
            var clickDay = new Date(this.dataset.date + 'T00:00:00');
            var todayNow = new Date(); todayNow.setHours(0, 0, 0, 0);
            if (clickDay < todayNow) {
              renderCalendar(); // refresh to mark newly-past dates
              return;
            }
            weekEl.querySelectorAll('.cal-day').forEach(function (b) { b.classList.remove('cal-day--selected'); });
            this.classList.add('cal-day--selected');
            state.date = this.dataset.date;
            state.time = '';
            updateSummary();
            loadSlots(state.date);
          });
        }
        weekEl.appendChild(btn);
      }
    }

    document.getElementById('cal-prev') && document.getElementById('cal-prev').addEventListener('click', function () {
      calWeekStart.setDate(calWeekStart.getDate() - 7);
      renderCalendar();
    });
    document.getElementById('cal-next') && document.getElementById('cal-next').addEventListener('click', function () {
      calWeekStart.setDate(calWeekStart.getDate() + 7);
      renderCalendar();
    });

    renderCalendar();

    /* ---- Parse a slot string to minutes since midnight ---- */
    function slotToMinutes(slot) {
      var m = slot.match(/(\d+):(\d+) (AM|PM)/);
      var h = parseInt(m[1]), min = parseInt(m[2]), mer = m[3];
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    }

    /* ---- Time slots ---- */
    async function loadSlots(date) {
      var el = document.getElementById('cal-times');
      el.innerHTML = '<p class="cal-times__hint">Loading…</p>';
      var stylist = (document.getElementById('b-stylist') || {}).value || 'Any stylist';
      var booked = [];
      try {
        var r = await fetch('/api/availability?date=' + encodeURIComponent(date) +
          '&stylist=' + encodeURIComponent(stylist));
        if (r.ok) booked = (await r.json()).booked || [];
      } catch (_) {}

      // For today: disable slots that are already past (+ 30 min buffer)
      // Use LOCAL date parts — toISOString() is UTC and gives wrong date for US timezones at night
      var _n = new Date();
      var todayStr = _n.getFullYear() + '-' +
        String(_n.getMonth() + 1).padStart(2, '0') + '-' +
        String(_n.getDate()).padStart(2, '0');
      var nowMinutes = -1;
      if (date === todayStr) {
        nowMinutes = _n.getHours() * 60 + _n.getMinutes() + 30; // 30-min booking buffer
      }

      var p = date.split('-');
      var label = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      var html = '<p class="cal-times__selected-date">' + label + '</p>';
      SLOT_GROUPS.forEach(function (group) {
        html += '<div class="time-group"><p class="time-group__label">' + group.label + '</p>';
        var anyAvailable = false;
        var slotsHtml = '<div class="time-group__slots">';
        group.slots.forEach(function (slot) {
          var taken   = booked.indexOf(slot) !== -1;
          var isPast  = nowMinutes > 0 && slotToMinutes(slot) <= nowMinutes;
          var disabled = taken || isPast;
          var selected = slot === state.time;
          if (!disabled) anyAvailable = true;
          slotsHtml += '<button type="button" class="time-slot' + (selected && !disabled ? ' selected' : '') + '"' +
            (disabled ? ' disabled' : '') + ' data-slot="' + slot + '">' + slot + '</button>';
        });
        slotsHtml += '</div>';
        html += anyAvailable ? slotsHtml : '<p class="time-group__empty">No availability</p>';
        html += '</div>';
      });
      el.innerHTML = html;

      el.querySelectorAll('.time-slot:not([disabled])').forEach(function (btn) {
        btn.addEventListener('click', function () {
          el.querySelectorAll('.time-slot').forEach(function (b) { b.classList.remove('selected'); });
          this.classList.add('selected');
          state.time = this.dataset.slot;
          updateSummary();
        });
      });
    }

    /* ---- Summary ---- */
    function updateSummary() {
      var rowsEl  = document.getElementById('bk-summary-rows');
      if (!rowsEl) return;
      var service = document.getElementById('b-service').value;
      var stylist = (document.getElementById('b-stylist').value || 'Any stylist');
      var rows = [];
      if (service) rows.push(['Service', service]);
      if (stylist !== 'Any stylist') rows.push(['Stylist', stylist]);
      if (state.date) {
        var p = state.date.split('-');
        rows.push(['Date', new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })]);
      }
      if (state.time) rows.push(['Time', state.time]);
      if (!rows.length) {
        rowsEl.innerHTML = '<p class="bk-summary__empty">Your selections will appear here.</p>';
      } else {
        rowsEl.innerHTML = rows.map(function (r) {
          return '<div class="bk-summary__row"><span class="bk-summary__key">' + r[0] +
                 '</span><span class="bk-summary__val">' + r[1] + '</span></div>';
        }).join('');
      }
    }

    // Update summary when service changes
    var serviceEl = document.getElementById('b-service');
    if (serviceEl) serviceEl.addEventListener('change', updateSummary);


    /* ---- Submit ---- */
    submitBtn.addEventListener('click', async function () {
      var service = document.getElementById('b-service').value;
      var name    = (document.getElementById('b-name').value  || '').trim();
      var phone   = (document.getElementById('b-phone').value || '').trim();
      if (!service)     { showErr('Please select a service.');        return; }
      if (!state.date)  { showErr('Please select a date.');           return; }
      if (!state.time)  { showErr('Please select a time.');           return; }
      if (!name)        { showErr('Please enter your name.');         return; }
      if (!phone)       { showErr('Please enter your phone number.'); return; }

      errEl.hidden = true; okEl.hidden = true;
      submitBtn.textContent = 'Sending…';
      submitBtn.disabled = true;

      try {
        var res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name:    name,
            client_phone:   phone,
            client_email:   (document.getElementById('b-email').value   || '').trim(),
            service_name:   service,
            stylist_name:   document.getElementById('b-stylist').value  || 'Any stylist',
            preferred_date: state.date,
            preferred_time: state.time,
            message:        (document.getElementById('b-message').value || '').trim()
          })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong.');
        okEl.textContent = '✓ ' + data.message;
        okEl.hidden = false;
        submitBtn.textContent = 'Request Sent ✓';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
        submitBtn.textContent = 'Request Appointment →';
        submitBtn.disabled = false;
      }
    });

    function showErr(msg) {
      errEl.textContent = msg; errEl.hidden = false;
      setTimeout(function () { errEl.hidden = true; }, 4000);
    }

    /* ---- Populate dropdowns ---- */
    async function loadServiceDropdown() {
      var sel = document.getElementById('b-service');
      if (!sel) return;
      try {
        var res  = await fetch('/api/services');
        if (!res.ok) return;
        var data = await res.json();
        var cats = {};
        data.forEach(function (s) { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
        Object.entries(cats).forEach(function (entry) {
          var grp = document.createElement('optgroup');
          grp.label = entry[0];
          entry[1].forEach(function (s) {
            var opt = document.createElement('option');
            var price = s.price_is_from ? 'from $' + s.price : (s.price === 'Varies' ? 'Varies' : '$' + s.price);
            opt.value = s.name;
            opt.textContent = s.name + ' — ' + price;
            grp.appendChild(opt);
          });
          sel.appendChild(grp);
        });
      } catch (_) {}
    }

    async function loadStylistDropdown() {
      var dd      = document.getElementById('stylist-dd');
      var hidden  = document.getElementById('b-stylist');
      if (!dd) return;

      var trigger = dd.querySelector('.stylist-dd__trigger');
      var list    = dd.querySelector('.stylist-dd__list');

      /* ---- open / close ---- */
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !list.hidden;
        list.hidden = open;
        trigger.setAttribute('aria-expanded', String(!open));
        dd.classList.toggle('open', !open);
      });
      document.addEventListener('click', function () {
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        dd.classList.remove('open');
      });

      /* ---- select an option ---- */
      function pick(value, avatarHtml, label) {
        hidden.value = value;
        updateSummary();
        if (state.date) { state.time = ''; loadSlots(state.date); } // reload availability for new stylist
        trigger.querySelector('.stylist-dd__avatar, img.stylist-dd__avatar-img').outerHTML; // replaced below
        // rebuild trigger inner
        trigger.innerHTML =
          avatarHtml +
          '<span class="stylist-dd__label">' + label + '</span>' +
          '<span class="stylist-dd__arrow" aria-hidden="true">▾</span>';
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        dd.classList.remove('open');
        // mark active
        list.querySelectorAll('.stylist-dd__item').forEach(function (li) {
          li.classList.toggle('active', li.dataset.value === value);
        });
        updateSummary();
      }

      /* ---- build list items ---- */
      function addItem(value, avatarHtml, name, sub) {
        var li = document.createElement('li');
        li.className = 'stylist-dd__item' + (value === 'Any stylist' ? ' active' : '');
        li.role = 'option';
        li.dataset.value = value;
        li.innerHTML = avatarHtml +
          '<span class="stylist-dd__item-info">' +
            '<span class="stylist-dd__item-name">' + name + '</span>' +
            (sub ? '<span class="stylist-dd__item-role">' + sub + '</span>' : '') +
          '</span>';
        li.addEventListener('click', function (e) {
          e.stopPropagation();
          pick(value, avatarHtml, name);
        });
        list.appendChild(li);
      }

      var anyAvatar = '<span class="stylist-dd__avatar stylist-dd__avatar--any" aria-hidden="true">✂</span>';
      addItem('Any stylist', anyAvatar, 'Any stylist', 'First available stylist');

      try {
        var res  = await fetch('/api/stylists');
        if (!res.ok) return;
        var data = await res.json();
        data.forEach(function (s) {
          var av = s.photo_url
            ? '<img src="' + s.photo_url + '" alt="' + s.name + '" class="stylist-dd__avatar stylist-dd__avatar-img" />'
            : '<span class="stylist-dd__avatar stylist-dd__avatar--initial" aria-hidden="true">' + s.name.charAt(0) + '</span>';
          addItem(s.name, av, s.name, s.role);
        });
      } catch (_) {}
    }

    loadServiceDropdown();
    loadStylistDropdown();
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
