/* Presentación. Convierte una lista de .slide en diapositivas de 16:9 con
   teclado, barra de control y pantalla completa. Sin este archivo la página
   sigue siendo legible: las diapositivas se quedan apiladas. */

(function () {
  'use strict';

  var deck = document.querySelector('.deck');
  if (!deck) return;
  var stage = deck.querySelector('.deck-stage');
  var slides = [].slice.call(deck.querySelectorAll('.slide'));
  if (!stage || slides.length < 2) return;

  deck.classList.add('deck--js');
  deck.setAttribute('aria-roledescription', 'presentación');

  slides.forEach(function (s, i) {
    s.setAttribute('role', 'group');
    s.setAttribute('aria-label', 'Diapositiva ' + (i + 1) + ' de ' + slides.length);
    if (!s.id) s.id = 'd' + (i + 1);
  });

  /* ---------- barra ---------- */
  var bar = document.createElement('div');
  bar.className = 'deck-bar';
  bar.innerHTML =
    '<button class="deck-btn" type="button" data-go="-1" aria-label="Diapositiva anterior">←</button>' +
    '<button class="deck-btn" type="button" data-go="1" aria-label="Diapositiva siguiente">→</button>' +
    '<span class="deck-count" aria-live="polite"><b>1</b> / ' + slides.length + '</span>' +
    '<span class="grow"></span>' +
    '<span class="deck-hint">← → o espacio para pasar</span>' +
    '<button class="deck-btn deck-exit" type="button" data-exit>Volver a la página</button>' +
    '<button class="deck-btn primary" type="button" data-full>Pantalla completa</button>';
  deck.appendChild(bar);

  /* Las diapositivas se meten en su propia caja y la pista de bolitas queda
     debajo, como franja reservada: así no puede solaparse nunca con el
     contenido, por mucho que crezca el texto de una diapositiva. */
  var lienzo = document.createElement('div');
  lienzo.className = 'deck-slides';
  stage.insertBefore(lienzo, stage.firstChild);
  slides.forEach(function (s) { lienzo.appendChild(s); });

  /* ---------- Pac-Man se come una bolita por diapositiva ---------- */
  var pista = document.createElement('div');
  pista.className = 'deck-pac';
  pista.setAttribute('aria-hidden', 'true');
  var track = document.createElement('div');
  track.className = 'pac-track';
  track.innerHTML = new Array(slides.length + 1).join('<i></i>');
  var pac = document.createElement('div');
  pac.className = 'pac-man';
  pac.innerHTML = '<svg viewBox="0 0 26 26">' +
    '<path class="pac pac-a" d="M13 13 24.26 6.5A13 13 0 1 0 24.26 19.5Z"/>' +
    '<path class="pac pac-b" d="M13 13 25.74 10.41A13 13 0 1 0 25.74 15.59Z"/></svg>';
  pista.appendChild(track);
  pista.appendChild(pac);
  stage.appendChild(pista);
  var bolitas = [].slice.call(track.children);
  var atras = false;

  function colocaPac() {
    var libre = track.clientWidth - pac.offsetWidth;
    var f = slides.length > 1 ? i / (slides.length - 1) : 0;
    pac.style.transform = 'translateX(' + (libre * f).toFixed(1) + 'px)' + (atras ? ' scaleX(-1)' : '');
    bolitas.forEach(function (b, k) { b.classList.toggle('comida', k <= i); });
  }

  function masca() {
    pac.classList.remove('chomp');
    void pac.offsetWidth;
    pac.classList.add('chomp');
  }

  var reajuste;
  window.addEventListener('resize', function () {
    clearTimeout(reajuste);
    reajuste = setTimeout(colocaPac, 120);
  });
  document.addEventListener('fullscreenchange', function () { setTimeout(colocaPac, 80); });
  document.addEventListener('webkitfullscreenchange', function () { setTimeout(colocaPac, 80); });

  var btnPrev = bar.querySelector('[data-go="-1"]');
  var btnNext = bar.querySelector('[data-go="1"]');
  var btnFull = bar.querySelector('[data-full]');
  var btnExit = bar.querySelector('[data-exit]');
  var count = bar.querySelector('.deck-count b');

  /* ---------- navegación ---------- */
  var i = 0;

  function show(n, silent) {
    var antes = i;
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) { s.hidden = k !== i; });
    count.textContent = String(i + 1);
    if (i !== antes) atras = i < antes;
    colocaPac();
    if (i !== antes) masca();
    btnPrev.disabled = i === 0;
    btnNext.disabled = i === slides.length - 1;
    if (!silent) {
      try { history.replaceState(null, '', '#' + slides[i].id); } catch (e) {}
    }
  }

  bar.addEventListener('click', function (e) {
    var go = e.target.getAttribute && e.target.getAttribute('data-go');
    if (go) show(i + Number(go));
  });

  stage.addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    // media pantalla derecha avanza, izquierda retrocede
    var r = stage.getBoundingClientRect();
    show(i + (e.clientX - r.left > r.width / 2 ? 1 : -1));
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { show(i + 1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { show(i - 1); e.preventDefault(); }
    else if (k === 'Home') { show(0); e.preventDefault(); }
    else if (k === 'End') { show(slides.length - 1); e.preventDefault(); }
    else if (k === 'f' || k === 'F') { toggleFull(); e.preventDefault(); }
  });

  /* deslizar con el dedo */
  var x0 = null, y0 = null;
  stage.addEventListener('touchstart', function (e) {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    var dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  });

  /* ---------- pantalla completa ---------- */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function paintFull() {
    var on = fsElement() === deck || deck.classList.contains('deck--big');
    deck.classList.toggle('is-full', on);
    btnFull.textContent = on ? 'Salir' : 'Pantalla completa';
    btnFull.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleFull() {
    if (fsElement() === deck) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (deck.classList.contains('deck--big')) { exitBig(); return; }
    var req = deck.requestFullscreen || deck.webkitRequestFullscreen;
    if (req) {
      var p = req.call(deck);
      if (p && p.catch) p.catch(enterBig);
    } else {
      enterBig();
    }
    setTimeout(paintFull, 60);
  }
  function enterBig() {
    deck.classList.add('deck--big');
    document.documentElement.style.overflow = 'hidden';
    paintFull();
  }
  function exitBig() {
    deck.classList.remove('deck--big');
    document.documentElement.style.overflow = '';
    paintFull();
    deck.scrollIntoView({ block: 'start' });
  }
  btnFull.addEventListener('click', toggleFull);
  btnExit.addEventListener('click', function () {
    if (fsElement() === deck) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else exitBig();
  });
  document.addEventListener('fullscreenchange', paintFull);
  document.addEventListener('webkitfullscreenchange', paintFull);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && deck.classList.contains('deck--big')) exitBig();
  });

  /* ---------- arranque y enlaces a una diapositiva ---------- */
  function indiceDeHash() {
    return slides.map(function (s) { return '#' + s.id; }).indexOf(location.hash);
  }
  window.addEventListener('hashchange', function () {
    var k = indiceDeHash();
    if (k > -1 && k !== i) show(k, true);
  });
  var start = 0;
  if (location.hash) {
    var k0 = indiceDeHash();
    if (k0 > -1) start = k0;
  }
  show(start, true);
  colocaPac();
  paintFull();
})();
