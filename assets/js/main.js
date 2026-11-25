/* Bursa Building Contracting — page behaviour: menu, time-of-day tint, scroll story, gallery, form */
(function(){
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v){ var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // loader: CSS hides it on its own after ~1.2s; JS only ends it a touch earlier once the page is ready
  if (doc.classList.contains('show-loader')) {
    var endLoader = function(){ doc.classList.add('loaded'); setTimeout(function(){ doc.classList.remove('show-loader'); }, 400); };
    var t0 = performance.now();
    window.addEventListener('load', function(){ setTimeout(endLoader, Math.max(0, 850 - (performance.now() - t0))); });
    setTimeout(endLoader, 1150);
  }

  // mobile menu
  var btn = document.querySelector('[data-menu-toggle]');
  var menu = document.querySelector('[data-menu]');
  function closeMenu(){
    btn.setAttribute('aria-expanded','false');
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  }
  if (btn && menu) {
    btn.addEventListener('click', function(){
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
      document.body.classList.toggle('menu-open', !open);
    });
    menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { closeMenu(); btn.focus(); }
    });
  }

  // year
  document.querySelectorAll('[data-year]').forEach(function(el){ el.textContent = new Date().getFullYear(); });

  // contact form
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = form.elements['name'].value.trim();
      var phone = form.elements['phone'].value.trim();
      var msg = form.elements['message'].value.trim();
      var type = form.elements['project'] ? form.elements['project'].value : '';
      var missing = [];
      if (!name) missing.push('your name');
      if (!/^[+0-9 ()-]{7,}$/.test(phone)) missing.push('a phone number we can call');
      if (!msg) missing.push('a short description of the job');
      if (missing.length) {
        status.textContent = 'Please add ' + missing.join(', ') + '.';
        status.className = 'form-status is-error';
        return;
      }
      var text = 'Hello, I am ' + name + ' (' + phone + ').' + (type ? ' Project: ' + type + '.' : '') + ' ' + msg;
      var wa = form.getAttribute('data-whatsapp');
      if (wa) {
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        status.textContent = 'WhatsApp is opening with your message. Press send there to reach us.';
      } else {
        status.textContent = 'Thank you, ' + name + '. We will call you on ' + phone + ' within one working day.';
      }
      status.className = 'form-status is-ok';
      form.reset();
    });
  }

  /* ---------------- time of day ---------------- */
  // shared state read by scene.js every frame
  var B = window.Bursa = window.Bursa || {};
  B.tod = 0.08; B.story = 0; B.storyOn = false;

  var STOPS = [
    {t:0,   sky:[157,194,210], hz:[233,238,234], accent:[169,132,74],  panel:[245,246,243,.72], line:[31,59,54,.14],    scrim:[236,238,232,.62], meta:[31,59,54]},
    {t:.34, sky:[226,178,132], hz:[246,219,178], accent:[178,110,46],  panel:[250,236,216,.66], line:[110,70,30,.16],   scrim:[247,226,196,.58], meta:[150,96,48]},
    {t:.62, sky:[75,72,119],   hz:[201,154,174], accent:[236,194,140], panel:[46,40,74,.5],     line:[255,255,255,.18], scrim:[38,32,64,.55],    meta:[60,54,96]},
    {t:1,   sky:[11,18,38],    hz:[38,43,74],    accent:[231,196,140], panel:[14,18,36,.56],    line:[255,255,255,.14], scrim:[8,11,26,.6],      meta:[11,18,38]}
  ];
  function mix(a, b, k){ var o = []; for (var i = 0; i < a.length; i++) o.push(a[i] + (b[i] - a[i]) * k); return o; }
  function rgb(c){ return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function rgba(c){ return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + c[3].toFixed(3) + ')'; }
  function todName(t){ return t < .2 ? 'Midday' : t < .48 ? 'Golden hour' : t < .78 ? 'Dusk' : 'Night'; }

  var todInput = document.querySelector('[data-tod]');
  var todLabel = document.querySelector('[data-tod-label]');
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  var lastApplied = -1, lastName = '';
  function applyTint(t){
    if (Math.abs(t - lastApplied) < .002) return;
    lastApplied = t;
    var i = 0; while (i < STOPS.length - 2 && t > STOPS[i + 1].t) i++;
    var a = STOPS[i], b = STOPS[i + 1], k = smooth(0, 1, (t - a.t) / (b.t - a.t));
    var s = doc.style, dark = t > .5;
    s.setProperty('--tod-sky', rgb(mix(a.sky, b.sky, k)));
    s.setProperty('--tod-hz', rgb(mix(a.hz, b.hz, k)));
    s.setProperty('--tod-accent', rgb(mix(a.accent, b.accent, k)));
    s.setProperty('--tod-panel', rgba(mix(a.panel, b.panel, k)));
    s.setProperty('--tod-line', rgba(mix(a.line, b.line, k)));
    s.setProperty('--tod-scrim', rgba(mix(a.scrim, b.scrim, k)));
    s.setProperty('--tod-ink', dark ? '#F4F1EA' : (t > .2 ? '#24180F' : '#15201E'));
    s.setProperty('--tod-sub', dark ? 'rgba(244,241,234,.8)' : (t > .2 ? '#4E3E30' : '#3B4A47'));
    s.setProperty('--w-golden', (smooth(.05, .3, t) * (1 - smooth(.36, .6, t))).toFixed(3));
    s.setProperty('--w-dusk', (smooth(.36, .6, t) * (1 - smooth(.7, .95, t))).toFixed(3));
    s.setProperty('--w-night', smooth(.62, .98, t).toFixed(3));
    s.setProperty('--w-lights', smooth(.42, .82, t).toFixed(3));
    doc.setAttribute('data-ui', dark ? 'dark' : 'light');
    var name = todName(t);
    if (name !== lastName) {
      lastName = name;
      if (todLabel) todLabel.textContent = name;
      if (todInput) todInput.setAttribute('aria-valuetext', name);
      if (metaTheme) metaTheme.setAttribute('content', rgb(mix(a.meta, b.meta, k)));
    }
  }

  /* ---------------- scroll story (index) ---------------- */
  var story = document.querySelector('[data-story]');
  var header = document.querySelector('[data-header]');
  var KEY_T = [0, .25, .5, .72, .93];           // story progress of each chapter's camera pose
  var KEY_TOD = [.08, .2, .36, .63, .95];        // time of day reached at each pose
  B.keys = KEY_T;
  var chapters = story ? Array.prototype.slice.call(story.querySelectorAll('[data-chapter]')) : [];
  var railBtns = story ? Array.prototype.slice.call(story.querySelectorAll('[data-goto]')) : [];
  var storyOn = !!story && !reduce;
  if (storyOn) doc.classList.add('story-on');
  B.storyOn = storyOn;

  function storyProgress(){
    if (!story) return 0;
    var r = story.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }
  function todForProgress(p){
    var i = 0; while (i < KEY_T.length - 2 && p > KEY_T[i + 1]) i++;
    var k = smooth(KEY_T[i], KEY_T[i + 1], p);
    return KEY_TOD[i] + (KEY_TOD[i + 1] - KEY_TOD[i]) * k;
  }
  var activeCh = -1;
  function setChapter(p){
    var idx = 0;
    for (var i = 0; i < KEY_T.length; i++) { if (p >= (i === 0 ? 0 : (KEY_T[i - 1] + KEY_T[i]) / 2 + .02)) idx = i; }
    if (idx === activeCh) return;
    activeCh = idx;
    chapters.forEach(function(c, i){ c.classList.toggle('is-active', i === idx); c.setAttribute('aria-hidden', i === idx ? 'false' : 'true'); if ('inert' in c) c.inert = i !== idx; });
    story.setAttribute('data-side', chapters[idx] && chapters[idx].classList.contains('ch-right') ? 'right' : 'left');
    railBtns.forEach(function(b, i){ b.classList.toggle('is-active', i === idx); if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  }
  railBtns.forEach(function(b){
    b.addEventListener('click', function(){
      var i = +b.getAttribute('data-goto');
      var total = story.offsetHeight - window.innerHeight;
      window.scrollTo({top: story.offsetTop + KEY_T[i] * total + (i ? 2 : 0), behavior: reduce ? 'auto' : 'smooth'});
    });
  });

  // slider: user takes over until they scroll on a little
  var manual = !storyOn, manualP = 0, todTarget = B.tod;
  if (todInput) {
    todTarget = parseFloat(todInput.value) || .08; B.tod = todTarget;
    todInput.addEventListener('input', function(){
      manual = true; manualP = B.story; todTarget = parseFloat(todInput.value);
      if (reduce) { B.tod = todTarget; applyTint(B.tod); }
    });
  }

  var headerSolidAt = 24;
  function onScroll(){
    var y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      if (story) header.classList.toggle('is-solid', y > story.offsetTop + story.offsetHeight - (header.offsetHeight || 70));
    }
    if (story) {
      B.story = storyOn ? storyProgress() : 0;
      if (storyOn) {
        setChapter(B.story);
        story.classList.toggle('is-moving', B.story > .01);
        if (manual && Math.abs(B.story - manualP) > .035) manual = false;
      }
    }
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);
  onScroll();
  if (storyOn) setChapter(B.story); else chapters.forEach(function(c){ c.classList.add('is-active'); });

  if (todInput) {
    applyTint(B.tod);
    var lastT = performance.now();
    var loop = function(now){
      var dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
      if (!manual && storyOn) todTarget = todForProgress(B.story);
      var k = reduce ? 1 : 1 - Math.exp(-dt * (manual ? 9 : 5));
      B.tod += (todTarget - B.tod) * k;
      if (Math.abs(todTarget - B.tod) < .0005) B.tod = todTarget;
      applyTint(B.tod);
      if (!manual && document.activeElement !== todInput) {
        var v = B.tod.toFixed(2);
        if (todInput.value !== v) todInput.value = v;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------------- gallery: lights toggle + parallax ---------------- */
  document.querySelectorAll('[data-proj]').forEach(function(card){
    var b = card.querySelector('[data-lights]'), txt = card.querySelector('[data-lights-text]');
    if (b) b.addEventListener('click', function(){
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      card.classList.toggle('is-lit', on);
      if (txt) txt.textContent = on ? 'Switch the lights off' : 'Switch the lights on';
    });
    var pic = card.querySelector('[data-parallax]');
    if (!pic || reduce) return;
    var svg = pic.querySelector('svg');
    pic.addEventListener('pointermove', function(e){
      if (e.pointerType === 'touch') return;
      var r = pic.getBoundingClientRect();
      svg.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      svg.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
    pic.addEventListener('pointerleave', function(){ svg.style.setProperty('--mx', 0); svg.style.setProperty('--my', 0); });
  });
  var parallaxEls = reduce ? [] : Array.prototype.slice.call(document.querySelectorAll('[data-parallax] svg, .villa-card .pic svg'));
  if (parallaxEls.length) {
    var ticking = false;
    var updateSy = function(){
      ticking = false;
      var vh = window.innerHeight;
      parallaxEls.forEach(function(el){
        var r = el.parentNode.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        el.style.setProperty('--sy', clamp(((r.top + r.height / 2) - vh / 2) / vh, -1, 1).toFixed(3));
      });
    };
    window.addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(updateSy); } }, {passive:true});
    updateSy();
  }

  /* ---------------- reveal (section heads and cards only) ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var els = document.querySelectorAll('.sec-head, .intro > div, .villa-card, .svc, .proj, .steps li, .facts > div');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting || en.boundingClientRect.top < 0) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, {rootMargin: '0px 0px -8% 0px'});
    els.forEach(function(el){
      var sib = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.transitionDelay = Math.min(sib, 4) * 80 + 'ms';
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* ---------------- soft page transitions (fallback when CSS view transitions are unsupported) ---------------- */
  if (!window.CSSViewTransitionRule && !reduce) {
    doc.classList.add('no-vt');
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      doc.classList.add('is-leaving');
      setTimeout(function(){ location.href = a.href; }, 200);
    });
    window.addEventListener('pageshow', function(){ doc.classList.remove('is-leaving'); });
  }
})();
