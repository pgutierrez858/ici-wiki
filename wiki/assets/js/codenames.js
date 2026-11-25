/* Código Secreto en la página: el motor, las estrategias de la máquina y los ejemplos
 * interactivos del tema bonus (agentes para juegos de lenguaje).
 *
 *   data-cn="coseno"     dos palabras y su coseno, y las más cercanas a una palabra
 *   data-cn="suma"       sumar y restar vectores: rey − hombre + mujer
 *   data-cn="ranking"    el tablero pequeño de los apuntes y una pista: cómo lo ordena el que adivina
 *   data-cn="pistas"     lo que propone cada estrategia, en el tablero pequeño o en una partida
 *   data-cn="liguilla"   una estrategia contra otra en muchas partidas, con o sin ruido
 *   data-cn="simulador"  la partida entera: semilla, puestos de persona o máquina, y cortinas
 *
 * Los vectores vienen de assets/js/codenames-datos.js (tools/codenames-vectores.py).
 * El que da pistas y el que adivina usan los mismos vectores: los dos conocen la estrategia.
 * El motor también se carga en node (module.exports) para probarlo sin navegador.
 * Sin dependencias y sin build. Sin JavaScript queda el aviso de cada bloque.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;

  /* ============================ el motor ============================ */

  var D = G.CN_DATOS;
  var PAL = D.palabras, NT = D.nTablero, DIM = D.dim;
  var VEC = (function () {
    var bin = typeof atob === 'function' ? atob(D.vec) : Buffer.from(D.vec, 'base64').toString('binary');
    var v = new Int8Array(bin.length);
    for (var i = 0; i < bin.length; i++) v[i] = bin.charCodeAt(i) << 24 >> 24;
    return v;
  })();
  var IDX = {}, SIN = {};
  function sinTilde(w) { return w.normalize('NFD').replace(/ñ/g, '\u0001').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ'); }
  PAL.forEach(function (w, i) { IDX[w] = i; var s = sinTilde(w); if (!(s in SIN)) SIN[s] = i; });

  function indice(txt) {
    var w = String(txt || '').trim().toLowerCase();
    if (w in IDX) return IDX[w];
    var s = sinTilde(w);
    return s in SIN ? SIN[s] : -1;
  }
  function cos(i, j) {
    var a = i * DIM, b = j * DIM, s = 0;
    for (var k = 0; k < DIM; k++) s += VEC[a + k] * VEC[b + k];
    return s / 16129;                       // 127 · 127: los vectores se guardaron normalizados
  }
  // La regla del juego, aproximada (la misma que en tools/codenames-vectores.py): la pista no puede
  // ser una palabra del tablero ni empezar igual (GATO no deja decir gatito, ni MAR marino).
  function mismaRaiz(a, b) {
    a = sinTilde(a); b = sinTilde(b);
    var n = 0, m = Math.min(a.length, b.length);
    while (n < m && a[n] === b[n]) n++;
    return n >= Math.max(3, m - 1);
  }
  function vecinas(i, k) {
    var out = [];
    for (var j = 0; j < PAL.length; j++) if (j !== i && !mismaRaiz(PAL[j], PAL[i])) out.push([j, cos(i, j)]);
    out.sort(function (x, y) { return y[1] - x[1]; });
    return out.slice(0, k);
  }

  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  var OTRO = { R: 'A', A: 'R' };
  var NOMBRE = { R: 'rojo', A: 'azul', N: 'neutral', X: 'asesino' };

  // Un tablero a partir de sus cartas: [[palabra, color], ...]. Calcula una vez qué pistas valen
  // en él y el coseno de cada una con cada carta.
  function tablero(lista, empieza) {
    var cartas = lista.map(function (x) { return { i: indice(x[0]), w: PAL[indice(x[0])], color: x[1], vista: false }; });
    var p = { cartas: cartas, empieza: empieza, turno: empieza, ganador: null, porAsesino: false };
    var n = cartas.length, cand = [];
    for (var i = 0; i < PAL.length; i++) {
      var vale = true;
      for (var j = 0; j < n && vale; j++) if (i === cartas[j].i || mismaRaiz(PAL[i], cartas[j].w)) vale = false;
      if (vale) cand.push(i);
    }
    var S = new Float32Array(cand.length * n);
    for (var c = 0; c < cand.length; c++) for (j = 0; j < n; j++) S[c * n + j] = cos(cand[c], cartas[j].i);
    p.cand = cand; p.S = S; p.n = n;
    return p;
  }
  // Una partida a partir de una semilla: las 25 palabras, quién empieza (con 9) y de quién es cada una.
  function partida(semilla) {
    var r = rng(semilla), orden = [], i, j, t;
    for (i = 0; i < NT; i++) orden.push(i);
    for (i = NT - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = orden[i]; orden[i] = orden[j]; orden[j] = t; }
    var empieza = r() < 0.5 ? 'R' : 'A', colores = [];
    for (i = 0; i < 9; i++) colores.push(empieza);
    for (i = 0; i < 8; i++) colores.push(OTRO[empieza]);
    for (i = 0; i < 7; i++) colores.push('N');
    colores.push('X');
    for (i = 24; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = colores[i]; colores[i] = colores[j]; colores[j] = t; }
    var p = tablero(orden.slice(0, 25).map(function (k, x) { return [PAL[k], colores[x]]; }), empieza);
    p.semilla = semilla;
    return p;
  }
  function quedan(p, eq) { var n = 0; p.cartas.forEach(function (c) { if (c.color === eq && !c.vista) n++; }); return n; }
  function valida(p, txt) {
    if (!String(txt || '').trim()) return { error: 'Escribe una palabra.' };
    var i = indice(txt);
    if (i < 0) return { error: 'La máquina no conoce "' + txt.trim() + '". Prueba con otra (se sabe ' + miles(PAL.length) + ' palabras).' };
    for (var j = 0; j < p.n; j++) {
      if (p.cartas[j].i === i) return { error: '"' + PAL[i] + '" está en el tablero.' };
      if (mismaRaiz(PAL[i], p.cartas[j].w)) return { error: '"' + PAL[i] + '" empieza igual que ' + p.cartas[j].w.toUpperCase() + ', que está en el tablero.' };
    }
    return { i: i, w: PAL[i] };
  }
  // los cosenos de una palabra con todas las cartas
  function fila(p, i) {
    var c = p.cand.indexOf(i), out = [];
    for (var j = 0; j < p.n; j++) out.push(c >= 0 ? p.S[c * p.n + j] : cos(i, p.cartas[j].i));
    return out;
  }

  /* ---------------- las estrategias del que da pistas ----------------
     Todas miran las cartas sin descubrir: las propias, las malas (rivales,
     neutrales y el asesino) y s(c, x), el coseno de la pista c con la carta x.

     una         n = 1: la propia que más destaca sobre la mejor de las malas
     media       la media de los vectores de las m propias más parecidas entre sí,
                 y la palabra más cercana a esa media; no mira las malas
     companero   simula al compañero: ordena el tablero como él y cuenta las propias
                 que salen antes de la primera mala, con margen δ sobre ella (2δ sobre
                 el asesino) y con s ≥ τ. Con δ = 0 es el bot base de la competición
     blanda      Koyyalagunta y otros (2021): las m propias más parecidas y
                 g = suma de s(c, propias) − λ · máximo de s(c, malas)
     esperado    genera candidatas con companero (δ = 0) y valora cada (pista, n)
                 simulando R veces a un compañero con ruido σ: +1 por propia,
                 −1 por rival, −A por el asesino, y elige la de más valor esperado  */

  var ESTR = {
    una:         { tipo: 'una', nombre: 'Una a una' },
    media:       { tipo: 'media', m: 2, nombre: 'La media (m = 2)' },
    competicion: { tipo: 'companero', tau: 0.3, delta: 0, nombre: 'La de la competición (τ = 0,30)' },
    atrevida:    { tipo: 'companero', tau: -1, delta: 0, nombre: 'Simular al compañero, sin umbral' },
    margen:      { tipo: 'companero', tau: 0.3, delta: 0.1, nombre: 'Con margen (τ = 0,30, δ = 0,10)' },
    blanda:      { tipo: 'blanda', m: 2, lambda: 0.5, nombre: 'Puntuación blanda (m = 2, λ = 0,5)' },
    esperado:    { tipo: 'esperado', sigma: 0.05, castigo: 10, nombre: 'Valor esperado (σ = 0,05, asesino −10)' },
  };

  // Lo que todas necesitan de una pista: las propias ordenadas y la mala más parecida.
  function mira(p, eq, c) {
    var n = p.n, base = c * n, malaMax = -2, mala = -1, asesino = -2, props = [];
    for (var x = 0; x < n; x++) {
      if (p.cartas[x].vista) continue;
      var s = p.S[base + x];
      if (p.cartas[x].color === eq) props.push(x);
      else {
        if (s > malaMax) { malaMax = s; mala = x; }
        if (p.cartas[x].color === 'X') asesino = s;
      }
    }
    props.sort(function (u, v) { return p.S[base + v] - p.S[base + u]; });
    return { base: base, props: props, malaMax: malaMax, mala: mala, asesino: asesino };
  }
  function opcion(p, c, m, para, punt) {
    return { i: p.cand[c], w: PAL[p.cand[c]], n: para.length, para: para, mala: m.mala,
      margen: p.S[m.base + para[para.length - 1]] - m.malaMax, punt: punt };
  }
  function guarda(top, o, K) {
    if (top.length >= K && o.punt <= top[top.length - 1].punt) return;
    top.push(o); top.sort(function (u, v) { return v.punt - u.punt; });
    if (top.length > K) top.pop();
  }

  // Devuelve la mejor pista para el equipo eq, y en .otras las k siguientes.
  function pista(p, eq, e, k) {
    e = e || {};
    var tipo = e.tipo || 'companero', K = (k || 0) + 1, top = [], c, m;
    if (!quedan(p, eq)) return null;
    if (tipo === 'media') return pistaMedia(p, eq, e.m || 2, K);
    if (tipo === 'esperado') return pistaEsperada(p, eq, e, K);
    var tau = e.tau != null ? e.tau : -1, delta = e.delta || 0, lambda = e.lambda != null ? e.lambda : 0.5;
    for (c = 0; c < p.cand.length; c++) {
      m = mira(p, eq, c);
      var S = p.S, b = m.base, props = m.props, n = 0;
      if (tipo === 'una') { guarda(top, opcion(p, c, m, [props[0]], S[b + props[0]] - m.malaMax), K); continue; }
      if (tipo === 'blanda') {
        var para = props.slice(0, e.m || 2), suma = 0;
        para.forEach(function (x) { suma += S[b + x]; });
        guarda(top, opcion(p, c, m, para, suma - lambda * m.malaMax), K);
        continue;
      }
      while (n < props.length) {
        var sn = S[b + props[n]];
        if (sn < tau || sn - m.malaMax < delta || sn - m.asesino < 2 * delta || sn <= m.malaMax) break;
        n++;
      }
      if (n) guarda(top, opcion(p, c, m, props.slice(0, n), n + S[b + props[n - 1]] - m.malaMax), K);
    }
    // si con esas condiciones no sale ninguna, la más segura de una en una
    if (!top.length) { var r = pista(p, eq, { tipo: 'una' }, k); r.apuro = true; return r; }
    top[0].otras = top.slice(1);
    return top[0];
  }

  // La media: las m propias más parecidas entre sí, la media de sus vectores y la pista más cercana a ella.
  function pistaMedia(p, eq, m, K) {
    var props = [];
    for (var x = 0; x < p.n; x++) if (!p.cartas[x].vista && p.cartas[x].color === eq) props.push(x);
    m = Math.min(m, props.length);
    var mejor = null;
    (function elige(desde, grupo) {
      if (grupo.length === m) {
        var s = 0;
        for (var a = 0; a < m; a++) for (var b = a + 1; b < m; b++) s += cos(p.cartas[grupo[a]].i, p.cartas[grupo[b]].i);
        if (!mejor || s > mejor.s) mejor = { s: s, grupo: grupo.slice() };
        return;
      }
      for (var y = desde; y < props.length; y++) { grupo.push(props[y]); elige(y + 1, grupo); grupo.pop(); }
    })(0, []);
    var top = [];
    for (var c = 0; c < p.cand.length; c++) {
      var t = 0;
      mejor.grupo.forEach(function (g) { t += p.S[c * p.n + g]; });
      // coseno con la media = suma de cosenos / longitud de la suma, que es igual para todas: basta la suma
      var mm = mira(p, eq, c);
      guarda(top, opcion(p, c, mm, mejor.grupo.slice().sort(function (u, v) { return p.S[mm.base + v] - p.S[mm.base + u]; }), t), K);
    }
    top[0].otras = top.slice(1);
    return top[0];
  }

  // Valor esperado: candidatas de simular al compañero, y cada una valorada con R partidas de mentira.
  function pistaEsperada(p, eq, e, K) {
    var sigma = e.sigma != null ? e.sigma : 0.05, castigo = e.castigo != null ? e.castigo : 10, R = e.R || 100;
    var cands = pista(p, eq, { tipo: 'companero', tau: -1, delta: 0 }, 29);
    var lista = [cands].concat(cands.otras || []), r = rng(7919 * (p.semilla || 1) + quedan(p, 'R') * 31 + quedan(p, 'A'));
    var top = [];
    lista.forEach(function (o) {
      var c = p.cand.indexOf(o.i), m = mira(p, eq, c), maxN = Math.min(o.n + 1, m.props.length), suma = [];
      for (var n = 0; n <= maxN; n++) suma.push(0);
      for (var t = 0; t < R; t++) {
        var orden = ordena(p, o.i, sigma, r), valor = 0;
        for (var g = 0; g < maxN; g++) {
          var col = p.cartas[orden[g].k].color;
          if (col === eq) valor += 1;
          else { valor += col === 'X' ? -castigo : col === 'N' ? 0 : -1; for (var h = g + 1; h <= maxN; h++) suma[h] += valor; break; }
          suma[g + 1] += valor;
        }
      }
      for (n = 1; n <= maxN; n++) {
        var o2 = opcion(p, c, m, m.props.slice(0, n), suma[n] / R);
        o2.esperado = suma[n] / R;
        guarda(top, o2, K);
      }
    });
    top[0].otras = top.slice(1);
    return top[0];
  }

  // El que adivina: ordena las cartas por parecido con la pista (con ruido si no comparte
  // del todo los vectores del que la dio) y prueba las n primeras, en orden.
  function ordena(p, i, ruido, r) {
    var f = fila(p, i), lista = [];
    for (var j = 0; j < p.n; j++) if (!p.cartas[j].vista) lista.push({ k: j, s: f[j], t: f[j] + (ruido ? ruido * gauss(r) : 0) });
    lista.sort(function (x, y) { return y.t - x.t; });
    return lista;
  }
  function adivina(p, i, n, ruido, r) { return ordena(p, i, ruido, r).slice(0, n).map(function (o) { return o.k; }); }

  // Descubre una carta: dice qué era y si sigue el turno. Aplica el final de partida.
  function descubre(p, k) {
    var c = p.cartas[k], eq = p.turno;
    c.vista = true;
    if (c.color === 'X') { p.ganador = OTRO[eq]; p.porAsesino = true; return { color: 'X', sigue: false }; }
    if (!quedan(p, 'R')) p.ganador = 'R';
    else if (!quedan(p, 'A')) p.ganador = 'A';
    return { color: c.color, sigue: c.color === eq && !p.ganador };
  }
  function pasaTurno(p) { p.turno = OTRO[p.turno]; }

  // Una partida entera de máquina contra máquina, para la liguilla. Con solo = true juega
  // sólo el equipo que empieza, como en la competición: cuenta turnos hasta descubrir sus 9
  // cartas, y si toca el asesino o descubre todas las del rival se apunta 25.
  function juega(semilla, estr, ruido, solo) {
    var p = partida(semilla), r = rng(semilla * 7 + 1), turnos = 0;
    var est = { R: { pistas: 0, aciertos: 0, turnos: 0 }, A: { pistas: 0, aciertos: 0, turnos: 0 } };
    while (!p.ganador && turnos < 80) {
      var eq = p.turno, q = pista(p, eq, estr[eq]);
      var orden = adivina(p, q.i, q.n, ruido, r);
      est[eq].pistas++; est[eq].turnos++;
      for (var g = 0; g < orden.length; g++) {
        var res = descubre(p, orden[g]);
        if (res.color === eq) est[eq].aciertos++;
        if (!res.sigue) break;
      }
      if (!p.ganador && !solo) pasaTurno(p);
      turnos++;
    }
    var puntos = solo ? (p.ganador === p.empieza ? turnos : 25) : null;
    return { ganador: p.ganador, empieza: p.empieza, asesino: p.porAsesino, turnos: turnos, est: est, puntos: puntos };
  }

  function fmt(x, d) { return (x == null || isNaN(x)) ? '—' : Number(x).toFixed(d == null ? 2 : d).replace('.', ',').replace(/^-/, '−'); }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  // El tablero pequeño de los apuntes: vuestras son PLAYA, ISLA y PIRATA.
  var PEQUENO = [['playa', 'R'], ['barco', 'A'], ['luna', 'N'], ['isla', 'R'],
                 ['tiburón', 'X'], ['pirata', 'R'], ['gato', 'N'], ['banco', 'A']];

  var CN = { palabras: PAL, nTablero: NT, indice: indice, cos: cos, mismaRaiz: mismaRaiz, vecinas: vecinas,
    tablero: tablero, partida: partida, valida: valida, fila: fila, pista: pista, ordena: ordena,
    adivina: adivina, descubre: descubre, pasaTurno: pasaTurno, quedan: quedan, juega: juega, rng: rng,
    ESTR: ESTR, NOMBRE: NOMBRE, OTRO: OTRO, PEQUENO: PEQUENO, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = CN;
  if (typeof document === 'undefined') return;
  G.CN = CN;

  /* ============================ utilidades de página ============================ */

  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
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
    var f = formato || function (x) { return fmt(x, 2); };
    var out = el('b', null, f(val));
    i.oninput = function () { out.textContent = f(Number(i.value)); alCambiar(Number(i.value)); };
    raiz.appendChild(i); raiz.appendChild(out);
    return raiz;
  }
  function selector(etiq, val, alCambiar, claves) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(document.createTextNode(etiq));
    var s = el('select', 'cn-select');
    (claves || Object.keys(ESTR)).forEach(function (k) { var o = el('option', null, ESTR[k].nombre); o.value = k; s.appendChild(o); });
    s.value = val;
    s.onchange = function () { alCambiar(s.value); };
    raiz.appendChild(s);
    return raiz;
  }
  function campo(etiq, val, ancho) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(document.createTextNode(etiq));
    var i = el('input', 'cn-texto'); i.type = 'text'; i.value = val; i.autocomplete = 'off'; i.spellcheck = false;
    i.setAttribute('autocapitalize', 'off');
    if (ancho) i.style.width = ancho;
    raiz.appendChild(i);
    raiz.input = i;
    return raiz;
  }
  function prepara(nodo) {
    var stage = nodo.querySelector('.demo-stage'); stage.innerHTML = '';
    return { stage: stage, controls: nodo.querySelector('.demo-controls'), read: nodo.querySelector('.demo-read') };
  }
  function may(w) { return w.toUpperCase(); }

  /* Las 25 (u 8) cartas. clave: se ven los colores de las que no están descubiertas.
     alPulsar: las cartas se pueden tocar. marca: cartas resaltadas. */
  function dibujaTablero(p, o) {
    o = o || {};
    var g = el('div', 'cn-tablero');
    g.style.setProperty('--cols', o.cols || 5);
    p.cartas.forEach(function (c, k) {
      var pulsable = o.alPulsar && !c.vista && !p.ganador;
      var b = el(pulsable ? 'button' : 'div', 'cn-carta');
      if (pulsable) { b.type = 'button'; b.onclick = function () { o.alPulsar(k); }; }
      var ver = c.vista || o.clave;
      if (ver) b.classList.add('cn-' + c.color, c.vista ? 'vista' : 'clave');
      if (o.marca && o.marca.indexOf(k) >= 0) b.classList.add('marca');
      if (ver) b.appendChild(el('span', 'cn-tipo', NOMBRE[c.color]));
      b.appendChild(el('span', 'cn-w', may(c.w)));
      b.setAttribute('aria-label', may(c.w) + (ver ? ', ' + NOMBRE[c.color] : '') + (c.vista ? ', descubierta' : ''));
      g.appendChild(b);
    });
    return g;
  }

  /* El tablero ordenado por parecido con una pista, de más a menos, como lo
     recorrerá el que adivina. corte: dónde para con el número de la pista. */
  function dibujaRanking(p, i, o) {
    o = o || {};
    var lista = ordena(p, i, 0), ol = el('ol', 'cn-ranking');
    var max = Math.max(0.05, lista.length ? lista[0].s : 0);
    lista.forEach(function (x, pos) {
      var c = p.cartas[x.k], li = el('li', 'cn-fila' + (o.clave ? ' cn-' + c.color : ''));
      if (o.corte && pos === o.corte) li.classList.add('cn-corte');
      li.appendChild(el('span', 'w', may(c.w)));
      var bar = el('span', 'barra'), relleno = el('i');
      relleno.style.width = Math.max(0, x.s / max * 100).toFixed(1) + '%';
      bar.appendChild(relleno); li.appendChild(bar);
      li.appendChild(el('span', 'num', fmt(x.s)));
      if (o.clave) li.appendChild(el('span', 'tipo', NOMBRE[c.color]));
      ol.appendChild(li);
    });
    return { nodo: ol, lista: lista };
  }

  // Qué pasaría con esa pista: cuántas vuestras salen primero y cuál es la primera que no.
  function leeRanking(p, lista, eq) {
    var n = 0;
    while (n < lista.length && p.cartas[lista[n].k].color === eq) n++;
    if (n === lista.length) return 'Todas las que quedan son vuestras.';
    var mala = lista[n], cm = p.cartas[mala.k];
    var t = n === 0
      ? 'La primera que probaría vuestro compañero es ' + may(cm.w) + ' (' + NOMBRE[cm.color] + ', ' + fmt(mala.s) + '): esta pista no os vale.'
      : 'Las ' + (n === 1 ? 'primera es vuestra' : n + ' primeras son vuestras') + ', y la primera que no lo es, ' + may(cm.w) +
        ' (' + NOMBRE[cm.color] + '), sale con ' + fmt(mala.s) + '. Margen de la última vuestra sobre ella: ' +
        fmt(lista[n - 1].s) + ' − ' + fmt(mala.s) + ' = ' + fmt(lista[n - 1].s - mala.s) + '.';
    return t;
  }

  /* ============================ 1 · el coseno ============================ */

  function creaCoseno(nodo) {
    var d = prepara(nodo);
    var a = campo('Palabra', 'playa', '8rem'), b = campo('y', 'arena', '8rem');
    var caja = el('div', 'cn-coseno');
    d.stage.appendChild(caja);
    var bar = barra();
    bar.appendChild(a); bar.appendChild(b);
    var pares = barra();
    pares.appendChild(el('span', 'demo-tag', 'Probad'));
    [['playa', 'arena'], ['playa', 'barco'], ['frío', 'calor'], ['banco', 'dinero'], ['banco', 'parque'], ['gato', 'tigre'], ['gato', 'mesa']].forEach(function (x) {
      pares.appendChild(boton(x[0] + ' · ' + x[1], function () { a.input.value = x[0]; b.input.value = x[1]; pinta(); }, 'demo-btn-mini'));
    });
    d.controls.appendChild(bar); d.controls.appendChild(pares);
    a.input.oninput = b.input.oninput = pinta;

    function pinta() {
      var i = indice(a.input.value), j = indice(b.input.value);
      caja.innerHTML = '';
      if (i < 0 || j < 0) {
        caja.appendChild(el('p', 'cn-aviso', 'La máquina no conoce "' + (i < 0 ? a.input.value : b.input.value).trim() + '".'));
        d.read.textContent = 'Se sabe ' + miles(PAL.length) + ' palabras, todas en minúscula y casi todas en singular.';
        return;
      }
      var c = cos(i, j);
      var gr = el('div', 'cn-medidor');
      var rel = el('i'); rel.style.width = Math.max(0, c * 100).toFixed(1) + '%';
      gr.appendChild(rel);
      var cab = el('p', 'cn-cifra');
      cab.appendChild(el('span', null, 'coseno(' + PAL[i] + ', ' + PAL[j] + ') = '));
      cab.appendChild(el('b', null, fmt(c)));
      caja.appendChild(cab); caja.appendChild(gr);
      var lis = el('div', 'cn-vecinas');
      [i, j].forEach(function (w) {
        var col = el('div');
        col.appendChild(el('h5', null, 'Las más cercanas a ' + PAL[w]));
        var ol = el('ol');
        vecinas(w, 8).forEach(function (v) { ol.appendChild(el('li', null, PAL[v[0]] + ' ' + fmt(v[1]))); });
        col.appendChild(ol); lis.appendChild(col);
      });
      caja.appendChild(lis);
      d.read.textContent = c > 0.45 ? 'Muy cerca: se usan en frases muy parecidas.' :
        c > 0.25 ? 'Algo cerca: comparten parte del contexto.' :
        c > 0.1 ? 'Poco: alguna relación, pero floja.' : 'Casi nada en común (o lo contrario, que en coseno es casi lo mismo).';
    }
    pinta();
  }

  /* ============================ 1b · sumar y restar ============================ */

  function creaSuma(nodo) {
    var d = prepara(nodo);
    var c = campo('', 'rey - hombre + mujer', '16rem');
    var caja = el('div', 'cn-coseno');
    d.stage.appendChild(caja);
    var bar = barra(); bar.appendChild(c);
    var pr = barra(); pr.appendChild(el('span', 'demo-tag', 'Probad'));
    ['rey - hombre + mujer', 'verano + frío - calor', 'playa + nieve - arena', 'perro + gatito - gato', 'playa + isla', 'queso + cebolla'].forEach(function (t) {
      pr.appendChild(boton(t, function () { c.input.value = t; pinta(); }, 'demo-btn-mini'));
    });
    d.controls.appendChild(bar); d.controls.appendChild(pr);
    c.input.oninput = pinta;
    function pinta() {
      caja.innerHTML = '';
      var trozos = c.input.value.replace(/([+\-−])/g, ' $1 ').split(/\s+/).filter(Boolean), signo = 1, usadas = [], v = new Float32Array(DIM), mal = null;
      trozos.forEach(function (t) {
        if (t === '+') { signo = 1; return; }
        if (t === '-' || t === '−') { signo = -1; return; }
        var i = indice(t);
        if (i < 0) { mal = mal || t; return; }
        usadas.push(i);
        for (var k = 0; k < DIM; k++) v[k] += signo * VEC[i * DIM + k];
        signo = 1;
      });
      if (mal) { d.read.textContent = 'La máquina no conoce "' + mal + '".'; return; }
      if (!usadas.length) { d.read.textContent = 'Escribid palabras separadas por + y −.'; return; }
      var nv = 0; for (var k = 0; k < DIM; k++) nv += v[k] * v[k]; nv = Math.sqrt(nv) * 127;
      var res = [];
      for (var j = 0; j < PAL.length; j++) {
        if (usadas.indexOf(j) >= 0 || usadas.some(function (u) { return mismaRaiz(PAL[j], PAL[u]); })) continue;
        var s = 0, b = j * DIM;
        for (k = 0; k < DIM; k++) s += v[k] * VEC[b + k];
        res.push([j, s / nv]);
      }
      res.sort(function (x, y) { return y[1] - x[1]; });
      var ol = el('ol', 'cn-resultado');
      res.slice(0, 8).forEach(function (x, n) { var li = el('li', n === 0 ? 'primera' : null); li.appendChild(el('b', null, PAL[x[0]])); li.appendChild(el('span', null, fmt(x[1]))); ol.appendChild(li); });
      caja.appendChild(ol);
      d.read.textContent = 'La palabra más cercana al resultado es ' + PAL[res[0][0]] + ' (coseno ' + fmt(res[0][1]) + '). Las palabras que habéis escrito, y las que empiezan igual, no cuentan.';
    }
    pinta();
  }

  /* ============================ 2 · el ranking ============================ */

  function creaRanking(nodo) {
    var d = prepara(nodo);
    var p = tablero(PEQUENO, 'R');
    var arriba = el('div'), abajo = el('div');
    d.stage.appendChild(arriba); d.stage.appendChild(abajo);
    var c = campo('Pista', 'mar', '9rem');
    var bar = barra(); bar.appendChild(c);
    var sug = barra(); sug.appendChild(el('span', 'demo-tag', 'Probad'));
    ['mar', 'costa', 'arena', 'tesoro', 'pez', 'vacaciones'].forEach(function (w) {
      sug.appendChild(boton(w, function () { c.input.value = w; pinta(); }, 'demo-btn-mini'));
    });
    d.controls.appendChild(bar); d.controls.appendChild(sug);
    c.input.oninput = pinta;
    function pinta() {
      arriba.innerHTML = ''; abajo.innerHTML = '';
      var v = valida(p, c.input.value);
      if (v.error) {
        arriba.appendChild(dibujaTablero(p, { clave: true, cols: 4 }));
        d.read.textContent = v.error;
        return;
      }
      var r = dibujaRanking(p, v.i, { clave: true });
      arriba.appendChild(dibujaTablero(p, { clave: true, cols: 4, marca: [r.lista[0].k] }));
      abajo.appendChild(r.nodo);
      d.read.textContent = 'Con ' + may(v.w) + '. ' + leeRanking(p, r.lista, 'R');
    }
    pinta();
  }

  /* ============================ 3 · las pistas de cada estrategia ============================ */

  // Cada estrategia con sus parámetros, para tocarlos en el ejemplo.
  var PARAM = {
    una: [],
    media: [['m', 'm', 1, 4, 1]],
    companero: [['τ', 'tau', -0.2, 0.6, 0.01], ['δ', 'delta', 0, 0.3, 0.01]],
    blanda: [['m', 'm', 1, 4, 1], ['λ', 'lambda', 0, 3, 0.1]],
    esperado: [['σ', 'sigma', 0, 0.2, 0.01], ['asesino −', 'castigo', 1, 30, 1]],
  };

  function creaPistas(nodo) {
    var d = prepara(nodo);
    var cual = 'pequeno', semilla = 25, tipo = 'una', p;
    var val = { m: 2, tau: 0.3, delta: 0, lambda: 0.5, sigma: 0.05, castigo: 10 };
    var arriba = el('div'), lista = el('div', 'cn-opciones'), abajo = el('div');
    d.stage.appendChild(arriba); d.stage.appendChild(lista); d.stage.appendChild(abajo);

    var b1 = barra();
    b1.appendChild(opciones('Tablero', [['pequeño', 'pequeno'], ['una partida', 'partida']], cual, function (v) { cual = v; nuevo(); }));
    var otra = boton('Otra partida', function () { semilla = 1 + Math.floor(Math.random() * 9999); nuevo(); }, 'demo-btn-mini');
    b1.appendChild(otra);
    var b2 = barra();
    b2.appendChild(opciones('Estrategia', [['una a una', 'una'], ['la media', 'media'], ['simular al compañero', 'companero'],
      ['blanda', 'blanda'], ['valor esperado', 'esperado']], tipo, function (v) { tipo = v; ajusta(); calcula(); }));
    var b3 = barra();
    d.controls.appendChild(b1); d.controls.appendChild(b2); d.controls.appendChild(b3);
    function ajusta() {
      b3.innerHTML = '';
      PARAM[tipo].forEach(function (q) {
        b3.appendChild(deslizador(q[0], q[2], q[3], q[4], val[q[1]], function (v) { val[q[1]] = v; calcula(); },
          q[4] === 1 ? function (x) { return String(x); } : function (x) { return fmt(x, 2); }));
      });
      b3.hidden = !PARAM[tipo].length;
    }
    function nuevo() {
      p = cual === 'pequeno' ? tablero(PEQUENO, 'R') : partida(semilla);
      otra.hidden = cual === 'pequeno';
      calcula();
    }
    function calcula() {
      var e = { tipo: tipo, m: val.m, tau: val.tau, delta: val.delta, lambda: val.lambda, sigma: val.sigma, castigo: val.castigo };
      var q = pista(p, p.empieza, e, 4);
      lista.innerHTML = '';
      lista.appendChild(el('span', 'demo-tag', 'Las mejores'));
      [q].concat(q.otras || []).forEach(function (o, x) {
        var b = boton(may(o.w) + ' ' + o.n, function () {
          Array.prototype.forEach.call(lista.querySelectorAll('button'), function (z) { z.setAttribute('aria-pressed', String(z === b)); });
          muestra(o, q.apuro);
        }, 'demo-btn-mini');
        b.setAttribute('aria-pressed', String(x === 0));
        lista.appendChild(b);
      });
      muestra(q, q.apuro);
    }
    function muestra(o, apuro) {
      arriba.innerHTML = ''; abajo.innerHTML = '';
      arriba.appendChild(dibujaTablero(p, { clave: true, cols: p.n === 8 ? 4 : 5, marca: o.para }));
      var r = dibujaRanking(p, o.i, { clave: true, corte: o.n });
      abajo.appendChild(r.nodo);
      d.read.textContent = (apuro ? 'Con estas condiciones no sale ninguna, así que se conforma con una a una. ' : '') +
        may(o.w) + ' ' + o.n + ', pensada para ' + o.para.map(function (k) { return may(p.cartas[k].w); }).join(', ') +
        ' (juega el ' + NOMBRE[p.empieza] + ')' + (o.esperado != null ? ', con valor esperado ' + fmt(o.esperado) : '') + '. ' +
        leeRanking(p, r.lista, p.empieza) + ' La línea discontinua marca dónde para el agente.';
    }
    ajusta(); nuevo();
  }

  /* ============================ 4 · la liguilla ============================ */

  function creaLiguilla(nodo) {
    var d = prepara(nodo);
    var eR = 'margen', eA = 'atrevida', ruido = 0, N = 60, solo = true, corriendo = 0;
    var tabla = el('div', 'table-scroll cn-liga');
    d.stage.appendChild(tabla);
    var b0 = barra(), b1 = barra(), b2 = barra(), b3 = barra('demo-bar-play');
    b0.appendChild(opciones('Modo', [['solitario, como la competición', true], ['rojo contra azul', false]], solo, function (v) { solo = v; ajusta(); }));
    var sR = selector('Rojo', eR, function (v) { eR = v; }), sA = selector('Azul', eA, function (v) { eA = v; });
    b1.appendChild(sR); b1.appendChild(sA);
    b2.appendChild(deslizador('Ruido del que adivina', 0, 0.15, 0.01, ruido, function (v) { ruido = v; }));
    b2.appendChild(opciones('Partidas', [['60', 60], ['120', 120], ['240', 240]], N, function (v) { N = v; }));
    var jugar = boton('Jugar la liguilla', corre, 'demo-play');
    b3.appendChild(jugar);
    d.controls.appendChild(b0); d.controls.appendChild(b1); d.controls.appendChild(b2); d.controls.appendChild(b3);
    function ajusta() {
      sR.firstChild.textContent = solo ? 'Estrategia A' : 'Rojo';
      sA.firstChild.textContent = solo ? 'Estrategia B' : 'Azul';
      d.read.textContent = solo
        ? 'En solitario juega un solo equipo hasta descubrir sus 9 cartas. Se apuntan los turnos, y 25 si toca el asesino o todas las del rival. Menos es mejor.'
        : 'Las dos estrategias se enfrentan. Cada partida tiene su semilla (de la 1 a la ' + N + '), así que con los mismos ajustes sale siempre lo mismo.';
    }
    ajusta();

    function corre() {
      var yo = ++corriendo, s = 0, est = solo ? { R: ESTR[eR], A: ESTR[eR] } : { R: ESTR[eR], A: ESTR[eA] };
      var tot = { R: nuevoT(), A: nuevoT() };
      jugar.disabled = true;
      function nuevoT() { return { gana: 0, asesino: 0, pistas: 0, aciertos: 0, puntos: 0, partidas: 0 }; }
      function suma(o, r, eq) {
        o.pistas += r.est[eq].pistas; o.aciertos += r.est[eq].aciertos;
        if (r.asesino && r.ganador !== eq) o.asesino++;
        if (r.ganador === eq) o.gana++;
        o.puntos += r.puntos || 0; o.partidas++;
      }
      function tanda() {
        if (yo !== corriendo) return;
        var fin = Math.min(N, s + 3);
        for (; s < fin; s++) {
          if (solo) {
            var a = juega(s + 1, { R: ESTR[eR], A: ESTR[eR] }, ruido, true), b = juega(s + 1, { R: ESTR[eA], A: ESTR[eA] }, ruido, true);
            suma(tot.R, a, a.empieza); suma(tot.A, b, b.empieza);
          } else {
            var r = juega(s + 1, est, ruido);
            suma(tot.R, r, 'R'); suma(tot.A, r, 'A');
          }
        }
        pinta(tot, s);
        if (s < N) setTimeout(tanda, 0);
        else { jugar.disabled = false; d.read.textContent = lectura(tot); }
      }
      tanda();
    }
    function pinta(tot, s) {
      var t = el('table', 'cn-tabla');
      var cab = solo ? ['', 'Estrategia', 'Turnos de media', 'Partidas perdidas (25)', 'Palabras por pista']
                     : ['Equipo', 'Estrategia', 'Victorias', 'Derrotas por el asesino', 'Palabras por pista'];
      t.innerHTML = '<thead><tr>' + cab.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('') + '</tr></thead>';
      var tb = el('tbody');
      [['R', eR, 'A'], ['A', eA, 'B']].forEach(function (x) {
        var o = tot[x[0]], tr = el('tr');
        var celdas = solo
          ? [x[2], ESTR[x[1]].nombre, fmt(o.puntos / Math.max(1, o.partidas), 1), String(o.partidas - o.gana), fmt(o.aciertos / Math.max(1, o.pistas))]
          : [x[0] === 'R' ? 'Rojo' : 'Azul', ESTR[x[1]].nombre, o.gana + ' de ' + s, String(o.asesino), fmt(o.aciertos / Math.max(1, o.pistas))];
        celdas.forEach(function (v, c) { tr.appendChild(el('td', c === 0 && !solo ? 'cn-eq cn-' + x[0] : null, v)); });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      tabla.innerHTML = ''; tabla.appendChild(t);
      d.read.textContent = 'Jugando… ' + s + ' de ' + N;
    }
    function lectura(tot) {
      var cuando = ruido ? 'con ruido ' + fmt(ruido) : 'sin ruido';
      if (solo) return 'Hecho, ' + cuando + '. A: ' + fmt(tot.R.puntos / N, 1) + ' turnos de media; B: ' + fmt(tot.A.puntos / N, 1) + '.';
      return 'Hecho, ' + cuando + '. Rojo gana ' + tot.R.gana + ' y azul ' + tot.A.gana + '.';
    }
  }

  /* ============================ 5 · el simulador ============================

     Cuatro puestos: jefe de espías y agente de cada equipo, cada uno de una
     persona o de la máquina. La tarjeta (los colores) sólo se enseña cuando
     le toca a un jefe de espías que es una persona, y si en la sala hay más
     de una persona, antes de enseñarla sale una cortina para pasar el
     ordenador sin que nadie más la vea.                                     */

  function creaSimulador(nodo) {
    var d = prepara(nodo);
    var conf = { semilla: semillaInicial(), puestos: { R: { jefe: 'maquina', agente: 'persona' }, A: { jefe: 'maquina', agente: 'maquina' } },
      estr: { R: 'margen', A: 'margen' } };
    var st = null, token = 0;

    var cfg = el('div', 'cn-config'), estado = el('div', 'cn-estado'), zona = el('div', 'cn-zona'), hist = el('div', 'cn-historial');
    d.stage.appendChild(cfg); d.stage.appendChild(estado); d.stage.appendChild(zona); d.stage.appendChild(hist);
    montaConfig();
    empieza();

    function semillaInicial() {
      var m = /semilla=(\d+)/.exec(location.hash);
      return m ? Number(m[1]) : 1 + Math.floor(Math.random() * 9999);
    }
    function humanos() {
      var l = [];
      ['R', 'A'].forEach(function (eq) { ['jefe', 'agente'].forEach(function (rol) { if (conf.puestos[eq][rol] === 'persona') l.push({ eq: eq, rol: rol }); }); });
      return l;
    }
    function nomPuesto(eq, rol) { return (rol === 'jefe' ? 'jefe de espías ' : 'agente ') + NOMBRE[eq]; }

    function montaConfig() {
      cfg.innerHTML = '';
      var b1 = barra();
      var sem = campo('Semilla', String(conf.semilla), '6rem');
      sem.input.inputMode = 'numeric';
      b1.appendChild(sem);
      b1.appendChild(boton('Otra al azar', function () { sem.input.value = String(1 + Math.floor(Math.random() * 9999)); }, 'demo-btn-mini'));
      var tab = el('table', 'cn-puestos');
      tab.innerHTML = '<thead><tr><th scope="col"><span class="sr">Equipo</span></th><th scope="col">Da pistas</th><th scope="col">Adivina</th></tr></thead>';
      var tb = el('tbody');
      ['R', 'A'].forEach(function (eq) {
        var tr = el('tr'); tr.appendChild(el('th', 'cn-eq cn-' + eq, NOMBRE[eq] === 'rojo' ? 'Rojo' : 'Azul'));
        ['jefe', 'agente'].forEach(function (rol) {
          var td = el('td');
          td.appendChild(opciones(null, [['persona', 'persona'], ['máquina', 'maquina']], conf.puestos[eq][rol], function (v) { conf.puestos[eq][rol] = v; }));
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      tab.appendChild(tb);
      var b2 = barra('cn-bar-puestos'); b2.appendChild(el('span', 'demo-tag', 'Quién juega')); b2.appendChild(tab);
      var b3 = barra();
      b3.appendChild(selector('Máquina roja', conf.estr.R, function (v) { conf.estr.R = v; }));
      b3.appendChild(selector('Máquina azul', conf.estr.A, function (v) { conf.estr.A = v; }));
      var b4 = barra('demo-bar-play');
      b4.appendChild(boton('Empezar partida', function () {
        var n = parseInt(sem.input.value, 10);
        conf.semilla = isNaN(n) ? 1 : Math.abs(n);
        empieza();
      }, 'demo-play'));
      b4.appendChild(el('span', 'demo-cuenta', 'La semilla decide el tablero: con la misma, sale la misma partida en cualquier ordenador.'));
      cfg.appendChild(b1); cfg.appendChild(b2); cfg.appendChild(b3); cfg.appendChild(b4);
    }

    function empieza() {
      token++;
      st = { p: partida(conf.semilla), fase: 'pista', pista: null, cola: null, vista: 'publica', cortina: null, log: [], aviso: '', sugerencia: '' };
      try { history.replaceState(null, '', '#semilla=' + conf.semilla); } catch (e) { /* sin historial, da igual */ }
      paso();
    }

    // Decide qué toca ahora y qué se enseña.
    function paso() {
      var p = st.p, hs = humanos();
      if (p.ganador) { st.fase = 'fin'; st.vista = 'todo'; st.cortina = null; pinta(); return; }
      var eq = p.turno, rol = st.fase === 'pista' ? 'jefe' : 'agente';
      var persona = conf.puestos[eq][rol] === 'persona';
      if (!hs.length) st.vista = 'todo';
      else if (hs.length === 1) st.vista = hs[0].rol === 'jefe' ? 'jefe-' + hs[0].eq : 'publica';
      else if (persona && rol === 'jefe') {
        if (st.vista !== 'jefe-' + eq) {
          st.cortina = { eq: eq, rol: rol };
          st.vista = 'publica';
          pinta(); return;
        }
      } else st.vista = 'publica';
      pinta();
      if (!persona) {
        var yo = token;
        setTimeout(function () { if (yo === token) maquina(); }, st.fase === 'pista' ? 700 : 850);
      }
    }

    function maquina() {
      var p = st.p, eq = p.turno;
      if (st.fase === 'pista') {
        var q = pista(p, eq, ESTR[conf.estr[eq]]);
        ponPista(q.i, q.n, 'máquina', q);
      } else {
        if (!st.cola) st.cola = adivina(p, st.pista.i, st.pista.n, 0);
        prueba(st.cola.shift());
      }
    }

    function ponPista(i, n, quien, q) {
      var p = st.p, eq = p.turno;
      var agentePersona = conf.puestos[eq].agente === 'persona';
      st.pista = { i: i, w: PAL[i], n: n, quedan: agentePersona ? n + 1 : n, probadas: 0 };
      var ent = { eq: eq, w: PAL[i], n: n, quien: quien, intentos: [], secreto: '' };
      if (q) ent.secreto = 'Pensada para ' + q.para.map(function (k) { return may(p.cartas[k].w); }).join(', ') +
        (q.mala >= 0 ? '; la primera mala, ' + may(p.cartas[q.mala].w) + ', con margen ' + fmt(q.margen) : '') + '.';
      if (!agentePersona) {
        var o = ordena(p, i, 0).slice(0, Math.max(5, n + 2));
        ent.orden = 'El agente (máquina) ordena así: ' + o.map(function (x) { return may(p.cartas[x.k].w) + ' ' + fmt(x.s); }).join(' · ');
      }
      st.log.unshift(ent);
      st.fase = 'adivinar'; st.cola = null; st.aviso = ''; st.sugerencia = '';
      paso();
    }

    function prueba(k) {
      var p = st.p, eq = p.turno, res = descubre(p, k);
      st.pista.quedan--; st.pista.probadas++;
      st.log[0].intentos.push({ w: p.cartas[k].w, color: res.color });
      if (!res.sigue || st.pista.quedan <= 0 || (st.cola && !st.cola.length)) finTurno();
      else paso();
    }
    function finTurno() {
      if (!st.p.ganador) pasaTurno(st.p);
      st.fase = 'pista'; st.pista = null; st.cola = null;
      paso();
    }

    function pinta() {
      var p = st.p, eq = p.turno, hs = humanos();
      var clave = st.vista === 'todo' || (st.vista === 'jefe-R' || st.vista === 'jefe-A');
      var rol = st.fase === 'pista' ? 'jefe' : 'agente';
      var persona = st.fase !== 'fin' && conf.puestos[eq][rol] === 'persona';

      estado.innerHTML = '';
      ['R', 'A'].forEach(function (e) {
        var s = el('span', 'cn-marcador cn-' + e + (e === eq && st.fase !== 'fin' ? ' turno' : ''));
        s.appendChild(el('b', null, NOMBRE[e] === 'rojo' ? 'Rojo' : 'Azul'));
        s.appendChild(document.createTextNode(' quedan ' + quedan(p, e)));
        estado.appendChild(s);
      });
      var txt = el('span', 'cn-quien');
      if (st.fase === 'fin') txt.textContent = (p.ganador === 'R' ? 'Gana el rojo' : 'Gana el azul') + (p.porAsesino ? ', porque el otro equipo ha tocado al asesino.' : '.');
      else txt.textContent = 'Le toca al ' + nomPuesto(eq, rol) + (persona ? '' : ' (máquina)') + '.';
      estado.appendChild(txt);

      zona.innerHTML = '';
      if (st.cortina) {
        var cort = el('div', 'cn-cortina');
        cort.appendChild(el('p', 'cn-cortina-t', 'Le toca al ' + nomPuesto(st.cortina.eq, st.cortina.rol) + '.'));
        cort.appendChild(el('p', null, 'Pasadle el ordenador. Los demás, sin mirar: al pulsar se enseña la tarjeta con los colores.'));
        var ok = boton('Soy el ' + nomPuesto(st.cortina.eq, st.cortina.rol) + ': enseñar la tarjeta', function () {
          st.vista = 'jefe-' + st.cortina.eq; st.cortina = null; paso();
        }, 'demo-play');
        cort.appendChild(ok);
        zona.appendChild(cort);
        pintaHistorial(false);
        setTimeout(function () { ok.focus(); }, 0);
        return;
      }

      var puedeTocar = st.fase === 'adivinar' && persona;
      if (st.pista && st.fase === 'adivinar') {
        var pi = el('p', 'cn-pista-actual cn-' + eq);
        pi.appendChild(el('span', 'demo-tag', 'Pista del ' + NOMBRE[eq]));
        pi.appendChild(el('b', null, may(st.pista.w) + ' · ' + st.pista.n));
        if (puedeTocar) pi.appendChild(el('span', 'cn-quedan', 'podéis probar ' + st.pista.quedan + ' más'));
        zona.appendChild(pi);
      }
      zona.appendChild(dibujaTablero(p, { clave: clave, alPulsar: puedeTocar ? function (k) { prueba(k); } : null }));
      if (clave && st.vista !== 'todo') zona.appendChild(el('p', 'cn-ojo', 'Estáis viendo la tarjeta del ' + nomPuesto(st.vista.slice(5), 'jefe') + '.'));

      if (persona && st.fase === 'pista') zona.appendChild(formPista());
      if (puedeTocar) {
        var bb = barra('cn-acciones');
        bb.appendChild(el('span', 'demo-cuenta', 'Tocad una carta para descubrirla.'));
        var plant = boton('Plantarse y pasar el turno', finTurno);
        plant.disabled = st.pista.probadas === 0;
        bb.appendChild(plant);
        zona.appendChild(bb);
      }
      if (st.fase === 'fin') {
        var bf = barra('demo-bar-play');
        bf.appendChild(boton('Otra con la misma semilla', empieza));
        bf.appendChild(boton('Otra partida nueva', function () { conf.semilla = 1 + Math.floor(Math.random() * 9999); montaConfig(); empieza(); }));
        zona.appendChild(bf);
      }
      pintaHistorial(clave);
      d.read.textContent = hs.length > 1 ? 'Juegan ' + hs.length + ' personas: los colores sólo se enseñan detrás de la cortina.' :
        hs.length === 1 ? 'Juegas de ' + nomPuesto(hs[0].eq, hs[0].rol) + '; el resto lo lleva la máquina.' :
        'Sólo máquinas: se ve la tarjeta y por qué da cada pista.';
    }

    function formPista() {
      var f = el('form', 'cn-form');
      var c = campo('Pista', '', '10rem');
      var num = el('label', 'demo-campo'); num.appendChild(document.createTextNode('número'));
      var s = el('select', 'cn-select');
      for (var n = 1; n <= 9; n++) { var o = el('option', null, String(n)); o.value = n; s.appendChild(o); }
      s.value = '2'; num.appendChild(s);
      var dar = el('button', 'demo-btn demo-play', 'Dar la pista'); dar.type = 'submit';
      var bar = barra(); bar.appendChild(c); bar.appendChild(num); bar.appendChild(dar);
      bar.appendChild(boton('¿Qué diría la máquina?', function () {
        var q = pista(st.p, st.p.turno, ESTR[conf.estr[st.p.turno]]);
        st.sugerencia = 'Con "' + ESTR[conf.estr[st.p.turno]].nombre + '", la máquina diría ' + may(q.w) + ' ' + q.n + ', para ' +
          q.para.map(function (k) { return may(st.p.cartas[k].w); }).join(', ') + '.';
        av2.textContent = st.sugerencia;
      }, 'demo-btn-mini'));
      f.appendChild(bar);
      var av = el('p', 'cn-aviso', st.aviso), av2 = el('p', 'cn-sugerencia', st.sugerencia);
      f.appendChild(av); f.appendChild(av2);
      f.onsubmit = function (ev) {
        ev.preventDefault();
        var v = valida(st.p, c.input.value);
        if (v.error) { st.aviso = v.error; av.textContent = v.error; c.input.focus(); return; }
        ponPista(v.i, Number(s.value), 'persona', null);
      };
      setTimeout(function () { c.input.focus(); }, 0);
      return f;
    }

    function pintaHistorial(clave) {
      hist.innerHTML = '';
      if (!st.log.length) return;
      hist.appendChild(el('h5', null, 'Pistas de la partida'));
      var ol = el('ol');
      st.log.forEach(function (e) {
        var li = el('li', 'cn-' + e.eq);
        li.appendChild(el('b', null, (e.eq === 'R' ? 'Rojo' : 'Azul') + ' · ' + may(e.w) + ' ' + e.n));
        e.intentos.forEach(function (t) { li.appendChild(el('span', 'cn-intento cn-' + t.color, may(t.w))); });
        var ver = clave && (st.vista === 'todo' || st.vista === 'jefe-' + e.eq);
        if (e.secreto && ver) li.appendChild(el('span', 'cn-secreto', e.secreto));
        if (e.orden) li.appendChild(el('span', 'cn-secreto', e.orden));
        ol.appendChild(li);
      });
      hist.appendChild(ol);
    }
  }

  /* ============================ arranque ============================ */

  var CREA = { coseno: creaCoseno, suma: creaSuma, ranking: creaRanking, pistas: creaPistas, liguilla: creaLiguilla, simulador: creaSimulador };
  function arranca() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cn]'), function (n) {
      var f = CREA[n.getAttribute('data-cn')];
      if (f) f(n);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
