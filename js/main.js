/* ============================================================
   Nurse Ashthetics — site logic
   Data-driven rendering · quote builder · before/after slider
   Admin panel with localStorage persistence + JSON export
   ============================================================ */
(function () {
  'use strict';

  var ADMIN_PASSWORD = 'nurseash-admin'; // change in admin > settings flow (documented in README)
  var STORAGE_KEY = 'na-site-data-v1';

  /* ---------- data loading ---------- */
  function embeddedData() {
    try { return JSON.parse(document.getElementById('site-data').textContent); }
    catch (e) { return null; }
  }

  function storedData() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  // Deep-merge: base <- overrides (arrays replaced wholesale, objects merged per key)
  function mergeData(base, over) {
    if (!over || typeof over !== 'object') return base;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof over[k] === 'object') {
        var m = {};
        Object.keys(base[k]).forEach(function (kk) { m[kk] = base[k][kk]; });
        Object.keys(over[k]).forEach(function (kk) { m[kk] = over[k][kk]; });
        out[k] = m;
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    });
    return out;
  }

  var DATA = embeddedData() || { treatments: [], offer: null, slots: [] };
  var usingStored = false;

  function loadData() {
    // 1) admin edits saved in this browser win (live preview of unpublished changes)
    var stored = storedData();
    if (stored) { DATA = mergeData(DATA, stored); usingStored = true; }
    // 2) published site-data.json wins over the embedded fallback
    return fetch('data/site-data.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (json) {
        DATA = mergeData(json, stored || {});
        renderAll();
      })
      .catch(function () { renderAll(); }); // file:// or 404 -> embedded data is fine
  }

  /* ---------- helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function waLink(number, text) {
    var n = String(number || '').replace(/\D/g, '');
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  function settings() {
    return DATA.settings || {};
  }

  /* ---------- render: instagram links ---------- */
  function renderInstagram() {
    var ig = settings().instagram || '@nurseashthetics';
    var url = 'https://www.instagram.com/' + esc(ig.replace(/^@/, ''));
    ['navInstagram', 'galleryInstagram', 'footerInstagram'].forEach(function (id) {
      var a = el(id);
      if (!a) return;
      a.href = url;
      if (id !== 'footerInstagram') a.textContent = ig;
    });
  }

  /* ---------- render: treatments ---------- */
  function renderTreatments() {
    var grid = el('treatGrid');
    if (!grid) return;
    grid.innerHTML = DATA.treatments.map(function (t, i) {
      return '<article class="treat-card">'
        + '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<h3>' + esc(t.name) + '</h3>'
        + '<p>' + esc(t.longDesc) + '</p>'
        + '<div class="treat-foot">'
        +   '<span class="price">From £' + Number(t.price).toLocaleString('en-GB') + '</span>'
        +   '<button type="button" class="add-quote-btn" data-treat="' + esc(t.name) + '">+ Add to quote</button>'
        + '</div></article>';
    }).join('');

    grid.querySelectorAll('.add-quote-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-treat');
        var box = document.querySelector('.qt[data-name="' + CSS.escape(name) + '"]');
        if (!box) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change'));
      });
    });
  }

  /* ---------- render: quote checklist ---------- */
  function renderQuoteList() {
    var listEl = el('quoteCheckList');
    if (!listEl) return;
    listEl.innerHTML = DATA.treatments.map(function (t) {
      return '<label class="check-row">'
        + '<input type="checkbox" class="qt" data-name="' + esc(t.name) + '" data-price="' + Number(t.price) + '">'
        + '<span class="check-mark" aria-hidden="true"></span>'
        + '<span class="meta"><span class="meta-top"><span class="name">' + esc(t.name) + '</span>'
        + '<span class="price">From £' + Number(t.price).toLocaleString('en-GB') + '</span></span>'
        + '<span class="desc">' + esc(t.shortDesc) + '</span></span>'
        + '</label>';
    }).join('');

    var firstRow = el('firstTimeRow');
    var firstLabel = el('firstTimeLabel');
    if (DATA.offer && DATA.offer.enabled) {
      firstRow.hidden = false;
      firstLabel.textContent = 'First-time client — apply ' + DATA.offer.percent + '% off';
    } else {
      firstRow.hidden = true;
    }
  }

  /* ---------- render: offer ---------- */
  function renderOffer() {
    var section = el('offer');
    var bar = el('offerBar');
    if (DATA.offer && DATA.offer.enabled) {
      section.style.display = '';
      el('offerPctNum').textContent = DATA.offer.percent;
      document.querySelector('#offer h3').textContent = DATA.offer.headline || 'Special offer';
      el('offerDetail').textContent = DATA.offer.detail || '';
      bar.hidden = false;
      bar.innerHTML = '<strong>' + esc(DATA.offer.percent) + '% off</strong> for first-time clients. <a href="#offer">Details</a>';
    } else {
      section.style.display = 'none';
      bar.hidden = true;
    }
  }

  /* ---------- render: booking slots ---------- */
  function renderSlots() {
    var grid = el('bookGrid');
    if (!grid) return;
    var slots = (DATA.slots || []).slice().sort(function (a, b) {
      return (a.date + a.time).localeCompare(b.date + b.time);
    });
    // hide past dates from the public view
    var today = new Date(); today.setHours(0, 0, 0, 0);
    slots = slots.filter(function (s) {
      var d = new Date(s.date + 'T00:00:00');
      return !isNaN(d) && d >= today;
    });

    if (!slots.length) {
      grid.innerHTML = '<div class="empty-note">No open times published right now — send a quote request and we\'ll find a time that works.</div>';
      return;
    }

    var byDate = {};
    slots.forEach(function (s) { (byDate[s.date] = byDate[s.date] || []).push(s); });

    var html = '';
    Object.keys(byDate).sort().forEach(function (date) {
      var d = new Date(date + 'T00:00:00');
      var label = isNaN(d) ? date : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      html += '<div class="slot-group"><h3>' + esc(label) + '</h3>';
      byDate[date].forEach(function (s) {
        var pick = date + ' at ' + s.time + ' — ' + s.location;
        html += '<div class="slot-row">'
          + '<div class="when"><span class="time">' + esc(s.time) + '</span><span class="where">' + esc(s.location) + '</span></div>'
          + '<button type="button" class="btn btn-ghost btn-sm" data-pick="' + esc(pick) + '">Request this slot</button>'
          + '</div>';
      });
      html += '</div>';
    });
    grid.innerHTML = html;

    grid.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        el('qslot').value = btn.getAttribute('data-pick');
        document.getElementById('quote').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- quote total logic ---------- */
  var lastTotal = 0;
  function animateNumber(node, from, to) {
    if (prefersReducedMotion() || from === to) { node.textContent = String(to); return; }
    var t0 = performance.now(), dur = 320;
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function wireQuote() {
    var totalEl = el('totalAmount');
    var listEl = el('selectedList');
    var firstTimeBox = el('firstTimeBox');
    if (!totalEl || !listEl) return;

    function update() {
      var checks = document.querySelectorAll('.qt');
      var total = 0, names = [];
      checks.forEach(function (c) {
        if (c.checked) { total += parseInt(c.getAttribute('data-price'), 10); names.push(c.getAttribute('data-name')); }
      });
      var offerOn = !!(DATA.offer && DATA.offer.enabled && firstTimeBox && firstTimeBox.checked);
      var discounted = offerOn ? Math.round(total * (100 - DATA.offer.percent) / 100) : total;

      // sync quick-add buttons on treatment cards
      document.querySelectorAll('.add-quote-btn').forEach(function (btn) {
        var box = document.querySelector('.qt[data-name="' + CSS.escape(btn.getAttribute('data-treat')) + '"]');
        if (box) btn.classList.toggle('added', box.checked);
      });

      // animated total with "From £" prefix
      if (offerOn && total > 0) {
        totalEl.innerHTML = '<span class="was">£' + total.toLocaleString('en-GB') + '</span> From £';
      } else {
        totalEl.textContent = 'From £';
      }
      var numNode = document.createElement('span');
      totalEl.appendChild(numNode);
      animateNumber(numNode, lastTotal, offerOn ? discounted : total);
      lastTotal = offerOn ? discounted : total;

      listEl.textContent = names.length
        ? names.join(', ') + (offerOn ? ' — first-time discount applied' : '')
        : 'Nothing selected yet';

      var box = totalEl.closest('.total-box');
      if (box) { box.classList.add('amount-flash'); setTimeout(function () { box.classList.remove('amount-flash'); }, 350); }
    }

    document.querySelectorAll('.qt').forEach(function (c) { c.addEventListener('change', update); });
    if (firstTimeBox) firstTimeBox.addEventListener('change', update);
    update();
  }

  /* ---------- whatsapp send ---------- */
  function wireWhatsapp() {
    var form = el('quoteForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var names = [];
      document.querySelectorAll('.qt').forEach(function (c) { if (c.checked) names.push(c.getAttribute('data-name')); });
      var name = el('qname').value.trim();
      var phone = el('qphone').value.trim();
      var slot = el('qslot').value.trim();
      var note = el('qnote').value.trim();

      var lines = ["Hi! I'd like a quote from Nurse Ashthetics."];
      lines.push('Treatments: ' + (names.length ? names.join(', ') : 'not sure yet'));
      if (el('firstTimeBox') && el('firstTimeBox').checked) lines.push('First-time client offer: yes');
      if (slot) lines.push('Preferred time: ' + slot);
      if (name) lines.push('Name: ' + name);
      if (phone) lines.push('Contact: ' + phone);
      if (note) lines.push('Notes: ' + note);

      window.open(waLink(settings().whatsapp, lines.join('\n')), '_blank', 'noopener');
    });
  }

  /* ---------- before/after slider ---------- */
  function wireSlider() {
    var slider = el('heroSlider');
    if (!slider) return;
    var range = slider.querySelector('.ba-range');
    function setPos(v) { slider.style.setProperty('--pos', v + '%'); }
    range.addEventListener('input', function () { setPos(range.value); });
    // gentle intro sweep (skipped for reduced motion)
    if (!prefersReducedMotion()) {
      var start = null;
      function sweep(t) {
        if (start === null) start = t;
        var p = Math.min(1, (t - start) / 900);
        var eased = 1 - Math.pow(1 - p, 3);
        setPos(50 + 26 * Math.sin(p * Math.PI)); // 50 -> 76 -> 50
        if (p < 1) requestAnimationFrame(sweep); else { range.value = 50; setPos(50); }
      }
      setTimeout(function () { requestAnimationFrame(sweep); }, 400);
    }
  }

  /* ---------- mobile nav + CTA bar ---------- */
  function wireNav() {
    var toggle = el('navToggle');
    var links = el('navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          links.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var bar = el('mobileCta');
    if (bar) {
      var mq = window.matchMedia('(max-width: 720px)');
      function onScroll() { bar.hidden = !(mq.matches && window.scrollY >= 480); }
      window.addEventListener('scroll', onScroll, { passive: true });
      if (mq.addEventListener) mq.addEventListener('change', onScroll);
      else mq.addListener(onScroll);
      onScroll();
    }
  }

  /* ---------- scroll reveal ---------- */
  function wireReveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ================= ADMIN ================= */
  var overlay, loginPane, dashPane, loginStatus, publishStatus;

  function openAdmin() { if (overlay) { overlay.hidden = false; document.body.style.overflow = 'hidden'; el('adminPass').focus(); } }
  function closeAdmin() { if (overlay) { overlay.hidden = true; document.body.style.overflow = ''; } }

  function wireAdmin() {
    overlay = el('adminOverlay');
    loginPane = el('adminLogin');
    dashPane = el('adminDash');
    loginStatus = el('loginStatus');
    publishStatus = el('publishStatus');
    if (!overlay) return;

    el('adminOpenLink').addEventListener('click', function (e) { e.preventDefault(); openAdmin(); });
    el('adminCloseBtn').addEventListener('click', closeAdmin);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAdmin(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeAdmin(); });

    el('adminLoginBtn').addEventListener('click', tryLogin);
    el('adminPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });

    function tryLogin() {
      var val = el('adminPass').value;
      if (val === ADMIN_PASSWORD) {
        loginPane.style.display = 'none';
        dashPane.hidden = false;
        fillAdminForms();
        loginStatus.textContent = '';
      } else {
        loginStatus.className = 'admin-status err';
        loginStatus.textContent = 'Wrong password.';
      }
    }

    // tabs
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        document.querySelectorAll('.admin-pane').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        el('pane-' + tab.getAttribute('data-tab')).classList.add('active');
      });
    });

    function fillAdminForms() {
      var priceList = el('adminPriceList');
      priceList.innerHTML = DATA.treatments.map(function (t, i) {
        return '<div class="admin-price-row"><span class="aname">' + esc(t.name) + '</span>'
          + '<span>£<input type="number" data-idx="' + i + '" class="admin-price-input" value="' + Number(t.price) + '" min="0"></span></div>';
      }).join('');

      renderAdminSlots();

      el('offerEnabled').checked = !!(DATA.offer && DATA.offer.enabled);
      el('offerPercentInput').value = DATA.offer ? DATA.offer.percent : 20;
      el('offerHeadlineInput').value = DATA.offer ? (DATA.offer.headline || '') : '';
      el('offerDetailInput').value = DATA.offer ? (DATA.offer.detail || '') : '';

      el('waNumberInput').value = settings().whatsapp || '';
      el('igHandleInput').value = settings().instagram || '';
    }

    function renderAdminSlots() {
      var list = el('adminSlotList');
      if (!DATA.slots.length) {
        list.innerHTML = '<p class="muted">No slots yet — add one below.</p>';
        return;
      }
      list.innerHTML = DATA.slots.map(function (s) {
        return '<div class="admin-slot-row"><span>' + esc(s.date) + ' at ' + esc(s.time) + ' — ' + esc(s.location) + '</span>'
          + '<button class="icon-btn" data-remove="' + esc(s.id) + '" type="button" aria-label="Remove slot">✕</button></div>';
      }).join('');
      list.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-remove');
          DATA.slots = DATA.slots.filter(function (s) { return s.id !== id; });
          renderAdminSlots();
        });
      });
    }

    el('addSlotBtn').addEventListener('click', function () {
      var date = el('newSlotDate').value;
      var time = el('newSlotTime').value;
      var loc = el('newSlotLocation').value.trim() || 'Clinic — Atherton';
      if (!date || !time) return;
      DATA.slots.push({ id: 's' + Date.now(), date: date, time: time, location: loc });
      el('newSlotDate').value = '';
      el('newSlotTime').value = '';
      renderAdminSlots();
    });

    // save -> localStorage (live preview) ; export -> file / clipboard for publishing
    function collectEdits() {
      document.querySelectorAll('.admin-price-input').forEach(function (inp) {
        var idx = parseInt(inp.getAttribute('data-idx'), 10);
        var val = parseInt(inp.value, 10);
        if (!isNaN(val)) DATA.treatments[idx].price = val;
      });
      DATA.offer = {
        enabled: el('offerEnabled').checked,
        percent: parseInt(el('offerPercentInput').value, 10) || 20,
        headline: el('offerHeadlineInput').value.trim(),
        detail: el('offerDetailInput').value.trim()
      };
      DATA.settings = {
        whatsapp: el('waNumberInput').value.trim(),
        instagram: el('igHandleInput').value.trim()
      };
    }

    function flashStatus(node, cls, msg) {
      node.className = 'admin-status ' + cls;
      node.textContent = msg;
    }

    el('publishBtn').addEventListener('click', function () {
      collectEdits();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); } catch (e) {}
      renderAll(); // live preview of the changes
      flashStatus(publishStatus, 'ok', 'Saved in this browser — download or copy the data file to publish for everyone.');
    });

    el('exportBtn').addEventListener('click', function () {
      collectEdits();
      var blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'site-data.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    });

    el('copyJsonBtn').addEventListener('click', function () {
      collectEdits();
      var json = JSON.stringify(DATA, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
          flashStatus(publishStatus, 'ok', 'Copied — paste it over data/site-data.json in the repo.');
        }, function () { flashStatus(publishStatus, 'err', 'Copy failed — use Download instead.'); });
      } else {
        flashStatus(publishStatus, 'err', 'Clipboard unavailable — use Download instead.');
      }
    });

    // note if unpublished local edits exist when admin opens the dashboard
    if (storedData()) {
      setTimeout(function () {
        flashStatus(publishStatus, 'info', 'This browser has unsaved-to-repo changes loaded. Export to publish them.');
      }, 600);
    }
  }

  /* ---------- boot ---------- */
  function renderAll() {
    renderInstagram();
    renderTreatments();
    renderQuoteList();
    renderOffer();
    renderSlots();
    wireQuote();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadData();
    wireWhatsapp();
    wireSlider();
    wireNav();
    wireReveal();
    wireAdmin();
  });
})();
