/* Ejemplos interactivos de los apuntes de razonamiento borroso.
 *
 * Dentro hay un intérprete pequeño de FCL, el lenguaje de jFuzzyLogic, con lo
 * que usan los apuntes y la práctica: variables de entrada y salida, términos
 * por puntos, trian, trape y gauss, RANGE, METHOD (COG, COA, LM, RM), DEFAULT,
 * y bloques de reglas con AND, OR, ACT, ACCU, NOT, paréntesis y WITH.
 *
 * La inferencia se hace como jFuzzyLogic 3.2h, que es el que trae el motor:
 * la salida se discretiza en 1000 puntos entre los extremos de sus términos
 * (una gaussiana llega a ±4σ), cada regla recorta (ACT MIN) o escala (ACT PROD)
 * su término punto a punto, se acumula con ACCU (SUM si no se dice nada) y el
 * centro de gravedad es la media ponderada de esos puntos. Los ejemplos de los
 * apuntes dan aquí las mismas cifras que en jFuzzyLogic: se comprobó
 * lanzándolos en los dos.
 *
 * Sin dependencias y sin build. Sin JavaScript queda el aviso de cada bloque.
 */
(function () {
  'use strict';

  /* ============================ el lector de FCL ============================ */

  function ErrorFCL(msg) { this.message = msg; }
  ErrorFCL.prototype = Object.create(Error.prototype);

  function tokens(src) {
    var t = [], i = 0, n = src.length, l = 1;
    while (i < n) {
      var c = src[i];
      if (c === '\n') { l++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') l++; i++; } i += 2; continue; }
      if (c === '(' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === ')')) { if (src[i] === '\n') l++; i++; } i += 2; continue; }
      if (c === ':' && src[i + 1] === '=') { t.push({ k: ':=', l: l }); i += 2; continue; }
      if (c === '.' && src[i + 1] === '.') { t.push({ k: '..', l: l }); i += 2; continue; }
      if ('();:,'.indexOf(c) >= 0) { t.push({ k: c, l: l }); i++; continue; }
      var m = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (m) { t.push({ k: 'num', v: Number(m[0]), l: l }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (m) { t.push({ k: 'id', v: m[0], l: l }); i += m[0].length; continue; }
      throw new ErrorFCL('línea ' + l + ': no entiendo "' + c + '"');
    }
    return t;
  }

  function lee(src) {
    var t = tokens(src), p = 0;
    function mira() { return t[p]; }
    function es(k, v) { var x = t[p]; return x && x.k === k && (v == null || x.v.toUpperCase() === v); }
    function come(k, v) {
      var x = t[p];
      if (!x) throw new ErrorFCL('el fichero se acaba antes de tiempo: esperaba ' + (v || k));
      if (x.k !== k || (v != null && x.v.toUpperCase() !== v)) throw new ErrorFCL('línea ' + x.l + ': esperaba ' + (v || k) + ' y hay "' + (x.v != null ? x.v : x.k) + '"');
      p++; return x;
    }
    function opc(k) { if (es(k)) { p++; return true; } return false; }
    function numero() { return come('num').v; }

    var fb = { nombre: '', entradas: {}, salidas: {}, orden: [], reglas: [], and: 'MIN', or: 'MAX', act: 'MIN', accu: null };
    come('id', 'FUNCTION_BLOCK');
    if (es('id') && mira().v.toUpperCase() !== 'VAR_INPUT') fb.nombre = come('id').v;

    function variables(dest) {
      while (!es('id', 'END_VAR')) {
        var nom = come('id').v; come(':'); come('id'); come(';');
        dest[nom] = { nombre: nom, terminos: {}, ordenT: [], metodo: 'COG', defecto: NaN, rango: null, accu: null };
        fb.orden.push(nom);
      }
      come('id', 'END_VAR');
    }
    function funcion(l) {
      if (es('(')) {
        var xs = [], ys = [];
        while (opc('(')) { xs.push(numero()); come(','); ys.push(numero()); come(')'); }
        for (var i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) throw new ErrorFCL('línea ' + l + ': los puntos tienen que ir de menor a mayor x');
        return { tipo: 'puntos', xs: xs, ys: ys };
      }
      var f = come('id').v.toUpperCase();
      if (f === 'TRIAN') return { tipo: 'trian', a: numero(), b: numero(), c: numero() };
      if (f === 'TRAPE') return { tipo: 'trape', a: numero(), b: numero(), c: numero(), d: numero() };
      if (f === 'GAUSS') return { tipo: 'gauss', m: numero(), s: numero() };
      throw new ErrorFCL('línea ' + l + ': este banco entiende términos por puntos, trian, trape y gauss, y no ' + f);
    }
    function bloqueVar(fin) {
      var nom = come('id').v;
      var v = fb.entradas[nom] || fb.salidas[nom];
      if (!v) throw new ErrorFCL('línea ' + t[p - 1].l + ': ' + nom + ' no está declarada en VAR_INPUT ni en VAR_OUTPUT');
      while (!es('id', fin)) {
        var x = come('id'), k = x.v.toUpperCase();
        if (k === 'TERM') {
          var tn = come('id').v; come(':=');
          v.terminos[tn] = funcion(x.l); v.ordenT.push(tn); come(';');
        } else if (k === 'METHOD') { come(':'); v.metodo = come('id').v.toUpperCase(); come(';'); }
        else if (k === 'DEFAULT') { come(':='); v.defecto = es('id', 'NC') ? (p++, NaN) : numero(); come(';'); }
        else if (k === 'ACCU') { come(':'); v.accu = come('id').v.toUpperCase(); come(';'); }
        else if (k === 'RANGE') { come(':='); come('('); var a = numero(); come('..'); var b = numero(); come(')'); come(';'); v.rango = [a, b]; }
        else throw new ErrorFCL('línea ' + x.l + ': no sé qué es ' + x.v + ' dentro de ' + (fin === 'END_FUZZIFY' ? 'FUZZIFY' : 'DEFUZZIFY'));
      }
      come('id', fin);
      if (!v.ordenT.length) throw new ErrorFCL(nom + ' no tiene ningún TERM');
    }
    // Como jFuzzyLogic: AND y OR tienen la misma precedencia y se leen de
    // izquierda a derecha, así que "a OR b AND c" es "(a OR b) AND c".
    function condicion() {
      var a = unaria();
      while (es('id', 'AND') || es('id', 'OR')) {
        var op = t[p++].v.toLowerCase();
        a = { op: op, a: a, b: unaria() };
      }
      return a;
    }
    function unaria() {
      if (es('id', 'NOT')) { p++; return { op: 'not', a: unaria() }; }
      if (opc('(')) { var c = condicion(); come(')'); return c; }
      var vx = come('id'), vn = vx.v; come('id', 'IS');
      var neg = false;
      if (es('id', 'NOT')) { p++; neg = true; }
      var tn = come('id').v;
      var v = fb.entradas[vn] || fb.salidas[vn];
      if (!v) throw new ErrorFCL('línea ' + vx.l + ': la regla usa ' + vn + ', que no está declarada');
      if (!(tn in v.terminos)) throw new ErrorFCL('línea ' + vx.l + ': ' + vn + ' no tiene ningún término llamado ' + tn);
      return { op: 'is', v: vn, t: tn, neg: neg };
    }
    function bloqueReglas() {
      fb.bloque = come('id').v;
      while (!es('id', 'END_RULEBLOCK')) {
        var x = come('id'), k = x.v.toUpperCase();
        if (k === 'AND') { come(':'); fb.and = come('id').v.toUpperCase(); fb.or = fb.and === 'PROD' ? 'PROBOR' : fb.and === 'BDIF' ? 'BSUM' : 'MAX'; come(';'); }
        else if (k === 'OR') { come(':'); fb.or = come('id').v.toUpperCase(); fb.and = fb.or === 'PROBOR' ? 'PROD' : fb.or === 'BSUM' ? 'BDIF' : 'MIN'; come(';'); }
        else if (k === 'ACT') { come(':'); fb.act = come('id').v.toUpperCase(); come(';'); }
        else if (k === 'ACCU') { come(':'); fb.accu = come('id').v.toUpperCase(); come(';'); }
        else if (k === 'RULE') {
          var n = es('num') ? String(numero()) : come('id').v; come(':');
          come('id', 'IF');
          var desde = p;
          var c = condicion();
          come('id', 'THEN');
          var cons = [];
          do {
            var sx = come('id'), sv = sx.v; come('id', 'IS'); var st = come('id').v;
            if (!fb.salidas[sv]) throw new ErrorFCL('línea ' + sx.l + ': ' + sv + ' no es una variable de salida');
            if (!(st in fb.salidas[sv].terminos)) throw new ErrorFCL('línea ' + sx.l + ': ' + sv + ' no tiene ningún término llamado ' + st);
            cons.push({ v: sv, t: st });
          } while (opc(','));
          var peso = 1;
          if (es('id', 'WITH')) { p++; peso = numero(); }
          come(';');
          fb.reglas.push({ n: n, si: c, entonces: cons, peso: peso, l: x.l });
        } else throw new ErrorFCL('línea ' + x.l + ': no sé qué es ' + x.v + ' dentro de RULEBLOCK');
      }
      come('id', 'END_RULEBLOCK');
    }
    while (!es('id', 'END_FUNCTION_BLOCK')) {
      var x = mira();
      if (!x) throw new ErrorFCL('falta END_FUNCTION_BLOCK');
      var k = x.k === 'id' ? x.v.toUpperCase() : '';
      p++;
      if (k === 'VAR_INPUT') variables(fb.entradas);
      else if (k === 'VAR_OUTPUT') variables(fb.salidas);
      else if (k === 'FUZZIFY') bloqueVar('END_FUZZIFY');
      else if (k === 'DEFUZZIFY') bloqueVar('END_DEFUZZIFY');
      else if (k === 'RULEBLOCK') bloqueReglas();
      else throw new ErrorFCL('línea ' + x.l + ': no sé qué es "' + (x.v || x.k) + '" aquí');
    }
    Object.keys(fb.entradas).concat(Object.keys(fb.salidas)).forEach(function (n) {
      var v = fb.entradas[n] || fb.salidas[n];
      if (!v.ordenT.length) throw new ErrorFCL(n + ' está declarada pero no tiene FUZZIFY ni DEFUZZIFY');
      v.universo = universo(v);
    });
    return fb;
  }

  /* ============================ la inferencia ============================ */

  function mu(f, x) {
    switch (f.tipo) {
      case 'puntos': {
        var xs = f.xs, ys = f.ys, n = xs.length;
        if (x <= xs[0]) return ys[0];
        if (x > xs[n - 1]) return ys[n - 1];
        for (var i = 1; i < n; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * ((x - xs[i - 1]) / (xs[i] - xs[i - 1]));
        return ys[n - 1];
      }
      case 'trian':
        if (x < f.a || x > f.c) return 0;
        if (x === f.b) return 1;
        return x < f.b ? (x - f.a) / (f.b - f.a) : (f.c - x) / (f.c - f.b);
      case 'trape':
        if (x < f.a || x > f.d) return 0;
        if (x >= f.b && x <= f.c) return 1;
        return x < f.b ? (x - f.a) / (f.b - f.a) : (f.d - x) / (f.d - f.c);
      case 'gauss':
        return Math.exp(-(x - f.m) * (x - f.m) / (2 * f.s * f.s));
    }
    return 0;
  }
  function extremos(f) {
    switch (f.tipo) {
      case 'puntos': return [f.xs[0], f.xs[f.xs.length - 1]];
      case 'trian': return [f.a, f.c];
      case 'trape': return [f.a, f.d];
      case 'gauss': return [f.m - 4 * f.s, f.m + 4 * f.s];
    }
  }
  function universo(v) {
    if (v.rango) return v.rango.slice();
    var a = Infinity, b = -Infinity;
    v.ordenT.forEach(function (t) { var e = extremos(v.terminos[t]); a = Math.min(a, e[0]); b = Math.max(b, e[1]); });
    return [a, b];
  }

  var Y = { MIN: Math.min, PROD: function (a, b) { return a * b; }, BDIF: function (a, b) { return Math.max(0, a + b - 1); } };
  var O = { MAX: Math.max, PROBOR: function (a, b) { return a + b - a * b; }, BSUM: function (a, b) { return Math.min(1, a + b); }, ASUM: function (a, b) { return a + b - a * b; } };
  var ACU = { MAX: Math.max, SUM: function (a, b) { return a + b; }, PROBOR: function (a, b) { return a + b - a * b; }, BSUM: function (a, b) { return Math.min(1, a + b); } };

  var PUNTOS = 1000;

  // Evalúa el bloque con unas entradas. Devuelve todo lo necesario para dibujar.
  function evalua(fb, entradas) {
    var y = Y[fb.and] || Y.MIN, o = O[fb.or] || O.MAX;
    var grados = {};
    fb.orden.forEach(function (n) {
      var v = fb.entradas[n];
      if (!v) return;
      grados[n] = {};
      v.ordenT.forEach(function (t) { grados[n][t] = mu(v.terminos[t], entradas[n]); });
    });
    function cond(c) {
      if (c.op === 'is') {
        var g = grados[c.v] ? grados[c.v][c.t] : 0;
        return c.neg ? 1 - g : g;
      }
      if (c.op === 'not') return 1 - cond(c.a);
      if (c.op === 'and') return y(cond(c.a), cond(c.b));
      return o(cond(c.a), cond(c.b));
    }
    var reglas = fb.reglas.map(function (r) { return { r: r, grado: cond(r.si) * r.peso }; });
    var salidas = {};
    Object.keys(fb.salidas).forEach(function (n) {
      var v = fb.salidas[n];
      var u = v.universo, paso = (u[1] - u[0]) / PUNTOS;
      var vals = new Float64Array(PUNTOS);
      var acu = ACU[fb.accu || v.accu || 'SUM'] || ACU.SUM;
      var recortes = [];
      reglas.forEach(function (rg) {
        rg.r.entonces.forEach(function (c) {
          if (c.v !== n) return;
          var f = v.terminos[c.t], rec = new Float64Array(PUNTOS), x = u[0];
          for (var i = 0; i < PUNTOS; i++, x += paso) {
            var m = mu(f, x);
            var z = fb.act === 'PROD' ? rg.grado * m : Math.min(rg.grado, m);
            rec[i] = z;
            vals[i] = acu(vals[i], z);
          }
          recortes.push({ t: c.t, regla: rg.r.n, grado: rg.grado, vals: rec });
        });
      });
      salidas[n] = { vals: vals, recortes: recortes, valor: desdifumina(v, vals, u, paso), u: u, paso: paso };
    });
    return { grados: grados, reglas: reglas, salidas: salidas };
  }

  function desdifumina(v, vals, u, paso) {
    var i, x, suma = 0, pond = 0, max = 0;
    for (i = 0; i < vals.length; i++) { suma += vals[i]; if (vals[i] > max) max = vals[i]; }
    if (suma <= 0) return v.defecto;
    switch (v.metodo) {
      case 'COA': {
        // como jFuzzyLogic: dos sumas que avanzan desde los extremos hasta encontrarse
        var bajo = 0, alto = vals.length - 1, sb = 0, sa = 0;
        while (bajo < alto) {
          if (sb <= sa) { bajo++; sb += vals[bajo]; } else { alto--; sa += vals[alto]; }
        }
        return u[0] + paso * bajo;
      }
      case 'LM':
        for (i = 0, x = u[0]; i < vals.length; i++, x += paso) if (vals[i] >= max) return x;
        return u[0];
      case 'RM':
        for (i = vals.length - 1; i >= 0; i--) if (vals[i] >= max) return u[0] + i * paso;
        return u[1];
      default:
        for (i = 0, x = u[0]; i < vals.length; i++, x += paso) pond += x * vals[i];
        return pond / suma;
    }
  }

  var API = { lee: lee, evalua: evalua, mu: mu, ErrorFCL: ErrorFCL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document === 'undefined') return;

  /* ============================ la página ============================ */

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
    raiz.pon = function (v) { val = v; Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o, i) { o.setAttribute('aria-pressed', String(pares[i][1] === v)); }); };
    return raiz;
  }
  function deslizador(etiq, min, max, paso, val, alCambiar) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(document.createTextNode(etiq));
    var i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = paso; i.value = val;
    var out = el('b', null, fmt(val));
    i.oninput = function () { out.textContent = fmt(Number(i.value)); alCambiar(Number(i.value)); };
    raiz.appendChild(i); raiz.appendChild(out);
    raiz.pon = function (v) { i.value = v; out.textContent = fmt(v); };
    return raiz;
  }
  function fmt(x, d) {
    if (x == null || isNaN(x)) return '—';
    var r = Number(x).toFixed(d == null ? (Math.abs(x) >= 10 || Number.isInteger(x) ? 0 : 2) : d);
    return r.replace('.', ',');
  }
  function f2(x) { return isNaN(x) ? '—' : Number(x).toFixed(2).replace('.', ','); }
  function prepara(nodo) {
    var stage = nodo.querySelector('.demo-stage'); stage.innerHTML = '';
    return { stage: stage, controls: nodo.querySelector('.demo-controls'), read: nodo.querySelector('.demo-read') };
  }

  // Un eje con una variable dibujada: sus términos, y opcionalmente lo que
  // devuelve la inferencia. Devuelve funciones para colocar cosas en él.
  var COLORES = ['bz-t0', 'bz-t1', 'bz-t2', 'bz-t3', 'bz-t4'];
  function lienzo(W, H, m) {
    m = m || { l: 30, r: 10, t: 10, b: 22 };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'demo-svg bz-svg', role: 'img' });
    return { svg: svg, W: W, H: H, m: m,
      px: function (x, u) { return m.l + (x - u[0]) / (u[1] - u[0]) * (W - m.l - m.r); },
      py: function (y, top) { return (H - m.b) - y / (top || 1) * (H - m.b - m.t); } };
  }
  function ejes(L, u, etiq, top) {
    var g = sv('g', {});
    var y0 = L.py(0), y1 = L.py(top || 1);
    g.appendChild(sv('line', { x1: L.m.l, y1: y0, x2: L.W - L.m.r, y2: y0, class: 'bz-eje' }));
    g.appendChild(sv('line', { x1: L.m.l, y1: y0, x2: L.m.l, y2: y1, class: 'bz-eje' }));
    g.appendChild(sv('text', { x: L.m.l - 4, y: y1 + 3, class: 'bz-n', style: 'text-anchor:end' }, fmt(top || 1)));
    g.appendChild(sv('text', { x: L.m.l - 4, y: y0 + 3, class: 'bz-n', style: 'text-anchor:end' }, '0'));
    var marcas = 5;
    for (var i = 0; i <= marcas; i++) {
      var x = u[0] + (u[1] - u[0]) * i / marcas;
      g.appendChild(sv('text', { x: L.px(x, u), y: y0 + 12, class: 'bz-n' }, fmt(Math.round(x * 10) / 10)));
    }
    if (etiq) g.appendChild(sv('text', { x: L.W - L.m.r, y: L.m.t - 7, class: 'bz-n', style: 'text-anchor:end' }, etiq));
    L.svg.appendChild(g);
  }
  function curva(L, u, f, cls, top) {
    var d = '', N = 240;
    for (var i = 0; i <= N; i++) {
      var x = u[0] + (u[1] - u[0]) * i / N;
      d += (i ? ' L' : 'M') + L.px(x, u).toFixed(1) + ' ' + L.py(f(x), top).toFixed(1);
    }
    var p = sv('path', { d: d, class: cls });
    L.svg.appendChild(p);
    return p;
  }
  function area(L, u, vals, cls, top) {
    var n = vals.length, paso = (u[1] - u[0]) / n;
    var d = 'M' + L.px(u[0], u).toFixed(1) + ' ' + L.py(0).toFixed(1);
    for (var i = 0; i < n; i += 2) d += ' L' + L.px(u[0] + i * paso, u).toFixed(1) + ' ' + L.py(Math.min(vals[i], top || 1), top).toFixed(1);
    d += ' L' + L.px(u[1], u).toFixed(1) + ' ' + L.py(0).toFixed(1) + ' Z';
    var p = sv('path', { d: d, class: cls });
    L.svg.appendChild(p);
    return p;
  }

  /* ---------- 1 · una variable lingüística, nítida o borrosa ---------- */

  function creaVariable(nodo) {
    var d = prepara(nodo);
    var u = [0, 100], x = 30, modo = 'borrosa';
    var T = {
      borrosa: [
        { n: 'cerca', f: { tipo: 'puntos', xs: [0, 15, 45], ys: [1, 1, 0] } },
        { n: 'media', f: { tipo: 'trian', a: 20, b: 50, c: 80 } },
        { n: 'lejos', f: { tipo: 'puntos', xs: [55, 85, 100], ys: [0, 1, 1] } }
      ],
      nitida: [
        { n: 'cerca', f: { tipo: 'puntos', xs: [0, 30, 30.0001, 100], ys: [1, 1, 0, 0] } },
        { n: 'media', f: { tipo: 'puntos', xs: [0, 29.9999, 30, 65, 65.0001, 100], ys: [0, 0, 1, 1, 0, 0] } },
        { n: 'lejos', f: { tipo: 'puntos', xs: [0, 64.9999, 65, 100], ys: [0, 0, 1, 1] } }
      ]
    };
    var L = lienzo(520, 200, { l: 30, r: 12, t: 26, b: 26 });
    L.svg.setAttribute('aria-label', 'Tres términos de la distancia de Ms. Pac-Man a la píldora, cerca, media y lejos, con una línea vertical en la distancia elegida.');
    d.stage.appendChild(L.svg);
    var leyenda = el('div', 'demo-leyenda');
    nodo.insertBefore(leyenda, d.read);

    function pinta() {
      L.svg.innerHTML = '';
      ejes(L, u, 'distancia de Ms. Pac-Man a la PPill');
      var ts = T[modo];
      ts.forEach(function (t, i) { curva(L, u, function (z) { return API.mu(t.f, z); }, 'bz-curva ' + COLORES[i]); });
      var px = L.px(x, u);
      L.svg.appendChild(sv('line', { x1: px, y1: L.py(0), x2: px, y2: L.py(1) - 4, class: 'bz-x' }));
      var txt = [];
      ts.forEach(function (t, i) {
        var g = API.mu(t.f, x);
        if (g > 0) {
          L.svg.appendChild(sv('circle', { cx: px, cy: L.py(g), r: 3.6, class: 'bz-punto ' + COLORES[i] }));
          L.svg.appendChild(sv('text', { x: px + 6, y: L.py(g) - 4, class: 'bz-v ' + COLORES[i] }, f2(g)));
        }
        txt.push(t.n + ' ' + f2(g));
      });
      leyenda.innerHTML = '';
      ts.forEach(function (t, i) {
        var s = el('span', 'lg');
        var m = el('i', 'bz-muestra ' + COLORES[i]);
        s.appendChild(m); s.appendChild(document.createTextNode(t.n));
        leyenda.appendChild(s);
      });
      d.read.textContent = 'A ' + x + ' pasos: ' + txt.join(' · ') + '. ' + (modo === 'nitida'
        ? 'Con intervalos, cada distancia está en un solo conjunto, y a 29 y a 31 pasos dice cosas opuestas.'
        : 'Con conjuntos borrosos, una distancia puede ser un poco cerca y un poco media a la vez.');
    }
    var b1 = barra('demo-bar-play');
    b1.appendChild(deslizador('Distancia', 0, 100, 1, x, function (v) { x = v; pinta(); }));
    b1.appendChild(opciones('Conjuntos', [['Borrosos', 'borrosa'], ['Nítidos', 'nitida']], modo, function (v) { modo = v; pinta(); }));
    d.controls.appendChild(b1);
    pinta();
  }

  /* ---------- 2 · AND, OR y NOT sobre dos conjuntos ---------- */

  function creaOperaciones(nodo) {
    var d = prepara(nodo);
    var u = [0, 100];
    var A = { tipo: 'puntos', xs: [0, 15, 45], ys: [1, 1, 0] };      // cerca
    var B = { tipo: 'trian', a: 20, b: 50, c: 80 };                     // media
    var op = 'and-min';
    var OPS = {
      'and-min': ['cerca AND media · min', function (a, b) { return Math.min(a, b); }],
      'and-prod': ['cerca AND media · producto', function (a, b) { return a * b; }],
      'or-max': ['cerca OR media · max', function (a, b) { return Math.max(a, b); }],
      'or-probor': ['cerca OR media · a+b−ab', function (a, b) { return a + b - a * b; }],
      'not': ['NOT cerca · 1 − μ', function (a) { return 1 - a; }]
    };
    var L = lienzo(520, 200, { l: 30, r: 12, t: 26, b: 26 });
    L.svg.setAttribute('aria-label', 'Los conjuntos cerca y media dibujados con línea, y el resultado de la operación elegida relleno debajo.');
    d.stage.appendChild(L.svg);
    var x = 32;
    function pinta() {
      L.svg.innerHTML = '';
      ejes(L, u, 'distancia');
      var f = OPS[op][1];
      var vals = new Float64Array(500);
      for (var i = 0; i < 500; i++) { var z = u[0] + (u[1] - u[0]) * i / 500; vals[i] = f(API.mu(A, z), API.mu(B, z)); }
      area(L, u, vals, 'bz-res');
      curva(L, u, function (z) { return API.mu(A, z); }, 'bz-curva bz-t0');
      curva(L, u, function (z) { return API.mu(B, z); }, 'bz-curva bz-t1');
      var a = API.mu(A, x), b = API.mu(B, x), r = f(a, b);
      var px = L.px(x, u);
      L.svg.appendChild(sv('line', { x1: px, y1: L.py(0), x2: px, y2: L.py(1) - 4, class: 'bz-x' }));
      L.svg.appendChild(sv('circle', { cx: px, cy: L.py(r), r: 3.8, class: 'bz-punto bz-res-p' }));
      d.read.textContent = 'A ' + x + ' pasos: cerca = ' + f2(a) + ', media = ' + f2(b) + ' → ' + OPS[op][0] + ' = ' + f2(r) + '.';
    }
    var b1 = barra('demo-bar-play');
    b1.appendChild(opciones('Operación', [['AND · min', 'and-min'], ['AND · producto', 'and-prod'], ['OR · max', 'or-max'], ['OR · suma prob.', 'or-probor'], ['NOT', 'not']], op, function (v) { op = v; pinta(); }));
    var b2 = barra();
    b2.appendChild(deslizador('Distancia', 0, 100, 1, x, function (v) { x = v; pinta(); }));
    var lg = el('span', 'demo-leyenda bz-leyenda-en-barra');
    [['cerca', 'bz-t0'], ['media', 'bz-t1'], ['resultado', 'bz-res-m']].forEach(function (p) { var s = el('span', 'lg'); s.appendChild(el('i', 'bz-muestra ' + p[1])); s.appendChild(document.createTextNode(p[0])); lg.appendChild(s); });
    b2.appendChild(lg);
    d.controls.appendChild(b1); d.controls.appendChild(b2);
    pinta();
  }

  /* ---------- 3 · el banco de FCL: Mamdani entero ---------- */

  var FCL = {
    huir: {
      txt: 'Huir o ir a la píldora',
      src: [
        'FUNCTION_BLOCK huida',
        '',
        'VAR_INPUT',
        '   fantasma : REAL;   // distancia al fantasma más cercano',
        '   ppill    : REAL;   // distancia a la píldora más cercana',
        'END_VAR',
        '',
        'VAR_OUTPUT',
        '   huir : REAL;       // urgencia de huir, de 0 a 10',
        'END_VAR',
        '',
        'FUZZIFY fantasma',
        '   TERM cerca := (0, 1) (15, 1) (45, 0);',
        '   TERM media := trian 20 50 80;',
        '   TERM lejos := (55, 0) (85, 1) (100, 1);',
        'END_FUZZIFY',
        '',
        'FUZZIFY ppill',
        '   TERM cerca := (0, 1) (10, 1) (40, 0);',
        '   TERM lejos := (20, 0) (60, 1) (100, 1);',
        'END_FUZZIFY',
        '',
        'DEFUZZIFY huir',
        '   TERM poco  := (0, 1) (4, 0);',
        '   TERM algo  := trian 2 5 8;',
        '   TERM mucho := (6, 0) (10, 1);',
        '   METHOD : COG;',
        '   DEFAULT := 0;',
        'END_DEFUZZIFY',
        '',
        'RULEBLOCK reglas',
        '   AND : MIN;',
        '   ACT : MIN;',
        '   ACCU : MAX;',
        '   RULE 1 : IF fantasma IS cerca AND ppill IS lejos THEN huir IS mucho;',
        '   RULE 2 : IF fantasma IS cerca AND ppill IS cerca THEN huir IS poco;',
        '   RULE 3 : IF fantasma IS media THEN huir IS algo;',
        '   RULE 4 : IF fantasma IS lejos THEN huir IS poco;',
        'END_RULEBLOCK',
        '',
        'END_FUNCTION_BLOCK'
      ].join('\n'),
      ini: { fantasma: 25, ppill: 50 }
    },
    propina: {
      txt: 'La propina (tipper.fcl)',
      src: [
        'FUNCTION_BLOCK tipper',
        '',
        'VAR_INPUT',
        '   service : REAL;',
        '   food : REAL;',
        'END_VAR',
        '',
        'VAR_OUTPUT',
        '   tip : REAL;',
        'END_VAR',
        '',
        'FUZZIFY service',
        '   TERM poor := (0, 1) (4, 0);',
        '   TERM good := (1, 0) (4, 1) (6, 1) (9, 0);',
        '   TERM excellent := (6, 0) (9, 1);',
        'END_FUZZIFY',
        '',
        'FUZZIFY food',
        '   TERM rancid := (0, 1) (1, 1) (3, 0);',
        '   TERM delicious := (7, 0) (9, 1);',
        'END_FUZZIFY',
        '',
        'DEFUZZIFY tip',
        '   TERM cheap := (0, 0) (5, 1) (10, 0);',
        '   TERM average := (10, 0) (15, 1) (20, 0);',
        '   TERM generous := (20, 0) (25, 1) (30, 0);',
        '   METHOD : COG;',
        '   DEFAULT := 0;',
        'END_DEFUZZIFY',
        '',
        'RULEBLOCK No1',
        '   AND : MIN;',
        '   ACT : MIN;',
        '   ACCU : MAX;',
        '   RULE 1 : IF service IS poor OR food IS rancid THEN tip IS cheap;',
        '   RULE 2 : IF service IS good THEN tip IS average;',
        '   RULE 3 : IF service IS excellent AND food IS delicious THEN tip IS generous;',
        'END_RULEBLOCK',
        '',
        'END_FUNCTION_BLOCK'
      ].join('\n'),
      ini: { service: 3, food: 8 }
    },
    calma: {
      txt: 'Dos fantasmas que se contradicen',
      src: [
        '// dos fantasmas: uno encima y otro lejísimos. ¿Cuánta prisa hay?',
        'FUNCTION_BLOCK dos',
        '',
        'VAR_INPUT',
        '   blinky : REAL;',
        '   sue : REAL;',
        'END_VAR',
        '',
        'VAR_OUTPUT',
        '   huir : REAL;',
        'END_VAR',
        '',
        'FUZZIFY blinky',
        '   TERM cerca := (0, 1) (60, 0);',
        '   TERM lejos := (90, 0) (150, 1) (200, 1);',
        'END_FUZZIFY',
        '',
        'FUZZIFY sue',
        '   TERM cerca := (0, 1) (60, 0);',
        '   TERM lejos := (90, 0) (150, 1) (200, 1);',
        'END_FUZZIFY',
        '',
        'DEFUZZIFY huir',
        '   TERM calma := (0, 1) (5, 1) (15, 0);',
        '   TERM emergencia := (15, 0) (25, 1) (30, 1);',
        '   METHOD : COG;',
        '   DEFAULT := 0;',
        'END_DEFUZZIFY',
        '',
        'RULEBLOCK reglas',
        '   AND : MIN;',
        '   ACT : MIN;',
        '   ACCU : MAX;',
        '   RULE 1 : IF blinky IS cerca THEN huir IS emergencia;',
        '   RULE 2 : IF sue IS cerca THEN huir IS emergencia;',
        '   RULE 3 : IF blinky IS lejos THEN huir IS calma;',
        '   RULE 4 : IF sue IS lejos THEN huir IS calma;',
        'END_RULEBLOCK',
        '',
        'END_FUNCTION_BLOCK'
      ].join('\n'),
      ini: { blinky: 20, sue: 200 }
    }
  };

  function creaBanco(nodo) {
    var d = prepara(nodo);
    var lista = (nodo.getAttribute('data-presets') || 'huir').split(/\s+/);
    var actual = lista[0];
    var fb = null, entradas = {}, barrido = null;

    var marco = el('div', 'bz-banco');
    var det = el('details', 'bz-fcl');
    var sum = el('summary', null, 'El fichero FCL · abridlo para cambiarlo');
    det.appendChild(sum);
    var ed = el('textarea', 'rg-editor');
    ed.spellcheck = false;
    ed.setAttribute('aria-label', 'Bloque de funciones en FCL');
    det.appendChild(ed);
    var bCargar = boton('Cargar el FCL', function () { carga(true); }, 'demo-play');
    var pie = el('div', 'bz-fcl-pie'); pie.appendChild(bCargar);
    var aviso = el('span', 'bz-aviso'); pie.appendChild(aviso);
    det.appendChild(pie);
    marco.appendChild(det);
    var zonaE = el('div', 'bz-entradas'); marco.appendChild(zonaE);
    var zonaR = el('div', 'rg-tabla'); marco.appendChild(zonaR);
    var zonaS = el('div', 'bz-salidas'); marco.appendChild(zonaS);
    d.stage.appendChild(marco);

    var grupos = {};
    function ponTexto(v) { ed.value = FCL[v].src; ed.rows = 22; }

    function carga(desdeTexto) {
      try {
        fb = lee(ed.value);
        aviso.textContent = '';
        entradas = {};
        Object.keys(fb.entradas).forEach(function (n) {
          var u = fb.entradas[n].universo;
          var ini = FCL[actual] && FCL[actual].ini && FCL[actual].ini[n] != null && !desdeTexto ? FCL[actual].ini[n] : (u[0] + u[1]) / 2;
          entradas[n] = Math.min(u[1], Math.max(u[0], ini));
        });
        barrido = Object.keys(fb.entradas)[0];
        montaEntradas();
        sincroniza();
        pinta();
      } catch (e) {
        aviso.textContent = 'Error: ' + (e && e.message ? e.message : e);
        det.open = true;
        d.read.textContent = 'El FCL tiene un error: está debajo del editor.';
      }
    }
    function sincroniza() {
      grupos.and && grupos.and.pon(fb.and);
      grupos.act && grupos.act.pon(fb.act);
      grupos.accu && grupos.accu.pon(fb.accu || 'SUM');
      var m = fb.salidas[Object.keys(fb.salidas)[0]].metodo;
      grupos.met && grupos.met.pon(m);
    }
    function reescribe(clave, valor, enDefuzz) {
      var s = ed.value;
      if (enDefuzz) {
        if (/METHOD\s*:\s*\w+\s*;/i.test(s)) s = s.replace(/METHOD\s*:\s*\w+\s*;/gi, 'METHOD : ' + valor + ';');
        else s = s.replace(/END_DEFUZZIFY/gi, '   METHOD : ' + valor + ';\nEND_DEFUZZIFY');
      } else {
        var re = new RegExp('(^|\\n)(\\s*)' + clave + '\\s*:\\s*\\w+\\s*;', 'i');
        if (re.test(s)) s = s.replace(re, '$1$2' + clave + ' : ' + valor + ';');
        else s = s.replace(/(RULEBLOCK\s+\w+\s*\n)/i, '$1   ' + clave + ' : ' + valor + ';\n');
      }
      ed.value = s;
      var guardo = Object.assign({}, entradas);
      carga(true);
      Object.keys(guardo).forEach(function (k) { if (k in entradas) entradas[k] = guardo[k]; });
      montaEntradas(); pinta();
    }

    var lienzosE = {};
    function montaEntradas() {
      zonaE.innerHTML = '';
      lienzosE = {};
      Object.keys(fb.entradas).forEach(function (n, k) {
        var v = fb.entradas[n], u = v.universo;
        var caja = el('div', 'bz-entrada');
        var paso = (u[1] - u[0]) > 20 ? 1 : 0.1;
        var dz = deslizador(n, u[0], u[1], paso, entradas[n], function (x) { entradas[n] = x; pinta(); });
        caja.appendChild(dz);
        var L = lienzo(300, 104, { l: 24, r: 8, t: 20, b: 20 });
        L.svg.setAttribute('aria-label', 'Los términos de ' + n + ' y su valor actual.');
        caja.appendChild(L.svg);
        lienzosE[n] = L;
        zonaE.appendChild(caja);
      });
    }

    function textoCond(c) {
      if (c.op === 'is') return c.v + ' IS ' + (c.neg ? 'NOT ' : '') + c.t;
      if (c.op === 'not') return 'NOT (' + textoCond(c.a) + ')';
      var a = textoCond(c.a), b = textoCond(c.b);
      if (c.a.op !== 'is' && c.a.op !== 'not' && c.a.op !== c.op) a = '(' + a + ')';
      if (c.b.op !== 'is' && c.b.op !== 'not') b = '(' + b + ')';
      return a + ' ' + c.op.toUpperCase() + ' ' + b;
    }

    function pinta() {
      if (!fb) return;
      var r = evalua(fb, entradas);
      // entradas
      Object.keys(fb.entradas).forEach(function (n) {
        var v = fb.entradas[n], L = lienzosE[n], u = v.universo;
        L.svg.innerHTML = '';
        ejes(L, u);
        var x = entradas[n], px = L.px(x, u);
        v.ordenT.forEach(function (t, i) { curva(L, u, function (z) { return mu(v.terminos[t], z); }, 'bz-curva ' + COLORES[i % 5]); });
        L.svg.appendChild(sv('line', { x1: px, y1: L.py(0), x2: px, y2: L.py(1) - 2, class: 'bz-x' }));
        var lab = [];
        v.ordenT.forEach(function (t, i) {
          var g = r.grados[n][t];
          if (g > 0) L.svg.appendChild(sv('circle', { cx: px, cy: L.py(g), r: 3, class: 'bz-punto ' + COLORES[i % 5] }));
          lab.push(t + ' ' + f2(g));
        });
        L.svg.appendChild(sv('text', { x: L.W - L.m.r, y: 9, class: 'bz-n', style: 'text-anchor:end' }, lab.join(' · ')));
      });
      // reglas
      zonaR.innerHTML = '';
      var t = el('table', 'rg-pasos bz-reglas');
      var tr = el('tr');
      ['Regla', 'Si…', 'Entonces', 'Grado'].forEach(function (c) { var x = el('th', null, c); x.scope = 'col'; tr.appendChild(x); });
      var th = el('thead'); th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      r.reglas.forEach(function (rg) {
        var row = el('tr', rg.grado > 0 ? null : 'bz-apagada');
        row.appendChild(el('td', null, rg.r.n));
        row.appendChild(el('td', null, textoCond(rg.r.si)));
        row.appendChild(el('td', null, rg.r.entonces.map(function (c) { return c.v + ' IS ' + c.t; }).join(', ') + (rg.r.peso !== 1 ? ' WITH ' + rg.r.peso : '')));
        var c = el('td', 'bz-grado');
        var barraG = el('span', 'bz-barra'); barraG.style.width = (Math.min(1, rg.grado) * 3.5) + 'rem';
        c.appendChild(barraG); c.appendChild(el('b', null, f2(rg.grado)));
        row.appendChild(c);
        tb.appendChild(row);
      });
      t.appendChild(tb); zonaR.appendChild(t);
      // salidas
      zonaS.innerHTML = '';
      var lect = [];
      Object.keys(fb.salidas).forEach(function (n) {
        var v = fb.salidas[n], s = r.salidas[n], u = s.u;
        var top = 1;
        for (var i = 0; i < s.vals.length; i++) if (s.vals[i] > top) top = s.vals[i];
        var caja = el('div', 'bz-salida');
        var L = lienzo(520, 180, { l: 30, r: 12, t: 26, b: 24 });
        L.svg.setAttribute('aria-label', 'La salida ' + n + ': sus términos, lo que deja cada regla y el valor desdifuminado.');
        ejes(L, u, n + ' · ' + v.metodo, top);
        v.ordenT.forEach(function (tn, i) { curva(L, u, function (z) { return mu(v.terminos[tn], z); }, 'bz-curva bz-fina ' + COLORES[i % 5], top); });
        s.recortes.forEach(function (rc) { if (rc.grado > 0) area(L, u, rc.vals, 'bz-recorte ' + COLORES[v.ordenT.indexOf(rc.t) % 5], top); });
        area(L, u, s.vals, 'bz-agregado', top);
        if (!isNaN(s.valor)) {
          var px = L.px(s.valor, u);
          L.svg.appendChild(sv('line', { x1: px, y1: L.py(0) + 3, x2: px, y2: L.m.t - 2, class: 'bz-salida-x' }));
          L.svg.appendChild(sv('text', { x: px + 4, y: L.m.t + 8, class: 'bz-v bz-salida-t' }, fmt(s.valor, 2)));
        }
        caja.appendChild(L.svg);
        zonaS.appendChild(caja);
        lect.push(n + ' = ' + fmt(s.valor, 3));
      });
      // la curva de control: la primera salida frente a la entrada elegida
      var sal = Object.keys(fb.salidas)[0], vs = fb.salidas[sal], us = r.salidas[sal].u;
      var ue = fb.entradas[barrido].universo;
      var Lc = lienzo(520, 160, { l: 30, r: 12, t: 26, b: 24 });
      Lc.svg.setAttribute('aria-label', 'Cómo cambia ' + sal + ' al mover ' + barrido + ' de un extremo a otro, con las demás entradas fijas.');
      var top2 = us[1], bot2 = us[0];
      var d2 = '', N = 120, copia = Object.assign({}, entradas);
      for (var j = 0; j <= N; j++) {
        copia[barrido] = ue[0] + (ue[1] - ue[0]) * j / N;
        var val = evalua(fb, copia).salidas[sal].valor;
        if (isNaN(val)) val = bot2;
        var yy = (Lc.H - Lc.m.b) - (val - bot2) / (top2 - bot2) * (Lc.H - Lc.m.b - Lc.m.t);
        d2 += (j ? ' L' : 'M') + Lc.px(copia[barrido], ue).toFixed(1) + ' ' + yy.toFixed(1);
      }
      var g = sv('g', {});
      g.appendChild(sv('line', { x1: Lc.m.l, y1: Lc.H - Lc.m.b, x2: Lc.W - Lc.m.r, y2: Lc.H - Lc.m.b, class: 'bz-eje' }));
      g.appendChild(sv('line', { x1: Lc.m.l, y1: Lc.H - Lc.m.b, x2: Lc.m.l, y2: Lc.m.t, class: 'bz-eje' }));
      g.appendChild(sv('text', { x: Lc.m.l - 4, y: Lc.m.t + 3, class: 'bz-n', style: 'text-anchor:end' }, fmt(top2)));
      g.appendChild(sv('text', { x: Lc.m.l - 4, y: Lc.H - Lc.m.b + 3, class: 'bz-n', style: 'text-anchor:end' }, fmt(bot2)));
      for (var q = 0; q <= 5; q++) { var xx = ue[0] + (ue[1] - ue[0]) * q / 5; g.appendChild(sv('text', { x: Lc.px(xx, ue), y: Lc.H - Lc.m.b + 12, class: 'bz-n' }, fmt(Math.round(xx * 10) / 10))); }
      g.appendChild(sv('text', { x: Lc.W - Lc.m.r, y: Lc.m.t - 7, class: 'bz-n', style: 'text-anchor:end' }, sal + ' según ' + barrido + ', con lo demás fijo'));
      Lc.svg.appendChild(g);
      Lc.svg.appendChild(sv('path', { d: d2, class: 'bz-control' }));
      var vx = Lc.px(entradas[barrido], ue), vv = r.salidas[sal].valor;
      if (!isNaN(vv)) Lc.svg.appendChild(sv('circle', { cx: vx, cy: (Lc.H - Lc.m.b) - (vv - bot2) / (top2 - bot2) * (Lc.H - Lc.m.b - Lc.m.t), r: 3.6, class: 'bz-punto bz-res-p' }));
      var cajaC = el('div', 'bz-salida'); cajaC.appendChild(Lc.svg); zonaS.appendChild(cajaC);

      var activas = r.reglas.filter(function (x) { return x.grado > 0; }).length;
      d.read.textContent = activas + ' de ' + r.reglas.length + ' reglas activas. ' + lect.join(' · ') +
        (r.reglas.length && !activas ? ' (ninguna regla se cumple: sale el DEFAULT)' : '') + '.';
      if (grupos.barre) {
        grupos.barre.innerHTML = '';
        grupos.barre.appendChild(opciones('Curva según', Object.keys(fb.entradas).map(function (n) { return [n, n]; }), barrido, function (v) { barrido = v; pinta(); }));
      }
    }

    var b1 = barra('demo-bar-play');
    grupos.and = opciones('AND', [['MIN', 'MIN'], ['PROD', 'PROD']], 'MIN', function (v) { reescribe('AND', v); });
    grupos.act = opciones('ACT', [['MIN', 'MIN'], ['PROD', 'PROD']], 'MIN', function (v) { reescribe('ACT', v); });
    b1.appendChild(grupos.and); b1.appendChild(grupos.act);
    var b2 = barra('demo-bar-play');
    grupos.accu = opciones('ACCU', [['MAX', 'MAX'], ['SUM', 'SUM'], ['PROBOR', 'PROBOR']], 'MAX', function (v) { reescribe('ACCU', v); });
    grupos.met = opciones('METHOD', [['COG', 'COG'], ['COA', 'COA'], ['LM', 'LM'], ['RM', 'RM']], 'COG', function (v) { reescribe('METHOD', v, true); });
    b2.appendChild(grupos.accu); b2.appendChild(grupos.met);
    d.controls.appendChild(b1); d.controls.appendChild(b2);
    grupos.barre = barra(); d.controls.appendChild(grupos.barre);
    if (lista.length > 1) {
      var b3 = barra();
      b3.appendChild(opciones('Ejemplo', lista.map(function (p) { return [FCL[p].txt, p]; }), actual, function (v) { actual = v; ponTexto(v); carga(false); }));
      d.controls.appendChild(b3);
    }
    ed.addEventListener('input', function () { aviso.textContent = 'Has cambiado el FCL: pulsad "Cargar el FCL".'; });
    ponTexto(actual);
    carga(false);
  }

  var CREA = { variable: creaVariable, operaciones: creaOperaciones, banco: creaBanco };
  Array.prototype.forEach.call(document.querySelectorAll('[data-borroso]'), function (n) {
    var f = CREA[n.getAttribute('data-borroso')];
    if (!f) return;
    try { f(n); } catch (e) { if (window.console) console.error('borroso', n.getAttribute('data-borroso'), e); }
  });
})();
