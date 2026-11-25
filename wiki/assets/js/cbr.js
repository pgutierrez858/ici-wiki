/* Ejemplos interactivos de los apuntes del tema 6 (razonamiento basado en casos).
 *
 *   data-cbr="vecinos"   una consulta entre casos guardados: similitud, pesos, k y votación
 *   data-cbr="ventana"   revisar con una ventana de cruces: qué resultado se lleva cada caso
 *   data-cbr="retener"   la base crece: guardar todo, sólo lo que falla o sólo lo nuevo
 *
 * Los casos describen la situación con dos números, la distancia al fantasma más
 * cercano y a la píldora de poder más cercana (de 0 a 100 pasos), y la solución
 * es una de tres acciones: huir, ir a la píldora o comer pastillas.
 * Similitud como en jCOLIBRI: Interval(100) en cada atributo y la media pesada.
 * Sin dependencias y sin build. Sin JavaScript queda el aviso de cada bloque.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  /* ============================ utilidades ============================ */

  var NS = 'http://www.w3.org/2000/svg';
  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sv(t, at, txt) { var e = document.createElementNS(NS, t); for (var k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; return e; }
  function boton(txt, f, cls) { var b = el('button', 'demo-btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.onclick = f; return b; }
  function barra(cls) { return el('div', 'demo-bar' + (cls ? ' ' + cls : '')); }
  function opciones(etiq, pares, val, alCambiar) {
    var raiz = el('span', 'demo-grupo');
    if (etiq) raiz.appendChild(el('span', 'demo-tag', etiq));
    pares.forEach(function (p) {
      var b = el('button', 'demo-btn demo-btn-mini', p[0]); b.type = 'button';
      b.setAttribute('aria-pressed', String(p[1] === val));
      b.onclick = function () {
        Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        alCambiar(p[1]);
      };
      raiz.appendChild(b);
    });
    return raiz;
  }
  function deslizador(etiq, min, max, paso, val, alCambiar, formato) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(document.createTextNode(etiq));
    var i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = paso; i.value = val;
    var f = formato || function (x) { return fmt(x, 1); };
    var out = el('b', null, f(val));
    i.oninput = function () { out.textContent = f(Number(i.value)); alCambiar(Number(i.value)); };
    raiz.appendChild(i); raiz.appendChild(out);
    return raiz;
  }
  function fmt(x, d) { return (x == null || isNaN(x)) ? '—' : Number(x).toFixed(d == null ? 2 : d).replace('.', ','); }
  function prepara(nodo) {
    var stage = nodo.querySelector('.demo-stage'); stage.innerHTML = '';
    return { stage: stage, controls: nodo.querySelector('.demo-controls'), read: nodo.querySelector('.demo-read') };
  }
  // generador con semilla: los mismos casos en cada visita, para poder hablar de ellos
  function semilla(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ===================== el dominio de los ejemplos ===================== */

  var ACC = {
    H: { nom: 'Huir', cls: 'cb-huir' },
    P: { nom: 'Ir a la píldora', cls: 'cb-pild' },
    C: { nom: 'Comer pastillas', cls: 'cb-comer' }
  };
  // la "verdad" que nadie escribe: es lo que haría un buen jugador, y los casos la imitan
  function regla(g, p) {
    if (g < 22) return p < 14 ? 'P' : 'H';
    if (g < 50 && p < 32) return 'P';
    return 'C';
  }
  var RANGO = 100;
  function simLocal(a, b) { return 1 - Math.abs(a - b) / RANGO; }
  function simGlobal(c, q, wg, wp) {
    var s = wg + wp;
    if (s === 0) return 1;
    return (wg * simLocal(c.g, q.g) + wp * simLocal(c.p, q.p)) / s;
  }
  // los k más parecidos, de más a menos
  function vecinos(base, q, k, wg, wp) {
    return base.map(function (c) { return { c: c, s: simGlobal(c, q, wg, wp) }; })
      .sort(function (a, b) { return b.s - a.s || a.c.id - b.c.id; })
      .slice(0, k);
  }
  function vota(vs, pesada) {
    var t = { H: 0, P: 0, C: 0 };
    vs.forEach(function (v) { t[v.c.a] += pesada ? v.s : 1; });
    var mejor = null;
    // empate: gana la del vecino más parecido, que es la que elegiría 1-NN
    vs.forEach(function (v) { if (mejor === null || t[v.c.a] > t[mejor] + 1e-9) mejor = v.c.a; });
    return { gana: mejor, t: t };
  }

  // el plano: x = fantasma, y = píldora, los dos de 0 a 100
  function plano(svg, W, H, m) {
    var ancho = W - m.l - m.r, alto = H - m.t - m.b;
    var X = function (g) { return m.l + g / 100 * ancho; };
    var Y = function (p) { return m.t + (1 - p / 100) * alto; };
    svg.appendChild(sv('rect', { x: m.l, y: m.t, width: ancho, height: alto, class: 'cb-fondo' }));
    for (var v = 0; v <= 100; v += 20) {
      svg.appendChild(sv('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + alto, class: 'cb-rej' }));
      svg.appendChild(sv('line', { x1: m.l, x2: m.l + ancho, y1: Y(v), y2: Y(v), class: 'cb-rej' }));
      svg.appendChild(sv('text', { x: X(v), y: m.t + alto + 14, class: 'cb-t cb-centro' }, String(v)));
      svg.appendChild(sv('text', { x: m.l - 6, y: Y(v) + 3.5, class: 'cb-t cb-dcha' }, String(v)));
    }
    svg.appendChild(sv('text', { x: m.l + ancho / 2, y: H - 4, class: 'cb-t cb-centro cb-eje' }, 'distancia al fantasma más cercano →'));
    var ty = sv('text', { x: 12, y: m.t + alto / 2, class: 'cb-t cb-centro cb-eje', transform: 'rotate(-90 12 ' + (m.t + alto / 2) + ')' }, 'distancia a la píldora de poder →');
    svg.appendChild(ty);
    return { X: X, Y: Y, ancho: ancho, alto: alto,
      inv: function (px, py) { return { g: (px - m.l) / ancho * 100, p: (1 - (py - m.t) / alto) * 100 }; } };
  }
  // un caso: triángulo huir, cuadrado píldora, círculo comer (la forma dice lo mismo que el color)
  function marca(a, x, y, r, extra) {
    var cls = 'cb-caso ' + ACC[a].cls + (extra ? ' ' + extra : '');
    if (a === 'H') return sv('path', { d: 'M' + x + ' ' + (y - r * 1.15) + 'L' + (x + r * 1.1) + ' ' + (y + r * 0.8) + 'L' + (x - r * 1.1) + ' ' + (y + r * 0.8) + 'Z', class: cls });
    if (a === 'P') return sv('rect', { x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8, class: cls });
    return sv('circle', { cx: x, cy: y, r: r, class: cls });
  }
  function leyenda(cont) {
    var l = el('p', 'cb-leyenda');
    ['H', 'P', 'C'].forEach(function (a) {
      var s = sv('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true' });
      s.appendChild(marca(a, 7, 7.5, 5));
      var i = el('span'); i.appendChild(s); i.appendChild(document.createTextNode(' ' + ACC[a].nom));
      l.appendChild(i);
    });
    var s = sv('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true' });
    s.appendChild(sv('path', { d: 'M7 1L13 7L7 13L1 7Z', class: 'cb-consulta' }));
    var i = el('span'); i.appendChild(s); i.appendChild(document.createTextNode(' La situación de ahora (la consulta)'));
    l.appendChild(i);
    cont.appendChild(l);
  }
  function generaCasos(n, rnd, ruido) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var g = Math.round(rnd() * 100), p = Math.round(rnd() * 100), a = regla(g, p);
      if (ruido && rnd() < ruido) a = 'HPC'.replace(a, '').charAt(rnd() < 0.5 ? 0 : 1);
      out.push({ id: i + 1, g: g, p: p, a: a });
    }
    return out;
  }

  /* ============================ 1 · vecinos ============================ */

  function creaVecinos(nodo) {
    var d = prepara(nodo);
    var base = generaCasos(26, semilla(7), 0.08);
    var q = { g: 30, p: 26 }, k = 3, wg = 1, wp = 1, pesada = false, regiones = false;
    var W = 460, H = 330, m = { l: 40, r: 12, t: 12, b: 34 };
    var svg = sv('svg', { class: 'demo-svg cb-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', tabindex: '0',
      'aria-label': 'Plano con los casos guardados. Pulsad o arrastrad para mover la consulta; con el teclado, las flechas.' });
    d.stage.appendChild(svg);
    leyenda(d.stage);
    var cuentas = el('pre', 'cb-cuentas'); d.stage.appendChild(cuentas);
    var P = plano(svg, W, H, m);
    var capaReg = sv('g', {}), capaLin = sv('g', {}), capaCas = sv('g', {}), capaQ = sv('g', {});
    svg.appendChild(capaReg); svg.appendChild(capaLin); svg.appendChild(capaCas); svg.appendChild(capaQ);

    function pintaRegiones() {
      capaReg.innerHTML = '';
      if (!regiones) return;
      var paso = 4;
      for (var g = 0; g < 100; g += paso) for (var p = 0; p < 100; p += paso) {
        var c = { g: g + paso / 2, p: p + paso / 2 };
        var a = vota(vecinos(base, c, k, wg, wp), pesada).gana;
        capaReg.appendChild(sv('rect', { x: P.X(g), y: P.Y(p + paso), width: P.ancho * paso / 100 + 0.3, height: P.alto * paso / 100 + 0.3, class: 'cb-region ' + ACC[a].cls }));
      }
    }
    function dibuja() {
      var vs = vecinos(base, q, k, wg, wp), r = vota(vs, pesada);
      var cerca = {}; vs.forEach(function (v) { cerca[v.c.id] = true; });
      capaLin.innerHTML = ''; capaCas.innerHTML = ''; capaQ.innerHTML = '';
      vs.forEach(function (v) {
        capaLin.appendChild(sv('line', { x1: P.X(q.g), y1: P.Y(q.p), x2: P.X(v.c.g), y2: P.Y(v.c.p), class: 'cb-hilo' }));
      });
      base.forEach(function (c) {
        if (cerca[c.id]) capaCas.appendChild(sv('circle', { cx: P.X(c.g), cy: P.Y(c.p), r: 11, class: 'cb-anillo' }));
        capaCas.appendChild(marca(c.a, P.X(c.g), P.Y(c.p), 5.5));
      });
      var x = P.X(q.g), y = P.Y(q.p);
      capaQ.appendChild(sv('path', { d: 'M' + x + ' ' + (y - 9) + 'L' + (x + 9) + ' ' + y + 'L' + x + ' ' + (y + 9) + 'L' + (x - 9) + ' ' + y + 'Z', class: 'cb-consulta' }));

      var n = vs[0].c, sg = simLocal(n.g, q.g), sp = simLocal(n.p, q.p);
      var qg = Math.round(q.g), qp = Math.round(q.p);
      cuentas.textContent =
        'Consulta: fantasma ' + qg + ', píldora ' + qp + '.  El más parecido, el caso ' + n.id + ': fantasma ' + n.g + ', píldora ' + n.p + '\n' +
        'sim fantasma = 1 − |' + qg + ' − ' + n.g + '| / 100 = ' + fmt(sg) + '\n' +
        'sim píldora  = 1 − |' + qp + ' − ' + n.p + '| / 100 = ' + fmt(sp) + '\n' +
        'sim global   = (' + fmt(wg, 1) + ' · ' + fmt(sg) + ' + ' + fmt(wp, 1) + ' · ' + fmt(sp) + ') / (' + fmt(wg, 1) + ' + ' + fmt(wp, 1) + ') = ' + fmt(vs[0].s, 3);
      var lista = vs.map(function (v) { return 'caso ' + v.c.id + ' ' + ACC[v.c.a].nom.toLowerCase() + ' (' + fmt(v.s, 3) + ')'; }).join(', ');
      var votos = ['H', 'P', 'C'].filter(function (a) { return r.t[a] > 0; })
        .map(function (a) { return ACC[a].nom.toLowerCase() + ' ' + (pesada ? fmt(r.t[a], 2) : r.t[a]); }).join(', ');
      d.read.textContent = (k === 1 ? 'El más parecido: ' + lista + '. Se copia su acción: ' :
        'Los ' + k + ' más parecidos: ' + lista + '. Votos: ' + votos + '. Gana ') + ACC[r.gana].nom.toLowerCase() + '.' +
        (r.gana !== regla(q.g, q.p) ? ' (Un buen jugador aquí haría: ' + ACC[regla(q.g, q.p)].nom.toLowerCase() + '.)' : '');
    }
    function todo() { pintaRegiones(); dibuja(); }

    function mueve(ev) {
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      var l = pt.matrixTransform(svg.getScreenCTM().inverse()), v = P.inv(l.x, l.y);
      q = { g: Math.max(0, Math.min(100, v.g)), p: Math.max(0, Math.min(100, v.p)) };
      dibuja();
    }
    var arrastrando = false;
    svg.addEventListener('pointerdown', function (ev) { arrastrando = true; svg.setPointerCapture(ev.pointerId); mueve(ev); });
    svg.addEventListener('pointermove', function (ev) { if (arrastrando) mueve(ev); });
    svg.addEventListener('pointerup', function () { arrastrando = false; });
    svg.addEventListener('keydown', function (ev) {
      var dx = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, 2], ArrowDown: [0, -2] }[ev.key];
      if (!dx) return;
      ev.preventDefault();
      q = { g: Math.max(0, Math.min(100, q.g + dx[0])), p: Math.max(0, Math.min(100, q.p + dx[1])) };
      dibuja();
    });

    var b1 = barra();
    b1.appendChild(opciones('k', [['1', 1], ['3', 3], ['5', 5], ['7', 7]], k, function (v) { k = v; todo(); }));
    b1.appendChild(opciones('Votación', [['Un voto cada uno', false], ['Pesada por similitud', true]], pesada, function (v) { pesada = v; todo(); }));
    var b2 = barra();
    b2.appendChild(deslizador('Peso del fantasma', 0, 3, 0.5, wg, function (v) { wg = v; todo(); }));
    b2.appendChild(deslizador('Peso de la píldora', 0, 3, 0.5, wp, function (v) { wp = v; todo(); }));
    var bReg = boton('Pintar qué se decide en cada punto', function () {
      regiones = !regiones; bReg.setAttribute('aria-pressed', String(regiones)); todo();
    }, 'demo-btn-mini');
    bReg.setAttribute('aria-pressed', 'false');
    b2.appendChild(bReg);
    d.controls.appendChild(b1); d.controls.appendChild(b2);
    todo();
  }

  /* ============================ 2 · ventana ============================ */

  // una partida contada cruce a cruce: puntos al llegar a cada cruce y lo que pasó en el tramo
  var PARTIDA = [
    { s: 1000 }, { s: 1040, e: 'pastillas' }, { s: 1080, e: 'pastillas' }, { s: 1110, e: 'pastillas' },
    { s: 1180, e: 'píldora de poder' }, { s: 1380, e: 'come un fantasma' }, { s: 1420, e: 'pastillas' },
    { s: 1450, e: 'pastillas' }, { s: 1480, e: 'pastillas' }, { s: 1490, e: 'pastillas' },
    { s: 1490, e: 'muere', muerte: true }, { s: 1530, e: 'pastillas' }, { s: 1560, e: 'pastillas' }
  ];
  function creaVentana(nodo) {
    var d = prepara(nodo);
    var V = 3, castigo = false, sel = 8, n = PARTIDA.length - 1;
    var W = 560, H = 274, x0 = 46, dx = (W - x0 - 22) / n;
    var svg = sv('svg', { class: 'demo-svg cb-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'La partida cruce a cruce. Cada cruce es una decisión, y debajo, el resultado que se lleva su caso.' });
    d.stage.appendChild(svg);
    var cuentas = el('pre', 'cb-cuentas'); d.stage.appendChild(cuentas);
    function X(i) { return x0 + i * dx; }
    function resultado(i) {
      var j = Math.min(n, i + V), r = PARTIDA[j].s - PARTIDA[i].s, murio = false;
      for (var t = i + 1; t <= j; t++) if (PARTIDA[t].muerte) murio = true;
      return { j: j, r: r - (castigo && murio ? 500 : 0), murio: murio, puntos: r };
    }
    function dibuja() {
      svg.innerHTML = '';
      var yL = 58, yB = 170, esc = 0.17;
      svg.appendChild(sv('line', { x1: X(0), x2: X(n), y1: yL, y2: yL, class: 'cb-linea' }));
      var r = resultado(sel);
      svg.appendChild(sv('rect', { x: X(sel), y: yL - 12, width: X(r.j) - X(sel), height: 24, class: 'cb-ventana' }));
      for (var i = 1; i <= n; i++) {
        var e = PARTIDA[i], xm = (X(i - 1) + X(i)) / 2;
        // los puntos del tramo en una fila, y lo que pasó de especial encima, a dos alturas para que no se pisen
        svg.appendChild(sv('text', { x: xm, y: 42, class: 'cb-t cb-centro cb-evento' }, '+' + (e.s - PARTIDA[i - 1].s)));
        if (e.e !== 'pastillas')
          svg.appendChild(sv('text', { x: xm, y: i % 2 ? 18 : 29, class: 'cb-t cb-centro cb-evento' + (e.muerte ? ' cb-muerte' : ' cb-bueno') },
            e.muerte ? '✕ muere' : e.e === 'píldora de poder' ? 'píldora' : 'fantasma'));
      }
      svg.appendChild(sv('line', { x1: X(0), x2: X(n), y1: yB, y2: yB, class: 'cb-cero' }));
      for (i = 0; i <= n; i++) {
        var esCaso = i < n;
        var c = sv('circle', { cx: X(i), cy: yL, r: i === sel ? 8 : 6, class: 'cb-cruce' + (i === sel ? ' sel' : '') + (esCaso ? '' : ' fin') });
        if (esCaso) {
          c.setAttribute('tabindex', '0'); c.setAttribute('role', 'button');
          c.setAttribute('aria-label', 'Cruce ' + i);
          (function (k) {
            c.addEventListener('click', function () { sel = k; dibuja(); });
            c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sel = k; dibuja(); } });
          })(i);
        }
        svg.appendChild(c);
        svg.appendChild(sv('text', { x: X(i), y: yL + 24, class: 'cb-t cb-centro' }, String(i)));
        if (!esCaso) continue;
        var ri = resultado(i).r, h = Math.max(1.5, Math.min(60, Math.abs(ri) * esc));
        svg.appendChild(sv('rect', { x: X(i) - 9, y: ri >= 0 ? yB - h : yB, width: 18, height: h, class: 'cb-barra' + (ri < 0 ? ' mala' : '') + (i === sel ? ' sel' : '') }));
        svg.appendChild(sv('text', { x: X(i), y: ri >= 0 ? yB - h - 4 : yB + h + 11, class: 'cb-t cb-centro' }, (ri > 0 ? '+' : '') + String(ri).replace('-', '−')));
      }
      svg.appendChild(sv('text', { x: 4, y: yL + 24, class: 'cb-t cb-tenue' }, 'cruce'));
      svg.appendChild(sv('text', { x: 4, y: 42, class: 'cb-t cb-tenue' }, 'puntos'));
      svg.appendChild(sv('text', { x: 4, y: H - 6, class: 'cb-t cb-tenue' }, 'resultado que se guarda con el caso de cada cruce'));

      var lin = 'Caso del cruce ' + sel + ': se revisa al llegar al cruce ' + r.j + (r.j === n && sel + V > n ? ' (la partida se acaba antes)' : '') + '\n' +
        'resultado = puntos en el cruce ' + r.j + ' − puntos en el cruce ' + sel + '\n' +
        '          = ' + PARTIDA[r.j].s + ' − ' + PARTIDA[sel].s + (castigo && r.murio ? ' − 500 (murió por el camino)' : '') + '\n' +
        '          = ' + String(r.r).replace('-', '−');
      cuentas.textContent = lin;
      var t = 'Ventana de ' + V + ' cruce' + (V > 1 ? 's' : '') + '. ';
      if (r.murio && !castigo) t += 'Ms. Pac-Man muere dentro de la ventana y el caso sale con +' + r.r + ': parece una buena decisión. Probad a castigar las muertes.';
      else if (r.murio) t += 'Con el castigo, la decisión que llevó a la muerte queda marcada como mala.';
      else if (sel < 5 && sel + V >= 5) t += 'El fantasma comido en el tramo 5 cuenta también para este caso, aunque quizá la decisión buena fue otra.';
      else t += 'Pulsad otro cruce para ver qué resultado se lleva su caso.';
      d.read.textContent = t;
    }
    var b = barra();
    b.appendChild(deslizador('Ventana (cruces)', 1, 5, 1, V, function (v) { V = v; dibuja(); }, function (x) { return String(x); }));
    var bc = boton('Restar 500 si muere', function () { castigo = !castigo; bc.setAttribute('aria-pressed', String(castigo)); dibuja(); }, 'demo-btn-mini');
    bc.setAttribute('aria-pressed', 'false');
    b.appendChild(bc);
    d.controls.appendChild(b);
    dibuja();
  }

  /* ============================ 3 · retener ============================ */

  function creaRetener(nodo) {
    var d = prepara(nodo);
    var POL = { todo: 'Guardar todo', falla: 'Sólo si se equivoca', nuevo: 'Sólo si no hay uno parecido' };
    var pol = 'todo', ruido = 0.05, rnd, base, vistos, aciertos, historia;
    var W = 460, H = 300, m = { l: 40, r: 12, t: 12, b: 34 };
    var svg = sv('svg', { class: 'demo-svg cb-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Los casos que se van guardando en el plano. Debajo, cuántos hay y cuántas decisiones acierta.' });
    d.stage.appendChild(svg);
    leyenda(d.stage);
    var P = plano(svg, W, H, m), capa = sv('g', {}); svg.appendChild(capa);
    var tabla = el('div', 'table-scroll'); d.stage.appendChild(tabla);
    var filas = [];

    function reinicia() { rnd = semilla(11); base = []; vistos = 0; aciertos = []; historia = []; dibuja(); }
    // decide con 1-NN, mira si acierta y retiene según la política
    function una() {
      var g = Math.round(rnd() * 100), p = Math.round(rnd() * 100), buena = regla(g, p);
      // lo que de verdad pasó al probar a veces no coincide con la regla: el ruido de una partida
      if (rnd() < ruido) buena = 'HPC'.replace(buena, '').charAt(rnd() < 0.5 ? 0 : 1);
      var q = { g: g, p: p }, dec = null, s = 0;
      if (base.length) { var v = vecinos(base, q, 1, 1, 1)[0]; dec = v.c.a; s = v.s; }
      var ok = dec === buena;
      aciertos.push(ok ? 1 : 0);
      var guarda = pol === 'todo' || (pol === 'falla' && !ok) || (pol === 'nuevo' && (base.length === 0 || s < 0.95));
      if (guarda) base.push({ id: base.length + 1, g: g, p: p, a: buena });
      vistos++;
    }
    function juega(n) {
      for (var i = 0; i < n; i++) una();
      historia.push({ v: vistos, n: base.length, ac: ultimos(200) });
      dibuja();
    }
    function ultimos(n) { var a = aciertos.slice(-n); return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
    function dibuja() {
      capa.innerHTML = '';
      base.forEach(function (c) { capa.appendChild(marca(c.a, P.X(c.g), P.Y(c.p), base.length > 400 ? 2.6 : 3.6)); });
      d.read.textContent = vistos === 0 ? 'Base vacía. Pulsad para que Ms. Pac-Man vaya encontrándose situaciones.' :
        POL[pol] + ': ' + vistos + ' situaciones vistas, ' + base.length + ' casos guardados (' + Math.round(100 * base.length / vistos) +
        ' %). En las últimas ' + Math.min(200, vistos) + ' decisiones acierta el ' + Math.round(100 * ultimos(200)) + ' %.';
    }
    function apunta() {
      if (!vistos) return;
      filas.push([POL[pol] + (ruido ? '' : ' (sin ruido)'), vistos, base.length, Math.round(100 * ultimos(200)) + ' %']);
      tabla.innerHTML = '';
      var t = el('table', 'cb-tabla'), th = el('thead'), tr = el('tr');
      ['Política', 'Situaciones', 'Casos guardados', 'Aciertos (últimas 200)'].forEach(function (h) { var c = el('th', null, h); c.scope = 'col'; tr.appendChild(c); });
      th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      filas.forEach(function (f) { var r = el('tr'); f.forEach(function (x) { r.appendChild(el('td', null, String(x))); }); tb.appendChild(r); });
      t.appendChild(tb); tabla.appendChild(t);
    }
    var b1 = barra('demo-bar-play');
    b1.appendChild(boton('100 situaciones', function () { juega(100); }, 'demo-play'));
    b1.appendChild(boton('1000 más', function () { juega(1000); }));
    b1.appendChild(boton('Apuntar en la tabla', apunta));
    b1.appendChild(boton('Vaciar la base', reinicia));
    var b2 = barra();
    b2.appendChild(opciones('Retener', [[POL.todo, 'todo'], [POL.falla, 'falla'], [POL.nuevo, 'nuevo']], pol, function (v) { pol = v; reinicia(); }));
    b2.appendChild(opciones('Ruido', [['5 %', 0.05], ['Ninguno', 0]], ruido, function (v) { ruido = v; reinicia(); }));
    d.controls.appendChild(b1); d.controls.appendChild(b2);
    reinicia();
  }

  /* ============================ arranque ============================ */

  var CREA = { vecinos: creaVecinos, ventana: creaVentana, retener: creaRetener };
  Array.prototype.forEach.call(document.querySelectorAll('[data-cbr]'), function (n) {
    var f = CREA[n.getAttribute('data-cbr')];
    if (!f) return;
    try { f(n); } catch (e) { if (window.console) console.error('cbr', n.getAttribute('data-cbr'), e); }
  });
})();
