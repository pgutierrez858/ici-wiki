/* Ejemplos interactivos de los apuntes del tema 5 (juegos por turnos y MCTS).
 *
 *   data-mcts="bandido"       cuatro tragaperras, a mano o con UCB1
 *   data-mcts="fases"         MCTS sobre tres en raya, fase a fase
 *   data-mcts="conecta4"      jugar a Conecta 4 contra un MCTS
 *   data-mcts="determinizar"  determinizar una mano oculta, y por qué engaña
 *   data-mcts="alfabeta"      la poda alfa-beta, paso a paso, con α y β en cada nodo
 *   data-mcts="minimax"       minimax implícito: la media, el peor caso y el peso λ que los mezcla
 *
 * Todos con el mismo convenio que la práctica: el valor de un nodo se mira
 * desde quien hizo la jugada que lleva a él (gana 1, tablas 0,5, pierde 0).
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
        val = p[1];
        Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        alCambiar(val);
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
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function prepara(nodo) {
    var stage = nodo.querySelector('.demo-stage'); stage.innerHTML = '';
    return { stage: stage, controls: nodo.querySelector('.demo-controls'), read: nodo.querySelector('.demo-read') };
  }
  function azar(n) { return Math.floor(Math.random() * n); }
  function ucb(W, N, Np, c) { return N === 0 ? Infinity : W / N + c * Math.sqrt(Math.log(Np) / N); }

  /* ============================ 1 · el bandido ============================ */

  function creaBandido(nodo) {
    var d = prepara(nodo);
    var NOM = ['A', 'B', 'C', 'D'];
    var FIJAS = [0.35, 0.6, 0.5, 0.25];
    var p = FIJAS.slice(), n, s, total, premios, ultima, verUcb = false, revela = false, c = 1.4, comparativa = '';

    function reinicia() { n = [0, 0, 0, 0]; s = [0, 0, 0, 0]; total = 0; premios = 0; ultima = -1; comparativa = ''; }
    reinicia();

    function tira(i) {
      var g = Math.random() < p[i] ? 1 : 0;
      n[i]++; s[i] += g; total++; premios += g; ultima = i;
      return g;
    }
    function eligeUcb(nn, ss, tt) {
      var mejor = 0, mv = -1;
      for (var i = 0; i < 4; i++) { var v = ucb(ss[i], nn[i], Math.max(tt, 1), c); if (v > mv) { mv = v; mejor = i; } }
      return mejor;
    }

    var svg = sv('svg', { viewBox: '0 0 640 250', class: 'demo-svg mc-svg mc-ban', role: 'img', 'aria-label': 'Cuatro tragaperras con sus tiradas, su media y, si se activa, su puntuación UCB1' });
    d.stage.appendChild(svg);
    var traza = el('pre', 'demo-traza'); traza.hidden = true; d.stage.appendChild(traza);

    function pinta() {
      svg.innerHTML = '';
      var mejorU = verUcb ? eligeUcb(n, s, total) : -1;
      for (var i = 0; i < 4; i++) {
        var x = 20 + i * 155, w = 135;
        var g = sv('g', { class: 'mc-maquina' + (i === ultima ? ' ultima' : '') + (i === mejorU ? ' elegida' : '') });
        g.appendChild(sv('rect', { x: x, y: 8, width: w, height: 232, rx: 6, class: 'mc-maq-caja' }));
        g.appendChild(sv('text', { x: x + w / 2, y: 34, class: 'mc-maq-nom' }, 'Máquina ' + NOM[i]));
        g.appendChild(sv('text', { x: x + 12, y: 58, class: 'mc-t' }, 'N   ' + n[i]));
        g.appendChild(sv('text', { x: x + 12, y: 76, class: 'mc-t' }, 'premios ' + s[i]));
        // la barra de la media, en una escala de 0 a 1 (y hasta 2,5 si se suma la exploración)
        var top = 122, alto = 106, esc = verUcb ? 2.5 : 1;
        var by = function (v) { return top + alto - Math.min(v, esc) / esc * alto; };
        g.appendChild(sv('rect', { x: x + 40, y: top, width: 55, height: alto, class: 'mc-fondo' }));
        var media = n[i] ? s[i] / n[i] : 0;
        if (n[i]) g.appendChild(sv('rect', { x: x + 40, y: by(media), width: 55, height: top + alto - by(media), class: 'mc-media' }));
        if (verUcb) {
          var u = ucb(s[i], n[i], Math.max(total, 1), c);
          var techo = isFinite(u) ? by(u) : top;
          g.appendChild(sv('rect', { x: x + 40, y: techo, width: 55, height: by(media) - techo, class: 'mc-explora' + (isFinite(u) ? '' : ' infinito') }));
          g.appendChild(sv('text', { x: x + 12, y: 112, class: 'mc-t' }, 'UCB ' + (isFinite(u) ? fmt(u) : '∞')));
        }
        if (revela) {
          g.appendChild(sv('line', { x1: x + 32, x2: x + 103, y1: by(p[i]), y2: by(p[i]), class: 'mc-real' }));
          g.appendChild(sv('text', { x: x + 106, y: by(p[i]) + 4, class: 'mc-t mc-real-t' }, fmt(p[i])));
        }
        g.appendChild(sv('text', { x: x + 12, y: 94, class: 'mc-t' }, 'media ' + (n[i] ? fmt(media) : '—')));
        svg.appendChild(g);
      }
      traza.hidden = !comparativa;
      traza.textContent = comparativa;
    }

    function lee(txt) {
      d.read.textContent = txt + ' Lleváis ' + total + ' tiradas y ' + premios + ' premios' +
        (total ? ' (' + fmt(premios / total) + ' por tirada).' : '.');
    }

    var b1 = barra('demo-bar-play');
    b1.appendChild(el('span', 'demo-tag', 'Tirar de'));
    NOM.forEach(function (nm, i) {
      b1.appendChild(boton(nm, function () {
        var g = tira(i); pinta();
        lee('Máquina ' + nm + ': ' + (g ? '¡premio!' : 'nada.'));
      }, 'demo-play'));
    });
    b1.appendChild(boton('UCB1 elige una', function () {
      var i = eligeUcb(n, s, total), u = ucb(s[i], n[i], Math.max(total, 1), c);
      var g = tira(i); pinta();
      lee('UCB1 ha elegido la ' + NOM[i] + ' (' + (isFinite(u) ? 'UCB ' + fmt(u) : 'aún sin probar, UCB infinito') + '): ' + (g ? '¡premio!' : 'nada.'));
    }));
    d.controls.appendChild(b1);

    var b2 = barra();
    b2.appendChild(opciones('UCB1', [['Ocultar', false], ['Mostrar', true]], verUcb, function (v) { verUcb = v; pinta(); }));
    b2.appendChild(deslizador('c', 0, 3, 0.1, c, function (v) { c = v; pinta(); }));
    d.controls.appendChild(b2);

    var b3 = barra();
    b3.appendChild(boton('Que juegue UCB1 (100 tiradas)', function () {
      var nn = [0, 0, 0, 0], ss = [0, 0, 0, 0], g = 0;
      for (var t = 0; t < 100; t++) { var i = eligeUcb(nn, ss, t); var r = Math.random() < p[i] ? 1 : 0; nn[i]++; ss[i] += r; g += r; }
      var mejor = Math.max.apply(null, p), alAzar = (p[0] + p[1] + p[2] + p[3]) / 4;
      comparativa =
        'En 100 tiradas, con las mismas máquinas:\n' +
        '  vosotros          ' + (total ? fmt(100 * premios / total, 0) + ' premios (a vuestro ritmo de ' + fmt(premios / total) + ' por tirada)' : 'todavía no habéis tirado') + '\n' +
        '  UCB1 (c = ' + fmt(c, 1) + ')      ' + g + ' premios. Tiradas: ' + NOM.map(function (x, i) { return x + ' ' + nn[i]; }).join(', ') + '\n' +
        '  siempre la mejor  ' + fmt(100 * mejor, 0) + ' de media (sabiendo cuál es, que es hacer trampa)\n' +
        '  al azar           ' + fmt(100 * alAzar, 0) + ' de media';
      pinta();
      lee('UCB1 ha jugado 100 tiradas por su cuenta, sin tocar las vuestras.');
    }));
    b3.appendChild(boton('Revelar probabilidades', function () { revela = !revela; pinta(); }));
    b3.appendChild(boton('Barajar', function () {
      var base = [0.2, 0.3, 0.45, 0.55, 0.65, 0.4, 0.35];
      p = [0, 1, 2, 3].map(function () { return base.splice(azar(base.length), 1)[0]; });
      reinicia(); revela = false; pinta(); lee('Máquinas nuevas, con otras probabilidades ocultas.');
    }));
    b3.appendChild(boton('Reiniciar', function () { reinicia(); pinta(); lee('Contadores a cero, mismas máquinas.'); }));
    d.controls.appendChild(b3);

    pinta();
    d.read.textContent = 'Cuatro máquinas, cada una con una probabilidad de premio que no sabéis. Elegid de cuál tirar.';
  }

  /* ============================ tres en raya ============================ */

  var LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function ganaTer(b) {
    for (var i = 0; i < 8; i++) { var l = LINEAS[i]; if (b[l[0]] !== '.' && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return b[l[0]]; }
    return b.indexOf('.') < 0 ? '=' : null;
  }
  function otro(j) { return j === 'X' ? 'O' : 'X'; }

  // Un nodo: el tablero tras `mv`, quién movió para llegar (`quien`) y sus cuentas.
  function nodoTer(b, quien, padre, mv) {
    var fin = ganaTer(b), un = [];
    if (!fin) for (var i = 0; i < 9; i++) if (b[i] === '.') un.push(i);
    return { b: b, quien: quien, padre: padre, mv: mv, ch: [], un: un, N: 0, W: 0, fin: fin };
  }
  // Recompensa de un resultado ('X', 'O' o '=') para quien movió.
  function premioPara(quien, res) { return res === '=' ? 0.5 : (res === quien ? 1 : 0); }

  /* ============================ 2 · las cuatro fases ============================ */

  function creaFases(nodo) {
    var d = prepara(nodo);
    var INICIO = 'X.O.X....', TURNO = 'O';
    var FASES = ['Selección', 'Expansión', 'Simulación', 'Retropropagación'];
    var c = 1.4, clase = false, raiz, fase, camino, hoja, sim, res, iters, ucbs, esperando;

    function reinicia() {
      raiz = nodoTer(INICIO, otro(TURNO), null, null);
      fase = 0; camino = [raiz]; hoja = null; sim = null; res = null; iters = 0; ucbs = null; esperando = false;
    }

    function seleccion() {
      var n = raiz; camino = [raiz]; ucbs = [];
      while (!n.un.length && n.ch.length) {
        var vals = n.ch.map(function (h) { return ucb(h.W, h.N, n.N, c); });
        var k = vals.indexOf(Math.max.apply(null, vals));
        ucbs.push({ padre: n, vals: vals, k: k });
        n = n.ch[k]; camino.push(n);
      }
      hoja = n;
    }
    function expansion() {
      if (!hoja.un.length) return false;
      var mv = hoja.un.splice(azar(hoja.un.length), 1)[0];
      var b = hoja.b.slice(0, mv) + otro(hoja.quien) + hoja.b.slice(mv + 1);
      var h = nodoTer(b, otro(hoja.quien), hoja, mv);
      hoja.ch.push(h); hoja = h; camino.push(h);
      return true;
    }
    function simulacion() {
      var b = hoja.b.split(''), j = otro(hoja.quien), jugadas = [];
      var f = hoja.fin;
      while (!f) {
        var libres = []; for (var i = 0; i < 9; i++) if (b[i] === '.') libres.push(i);
        var m = libres[azar(libres.length)]; b[m] = j; jugadas.push(m); j = otro(j);
        f = ganaTer(b.join(''));
      }
      sim = { b: b.join(''), jugadas: jugadas }; res = f;
    }
    function retro() {
      camino.forEach(function (n) { n.N++; n.W += premioPara(n.quien, res); });
      iters++;
    }
    function iteracion() { seleccion(); expansion(); simulacion(); retro(); }

    var svg = sv('svg', { viewBox: '0 0 720 385', class: 'demo-svg mc-svg', role: 'img', 'aria-label': 'El árbol de MCTS: la raíz, sus jugadas y las respuestas a la jugada en la que se fija el camino' });
    d.stage.appendChild(svg);
    var leyenda = el('div', 'demo-leyenda');
    leyenda.innerHTML = '<span class="lg">casillas numeradas de 1 a 9, como un teclado de teléfono</span>' +
      '<span class="lg">N: visitas · W/N: valor medio para quien hizo esa jugada</span>' +
      '<span class="lg">en amarillo, el camino de esta iteración</span>';
    d.stage.appendChild(leyenda);
    var traza = el('pre', 'demo-traza'); d.stage.appendChild(traza);

    // un tablero pequeño en (x, y) de lado l; `nuevo` es la casilla de la última jugada
    function tablero(g, b, x, y, l, nuevo, cls, extra) {
      var cel = l / 3;
      g.appendChild(sv('rect', { x: x, y: y, width: l, height: l, rx: 2, class: 'mc-tab ' + (cls || '') }));
      if (nuevo != null) g.appendChild(sv('rect', { x: x + (nuevo % 3) * cel, y: y + Math.floor(nuevo / 3) * cel, width: cel, height: cel, class: 'mc-nuevo' }));
      for (var k = 1; k < 3; k++) {
        g.appendChild(sv('line', { x1: x + k * cel, x2: x + k * cel, y1: y + 2, y2: y + l - 2, class: 'mc-rej' }));
        g.appendChild(sv('line', { y1: y + k * cel, y2: y + k * cel, x1: x + 2, x2: x + l - 2, class: 'mc-rej' }));
      }
      for (var i = 0; i < 9; i++) {
        var cx = x + (i % 3 + 0.5) * cel, cy = y + (Math.floor(i / 3) + 0.5) * cel, r = cel * 0.3;
        var marca = b[i];
        var tenue = extra && extra.indexOf(i) >= 0 ? ' tenue' : '';
        if (marca === 'X') {
          g.appendChild(sv('path', { d: 'M' + (cx - r) + ' ' + (cy - r) + 'L' + (cx + r) + ' ' + (cy + r) + 'M' + (cx + r) + ' ' + (cy - r) + 'L' + (cx - r) + ' ' + (cy + r), class: 'mc-x' + tenue }));
        } else if (marca === 'O') {
          g.appendChild(sv('circle', { cx: cx, cy: cy, r: r, class: 'mc-o' + tenue }));
        }
      }
    }
    function etiquetas(g, x, y, n, ucbTxt) {
      g.appendChild(sv('text', { x: x, y: y, class: 'mc-t mc-centro' }, 'N ' + n.N));
      g.appendChild(sv('text', { x: x, y: y + 14, class: 'mc-t mc-centro' }, 'W/N ' + (n.N ? fmt(n.W / n.N) : '—')));
      if (ucbTxt) g.appendChild(sv('text', { x: x, y: y + 28, class: 'mc-t mc-centro mc-ucb' }, ucbTxt));
    }
    function enCamino(n) { return camino.indexOf(n) >= 0 && fase > 0; }

    function pinta() {
      svg.innerHTML = '';
      var g = sv('g', {}); svg.appendChild(g);
      var LR = 66, rx = 327, ry = 12;
      tablero(g, raiz.b, rx, ry, LR, null, 'raiz' + (fase > 0 ? ' camino' : ''));
      g.appendChild(sv('text', { x: rx - 10, y: ry + 26, class: 'mc-t mc-dcha' }, 'raíz · mueve ' + TURNO));
      g.appendChild(sv('text', { x: rx - 10, y: ry + 42, class: 'mc-t mc-dcha' }, 'N ' + raiz.N));

      // primer nivel: un hueco por jugada, en orden de casilla
      var mov1 = []; for (var i = 0; i < 9; i++) if (raiz.b[i] === '.') mov1.push(i);
      var L1 = 46, y1 = 132, ancho1 = 720 / mov1.length;
      var sel0 = ucbs && ucbs[0];
      // desde quién se cuenta cada nivel: los hijos de la raíz los crea O, y su W/N es lo buenos que son para O
      g.appendChild(sv('text', { x: 10, y: y1 - 12, class: 'mc-t mc-halo' }, 'jugadas de ' + TURNO + ' · W/N: lo buenas que son para ' + TURNO));
      var foco = camino[1] || raiz.ch.slice().sort(function (a, b) { return b.N - a.N; })[0];
      mov1.forEach(function (mv, k) {
        var cx = ancho1 * (k + 0.5), x = cx - L1 / 2;
        var h = raiz.ch.filter(function (z) { return z.mv === mv; })[0];
        if (!h) {
          g.appendChild(sv('line', { x1: rx + LR / 2, y1: ry + LR, x2: cx, y2: y1, class: 'mc-arista vacia' }));
          g.appendChild(sv('rect', { x: x, y: y1, width: L1, height: L1, rx: 2, class: 'mc-hueco' }));
          g.appendChild(sv('text', { x: cx, y: y1 + L1 / 2 + 4, class: 'mc-t mc-centro mc-tenue' }, mv + 1));
          g.appendChild(sv('text', { x: cx, y: y1 + L1 + 14, class: 'mc-t mc-centro mc-tenue' }, 'sin probar'));
          return;
        }
        var ec = enCamino(h);
        g.appendChild(sv('line', { x1: rx + LR / 2, y1: ry + LR, x2: cx, y2: y1, class: 'mc-arista' + (ec ? ' camino' : '') }));
        tablero(g, h.b, x, y1, L1, mv, (ec ? 'camino' : '') + (h === hoja && fase === 2 && !camino[2] ? ' hoja' : '') + (h.fin ? ' final' : ''));
        var ut = null;
        if (sel0 && fase === 1) { var v = sel0.vals[raiz.ch.indexOf(h)]; ut = 'UCB ' + (isFinite(v) ? fmt(v) : '∞'); }
        etiquetas(g, cx, y1 + L1 + 14, h, ut);
      });

      // segundo nivel: las respuestas a la jugada en la que se fija el camino (o la más visitada)
      if (foco && (foco.ch.length || foco.un.length)) {
        var k1 = mov1.indexOf(foco.mv), fx = ancho1 * (k1 + 0.5);
        var mov2 = []; for (var j = 0; j < 9; j++) if (foco.b[j] === '.') mov2.push(j);
        var L2 = 38, y2 = 268, ancho2 = Math.min(130, 700 / mov2.length), x0 = 360 - ancho2 * mov2.length / 2;
        var sel1 = ucbs && ucbs[1] && ucbs[1].padre === foco ? ucbs[1] : null;
        g.appendChild(sv('text', { x: 10, y: y2 - 18, class: 'mc-t mc-tenue mc-halo' }, 'respuestas de ' + otro(TURNO) + ' a la casilla ' + (foco.mv + 1) + ' · W/N: lo buenas que son para ' + otro(TURNO)));
        mov2.forEach(function (mv, k) {
          var cx = x0 + ancho2 * (k + 0.5), x = cx - L2 / 2;
          var h = foco.ch.filter(function (z) { return z.mv === mv; })[0];
          if (!h) {
            g.appendChild(sv('line', { x1: fx, y1: y1 + L1 + 44, x2: cx, y2: y2, class: 'mc-arista vacia' }));
            g.appendChild(sv('rect', { x: x, y: y2, width: L2, height: L2, rx: 2, class: 'mc-hueco' }));
            g.appendChild(sv('text', { x: cx, y: y2 + L2 / 2 + 4, class: 'mc-t mc-centro mc-tenue' }, mv + 1));
            return;
          }
          var ec = enCamino(h);
          g.appendChild(sv('line', { x1: fx, y1: y1 + L1 + 44, x2: cx, y2: y2, class: 'mc-arista' + (ec ? ' camino' : '') }));
          tablero(g, h.b, x, y2, L2, mv, (ec ? 'camino' : '') + (h.fin ? ' final' : ''));
          var ut = null;
          if (sel1 && fase === 1) { var v = sel1.vals[foco.ch.indexOf(h)]; ut = 'UCB ' + (isFinite(v) ? fmt(v) : '∞'); }
          etiquetas(g, cx, y2 + L2 + 14, h, ut);
          if (ec && camino.length > 3) g.appendChild(sv('text', { x: cx, y: y2 + L2 + 56, class: 'mc-t mc-centro mc-ucb' }, '↓ ' + (camino.length - 3) + ' nivel' + (camino.length > 4 ? 'es' : '') + ' más'));
        });
      }

      // la simulación, arriba a la derecha
      if (fase >= 2 && hoja) {
        var sx = 590, sy = 12;
        if (esperando) {
          tablero(g, hoja.b, sx, sy, LR, hoja.mv, 'hoja');
          g.appendChild(sv('text', { x: sx + LR / 2, y: sy + LR + 16, class: 'mc-t mc-centro' }, 'jugadla al azar'));
          g.appendChild(sv('text', { x: sx + LR / 2, y: sy + LR + 30, class: 'mc-t mc-centro' }, 'mueve ' + otro(hoja.quien)));
        } else if (sim) {
          tablero(g, sim.b, sx, sy, LR, null, 'hoja', sim.jugadas);
          g.appendChild(sv('text', { x: sx + LR / 2, y: sy + LR + 16, class: 'mc-t mc-centro' }, 'simulación'));
          g.appendChild(sv('text', { x: sx + LR / 2, y: sy + LR + 30, class: 'mc-t mc-centro mc-ucb' }, res === '=' ? 'tablas' : 'gana ' + res));
        }
      }
      resumen();
      botones();
    }

    function resumen() {
      if (!raiz.ch.length) { traza.textContent = 'Iteraciones: 0. El árbol es sólo la raíz.'; return; }
      var orden = raiz.ch.slice().sort(function (a, b) { return b.N - a.N; });
      traza.textContent = 'Iteraciones: ' + iters + '. Jugadas de O, de más a menos visitada:\n' +
        orden.map(function (h) { return '  casilla ' + (h.mv + 1) + '   N ' + String(h.N).padStart(4) + '   W/N ' + fmt(h.W / h.N); }).join('\n');
    }

    var bFases = [], bClase;
    function botones() {
      bFases.forEach(function (b, i) {
        b.disabled = esperando || i !== fase;
        b.setAttribute('aria-pressed', String(i === fase && !esperando));
      });
      bClase.hidden = !esperando;
    }

    function hazFase() {
      if (fase === 0) {
        seleccion(); fase = 1;
        var txt;
        if (!ucbs.length) txt = 'Selección: la raíz todavía tiene jugadas sin probar, así que se queda ahí.';
        else {
          var u = ucbs[ucbs.length - 1];
          txt = 'Selección: se baja ' + ucbs.length + ' nivel' + (ucbs.length > 1 ? 'es' : '') + ', y en cada uno gana el hijo con más UCB1 (el último elegido tenía ' +
            fmt(u.vals[u.k]) + '), hasta un nodo con jugadas sin probar' + (hoja.fin ? ' o un final de partida.' : '.');
        }
        if (hoja.fin) txt += ' Ese nodo es un final: ' + (hoja.fin === '=' ? 'tablas' : 'gana ' + hoja.fin) + '.';
        d.read.textContent = txt;
      } else if (fase === 1) {
        var hubo = expansion(); fase = 2;
        d.read.textContent = hubo
          ? 'Expansión: ' + hoja.quien + ' juega en la casilla ' + (hoja.mv + 1) + '. Se crea un hijo nuevo, con N = 0.'
          : 'Expansión: no hay nada que expandir, la partida ya ha terminado en ese nodo.';
      } else if (fase === 2) {
        if (clase && !hoja.fin) {
          esperando = true; sim = null;
          d.read.textContent = 'Simulación: os toca. Jugad el tablero de arriba a la derecha sin pensar (con un dado, o la primera casilla que se os ocurra) y decid quién gana.';
        } else {
          simulacion(); fase = 3;
          d.read.textContent = hoja.fin ? 'Simulación: no hace falta, el resultado ya se sabe: ' + (res === '=' ? 'tablas.' : 'gana ' + res + '.')
            : 'Simulación: desde la hoja se juega al azar (' + sim.jugadas.length + (sim.jugadas.length === 1 ? ' jugada' : ' jugadas') + ', en tenue) y ' + (res === '=' ? 'quedan tablas.' : 'gana ' + res + '.');
        }
      } else {
        retro(); fase = 0;
        d.read.textContent = 'Retropropagación: los ' + camino.length + ' nodos del camino suman una visita. Los de ' + (res === '=' ? 'los dos jugadores suman 0,5' : res + ' suman 1 y los de ' + otro(res) + ' suman 0') + '.';
        camino = [raiz]; sim = null;
      }
      pinta();
    }

    var b1 = barra('demo-bar-play');
    b1.appendChild(el('span', 'demo-tag', 'Fase'));
    FASES.forEach(function (f, i) { var b = boton((i + 1) + '. ' + f, hazFase); bFases.push(b); b1.appendChild(b); });
    d.controls.appendChild(b1);

    bClase = barra('demo-bar-paso');
    bClase.appendChild(el('span', 'demo-tag', 'La clase dice'));
    [['Gana X', 'X'], ['Tablas', '='], ['Gana O', 'O']].forEach(function (p) {
      bClase.appendChild(boton(p[0], function () {
        res = p[1]; esperando = false; sim = { b: hoja.b, jugadas: [] }; fase = 3;
        d.read.textContent = 'Simulación de la clase: ' + (res === '=' ? 'tablas.' : 'gana ' + res + '.') + ' Ahora, a retropropagar.';
        pinta();
      }, 'demo-play'));
    });
    d.controls.appendChild(bClase);

    var b2 = barra();
    function varias(k) {
      return function () {
        esperando = false;
        while (fase !== 0) hazFaseSilenciosa();   // acaba la iteración a medias, con simulación al azar
        for (var i = 0; i < k; i++) iteracion();
        camino = [raiz]; fase = 0; sim = null; pinta();
        var mejor = raiz.ch.slice().sort(function (a, b) { return b.N - a.N; })[0];
        d.read.textContent = k + ' iteraci' + (k > 1 ? 'ones' : 'ón') + ' completa' + (k > 1 ? 's' : '') + '. La más visitada ahora: casilla ' + (mejor.mv + 1) + ', con ' + mejor.N + ' de ' + raiz.N + ' visitas.';
      };
    }
    function hazFaseSilenciosa() {
      if (fase === 1) { expansion(); fase = 2; }
      else if (fase === 2) { simulacion(); fase = 3; }
      else if (fase === 3) { retro(); fase = 0; camino = [raiz]; }
    }
    b2.appendChild(boton('Iteración completa', varias(1)));
    b2.appendChild(boton('×10', varias(10)));
    b2.appendChild(boton('×100', varias(100)));
    b2.appendChild(boton('Reiniciar', function () { reinicia(); pinta(); d.read.textContent = 'Árbol nuevo: sólo la raíz. Pulsad "1. Selección".'; }));
    d.controls.appendChild(b2);

    var b3 = barra();
    b3.appendChild(opciones('Simula', [['El ordenador', false], ['La clase', true]], clase, function (v) { clase = v; }));
    b3.appendChild(deslizador('c', 0, 3, 0.1, c, function (v) { c = v; }));
    d.controls.appendChild(b3);

    reinicia(); pinta();
    d.read.textContent = 'Mueve O, y X amenaza la diagonal 1-5-9. Pulsad "1. Selección" para empezar la primera iteración.';
  }

  /* ============================ 3 · Conecta 4 ============================ */

  // El tablero: 7 columnas de 6 filas, casilla c*6 + f (f = 0 abajo). 1 y 2 son los jugadores.
  var C4 = { COL: 7, FIL: 6 };
  function gana4(t, c, f, j) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var k = 0; k < 4; k++) {
      var dc = dirs[k][0], df = dirs[k][1], n = 1;
      for (var s = 1; s < 4; s++) { var cc = c + dc * s, ff = f + df * s; if (cc < 0 || cc > 6 || ff < 0 || ff > 5 || t[cc * 6 + ff] !== j) break; n++; }
      for (s = 1; s < 4; s++) { cc = c - dc * s; ff = f - df * s; if (cc < 0 || cc > 6 || ff < 0 || ff > 5 || t[cc * 6 + ff] !== j) break; n++; }
      if (n >= 4) return true;
    }
    return false;
  }
  // Juega en la columna c; devuelve 'gana', 'lleno' o null.
  function juega4(t, h, c, j) {
    var f = h[c]; t[c * 6 + f] = j; h[c]++;
    if (gana4(t, c, f, j)) return 'gana';
    for (var k = 0; k < 7; k++) if (h[k] < 6) return null;
    return 'lleno';
  }
  function libres4(h) { var r = []; for (var c = 0; c < 7; c++) if (h[c] < 6) r.push(c); return r; }

  function mcts4(t0, h0, turno, iteraciones, c, alAcabar, alAvanzar) {
    // quien = el jugador que hizo la jugada que lleva al nodo
    var raiz = { mv: -1, padre: null, ch: [], un: libres4(h0), N: 0, W: 0, quien: 3 - turno, fin: null };
    var hechas = 0, t1 = performance.now();
    function iter() {
      var t = t0.slice(), h = h0.slice(), n = raiz;
      while (!n.un.length && n.ch.length) {
        var mejor = null, mv = -1, ln = Math.log(n.N);
        for (var i = 0; i < n.ch.length; i++) {
          var x = n.ch[i], u = x.W / x.N + c * Math.sqrt(ln / x.N);
          if (u > mv) { mv = u; mejor = x; }
        }
        n = mejor; juega4(t, h, n.mv, n.quien);
      }
      if (n.un.length && !n.fin) {
        var col = n.un.splice(azar(n.un.length), 1)[0], j = 3 - n.quien;
        var e = juega4(t, h, col, j);
        var hijo = { mv: col, padre: n, ch: [], un: e ? [] : libres4(h), N: 0, W: 0, quien: j, fin: e ? (e === 'gana' ? j : 0) : null };
        n.ch.push(hijo); n = hijo;
      }
      var gan = n.fin;
      if (gan === null) {
        var jj = 3 - n.quien;
        for (;;) {
          var l = libres4(h), cc = l[azar(l.length)], r = juega4(t, h, cc, jj);
          if (r) { gan = r === 'gana' ? jj : 0; break; }
          jj = 3 - jj;
        }
      }
      for (; n; n = n.padre) { n.N++; n.W += gan === 0 ? 0.5 : (gan === n.quien ? 1 : 0); }
    }
    function trozo() {
      var hasta = Math.min(iteraciones, hechas + 1500);
      for (; hechas < hasta; hechas++) iter();
      if (hechas < iteraciones) { alAvanzar(hechas); setTimeout(trozo, 0); }
      else alAcabar(raiz, performance.now() - t1);
    }
    trozo();
  }

  function creaConecta4(nodo) {
    var d = prepara(nodo);
    var VOS = 1, MAQ = 2;
    var empieza = VOS, iteraciones = 1000, t, h, turno, fin, ultima, stats, pensando;

    var svg = sv('svg', { viewBox: '0 0 420 500', class: 'demo-svg mc-svg mc-c4', role: 'img', 'aria-label': 'Tablero de Conecta 4 y, debajo, las visitas y el valor que el MCTS dio a cada columna' });
    d.stage.appendChild(svg);

    function nueva() {
      t = new Int8Array(42); h = new Int8Array(7); turno = empieza; fin = null; ultima = -1; stats = null; pensando = false;
      pinta();
      if (turno === MAQ) piensa(); else d.read.textContent = 'Os toca: elegid columna (en el tablero o con los botones).';
    }

    function pinta() {
      svg.innerHTML = '';
      var X0 = 14, Y0 = 10, CEL = 56;
      svg.appendChild(sv('rect', { x: X0, y: Y0, width: CEL * 7, height: CEL * 6, rx: 8, class: 'mc-c4-marco' }));
      for (var c = 0; c < 7; c++) {
        for (var f = 0; f < 6; f++) {
          var v = t[c * 6 + f], cx = X0 + CEL * (c + 0.5), cy = Y0 + CEL * (5 - f + 0.5);
          svg.appendChild(sv('circle', { cx: cx, cy: cy, r: CEL * 0.38, class: 'mc-c4-hueco' + (v === VOS ? ' vos' : v === MAQ ? ' maq' : '') + (c * 6 + f === ultima ? ' ultima' : '') }));
        }
        var zona = sv('rect', { x: X0 + CEL * c, y: Y0, width: CEL, height: CEL * 6, class: 'mc-c4-zona' });
        (function (col) { zona.addEventListener('click', function () { humano(col); }); })(c);
        svg.appendChild(zona);
        svg.appendChild(sv('text', { x: X0 + CEL * (c + 0.5), y: Y0 + CEL * 6 + 16, class: 'mc-t mc-centro' }, c + 1));
      }
      // lo que pensó el MCTS: visitas (barra) y valor medio para él
      var by = Y0 + CEL * 6 + 26, alto = 70;
      svg.appendChild(sv('text', { x: X0, y: by + alto + 44, class: 'mc-t mc-tenue' }, stats ? 'barra: visitas de cada columna · %: lo que espera ganar el MCTS' : 'aquí saldrá lo que pensó el MCTS en su última jugada'));
      if (stats) {
        var max = 1; stats.forEach(function (s) { if (s && s.N > max) max = s.N; });
        stats.forEach(function (s, c) {
          if (!s) return;
          var hh = alto * s.N / max, x = X0 + CEL * c + 12;
          svg.appendChild(sv('rect', { x: x, y: by + alto - hh, width: CEL - 24, height: hh, class: 'mc-media' + (c === stats.elegida ? ' elegida' : '') }));
          svg.appendChild(sv('text', { x: x + (CEL - 24) / 2, y: by + alto + 13, class: 'mc-t mc-centro' }, miles(s.N)));
          svg.appendChild(sv('text', { x: x + (CEL - 24) / 2, y: by + alto + 27, class: 'mc-t mc-centro mc-tenue' }, Math.round(100 * s.W / s.N) + '%'));
        });
      }
      botones.forEach(function (b, c) { b.disabled = pensando || !!fin || turno !== VOS || h[c] >= 6; });
    }

    function termina(e, quien) {
      fin = e === 'gana' ? quien : 0;
      d.read.textContent = fin === 0 ? 'Tablero lleno: tablas.' : fin === VOS ? '¡Habéis ganado al MCTS! Probad a darle más iteraciones.' : 'Gana el MCTS. Probad con menos iteraciones, o empezad vosotros.';
    }

    function humano(col) {
      if (pensando || fin || turno !== VOS || h[col] >= 6) return;
      ultima = col * 6 + h[col];
      var e = juega4(t, h, col, VOS);
      turno = MAQ; pinta();
      if (e) { termina(e, VOS); pinta(); return; }
      piensa();
    }

    function piensa() {
      pensando = true; pinta();
      d.read.textContent = 'El MCTS piensa (' + miles(iteraciones) + ' iteraciones)…';
      setTimeout(function () {
        mcts4(t, h, MAQ, iteraciones, 1.4, function (raiz, ms) {
          var mejor = raiz.ch.reduce(function (a, b) { return b.N > a.N ? b : a; });
          stats = []; raiz.ch.forEach(function (x) { stats[x.mv] = x; }); stats.elegida = mejor.mv;
          ultima = mejor.mv * 6 + h[mejor.mv];
          var e = juega4(t, h, mejor.mv, MAQ);
          pensando = false; turno = VOS;
          d.read.textContent = 'El MCTS juega la columna ' + (mejor.mv + 1) + ' tras ' + miles(iteraciones) + ' iteraciones (' + Math.round(ms) + ' ms). Espera ganar un ' + Math.round(100 * mejor.W / mejor.N) + ' %.';
          if (e) termina(e, MAQ);
          pinta();
        }, function (k) { d.read.textContent = 'El MCTS piensa… ' + miles(k) + ' de ' + miles(iteraciones) + ' iteraciones.'; });
      }, 30);
    }

    var botones = [];
    var b1 = barra('demo-bar-play');
    b1.appendChild(el('span', 'demo-tag', 'Columna'));
    for (var c = 0; c < 7; c++) { (function (col) { var b = boton(String(col + 1), function () { humano(col); }, 'demo-btn-mini'); botones.push(b); b1.appendChild(b); })(c); }
    d.controls.appendChild(b1);

    var b2 = barra();
    function redondea(e) { var v = Math.pow(10, e), p = Math.pow(10, Math.floor(e) - 1); return Math.round(v / p) * p; }
    b2.appendChild(deslizador('Iteraciones', 1, 4.3, 0.05, 3, function (e) { iteraciones = redondea(e); }, function (e) { return miles(redondea(e)); }));
    b2.appendChild(opciones('Empieza', [['Vosotros', VOS], ['El MCTS', MAQ]], empieza, function (v) { empieza = v; }));
    b2.appendChild(boton('Nueva partida', nueva, 'demo-play'));
    d.controls.appendChild(b2);

    nueva();
  }

  /* ============================ 4 · determinizar ============================ */

  function creaDeterminizar(nodo) {
    var d = prepara(nodo);
    var modo = 'pimc', mundos = [];
    var tabla = el('div', 'table-scroll'); d.stage.appendChild(tabla);
    var pie = el('pre', 'demo-traza'); d.stage.appendChild(pie);

    function pinta() {
      var cols = modo === 'pimc'
        ? [['A · el as, y adivinar', function (m) { return 10; }], ['B · plantarse', function () { return 6; }]]
        : [['A, y decir ♥', function (m) { return m === '♥' ? 10 : 0; }], ['A, y decir ♠', function (m) { return m === '♠' ? 10 : 0; }], ['B · plantarse', function () { return 6; }]];
      var html = '<table class="mc-det"><thead><tr><th scope="col">Mundo</th><th scope="col">El rival tiene</th>' +
        cols.map(function (c) { return '<th scope="col">' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>';
      var vista = mundos.slice(-6), desde = mundos.length - vista.length;
      if (desde > 0) html += '<tr><td colspan="' + (cols.length + 2) + '" class="mc-tenue">… ' + desde + ' mundos más arriba</td></tr>';
      vista.forEach(function (m, i) {
        var vals = cols.map(function (c) { return c[1](m); }), mx = Math.max.apply(null, vals);
        html += '<tr><td>' + (desde + i + 1) + '</td><td class="mc-palo">' + m + '</td>' +
          vals.map(function (v) { return '<td' + (v === mx ? ' class="mejor"' : '') + '>' + v + '</td>'; }).join('') + '</tr>';
      });
      var medias = cols.map(function (c) { return mundos.length ? mundos.reduce(function (a, m) { return a + c[1](m); }, 0) / mundos.length : NaN; });
      var mm = Math.max.apply(null, medias.filter(function (x) { return !isNaN(x); }).concat([-1]));
      html += '<tr class="mc-medias"><th scope="row" colspan="2">Media</th>' + medias.map(function (v) { return '<td' + (v === mm ? ' class="mejor"' : '') + '>' + (isNaN(v) ? '—' : fmt(v, 1)) + '</td>'; }).join('') + '</tr>';
      html += '</tbody></table>';
      tabla.innerHTML = html;
      if (!mundos.length) { pie.textContent = 'Todavía no hay mundos. Pulsad "Un mundo más".'; d.read.textContent = ''; return; }
      var k = medias.lastIndexOf(mm), elegida = cols[k][0];   // en un empate, B (la última columna)
      pie.textContent = modo === 'pimc'
        ? 'Determinizar elige: ' + elegida + '.\nEn cada mundo se ve la carta del rival, así que "adivinar" siempre acierta y A vale 10.\nPero de verdad no la veis: A vale 10 la mitad de las veces y 0 la otra mitad, 5 de media. B, con sus 6, era mejor.'
        : 'Un solo árbol para lo que sabéis: elige ' + elegida + '.\nEl palo que diréis tiene que ser el mismo en todos los mundos, porque no podéis distinguirlos.\n' +
          (k === cols.length - 1
            ? 'Así A vale lo que vale de verdad, unos 5, y B gana con 6.'
            : 'Con tan pocos mundos, el palo que más ha salido parece mejor de lo que es. Añadid mundos: su media baja hacia 5 y B, con 6, acaba ganando.');
      d.read.textContent = mundos.length + ' mundo' + (mundos.length > 1 ? 's' : '') + ': ' + mundos.filter(function (m) { return m === '♥'; }).length + ' con corazones y ' + mundos.filter(function (m) { return m === '♠'; }).length + ' con picas.';
    }
    function mas(k) { return function () { for (var i = 0; i < k; i++) mundos.push(Math.random() < 0.5 ? '♥' : '♠'); pinta(); }; }

    var b1 = barra('demo-bar-play');
    b1.appendChild(boton('Un mundo más', mas(1), 'demo-play'));
    b1.appendChild(boton('×10', mas(10)));
    b1.appendChild(boton('Reiniciar', function () { mundos = []; pinta(); }));
    d.controls.appendChild(b1);
    var b2 = barra();
    b2.appendChild(opciones('Cómo se cuenta', [['Determinizar', 'pimc'], ['Lo que sé (ISMCTS)', 'is']], modo, function (v) { modo = v; pinta(); }));
    d.controls.appendChild(b2);
    pinta();
  }

  /* ============================ 5 · alfa-beta, paso a paso ============================ */
  // La misma geometría que los diagramas fijos de juegos.html: hojas repartidas de 45 a 515, un nivel cada 72.

  function hAB(v) { return { hoja: true, v: v }; }
  function nAB(max, nombre, hijos) { return { hoja: false, max: max, nombre: nombre, hijos: hijos }; }
  var ARBOLES_AB = {
    apuntes: function () { return nAB(true, 'raíz', [nAB(false, 'A', [hAB(3), hAB(12), hAB(8)]), nAB(false, 'B', [hAB(2), hAB(4), hAB(6)]), nAB(false, 'C', [hAB(14), hAB(5), hAB(2)])]); },
    ordenado: function () { return nAB(true, 'raíz', [nAB(false, 'A', [hAB(3), hAB(12), hAB(8)]), nAB(false, 'B', [hAB(2), hAB(4), hAB(6)]), nAB(false, 'C', [hAB(2), hAB(14), hAB(5)])]); },
    hondo: function () {
      return nAB(true, 'raíz', [nAB(false, 'L', [nAB(true, 'L1', [hAB(5), hAB(6)]), nAB(true, 'L2', [hAB(7), hAB(4)])]),
                                nAB(false, 'R', [nAB(true, 'R1', [hAB(3), hAB(2)]), nAB(true, 'R2', [hAB(9), hAB(1)])])]);
    }
  };
  function infAB(x) { return x === Infinity ? '+∞' : x === -Infinity ? '−∞' : String(x); }

  function preparaAB(raiz) {
    var nodos = [], hojas = 0, prof = 0;
    (function rec(n, d, padre) {
      n.id = nodos.length; n.d = d; n.padre = padre; nodos.push(n); prof = Math.max(prof, d);
      if (n.hoja) { n.k = hojas++; return; }
      n.hijos.forEach(function (h) { rec(h, d + 1, n); });
    })(raiz, 0, null);
    (function x(n) {
      if (n.hoja) n.x = 45 + n.k * 470 / (hojas - 1);
      else { n.hijos.forEach(x); n.x = (n.hijos[0].x + n.hijos[n.hijos.length - 1].x) / 2; }
      n.y = 32 + n.d * 72;
    })(raiz);
    return { raiz: raiz, nodos: nodos, hojas: hojas, prof: prof };
  }

  // Recorre el árbol con alfa-beta y guarda una foto del estado en cada paso, con su explicación
  function trazaAB(arbol) {
    var st = { ab: {}, val: {}, visto: {}, podado: {} }, pasos = [], vistas = 0;
    function foto(actual, texto, linea) { pasos.push({ s: JSON.parse(JSON.stringify(st)), actual: actual, texto: texto, linea: linea }); }
    function quien(n) { return n.max ? 'MAX' : 'MIN'; }
    function podar(n) { st.podado[n.id] = true; if (!n.hoja) n.hijos.forEach(podar); }
    function hojasDe(n) { return n.hoja ? [n.v] : [].concat.apply([], n.hijos.map(hojasDe)); }
    function y(xs) { return xs.length === 1 ? xs[0] : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
    function lista(ns) { return y(ns.map(function (n) { return n.hoja ? 'el ' + n.v : n.nombre + ' entero (con ' + y(hojasDe(n)) + ')'; })); }
    function ab(n, a, b) {
      if (n.hoja) { st.visto[n.id] = true; vistas++; return n.v; }
      st.ab[n.id] = [infAB(a), infAB(b)]; st.visto[n.id] = true;
      foto(n.id, n.padre
        ? 'Bajáis a ' + n.nombre + ', de ' + quien(n) + ', con la ventana de su padre tal cual: α = ' + infAB(a) + ' y β = ' + infAB(b) + '.'
        : 'Empezáis en la raíz, de MAX, con α = −∞ y β = +∞: todavía no hay nada asegurado.',
        n.nombre + ': entra con α = ' + infAB(a) + ', β = ' + infAB(b));
      var mejor = n.max ? -Infinity : Infinity;
      for (var i = 0; i < n.hijos.length; i++) {
        var h = n.hijos[i], v = ab(h, a, b);
        h.ret = v;
        mejor = n.max ? Math.max(mejor, v) : Math.min(mejor, v);
        var antes = n.max ? a : b;
        if (n.max) a = Math.max(a, v); else b = Math.min(b, v);
        var ahora = n.max ? a : b, letra = n.max ? 'α' : 'β';
        st.ab[n.id] = [infAB(a), infAB(b)]; st.val[n.id] = String(mejor);
        var cuenta = letra + ' = ' + (n.max ? 'max' : 'min') + '(' + infAB(antes) + ', ' + v + ') = ' + infAB(ahora);
        var porque = ahora === antes
          ? ' ' + v + (n.max ? ' no supera ' : ' no baja de ') + infAB(antes) + ', así que ' + letra + ' se queda igual.'
          : (n.max ? ' MAX ya tiene asegurado un ' + a + '.' : ' MIN ya puede dejar a MAX en ' + b + ' o menos.');
        var ultimo = i === n.hijos.length - 1;
        if (a >= b && ultimo) porque += ' α ≥ β, pero ya no quedan hijos que podar.';
        foto(h.hoja ? h.id : n.id, (h.hoja ? 'Miráis la hoja ' + v + '.' : h.nombre + ' devuelve ' + v + '.') +
          ' En ' + n.nombre + ', de ' + quien(n) + ': ' + cuenta + '.' + porque, n.nombre + ': ' + cuenta);
        if (a >= b && !ultimo) {
          var resto = n.hijos.slice(i + 1); resto.forEach(podar);
          st.val[n.id] = (n.max ? '≥' : '≤') + mejor;
          foto(n.id, 'α = ' + a + ' ≥ β = ' + b + ': corte. ' + (n.max
            ? 'En ' + n.nombre + ' MAX consigue ' + a + ' o más, y MIN ya tiene ' + b + ' por otra rama. MIN no va a dejar que la partida llegue a ' + n.nombre
            : 'En ' + n.nombre + ' MIN puede dejar a MAX en ' + b + ' o menos, y MAX ya tiene ' + a + ' por otra rama. MAX no va a jugar hacia ' + n.nombre) +
            ', así que da igual cuánto valga exactamente: no se mira ' + lista(resto) + '.',
            n.nombre + ': α = ' + a + ' ≥ β = ' + b + ' → corte: fuera ' + lista(resto));
          break;
        }
      }
      return mejor;
    }
    var v = ab(arbol.raiz, -Infinity, Infinity);
    var elegido = arbol.raiz.hijos.filter(function (h) { return h.ret === v; })[0];
    foto(arbol.raiz.id, 'Fin: la raíz vale ' + v + ' y MAX juega ' + elegido.nombre + '. Se han mirado ' + vistas + ' de las ' + arbol.hojas +
      ' hojas; minimax sin poda las habría mirado todas, y el resultado es el mismo.', 'raíz = ' + v + ' → MAX juega ' + elegido.nombre);
    pasos.forEach(function (p) { p.vistas = Object.keys(p.s.visto).filter(function (id) { return arbol.nodos[id].hoja; }).length; });
    return pasos;
  }

  function creaAlfaBeta(nodo) {
    var d = prepara(nodo);
    var cual = 'apuntes', arbol, pasos, k = 0;
    var svg = sv('svg', { 'class': 'explica mc-svg', role: 'img' }); d.stage.appendChild(svg);
    var traza = el('pre', 'demo-traza'); d.stage.appendChild(traza);

    function nuevo() { arbol = preparaAB(ARBOLES_AB[cual]()); pasos = trazaAB(arbol); k = 0; pinta(); }
    function pinta() {
      var p = pasos[k], s = p.s, alto = 32 + arbol.prof * 72 + 26;
      svg.setAttribute('viewBox', '0 0 560 ' + alto);
      svg.setAttribute('aria-label', 'Paso ' + (k + 1) + ' de ' + pasos.length + '. ' + p.texto);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var camino = {};
      for (var c = arbol.nodos[p.actual]; c; c = c.padre) camino[c.id] = true;
      arbol.nodos.forEach(function (n) {
        if (n.hoja) return;
        var y0 = n.y + (n.max ? 20 : 18);
        n.hijos.forEach(function (h) {
          var y1 = h.y - (h.hoja ? 12 : h.max ? 20 : 18);
          var cls = s.podado[h.id] ? 'mc-podada' : 'mc-arista' + (camino[h.id] ? ' camino' : '');
          svg.appendChild(sv('line', { x1: n.x, y1: y0, x2: h.x, y2: y1, 'class': cls }));
        });
      });
      arbol.nodos.forEach(function (n) {
        var actual = n.id === p.actual;
        if (n.hoja) {
          var cls = s.podado[n.id] ? 'mc-hueco' : 'mc-tab' + (actual ? ' camino' : s.visto[n.id] ? ' final' : '');
          svg.appendChild(sv('rect', { x: n.x - 13, y: n.y - 12, width: 26, height: 24, 'class': cls }));
          svg.appendChild(sv('text', { x: n.x, y: n.y + 4, 'class': 'mc-t mc-centro' + (s.podado[n.id] ? ' mc-tenue' : '') }, n.v));
          return;
        }
        var pts = n.max ? [n.x, n.y - 20, n.x + 24, n.y + 20, n.x - 24, n.y + 20] : [n.x - 24, n.y - 18, n.x + 24, n.y - 18, n.x, n.y + 18];
        svg.appendChild(sv('polygon', { points: pts.join(' '), 'class': 'mc-nodo ' + (n.max ? 'max' : 'min') + (s.podado[n.id] ? ' podado' : '') + (actual ? ' actual' : '') }));
        if (s.val[n.id]) {
          var t = sv('text', { x: n.x, y: n.y + (n.max ? 14 : -4), 'class': 'mc-t mc-centro' });
          t.appendChild(sv('tspan', { 'font-weight': 700 }, s.val[n.id])); svg.appendChild(t);
        }
        svg.appendChild(sv('text', { x: n.x + 28, y: n.y - 3, 'class': 'mc-t' }, n.nombre));
        if (s.ab[n.id]) svg.appendChild(sv('text', { x: n.x + 28, y: n.y + 10, 'class': 'mc-t mc-ab' + (actual ? ' vivo' : '') }, 'α ' + s.ab[n.id][0] + ' · β ' + s.ab[n.id][1]));
      });
      for (var dd = 0; dd < arbol.prof; dd++) svg.appendChild(sv('text', { x: 8, y: 36 + dd * 72, 'class': 'mc-t mc-tenue' }, dd % 2 === 0 ? 'MAX' : 'MIN'));
      traza.textContent = pasos.slice(0, k + 1).map(function (q, i) { return (i + 1) + '. ' + q.linea; }).join('\n');
      d.read.textContent = 'Paso ' + (k + 1) + ' de ' + pasos.length + ' · hojas miradas: ' + p.vistas + ' de ' + arbol.hojas + '. ' + p.texto;
      atras.disabled = k === 0; paso.disabled = fin.disabled = k === pasos.length - 1;
    }

    var b1 = barra('demo-bar-play');
    var atras = boton('Atrás', function () { if (k > 0) { k--; pinta(); } });
    var paso = boton('Paso', function () { if (k < pasos.length - 1) { k++; pinta(); } }, 'demo-play');
    var fin = boton('Hasta el final', function () { k = pasos.length - 1; pinta(); });
    b1.appendChild(atras); b1.appendChild(paso); b1.appendChild(fin);
    b1.appendChild(boton('Reiniciar', function () { k = 0; pinta(); }));
    d.controls.appendChild(b1);
    var b2 = barra();
    b2.appendChild(opciones('Árbol', [['El de los apuntes', 'apuntes'], ['C bien ordenado', 'ordenado'], ['Más hondo', 'hondo']], cual,
      function (v) { cual = v; nuevo(); }));
    d.controls.appendChild(b2);
    nuevo();
  }

  /* ============================ 6 · minimax implícito ============================ */
  // El ejemplo de mejoras.html: mueven blancas; Dxb7 parece la mejor por su media, pero Txb7 se come la dama.
  // Cada M se cuenta, como W, desde quien hizo la jugada; las hojas valen la sigmoide de material.

  function creaMinimax(nodo) {
    var d = prepara(nodo);
    var lam = 0, conTxb7 = true;
    var RESP = [['Txb7', 0.94], ['Cc6', 0.42], ['a6', 0.42]];
    var HIJOS = [['Dxb7', 120, 0.61], ['Cf3', 90, 0.54], ['h3', 60, 0.50]];
    var svg = sv('svg', { 'class': 'explica mc-svg', viewBox: '0 0 640 300', role: 'img' }); d.stage.appendChild(svg);
    var traza = el('pre', 'demo-traza'); d.stage.appendChild(traza);
    function r2(x) { return Math.round(x * 100 + 1e-9) / 100; }

    function caja(x, y, w, h, lineas, cls) {
      svg.appendChild(sv('rect', { x: x - w / 2, y: y, width: w, height: h, rx: 6, 'class': 'mc-tab' + (cls ? ' ' + cls : '') }));
      lineas.forEach(function (l, i) {
        var t = sv('text', { x: x, y: y + 17 + i * 15, 'class': 'mc-t mc-centro' + (l[1] ? ' ' + l[1] : '') });
        if (i === 0) t.setAttribute('font-weight', 700);
        t.textContent = l[0]; svg.appendChild(t);
      });
    }

    function pinta() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var resp = conTxb7 ? RESP : RESP.slice(1);
      var maxNeg = Math.max.apply(null, resp.map(function (r) { return r[1]; }));
      var M = { Dxb7: r2(1 - maxNeg), Cf3: 0.50, h3: 0.50 };
      var val = HIJOS.map(function (h) { return r2((1 - lam) * h[2] + lam * M[h[0]]); });
      var mejor = val.indexOf(Math.max.apply(null, val));
      var xs = [130, 330, 530];
      caja(330, 6, 190, 26, [['raíz · mueven blancas']], 'raiz');
      HIJOS.forEach(function (h, i) {
        svg.appendChild(sv('line', { x1: 330, y1: 32, x2: xs[i], y2: 86, 'class': 'mc-arista' + (i === mejor ? ' camino' : '') }));
        caja(xs[i], 86, 150, 76, [[h[0]], ['N ' + h[1] + ' · W/N ' + fmt(h[2])], ['M ' + fmt(M[h[0]]), 'mc-ucb'], ['valor ' + fmt(val[i])]],
          i === mejor ? 'camino' : '');
      });
      svg.appendChild(sv('text', { x: 20, y: 196, 'class': 'mc-t mc-tenue mc-halo' }, 'respuestas de negras · M para negras'));
      var gx = [45, 115, 185];
      RESP.forEach(function (r, i) {
        var esta = conTxb7 || i > 0;
        svg.appendChild(sv('line', { x1: 130, y1: 162, x2: gx[i], y2: 214, 'class': esta ? 'mc-arista' : 'mc-arista vacia' }));
        if (esta) caja(gx[i], 214, 62, 40, [[r[0]], ['M ' + fmt(r[1]), r[1] === maxNeg ? 'mc-real-t' : '']], r[1] === maxNeg ? 'final' : '');
        else {
          svg.appendChild(sv('rect', { x: gx[i] - 31, y: 214, width: 62, height: 40, rx: 6, 'class': 'mc-hueco' }));
          svg.appendChild(sv('text', { x: gx[i], y: 238, 'class': 'mc-t mc-centro mc-tenue' }, 'Txb7 ¿?'));
        }
      });
      svg.appendChild(sv('line', { x1: 130, y1: 162, x2: 262, y2: 214, 'class': 'mc-arista vacia' }));
      svg.appendChild(sv('rect', { x: 226, y: 214, width: 72, height: 40, rx: 6, 'class': 'mc-hueco' }));
      svg.appendChild(sv('text', { x: 262, y: 231, 'class': 'mc-t mc-centro mc-tenue' }, conTxb7 ? '27 más' : '28 más'));
      svg.appendChild(sv('text', { x: 262, y: 245, 'class': 'mc-t mc-centro mc-tenue' }, 'sin probar'));
      svg.appendChild(sv('text', { x: 430, y: 196, 'class': 'mc-t mc-tenue' }, 'las respuestas a Cf3 y a h3'));
      svg.appendChild(sv('text', { x: 430, y: 211, 'class': 'mc-t mc-tenue' }, 'dejan el material igualado:'));
      svg.appendChild(sv('text', { x: 430, y: 226, 'class': 'mc-t mc-tenue' }, 'la mejor para negras vale 0,50'));
      svg.setAttribute('aria-label', 'Con λ = ' + fmt(lam) + ', la selección elige ' + HIJOS[mejor][0] + '.');

      var l = fmt(lam), l1 = fmt(r2(1 - lam));
      traza.textContent =
        'M(Dxb7) = 1 − max(' + resp.map(function (r) { return fmt(r[1]); }).join('; ') + ') = 1 − ' + fmt(maxNeg) + ' = ' + fmt(M.Dxb7) + '\n' +
        HIJOS.map(function (h, i) {
          return 'valor(' + h[0] + ') = ' + l1 + ' · ' + fmt(h[2]) + ' + ' + l + ' · ' + fmt(M[h[0]]) + ' = ' + fmt(val[i]) + (i === mejor ? '   ← elige esta' : '');
        }).join('\n');
      d.read.textContent = 'λ = ' + l + ': la selección baja por ' + HIJOS[mejor][0] + '. ' +
        (!conTxb7 ? 'Sin Txb7 en el árbol, M tampoco ve la trampa: sólo mira lo que ya se ha probado.'
          : lam === 0 ? 'Es el MCTS de siempre: sólo cuenta la media, y la media no ha visto Txb7.'
          : mejor === 0 ? 'Todavía pesa más la media que el peor caso.'
          : 'El peor caso ya pesa lo suficiente: la dama colgada deja de parecer buena.');
    }

    var b1 = barra();
    b1.appendChild(deslizador('λ ', 0, 1, 0.05, lam, function (v) { lam = r2(v); pinta(); }, function (x) { return fmt(x); }));
    d.controls.appendChild(b1);
    var b2 = barra();
    b2.appendChild(opciones('Txb7, la respuesta que come la dama', [['Ya está en el árbol', true], ['Todavía sin probar', false]], conTxb7,
      function (v) { conTxb7 = v; pinta(); }));
    d.controls.appendChild(b2);
    pinta();
  }

  var CREA = { bandido: creaBandido, fases: creaFases, conecta4: creaConecta4, determinizar: creaDeterminizar, alfabeta: creaAlfaBeta, minimax: creaMinimax };
  Array.prototype.forEach.call(document.querySelectorAll('[data-mcts]'), function (n) {
    var f = CREA[n.getAttribute('data-mcts')];
    if (!f) return;
    try { f(n); } catch (e) { if (window.console) console.error('mcts', n.getAttribute('data-mcts'), e); }
  });
})();
