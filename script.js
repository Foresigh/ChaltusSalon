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

      // Populate service dropdown in booking form
      const sel = document.getElementById('b-service');
      if (sel) {
        const cats2 = {};
        data.forEach(function (s) { if (!cats2[s.category]) cats2[s.category] = []; cats2[s.category].push(s); });
        Object.entries(cats2).forEach(function ([cat, services]) {
          const grp = document.createElement('optgroup');
          grp.label = cat;
          services.forEach(function (s) {
            const opt = document.createElement('option');
            const price = s.price_is_from ? 'from $' + s.price : (s.price === 'Varies' ? 'Varies' : '$' + s.price);
            opt.value       = s.name;
            opt.textContent = s.name + ' — ' + price;
            grp.appendChild(opt);
          });
          sel.appendChild(grp);
        });
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

      // Populate booking form dropdown
      const sel = document.getElementById('b-stylist');
      if (!sel) return;
      data.forEach(function (s) {
        const opt = document.createElement('option');
        opt.value       = s.name;
        opt.textContent = s.name + ' — ' + s.role;
        sel.appendChild(opt);
      });
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

      grid.innerHTML = items.map(function (img, i) {
        const featured = i === 0 ? ' featured' : '';
        return `<div class="gallery-item${featured} visible">
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
     8. BOOKING FORM SUBMISSION
     ==================================================== */
  var bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    // Set min date to today
    var dateInput = document.getElementById('b-date');
    if (dateInput) {
      dateInput.min = new Date().toISOString().slice(0, 10);
    }

    bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var errEl = document.getElementById('booking-error');
      var okEl  = document.getElementById('booking-success');
      var btn   = document.getElementById('booking-submit');
      errEl.hidden = true;
      okEl.hidden  = true;
      btn.textContent = 'Sending…';
      btn.disabled    = true;

      var body = {
        client_name:    document.getElementById('b-name').value,
        client_phone:   document.getElementById('b-phone').value,
        client_email:   document.getElementById('b-email').value,
        service_name:   document.getElementById('b-service').value,
        stylist_name:   document.getElementById('b-stylist').value,
        preferred_date: document.getElementById('b-date').value,
        preferred_time: document.getElementById('b-time').value,
        message:        document.getElementById('b-message').value,
      };

      try {
        var res  = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong.');
        okEl.textContent = '✓ ' + data.message;
        okEl.hidden = false;
        bookingForm.reset();
        dateInput.min = new Date().toISOString().slice(0, 10);
        btn.textContent = 'Request Sent ✓';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
        btn.textContent = 'Request Appointment →';
        btn.disabled    = false;
      }
    });
  }


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
