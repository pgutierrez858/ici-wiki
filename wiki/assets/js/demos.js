/* Ejemplos interactivos de los apuntes de pathfinding.
 *
 * Tres formas de repartir el espacio sobre la MISMA escena editable: puntos de
 * ruta, rejilla y triangulación. El usuario coloca obstáculos, mueve la salida
 * y el destino, toca los parámetros de cada método y le da a calcular.
 *
 * Sin dependencias y sin build, como el resto del sitio. Si no hay JavaScript
 * el bloque conserva su aviso y la página se lee igual: los tres métodos están
 * explicados en el texto y en el pseudocódigo que acompaña a cada ejemplo.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 320, H = 200;          // el mundo, en unidades del viewBox
  var EPS = 1e-9;

  /* ============================ geometría ============================ */

  function pt(x, y) { return { x: x, y: y }; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  // Área con signo (fórmula del cordón). En coordenadas de pantalla, con la Y
  // hacia abajo, un polígono positivo se recorre en el sentido del reloj.
  function area(p) {
    var s = 0;
    for (var i = 0, n = p.length; i < n; i++) {
      var q = p[(i + 1) % n];
      s += p[i].x * q.y - q.x * p[i].y;
    }
    return s / 2;
  }

  function caja(p) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < p.length; i++) {
      if (p[i].x < x0) x0 = p[i].x;
      if (p[i].y < y0) y0 = p[i].y;
      if (p[i].x > x1) x1 = p[i].x;
      if (p[i].y > y1) y1 = p[i].y;
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  // De qué lado de a→b cae p. En pantalla, positivo = a la derecha.
  function lado(a, b, p) {
    return (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
  }

  function dentroPoligono(p, poly) {
    var dentro = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  }

  // ¿Se cruzan de verdad los segmentos ab y cd? Rozarse en un extremo no cuenta:
  // los puntos de ruta viven justo en las esquinas y se tocarían todo el rato.
  function cruzan(a, b, c, d) {
    var d1 = lado(c, d, a), d2 = lado(c, d, b), d3 = lado(a, b, c), d4 = lado(a, b, d);
    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
        ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
    return false;
  }

  // ¿El segmento ab atraviesa el polígono? Cruzar un lado cuenta; pasar rozando
  // un vértice no, pero sí quedarse con el punto medio dentro.
  function atraviesa(a, b, poly) {
    var c = caja(poly);
    var mnx = Math.min(a.x, b.x), mxx = Math.max(a.x, b.x);
    var mny = Math.min(a.y, b.y), mxy = Math.max(a.y, b.y);
    if (mxx < c.x0 - EPS || mnx > c.x1 + EPS || mxy < c.y0 - EPS || mny > c.y1 + EPS) return false;
    for (var i = 0; i < poly.length; i++) {
      if (cruzan(a, b, poly[i], poly[(i + 1) % poly.length])) return true;
    }
    return dentroPoligono(pt((a.x + b.x) / 2, (a.y + b.y) / 2), poly);
  }

  function visible(a, b, obstaculos) {
    for (var i = 0; i < obstaculos.length; i++) {
      if (atraviesa(a, b, obstaculos[i])) return false;
    }
    return true;
  }

  function libre(p, obstaculos, margen) {
    margen = margen || 0;
    if (p.x < margen || p.y < margen || p.x > W - margen || p.y > H - margen) return false;
    for (var i = 0; i < obstaculos.length; i++) {
      if (dentroPoligono(p, obstaculos[i])) return false;
      if (margen > 0 && distanciaABorde(p, obstaculos[i]) < margen) return false;
    }
    return true;
  }

  function distanciaAsegmento(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    if (l2 < EPS) return dist(p, a);
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  }

  function distanciaABorde(p, poly) {
    var m = Infinity;
    for (var i = 0; i < poly.length; i++) {
      m = Math.min(m, distanciaAsegmento(p, poly[i], poly[(i + 1) % poly.length]));
    }
    return m;
  }

  // ¿Se solapan una celda rectangular y un polígono?
  function solapaRect(poly, x, y, w, h) {
    var c = caja(poly);
    if (c.x1 <= x || c.x0 >= x + w || c.y1 <= y || c.y0 >= y + h) return false;
    var esq = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
    var i, j;
    for (i = 0; i < poly.length; i++) {
      if (poly[i].x > x && poly[i].x < x + w && poly[i].y > y && poly[i].y < y + h) return true;
    }
    for (i = 0; i < 4; i++) if (dentroPoligono(esq[i], poly)) return true;
    for (i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      for (j = 0; j < 4; j++) {
        if (cruzan(a, b, esq[j], esq[(j + 1) % 4])) return true;
      }
    }
    return false;
  }

  function solapanPoligonos(p, q) {
    var cp = caja(p), cq = caja(q);
    if (cp.x1 < cq.x0 || cp.x0 > cq.x1 || cp.y1 < cq.y0 || cp.y0 > cq.y1) return false;
    var i, j;
    for (i = 0; i < p.length; i++) {
      for (j = 0; j < q.length; j++) {
        if (cruzan(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
      }
    }
    for (i = 0; i < p.length; i++) if (dentroPoligono(p[i], q)) return true;
    for (i = 0; i < q.length; i++) if (dentroPoligono(q[i], p)) return true;
    return false;
  }

  /* ============================== formas ============================== */

  // Cada forma se genera centrada en (cx, cy) y con un tamaño en unidades del
  // mundo. Todas salen en el sentido del reloj en pantalla, que es el que
  // espera el triangulador.
  var FORMAS = {
    bloque: function (cx, cy, t) {
      var a = t * 0.62, b = t * 0.45;
      return [pt(cx - a, cy - b), pt(cx + a, cy - b), pt(cx + a, cy + b), pt(cx - a, cy + b)];
    },
    columna: function (cx, cy, t) {
      var p = [], n = 14, r = t * 0.5;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2;
        p.push(pt(cx + r * Math.cos(ang), cy + r * Math.sin(ang)));
      }
      return p;
    },
    cuna: function (cx, cy, t) {
      var r = t * 0.62;
      return [pt(cx, cy - r), pt(cx + r * 0.87, cy + r * 0.5), pt(cx - r * 0.87, cy + r * 0.5)];
    },
    esquina: function (cx, cy, t) {
      var a = t * 0.58, b = t * 0.22;
      return [pt(cx - a, cy - a), pt(cx + b, cy - a), pt(cx + b, cy - b),
              pt(cx + a, cy - b), pt(cx + a, cy + a), pt(cx - a, cy + a)];
    }
  };
  var NOMBRE_FORMA = { bloque: 'Bloque', columna: 'Columna', cuna: 'Cuña', esquina: 'Esquina' };

  function normaliza(poly) { return area(poly) < 0 ? poly.slice().reverse() : poly; }

  /* ============================== grafos ============================== */

  // Dijkstra sobre lista de adyacencia {v, coste}. Los grafos de aquí tienen
  // como mucho unos pocos miles de nodos, así que basta con buscar el mínimo a
  // pelo en cada vuelta.
  function dijkstra(ady, ini, fin) {
    var n = ady.length, d = new Float64Array(n), padre = new Int32Array(n), visto = new Uint8Array(n), i;
    for (i = 0; i < n; i++) { d[i] = Infinity; padre[i] = -1; }
    d[ini] = 0;
    for (;;) {
      var u = -1, mejor = Infinity;
      for (i = 0; i < n; i++) if (!visto[i] && d[i] < mejor) { mejor = d[i]; u = i; }
      if (u < 0 || u === fin) break;
      visto[u] = 1;
      for (i = 0; i < ady[u].length; i++) {
        var e = ady[u][i], nd = d[u] + e.coste;
        if (nd < d[e.v] - EPS) { d[e.v] = nd; padre[e.v] = u; }
      }
    }
    if (d[fin] === Infinity) return null;
    var camino = [], x = fin;
    while (x >= 0) { camino.unshift(x); x = padre[x]; }
    return { camino: camino, coste: d[fin] };
  }

  function largoDe(puntos) {
    var s = 0;
    for (var i = 1; i < puntos.length; i++) s += dist(puntos[i - 1], puntos[i]);
    return s;
  }

  /* ========================= 1 · puntos de ruta ========================= */

  // Los puntos automáticos salen del análisis del terreno: una esquina convexa
  // de un obstáculo, separada un margen hacia fuera para que quepa el personaje.
  function esquinas(obstaculos, margen) {
    var ps = [];
    for (var k = 0; k < obstaculos.length; k++) {
      var poly = obstaculos[k], n = poly.length;
      for (var i = 0; i < n; i++) {
        var a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
        if (lado(a, b, c) <= 0) continue;               // esquina cóncava: no interesa
        var u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
        var lu = Math.hypot(u.x, u.y) || 1, lv = Math.hypot(v.x, v.y) || 1;
        var nx = (u.y / lu + v.y / lv), ny = -(u.x / lu + v.x / lv);
        var ln = Math.hypot(nx, ny);
        if (ln < EPS) continue;
        var p = pt(b.x + (nx / ln) * margen, b.y + (ny / ln) * margen);
        if (libre(p, obstaculos, 1)) ps.push(p);
      }
    }
    return ps;
  }

  function redWaypoints(esc, par) {
    var puntos = (par.auto ? esquinas(esc.obstaculos, par.margen) : []).concat(esc.waypoints);
    var aristas = [], i, j;
    for (i = 0; i < puntos.length; i++) {
      for (j = i + 1; j < puntos.length; j++) {
        if (visible(puntos[i], puntos[j], esc.obstaculos)) aristas.push([i, j]);
      }
    }
    return { puntos: puntos, aristas: aristas };
  }

  function rutaWaypoints(esc, red) {
    var n = red.puntos.length;
    var nodos = red.puntos.concat([esc.a, esc.b]);
    var iA = n, iB = n + 1;
    var ady = [], i;
    for (i = 0; i < nodos.length; i++) ady.push([]);
    function une(u, v) {
      var c = dist(nodos[u], nodos[v]);
      ady[u].push({ v: v, coste: c });
      ady[v].push({ v: u, coste: c });
    }
    for (i = 0; i < red.aristas.length; i++) une(red.aristas[i][0], red.aristas[i][1]);
    // el NPC entra y sale del grafo por el punto visible más cercano
    for (i = 0; i < n; i++) {
      if (visible(esc.a, red.puntos[i], esc.obstaculos)) une(iA, i);
      if (visible(esc.b, red.puntos[i], esc.obstaculos)) une(iB, i);
    }
    if (visible(esc.a, esc.b, esc.obstaculos)) une(iA, iB);
    var r = dijkstra(ady, iA, iB);
    if (!r) return null;
    return r.camino.map(function (k) { return nodos[k]; });
  }

  /* ============================= 2 · rejilla ============================= */

  function rejilla(esc, lado_) {
    var cols = Math.ceil(W / lado_), filas = Math.ceil(H / lado_);
    var bloqueada = new Uint8Array(cols * filas);
    for (var f = 0; f < filas; f++) {
      for (var c = 0; c < cols; c++) {
        var x = c * lado_, y = f * lado_;
        var w = Math.min(lado_, W - x), h = Math.min(lado_, H - y);
        for (var k = 0; k < esc.obstaculos.length; k++) {
          if (solapaRect(esc.obstaculos[k], x, y, w, h)) { bloqueada[f * cols + c] = 1; break; }
        }
      }
    }
    return { cols: cols, filas: filas, lado: lado_, bloqueada: bloqueada };
  }

  function celdaDe(g, p) {
    var c = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.lado)));
    var f = Math.min(g.filas - 1, Math.max(0, Math.floor(p.y / g.lado)));
    return f * g.cols + c;
  }

  function centroCelda(g, k) {
    var c = k % g.cols, f = (k - c) / g.cols;
    var x = c * g.lado, y = f * g.lado;
    return pt(x + Math.min(g.lado, W - x) / 2, y + Math.min(g.lado, H - y) / 2);
  }

  var V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var V8 = V4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);

  // Además del camino devuelve la TRAZA: una entrada por vuelta del bucle, con
  // la celda que se desencola y las que entran en la cola en esa misma vuelta.
  // Con eso y el orden en que se han ido encolando se puede reconstruir el
  // estado exacto de la cola y de los visitados en cualquier paso, sin guardar
  // una copia de las dos estructuras por paso.
  function rutaRejilla(g, esc, vecindad) {
    var ini = celdaDe(g, esc.a), fin = celdaDe(g, esc.b);
    if (g.bloqueada[ini] || g.bloqueada[fin]) {
      return { camino: null, motivo: g.bloqueada[ini] ? 'la salida cae dentro de un obstáculo'
                                                      : 'el destino cae dentro de un obstáculo' };
    }
    var V = vecindad === 8 ? V8 : V4;
    var n = g.cols * g.filas, padre = new Int32Array(n).fill(-1), visto = new Uint8Array(n);
    var cola = [ini]; visto[ini] = 1;         // `cola` es a la vez el orden de encolado
    var cab = 0, traza = [];
    while (cab < cola.length) {
      var k = cola[cab++], nuevas = [];
      if (k !== fin) {
        var c = k % g.cols, f = (k - c) / g.cols;
        for (var i = 0; i < V.length; i++) {
          var c2 = c + V[i][0], f2 = f + V[i][1];
          if (c2 < 0 || f2 < 0 || c2 >= g.cols || f2 >= g.filas) continue;
          var k2 = f2 * g.cols + c2;
          if (visto[k2] || g.bloqueada[k2]) continue;
          // en diagonal no se cuela por la rendija entre dos esquinas
          if (V[i][0] && V[i][1] &&
              (g.bloqueada[f * g.cols + c2] || g.bloqueada[f2 * g.cols + c])) continue;
          visto[k2] = 1; padre[k2] = k; cola.push(k2); nuevas.push(k2);
        }
      }
      traza.push({ sacada: k, nuevas: nuevas, total: cola.length });
      if (k === fin) break;
    }
    var base = { traza: traza, orden: cola, ini: ini, fin: fin, vistas: cola.length };
    if (!visto[fin]) {
      base.camino = null;
      base.motivo = 'no hay camino: la rejilla ha cerrado el paso';
      return base;
    }
    var celdas = [], x = fin;
    while (x >= 0) { celdas.unshift(x); x = padre[x]; }
    var pts = celdas.map(function (k) { return centroCelda(g, k); });
    pts.unshift(esc.a); pts.push(esc.b);
    base.camino = pts; base.celdas = celdas;
    return base;
  }

  // El rectángulo que ocupa una celda, recortado en el borde del lienzo.
  function rectCelda(g, k) {
    var c = k % g.cols, f = (k - c) / g.cols;
    var x = c * g.lado, y = f * g.lado;
    return { x: x, y: y, w: Math.min(g.lado, W - x), h: Math.min(g.lado, H - y), c: c, f: f };
  }

  /* =========================== 3 · triangulación =========================== */

  // El suelo transitable es el rectángulo menos los obstáculos, o sea un
  // polígono con agujeros. Antes de triangular hay que coserlo en uno solo:
  // por cada agujero se abre un puente hasta el contorno (Eberly).
  function cosePoligono(obstaculos) {
    var fuera = [pt(0, 0), pt(W, 0), pt(W, H), pt(0, H)];        // sentido del reloj
    fuera = normaliza(fuera);
    var agujeros = obstaculos.map(function (o) {
      var p = normaliza(o.slice());
      return p.slice().reverse();                                // al revés que el contorno
    });
    agujeros.sort(function (a, b) { return caja(b).x1 - caja(a).x1; });

    for (var h = 0; h < agujeros.length; h++) {
      var ag = agujeros[h];
      var iM = 0;
      for (var i = 1; i < ag.length; i++) if (ag[i].x > ag[iM].x) iM = i;
      var M = ag[iM];

      // rayo hacia la derecha desde M: primer corte con el contorno
      var mejorX = Infinity, iAr = -1;
      for (i = 0; i < fuera.length; i++) {
        var a = fuera[i], b = fuera[(i + 1) % fuera.length];
        if ((a.y > M.y) === (b.y > M.y)) continue;
        var t = (M.y - a.y) / (b.y - a.y);
        var x = a.x + t * (b.x - a.x);
        if (x > M.x - EPS && x < mejorX) { mejorX = x; iAr = i; }
      }
      if (iAr < 0) return null;

      // El corte es el PRIMER trozo de contorno que encuentra el rayo, así que
      // el tramo M-I no cruza nada: sirve de puente tal cual. Se mete I como
      // vértice nuevo, y así cada agujero cose por su sitio en vez de tirar
      // todos a la misma esquina.
      var I = pt(mejorX, M.y);
      var iSig = (iAr + 1) % fuera.length, iP;
      if (mismo(I, fuera[iAr])) iP = iAr;
      else if (mismo(I, fuera[iSig])) iP = iSig;
      else { fuera.splice(iAr + 1, 0, I); iP = iAr + 1; }

      var puente = [];
      puente.push(fuera[iP]);
      for (i = 0; i <= ag.length; i++) puente.push(ag[(iM + i) % ag.length]);
      puente.push(fuera[iP]);
      fuera = fuera.slice(0, iP).concat(puente, fuera.slice(iP + 1));
    }
    return fuera;
  }

  function enTriangulo(p, a, b, c) {
    var d1 = lado(a, b, p), d2 = lado(b, c, p), d3 = lado(c, a, p);
    var neg = (d1 < -EPS) || (d2 < -EPS) || (d3 < -EPS);
    var pos = (d1 > EPS) || (d2 > EPS) || (d3 > EPS);
    return !(neg && pos);
  }

  // Recorte de orejas. Devuelve triángulos como tríos de índices sobre `p`.
  function orejas(p) {
    var idx = [], i;
    for (i = 0; i < p.length; i++) idx.push(i);
    if (area(p) < 0) idx.reverse();
    var tris = [], guarda = 0, tope = p.length * p.length + 100;
    while (idx.length > 3 && guarda++ < tope) {
      var cortada = false;
      for (i = 0; i < idx.length; i++) {
        var ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        var a = p[ia], b = p[ib], c = p[ic];
        if (lado(a, b, c) <= EPS) continue;                       // cóncava o plana
        var limpia = true;
        for (var j = 0; j < idx.length; j++) {
          var k = idx[j];
          if (k === ia || k === ib || k === ic) continue;
          var q = p[k];
          // un puente repite vértices: el mismo punto con otro índice no estorba
          if (mismo(q, a) || mismo(q, b) || mismo(q, c)) continue;
          var qa = p[idx[(j + idx.length - 1) % idx.length]];
          var qc = p[idx[(j + 1) % idx.length]];
          if (lado(qa, q, qc) > EPS) continue;                    // convexa: no estorba
          if (enTriangulo(q, a, b, c)) { limpia = false; break; }
        }
        if (!limpia) continue;
        tris.push([ia, ib, ic]);
        idx.splice(i, 1);
        cortada = true;
        break;
      }
      if (cortada) continue;

      // No hay ninguna oreja: el anillo trae vértices repetidos o en línea
      // recta, que es lo que pasa cuando dos obstáculos están alineados y el
      // puente cae pegado al de al lado. Se corta uno igual, aunque el
      // triángulo salga sin área: emitirlo en vez de borrarlo es lo que
      // mantiene emparejadas todas las aristas, y sin eso los sectores dejan
      // de reconocer a sus vecinos.
      var sobra = -1;
      for (i = 0; i < idx.length; i++) {
        var pa = p[idx[(i + idx.length - 1) % idx.length]];
        var pb = p[idx[i]];
        var pc = p[idx[(i + 1) % idx.length]];
        if (mismo(pa, pb) || Math.abs(lado(pa, pb, pc)) <= 1e-6) { sobra = i; break; }
      }
      if (sobra < 0) break;     // escena degenerada de verdad: se sale con lo que haya
      tris.push([idx[(sobra + idx.length - 1) % idx.length], idx[sobra],
                 idx[(sobra + 1) % idx.length]]);
      idx.splice(sobra, 1);
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }

  // Coser los agujeros repite vértices: el puente se recorre en los dos sentidos,
  // así que el mismo punto acaba con dos índices. Para la adyacencia eso es
  // fatal (dos sectores pegados dejarían de parecer vecinos), y además el
  // puente no es una pared: se cruza como cualquier otro portal. Así que en
  // cuanto están los triángulos, se funden los índices que caen en el mismo
  // sitio y a partir de ahí todo habla de posiciones.
  function canoniza(pts, tris) {
    var mapa = {}, nuevos = [], indice = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) {
      var clave = Math.round(pts[i].x * 1000) + ':' + Math.round(pts[i].y * 1000);
      if (mapa[clave] === undefined) { mapa[clave] = nuevos.length; nuevos.push(pts[i]); }
      indice[i] = mapa[clave];
    }
    var limpios = [];
    for (i = 0; i < tris.length; i++) {
      var t = [indice[tris[i][0]], indice[tris[i][1]], indice[tris[i][2]]];
      if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue;   // degenerado
      limpios.push(t);
    }
    return { pts: nuevos, tris: limpios };
  }

  // Dos sectores son vecinos si comparten exactamente dos vértices seguidos.
  function vecinos(sectores) {
    var mapa = {}, ady = sectores.map(function () { return []; });
    sectores.forEach(function (s, si) {
      for (var i = 0; i < s.length; i++) {
        var u = s[i], v = s[(i + 1) % s.length];
        var clave = Math.min(u, v) + ':' + Math.max(u, v);
        if (mapa[clave] === undefined) mapa[clave] = [];
        mapa[clave].push({ s: si, u: u, v: v });
      }
    });
    var portales = [];
    Object.keys(mapa).forEach(function (clave) {
      var l = mapa[clave];
      if (l.length !== 2) return;
      var par = clave.split(':').map(Number);
      // Cada vecino se guarda con el lado tal como lo recorre EL SECTOR QUE SE
      // DEJA. Los sectores van en el sentido del reloj en pantalla, así que su
      // interior queda a la derecha del lado: al cruzarlo se sale hacia la
      // izquierda, y entonces el primer vértice del lado es la izquierda de la
      // marcha y el segundo la derecha. Sacarlo de aquí y no de la línea entre
      // los dos centros es lo que aguanta cuando el sector es largo y estrecho.
      ady[l[0].s].push({ v: l[1].s, arista: par, izq: l[0].u, der: l[0].v });
      ady[l[1].s].push({ v: l[0].s, arista: par, izq: l[1].u, der: l[1].v });
      portales.push(par);
    });
    return { ady: ady, portales: portales };
  }

  // Hertel-Mehlhorn: fundir sectores vecinos mientras el resultado siga siendo
  // convexo. De triángulos salen los polígonos grandes de una malla de verdad.
  function fundeSectores(pts, tris) {
    var secs = tris.map(function (t) { return t.slice(); });
    var cambio = true, vueltas = 0;
    while (cambio && vueltas++ < 40) {
      cambio = false;
      var v = vecinos(secs);
      for (var i = 0; i < secs.length && !cambio; i++) {
        for (var k = 0; k < v.ady[i].length; k++) {
          var j = v.ady[i][k].v;
          if (j <= i) continue;
          var u = fusiona(secs[i], secs[j], v.ady[i][k].arista);
          if (u && esConvexo(pts, u)) {
            secs[i] = u;
            secs.splice(j, 1);
            cambio = true;
            break;
          }
        }
      }
    }
    return secs;
  }

  function fusiona(sa, sb, arista) {
    var x = arista[0], y = arista[1];
    var ia = sa.indexOf(x), ib = sa.indexOf(y);
    if (ia < 0 || ib < 0) return null;
    // el lado compartido, recorrido en el sentido de sa
    var desde = ((ia + 1) % sa.length === ib) ? x : y;
    var hasta = (desde === x) ? y : x;
    var ja = sb.indexOf(hasta), jb = sb.indexOf(desde);
    if (ja < 0 || jb < 0) return null;
    if ((ja + 1) % sb.length !== jb) return null;                 // orientaciones incompatibles
    var out = [], i;
    var pa = sa.indexOf(hasta);
    for (i = 0; i < sa.length; i++) out.push(sa[(pa + i) % sa.length]);
    var pb = sb.indexOf(desde);
    for (i = 1; i < sb.length - 1; i++) out.push(sb[(pb + i) % sb.length]);
    for (i = 0; i < out.length; i++) {
      if (out.indexOf(out[i]) !== i) return null;                 // se repetiría un vértice
    }
    return out;
  }

  function esConvexo(pts, s) {
    for (var i = 0; i < s.length; i++) {
      var a = pts[s[(i + s.length - 1) % s.length]], b = pts[s[i]], c = pts[s[(i + 1) % s.length]];
      if (lado(a, b, c) < -EPS) return false;
    }
    return true;
  }

  function centro(pts, s) {
    var x = 0, y = 0;
    for (var i = 0; i < s.length; i++) { x += pts[s[i]].x; y += pts[s[i]].y; }
    return pt(x / s.length, y / s.length);
  }

  function sectorDe(pts, secs, p) {
    for (var i = 0; i < secs.length; i++) {
      var poly = secs[i].map(function (k) { return pts[k]; });
      if (dentroPoligono(p, poly)) return i;
    }
    var mejor = -1, d = Infinity;
    for (i = 0; i < secs.length; i++) {
      var c = centro(pts, secs[i]), dd = dist(p, c);
      if (dd < d) { d = dd; mejor = i; }
    }
    return mejor;
  }

  function rutaSectores(pts, secs, esc) {
    var v = vecinos(secs);
    var ini = sectorDe(pts, secs, esc.a), fin = sectorDe(pts, secs, esc.b);
    if (ini < 0 || fin < 0) return null;
    var ady = v.ady.map(function (l, i) {
      var ci = centro(pts, secs[i]);
      return l.map(function (e) { return { v: e.v, coste: dist(ci, centro(pts, secs[e.v])) }; });
    });
    var r = dijkstra(ady, ini, fin);
    if (!r) return null;

    // los portales del camino, cada uno con su extremo izquierdo y su derecho
    var portales = [], i;
    for (i = 0; i + 1 < r.camino.length; i++) {
      var a = r.camino[i], b = r.camino[i + 1], paso = null;
      for (var k = 0; k < v.ady[a].length; k++) if (v.ady[a][k].v === b) paso = v.ady[a][k];
      if (!paso) return null;
      portales.push([pts[paso.izq], pts[paso.der]]);
    }
    return { sectores: r.camino, portales: portales };
  }

  // Tirar de la cuerda (simple stupid funnel): el camino recto que cabe por
  // todos los portales. Es lo que separa una ruta de malla de una ruta de raíl.
  function tiraDeLaCuerda(a, b, portales) {
    var p = [[a, a]].concat(portales, [[b, b]]);
    var salida = [a];
    var vertice = a, izq = a, der = a, iV = 0, iI = 0, iD = 0;

    for (var i = 1; i < p.length; i++) {
      var nIzq = p[i][0], nDer = p[i][1];

      if (lado(vertice, der, nDer) <= EPS) {
        if (mismo(vertice, der) || lado(vertice, izq, nDer) > EPS) {
          der = nDer; iD = i;
        } else {
          salida.push(izq);
          vertice = izq; iV = iI;
          izq = vertice; der = vertice; iI = iV; iD = iV;
          i = iV;
          continue;
        }
      }
      if (lado(vertice, izq, nIzq) >= -EPS) {
        if (mismo(vertice, izq) || lado(vertice, der, nIzq) < -EPS) {
          izq = nIzq; iI = i;
        } else {
          salida.push(der);
          vertice = der; iV = iD;
          izq = vertice; der = vertice; iI = iV; iD = iV;
          i = iV;
          continue;
        }
      }
    }
    if (!mismo(salida[salida.length - 1], b)) salida.push(b);
    return salida;
  }

  function mismo(a, b) { return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6; }

  function porLosPortales(a, b, portales) {
    var p = [a];
    for (var i = 0; i < portales.length; i++) {
      p.push(pt((portales[i][0].x + portales[i][1].x) / 2, (portales[i][0].y + portales[i][1].y) / 2));
    }
    p.push(b);
    return p;
  }

  /* ============================== dibujo ============================== */

  function svgEl(t, at) {
    var e = document.createElementNS(NS, t);
    for (var k in at) if (at.hasOwnProperty(k)) e.setAttribute(k, at[k]);
    return e;
  }
  function el(t, cls, txt) {
    var e = document.createElement(t);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function ruta(ps) {
    return ps.map(function (p, i) {
      return (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    }).join(' ');
  }
  function cerrada(ps) { return ruta(ps) + ' Z'; }

  function marcaSalida(g, p) {
    var w = svgEl('g', { transform: 'translate(' + p.x + ' ' + p.y + ') scale(0.55)' });
    w.appendChild(svgEl('path', { d: 'M0 0 L11.26 -6.5 A13 13 0 1 0 11.26 6.5 Z', class: 'dm-a' }));
    g.appendChild(w);
  }
  function marcaDestino(g, p) {
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 6.5, class: 'dm-b' }));
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.4, class: 'dm-b2' }));
  }

  /* ====================== 4 · anchura y profundidad ====================== */

  // Un anillo con dos ramales de muy distinta longitud entre la salida y el
  // destino, más dos callejones sin salida por el lado largo. La geometría no
  // pinta nada en la búsqueda, pero elegida así se ve de un vistazo la
  // diferencia: la anchura llega a D en tres aristas, y la profundidad se va
  // por el lado de abajo, se mete en los dos callejones y llega en nueve.
  var GRAFO = {
    nodos: [ pt(40, 96),  pt(63, 64),  pt(120, 42), pt(200, 42),
             pt(66, 142), pt(110, 156), pt(170, 162), pt(228, 151),
             pt(262, 131), pt(278, 105), pt(271, 79), pt(243, 56),
             pt(150, 108), pt(208, 100) ],
    aristas: [[0,1],[1,2],[2,3],
              [0,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,3],
              [6,12],[7,13]],
    a: 0, b: 3
  };

  // El mismo tipo de grafo, pero con un coste por arista. Elegido para que se
  // vean las tres cosas que pasan en Dijkstra y en la anchura no: una g que
  // mejora después de estar puesta (D baja de 9 a 5, y G de 14 a 10 y a 8),
  // una relajación que se rechaza porque no mejora (H desde F), y una entrada
  // repetida en la cola que se descarta al salir (D con g = 9).
  var RED = {
    nodos: [ pt(32, 100), pt(100, 42), pt(100, 158), pt(175, 100), pt(178, 32),
             pt(178, 168), pt(252, 60), pt(252, 145), pt(300, 102) ],
    aristas: [[0,1,2],[0,2,4],[1,3,7],[1,4,2],[1,6,12],[2,3,1],[2,5,3],
              [3,6,3],[3,7,3],[4,6,6],[5,7,2],[6,8,4],[7,8,3]],
    a: 0, b: 8
  };

  function nombreNodo(i) {
    return i < 26 ? String.fromCharCode(65 + i) : 'N' + i;
  }

  // Una retícula de 5 x 4 con un tabique entre la tercera y la cuarta columna
  // que sólo deja pasar por abajo. Los costes son la longitud de cada arista,
  // así que la distancia en línea recta al destino sirve de heurística y es
  // admisible por construcción: redondeando los costes hacia arriba y la
  // heurística hacia abajo, nunca puede sobreestimar.
  var ASTAR = (function () {
    var COLS = 5, FILAS = 5, nodos = [], aristas = [], i, j;
    var id = function (c, f) { return f * COLS + c; };
    for (j = 0; j < FILAS; j++) {
      for (i = 0; i < COLS; i++) nodos.push(pt(34 + i * 63, 22 + j * 36));
    }
    // El tercer número de cada arista es un multiplicador de coste: 1 es
    // terreno normal y 3 es terreno lento. Las dos filas de abajo son lentas,
    // y son justamente por donde tira la heurística, que apunta al destino en
    // línea recta. Así el camino que «parece» directo es el caro.
    // El tercer número de cada arista es un multiplicador de coste: 1 es terreno
    // normal y 4, terreno lento. Sólo se embarra la fila de abajo, que es
    // precisamente por donde tira la heurística: en línea recta de una esquina
    // a la otra. Así el camino que «parece» directo es el caro, y el resto del
    // grafo conserva costes iguales a la distancia, que es lo que mantiene la
    // heurística apretada y hace que se note lo que se ahorra de mirar.
    for (j = 0; j < FILAS; j++) {
      for (i = 0; i < COLS; i++) {
        if (i + 1 < COLS) aristas.push([id(i, j), id(i + 1, j), j === FILAS - 1 ? 4 : 1]);
        if (j + 1 < FILAS) aristas.push([id(i, j), id(i, j + 1), 1]);
      }
    }
    // Y un atajo de una esquina a otra: va derecho al destino, así que la
    // heurística lo adora, pero cuesta más que dar el rodeo por arriba. Es la
    // trampa que hace falta para que se vea que con la h inflada A* deja de
    // encontrar el mejor camino, no sólo de garantizarlo.
    aristas.push([id(0, FILAS - 1), id(COLS - 1, FILAS - 1), 1.5]);
    // salida y destino abajo, en las dos esquinas: así todo lo de arriba queda
    // lejos del destino y se ve lo que la heurística se ahorra mirar
    return { nodos: nodos, aristas: aristas, a: id(0, FILAS - 1), b: id(COLS - 1, FILAS - 1) };
  })();

  function costeArista(e, modo) { return modo === 'uno' ? 1 : (e[2] == null ? 1 : e[2]); }

  // Búsqueda con coste, guardando la traza. Es la misma para el coste uniforme
  // y para A*: lo único que cambia es la h. Con h = 0 la cola se ordena por g y
  // sale Dijkstra; con h = distancia al destino, sale A*. Cada vuelta anota qué
  // nodo se cierra y qué le pasa a la g de cada vecino: si mejora se relaja y
  // el nodo vuelve a entrar en la cola; si no, se deja constancia igual, que es
  // justo lo que hay que ver.
  function busquedaCoste(esc, coste, h) {
    var N = esc.nodos.length, ini = esc.a, fin = esc.b;
    if (ini == null || fin == null || ini >= N || fin >= N) return null;

    var vec = esc.nodos.map(function () { return []; });
    esc.aristas.forEach(function (e) {
      var c = coste(e);
      vec[e[0]].push({ v: e[1], c: c });
      vec[e[1]].push({ v: e[0], c: c });
    });
    vec.forEach(function (l) { l.sort(function (x, y) { return x.v - y.v; }); });

    var g = new Array(N), hs = new Array(N), cerrado = new Uint8Array(N), padre = new Int32Array(N);
    for (var i = 0; i < N; i++) { g[i] = Infinity; padre[i] = -1; hs[i] = h(i); }
    g[ini] = 0;

    var frontera = [{ n: ini, g: 0, f: hs[ini] }], traza = [], guarda = 0, hallado = false;
    while (frontera.length && guarda++ < 6000) {
      var mejor = 0;
      for (i = 1; i < frontera.length; i++) if (frontera[i].f < frontera[mejor].f) mejor = i;
      var e2 = frontera.splice(mejor, 1)[0], k = e2.n;

      if (cerrado[k]) {
        traza.push({ sacado: k, gSacado: e2.g, fSacado: e2.f, repetido: true, relaj: [],
                     frontera: frontera.slice(), g: g.slice(),
                     cerrado: cerrado.slice(), padre: padre.slice() });
        continue;
      }
      cerrado[k] = 1;

      var relaj = [];
      if (k !== fin) {
        for (i = 0; i < vec[k].length; i++) {
          var v = vec[k][i].v;
          if (cerrado[v]) continue;
          var gNuevo = g[k] + vec[k][i].c;
          var antes = g[v];
          if (gNuevo < antes) {
            g[v] = gNuevo; padre[v] = k;
            frontera.push({ n: v, g: gNuevo, f: gNuevo + hs[v] });
            relaj.push({ v: v, antes: antes, ahora: gNuevo, mejora: true });
          } else {
            relaj.push({ v: v, antes: antes, ahora: gNuevo, mejora: false });
          }
        }
      }
      traza.push({ sacado: k, gSacado: e2.g, fSacado: e2.f, repetido: false, relaj: relaj,
                   frontera: frontera.slice(), g: g.slice(),
                   cerrado: cerrado.slice(), padre: padre.slice() });
      if (k === fin) { hallado = true; break; }
    }

    var cerrados = 0;
    for (i = 0; i < N; i++) if (cerrado[i]) cerrados++;

    var camino = null;
    if (hallado) {
      camino = [];
      var x = fin;
      while (x >= 0) { camino.unshift(x); x = padre[x]; }
    }
    return { traza: traza, camino: camino, coste: hallado ? g[fin] : null, h: hs, cerrados: cerrados };
  }

  function adyacencia(esc) {
    var ady = esc.nodos.map(function () { return []; });
    esc.aristas.forEach(function (e) {
      if (ady[e[0]].indexOf(e[1]) < 0) ady[e[0]].push(e[1]);
      if (ady[e[1]].indexOf(e[0]) < 0) ady[e[1]].push(e[0]);
    });
    // se exploran en orden de vecino, para que el recorrido sea reproducible
    ady.forEach(function (l) { l.sort(function (x, y) { return x - y; }); });
    return ady;
  }

  // El esquema general del tema, con la ÚNICA diferencia entre los dos métodos:
  // de qué punta de la frontera se saca. Y con la política de marcado que cada
  // uno usa de verdad: la anchura marca al encolar, porque así el primer camino
  // que encuentra es el más corto; la profundidad marca al sacar, y por eso su
  // pila puede llevar repetidos.
  function busquedaCiega(esc, modo) {
    var N = esc.nodos.length, ini = esc.a, fin = esc.b;
    if (ini == null || fin == null || ini >= N || fin >= N) return null;
    var ady = adyacencia(esc);
    var visto = new Uint8Array(N), padre = new Int32Array(N);
    for (var i = 0; i < N; i++) padre[i] = -1;

    var frontera = [{ n: ini, p: -1 }];
    if (modo === 'anchura') visto[ini] = 1;

    var traza = [], guarda = 0, hallado = false;
    while (frontera.length && guarda++ < 4000) {
      var e = (modo === 'anchura') ? frontera.shift() : frontera.pop();
      var k = e.n, repetido = false, nuevos = [];

      if (modo === 'profundidad' && visto[k]) repetido = true;
      else { visto[k] = 1; padre[k] = e.p; }

      if (!repetido && k !== fin) {
        for (i = 0; i < ady[k].length; i++) {
          var v = ady[k][i];
          if (visto[v]) continue;
          if (modo === 'anchura') visto[v] = 1;
          frontera.push({ n: v, p: k });
          nuevos.push(v);
        }
      }
      traza.push({
        sacado: k, repetido: repetido, nuevos: nuevos,
        frontera: frontera.map(function (x) { return x.n; }),
        visto: visto.slice(), padre: padre.slice()
      });
      if (!repetido && k === fin) { hallado = true; break; }
    }

    var camino = null;
    if (hallado) {
      camino = [];
      var x = fin;
      while (x >= 0) { camino.unshift(x); x = padre[x]; }
    }
    return { traza: traza, camino: camino, modo: modo };
  }

  /* ===================== 5 · partir y buscar, juntos ===================== */

  // Las tres particiones dan lo mismo: un grafo con posiciones. A partir de ahí
  // los cuatro algoritmos son intercambiables, que es justo lo que dice la
  // sección 1: representar el espacio y buscar en él son dos problemas
  // distintos. El coste de una arista es la distancia entre sus dos nodos, así
  // que la distancia en línea recta al destino sirve de heurística admisible
  // en las tres, por la desigualdad triangular.
  function construyeRed(esc, par) {
    if (par.particion === 'rejilla') {
      var g = rejilla(esc, par.lado);
      var nodos = [], indice = new Int32Array(g.cols * g.filas), k;
      for (k = 0; k < indice.length; k++) indice[k] = -1;
      for (k = 0; k < g.cols * g.filas; k++) {
        if (g.bloqueada[k]) continue;
        indice[k] = nodos.length;
        nodos.push(centroCelda(g, k));
      }
      var aristas = [];
      for (var f = 0; f < g.filas; f++) {
        for (var c = 0; c < g.cols; c++) {
          var kk = f * g.cols + c;
          if (indice[kk] < 0) continue;
          if (c + 1 < g.cols && indice[kk + 1] >= 0) aristas.push([indice[kk], indice[kk + 1]]);
          if (f + 1 < g.filas && indice[kk + g.cols] >= 0) aristas.push([indice[kk], indice[kk + g.cols]]);
        }
      }
      var ia = indice[celdaDe(g, esc.a)], ib = indice[celdaDe(g, esc.b)];
      if (ia < 0 || ib < 0) return { falla: ia < 0 ? 'la salida cae dentro de un obstáculo'
                                                  : 'el destino cae dentro de un obstáculo' };
      return { red: { nodos: nodos, aristas: aristas, a: ia, b: ib }, grid: g };
    }

    if (par.particion === 'malla') {
      var cosido = esc.obstaculos.length ? cosePoligono(esc.obstaculos)
                                         : [pt(0, 0), pt(W, 0), pt(W, H), pt(0, H)];
      if (!cosido) return { falla: 'esta escena no se ha podido triangular' };
      var cc = canoniza(cosido, orejas(cosido));
      var secs = par.fundir ? fundeSectores(cc.pts, cc.tris) : cc.tris;
      var v = vecinos(secs);
      var centros = secs.map(function (sec) { return centro(cc.pts, sec); });
      var nds = centros.slice(), ars = [];
      v.ady.forEach(function (l, i) {
        l.forEach(function (e) { if (e.v > i) ars.push([i, e.v]); });
      });
      var sa = sectorDe(cc.pts, secs, esc.a), sb = sectorDe(cc.pts, secs, esc.b);
      if (sa < 0 || sb < 0) return { falla: 'la salida o el destino se han quedado fuera de la malla' };
      var iA = nds.length; nds.push(esc.a); ars.push([iA, sa]);
      var iB = nds.length; nds.push(esc.b); ars.push([iB, sb]);
      return { red: { nodos: nds, aristas: ars, a: iA, b: iB },
               pts: cc.pts, secs: secs, portales: v.portales };
    }

    var red = redWaypoints(esc, par);
    var ns = red.puntos.slice(), as = red.aristas.map(function (e) { return [e[0], e[1]]; });
    var jA = ns.length; ns.push(esc.a);
    var jB = ns.length; ns.push(esc.b);
    for (var i = 0; i < red.puntos.length; i++) {
      if (visible(esc.a, red.puntos[i], esc.obstaculos)) as.push([jA, i]);
      if (visible(esc.b, red.puntos[i], esc.obstaculos)) as.push([jB, i]);
    }
    if (visible(esc.a, esc.b, esc.obstaculos)) as.push([jA, jB]);
    return { red: { nodos: ns, aristas: as, a: jA, b: jB }, wp: red };
  }

  var NOMBRE_PARTICION = { waypoints: 'puntos de ruta', rejilla: 'rejilla', malla: 'triangulación' };
  var NOMBRE_ALGORITMO = { anchura: 'anchura', profundidad: 'profundidad',
                           coste: 'coste uniforme', astar: 'A*' };

  /* ============================ el ejemplo ============================ */

  var PRESET = [
    FORMAS.bloque(96, 58, 72),
    FORMAS.columna(198, 150, 74),
    FORMAS.esquina(258, 58, 64)
  ].map(normaliza);

  var HERRAMIENTAS = [
    { id: 'obstaculo', txt: 'Obstáculo',     escena: true },
    { id: 'punto',     txt: 'Punto de ruta', solo: 'waypoints' },
    { id: 'nodo',      txt: 'Nodo',          red: true },
    { id: 'arista',    txt: 'Arista',        red: true },
    { id: 'coste',     txt: 'Coste',         conCoste: true },
    { id: 'mover',     txt: 'Mover',         solo: 'astar' },
    { id: 'a',         txt: 'Salida A' },
    { id: 'b',         txt: 'Destino B' },
    { id: 'quitar',    txt: 'Quitar' }
  ];

  function copiaRed(base) {
    return {
      nodos: base.nodos.map(function (p) { return pt(p.x, p.y); }),
      aristas: base.aristas.map(function (e) { return [e[0], e[1], e[2] == null ? 1 : e[2]]; }),
      a: base.a, b: base.b
    };
  }

  /* ==================== 8 · mapas de influencia ==================== */

  // Un laberinto de juguete de 16 x 10 casillas: 20 unidades de lado, así que
  // ocupa el mismo lienzo que el resto de los ejemplos. Es de bucles y sin
  // callejones, como los cuatro del juego de verdad, para que la capa de
  // salidas diga algo más que «aquí se acaba el mundo».
  var IW = 16, IH = 10, IC = W / 16;
  var LAB = [
    '################',
    '#..............#',
    '#.####.##.####.#',
    '#..............#',
    '#.##.######.##.#',
    '#....#....#....#',
    '####.#.##.#.####',
    '#....#.##.#....#',
    '#..............#',
    '################'
  ];
  var ICELDAS = IW * IH;

  function icx(k) { return k % IW; }
  function icy(k) { return Math.floor(k / IW); }
  function iid(x, y) { return y * IW + x; }
  function icentro(k) { return pt(icx(k) * IC + IC / 2, icy(k) * IC + IC / 2); }

  function ilibres() {
    var l = [], x, y;
    for (y = 0; y < IH; y++) for (x = 0; x < IW; x++) l.push(LAB[y].charAt(x) !== '#');
    return l;
  }

  function ivecinas(libre, k) {
    var x = icx(k), y = icy(k), v = [];
    if (x > 0 && libre[k - 1]) v.push(k - 1);
    if (x < IW - 1 && libre[k + 1]) v.push(k + 1);
    if (y > 0 && libre[k - IW]) v.push(k - IW);
    if (y < IH - 1 && libre[k + IW]) v.push(k + IW);
    return v;
  }

  // Distancias por el pasillo desde una casilla, y de quién viene cada una.
  // Es la anchura de la sección 4, sin más: en una rejilla sin costes, la
  // anchura ya da el camino mínimo.
  function ibfs(libre, ini) {
    var d = [], p = [], k, cola, i, n, vs, j;
    for (k = 0; k < ICELDAS; k++) { d.push(-1); p.push(-1); }
    if (!libre[ini]) return { d: d, p: p };
    d[ini] = 0;
    cola = [ini]; i = 0;
    while (i < cola.length) {
      n = cola[i++]; vs = ivecinas(libre, n);
      for (j = 0; j < vs.length; j++) {
        if (d[vs[j]] < 0) { d[vs[j]] = d[n] + 1; p[vs[j]] = n; cola.push(vs[j]); }
      }
    }
    return { d: d, p: p };
  }

  // Una capa: cada fuente vale 1 en su casilla y va perdiendo fuerza a razón
  // de un factor por paso. Varias fuentes se suman.
  function icapaDesde(libre, fuentes, caida) {
    var cap = [], k, i, d;
    for (k = 0; k < ICELDAS; k++) cap.push(0);
    for (i = 0; i < fuentes.length; i++) {
      d = ibfs(libre, fuentes[i]).d;
      for (k = 0; k < ICELDAS; k++) if (d[k] >= 0) cap[k] += Math.pow(caida, d[k]);
    }
    return cap;
  }

  // Sin normalizar no se pueden comparar los pesos entre sí: una capa con diez
  // fuentes llegaría a 10 y otra con una se quedaría en 1, y el peso de la
  // primera valdría diez veces más sin que nadie lo haya decidido.
  function inormaliza(cap, libre) {
    var m = 0, k, out = [];
    for (k = 0; k < ICELDAS; k++) if (libre[k] && cap[k] > m) m = cap[k];
    if (m <= 0) return cap;
    for (k = 0; k < ICELDAS; k++) out.push(cap[k] / m);
    return out;
  }

  // Cuántas salidas tiene la casilla, de 0 a 1. No depende de nadie, así que
  // se calcula una vez: es la única capa que no cambia en toda la partida.
  function icapaSalidas(libre) {
    var out = [], k;
    for (k = 0; k < ICELDAS; k++) out.push(libre[k] ? (ivecinas(libre, k).length - 1) / 3 : 0);
    return out;
  }

  function icapas(esc, par) {
    var libre = esc.libre, k, i, r, n, extra, mx;
    var cazan = [], presa = [];
    for (i = 0; i < esc.fantasmas.length; i++) {
      (esc.fantasmas[i].comestible ? presa : cazan).push(esc.fantasmas[i].c);
    }
    var am = inormaliza(icapaDesde(libre, cazan, par.caida), libre);
    if (par.rastro && cazan.length) {
      // No sólo dónde está: por dónde viene. Se encarece el camino que le trae
      // hasta mí, que es justo el sitio donde no hay que estar.
      extra = [];
      for (k = 0; k < ICELDAS; k++) extra.push(0);
      for (i = 0; i < cazan.length; i++) {
        r = ibfs(libre, cazan[i]); n = esc.pac; k = 0;
        while (n >= 0 && n !== cazan[i] && k++ < ICELDAS) { extra[n] += 1; n = r.p[n]; }
      }
      mx = 0;
      for (k = 0; k < ICELDAS; k++) if (extra[k] > mx) mx = extra[k];
      if (mx > 0) for (k = 0; k < ICELDAS; k++) am[k] = Math.min(1, am[k] + 0.45 * extra[k] / mx);
    }
    return {
      comida: inormaliza(icapaDesde(libre, esc.pildoras, par.caida), libre),
      amenaza: am,
      presa: inormaliza(icapaDesde(libre, presa, par.caida), libre),
      poder: inormaliza(icapaDesde(libre, esc.poder, par.caida), libre),
      salidas: icapaSalidas(libre)
    };
  }

  var ICAPAS = [
    { id: 'comida',  txt: 'comida',  signo:  1 },
    { id: 'amenaza', txt: 'amenaza', signo: -1 },
    { id: 'presa',   txt: 'presa',   signo:  1 },
    { id: 'poder',   txt: 'poder',   signo:  1 },
    { id: 'salidas', txt: 'salidas', signo:  1 }
  ];

  function iutilidad(cs, w) {
    var u = [], k, i, v;
    for (k = 0; k < ICELDAS; k++) {
      v = 0;
      for (i = 0; i < ICAPAS.length; i++) {
        v += ICAPAS[i].signo * w[ICAPAS[i].id] * cs[ICAPAS[i].id][k];
      }
      u.push(v);
    }
    return u;
  }

  // La otra cara del mismo mapa: donde la utilidad sube, entrar sale barato.
  // El suelo de 0,2 evita que una zona buena salga gratis y la distancia deje
  // de contar.
  function icostes(u, base) {
    var c = [], k;
    for (k = 0; k < ICELDAS; k++) c.push(Math.max(0.2, base - u[k]));
    return c;
  }

  // Coste uniforme sobre el mapa: el coste es el de ENTRAR en cada casilla.
  function idijkstra(libre, ini, cst) {
    var g = [], p = [], listo = [], k, mejor, mv, vs, i, ng;
    for (k = 0; k < ICELDAS; k++) { g.push(Infinity); p.push(-1); listo.push(false); }
    if (!libre[ini]) return { g: g, p: p };
    g[ini] = 0;
    for (;;) {
      mejor = -1; mv = Infinity;
      for (k = 0; k < ICELDAS; k++) if (!listo[k] && g[k] < mv) { mv = g[k]; mejor = k; }
      if (mejor < 0) break;
      listo[mejor] = true;
      vs = ivecinas(libre, mejor);
      for (i = 0; i < vs.length; i++) {
        ng = g[mejor] + cst[vs[i]];
        if (ng < g[vs[i]]) { g[vs[i]] = ng; p[vs[i]] = mejor; }
      }
    }
    return { g: g, p: p };
  }

  function icamino(p, ini, fin) {
    var cam = [], k, guarda = 0;
    if (fin < 0 || fin === ini) return [ini];
    for (k = fin; k >= 0 && guarda++ < ICELDAS; k = p[k]) { cam.push(k); if (k === ini) break; }
    if (cam[cam.length - 1] !== ini) return [ini];
    return cam.reverse();
  }

  // Salir por ahí y seguir el pasillo hasta que vuelva a haber elección. Es la
  // unidad natural de decisión del laberinto: dentro de un pasillo no se elige.
  function isiguienteCruce(libre, desde, primero) {
    var ant = desde, n = primero, celdas = [primero], vs, g;
    for (g = 0; g < ICELDAS; g++) {
      vs = ivecinas(libre, n).filter(function (v) { return v !== ant; });
      if (vs.length !== 1) break;
      ant = n; n = vs[0]; celdas.push(n);
    }
    return { nodo: n, pasos: celdas.length, celdas: celdas };
  }

  function imasCerca(ks, d) {
    var mejor = -1, mv = Infinity, i;
    for (i = 0; i < ks.length; i++) if (d[ks[i]] >= 0 && d[ks[i]] < mv) { mv = d[ks[i]]; mejor = ks[i]; }
    return mejor;
  }

  // --- las tres formas de escribir la decisión, sobre la misma escena ---

  // 1 · el mapa contesta: el mejor sitio al alcance de la vista lo dice la
  // utilidad, y por dónde ir hasta él lo dice el coste, que es el mismo mapa
  // con el signo cambiado.
  function idecideMapa(esc, u, par) {
    var libre = esc.libre, d = ibfs(libre, esc.pac).d, k, destino = -1, mv = -Infinity;
    for (k = 0; k < ICELDAS; k++) {
      if (!libre[k] || k === esc.pac || d[k] < 0 || d[k] > par.horizonte) continue;
      if (u[k] > mv) { mv = u[k]; destino = k; }
    }
    var cst = icostes(u, par.base);
    var dij = idijkstra(libre, esc.pac, cst);
    var cam = icamino(dij.p, esc.pac, destino);
    return {
      paso: cam.length > 1 ? cam[1] : -1, destino: destino, camino: cam,
      valor: mv, coste: destino >= 0 ? dij.g[destino] : 0
    };
  }

  // 2 · la función de evaluación: se puntúa cada salida por lo que hay en el
  // cruce al que lleva, y gana la mejor. Los términos son las mismas capas.
  function idecideEvaluacion(esc, cs, par, w) {
    var libre = esc.libre, salidas = ivecinas(libre, esc.pac);
    var filas = [], mejor = -1, mv = -Infinity;
    salidas.forEach(function (k) {
      var c = isiguienteCruce(libre, esc.pac, k), t = {}, v = 0, i;
      for (i = 0; i < ICAPAS.length; i++) {
        t[ICAPAS[i].id] = ICAPAS[i].signo * w[ICAPAS[i].id] * cs[ICAPAS[i].id][c.nodo];
        v += t[ICAPAS[i].id];
      }
      filas.push({ paso: k, cruce: c.nodo, pasos: c.pasos, celdas: c.celdas, t: t, valor: v });
      if (v > mv) { mv = v; mejor = k; }
    });
    return { paso: mejor, valor: mv, filas: filas };
  }

  // 3 · las reglas con prioridad: la primera que se cumple manda, y lo que se
  // toca para afinarlas no son pesos, es el orden y los umbrales.
  function idecideReglas(esc, par) {
    var libre = esc.libre, dpac = ibfs(libre, esc.pac).d, i, cazan = [], presa = [];
    for (i = 0; i < esc.fantasmas.length; i++) {
      (esc.fantasmas[i].comestible ? presa : cazan).push(esc.fantasmas[i]);
    }
    var cerca = cazan.map(function (f) { return dpac[f.c]; })
                     .filter(function (v) { return v >= 0; }).sort(function (a, b) { return a - b; });
    var dpresa = presa.map(function (f) { return dpac[f.c] < 0 ? Infinity : dpac[f.c]; });
    var reglas = {
      huir: {
        txt: 'si un fantasma está a ' + par.umbral + ' pasos o menos → al sitio que más me aleje de él',
        vale: cerca.length > 0 && cerca[0] <= par.umbral,
        destino: function () {
          var f = cazan[0], j;
          for (j = 1; j < cazan.length; j++) if (dpac[cazan[j].c] >= 0 && dpac[cazan[j].c] < dpac[f.c]) f = cazan[j];
          var df = ibfs(libre, f.c).d, mejor = -1, mv = -Infinity, k, v;
          for (k = 0; k < ICELDAS; k++) {
            if (!libre[k] || k === esc.pac || dpac[k] < 0 || dpac[k] > par.horizonte) continue;
            v = df[k] - dpac[k];
            if (v > mv) { mv = v; mejor = k; }
          }
          return mejor;
        }
      },
      poder: {
        txt: 'si hay dos o más encima y queda píldora de poder → a por ella',
        vale: esc.poder.length > 0 && cerca.filter(function (v) { return v <= par.umbral * 1.5; }).length >= 2,
        destino: function () { return imasCerca(esc.poder, dpac); }
      },
      cazar: {
        txt: 'si hay un fantasma comestible a tiro → a por él',
        vale: presa.length > 0 && Math.min.apply(null, dpresa) <= par.umbral * 2,
        destino: function () { return imasCerca(presa.map(function (f) { return f.c; }), dpac); }
      },
      comer: {
        txt: 'si no → a la píldora más cercana',
        vale: esc.pildoras.length > 0,
        destino: function () { return imasCerca(esc.pildoras, dpac); }
      }
    };
    var orden = par.orden === 'goloso' ? ['comer', 'cazar', 'poder', 'huir']
                                       : ['huir', 'poder', 'cazar', 'comer'];
    var lista = orden.map(function (id) {
      return { id: id, txt: reglas[id].txt, vale: reglas[id].vale };
    });
    var cual = -1;
    for (i = 0; i < lista.length; i++) if (lista[i].vale) { cual = i; break; }
    if (cual < 0) return { paso: -1, lista: lista, regla: -1 };
    var destino = reglas[lista[cual].id].destino();
    var r = ibfs(libre, esc.pac);
    var cam = icamino(r.p, esc.pac, destino);
    return {
      paso: cam.length > 1 ? cam[1] : -1, destino: destino, camino: cam,
      lista: lista, regla: cual
    };
  }

  function idecide(esc, cs, u, par, w) {
    if (par.tecnica === 'mapa') return idecideMapa(esc, u, par);
    if (par.tecnica === 'evaluacion') return idecideEvaluacion(esc, cs, par, w);
    return idecideReglas(esc, par);
  }

  // --- un turno ---
  // No es el juego: es lo justo para ver a dónde lleva la decisión repetida.
  // Los fantasmas persiguen por el camino más corto y pierden un turno de cada
  // tres, que aquí hace las veces de lo que en el juego de verdad son unos
  // fantasmas que no siempre aciertan.
  var ILENTO = 3;
  var IPODER = 25;        // turnos que dura el efecto de la píldora de poder

  function iturno(esc, par, w) {
    var cs = icapas(esc, par), u = iutilidad(cs, w), dec = idecide(esc, cs, u, par, w);
    if (esc.fin) return dec;
    if (dec.paso >= 0) { esc.ult = esc.pac; esc.pac = dec.paso; }
    var i = esc.pildoras.indexOf(esc.pac);
    if (i >= 0) { esc.pildoras.splice(i, 1); esc.comidas++; }
    i = esc.poder.indexOf(esc.pac);
    if (i >= 0) {
      esc.poder.splice(i, 1);
      esc.reloj = IPODER;
      esc.fantasmas.forEach(function (f) { f.comestible = true; });
    }
    if (!ichoque(esc)) {
      esc.fantasmas.forEach(function (f) {
        if (f.comestible ? esc.turnos % 2 === 0 : esc.turnos % ILENTO === 0) return;
        var d = ibfs(esc.libre, esc.pac).d, vs = ivecinas(esc.libre, f.c);
        // no darse la vuelta, como en el juego: sólo vale si no hay más remedio
        var sinVolver = vs.filter(function (v) { return v !== f.ult; });
        if (sinVolver.length) vs = sinVolver;
        var mejor = vs[0], mv = f.comestible ? -Infinity : Infinity;
        vs.forEach(function (v) {
          if (d[v] < 0) return;
          if (f.comestible ? d[v] > mv : d[v] < mv) { mv = d[v]; mejor = v; }
        });
        f.ult = f.c; f.c = mejor;
      });
      if (esc.reloj > 0 && --esc.reloj === 0) esc.fantasmas.forEach(function (f) { f.comestible = false; });
      ichoque(esc);
    }
    esc.turnos++;
    if (!esc.fin && !esc.pildoras.length && !esc.poder.length) esc.fin = 'limpio';
    return dec;
  }

  function ichoque(esc) {
    var muerto = false;
    esc.fantasmas.forEach(function (f) {
      var encima = f.c === esc.pac || (f.c === esc.ult && f.ult === esc.pac);
      if (!encima) return;
      if (f.comestible) { f.c = f.casa; f.ult = -1; f.comestible = false; esc.cazados++; }
      else muerto = true;
    });
    if (muerto) esc.fin = 'comida';
    return muerto;
  }

  // La escena de ejemplo: dos perseguidores en el pasillo de en medio, uno
  // comestible arriba a la derecha, dos montones de píldoras en las esquinas
  // de abajo y las dos de poder en diagonal. Está puesta así para que el mapa
  // por defecto tenga las tres cosas a la vez: una zona roja que parte el
  // laberinto en dos y dos zonas buenas a las que no se llega igual de barato.
  function iescena() {
    var libre = ilibres();
    var fant = [[5, 3, false], [10, 3, false], [13, 1, true]].map(function (f) {
      return { c: iid(f[0], f[1]), casa: iid(f[0], f[1]), comestible: f[2], ult: -1 };
    });
    var pi = [[1,7],[2,7],[3,7],[1,8],[2,8],[3,8],[1,5],[2,5],
              [11,5],[12,5],[13,5],[14,5],[11,4],[12,7],[13,7],[6,1],[9,1]];
    return {
      libre: libre, pac: iid(7, 8), ult: -1, fantasmas: fant,
      pildoras: pi.map(function (p) { return iid(p[0], p[1]); }),
      poder: [iid(1, 1), iid(14, 8)],
      turnos: 0, comidas: 0, cazados: 0, reloj: 0, fin: ''
    };
  }

  function icopia(e) {
    return {
      libre: e.libre.slice(), pac: e.pac, ult: e.ult,
      fantasmas: e.fantasmas.map(function (f) {
        return { c: f.c, casa: f.casa, comestible: f.comestible, ult: f.ult };
      }),
      pildoras: e.pildoras.slice(), poder: e.poder.slice(),
      turnos: e.turnos, comidas: e.comidas, cazados: e.cazados, reloj: e.reloj, fin: e.fin
    };
  }

  // Cuatro juegos de pesos con nombre. No son un adorno: es la forma más
  // rápida de ver que la misma técnica, con otros pesos, juega a otra cosa.
  var IPESOS = [
    ['Equilibrada', { comida: 1,   amenaza: 2,   presa: 1.5, poder: 1,   salidas: 0.5 }],
    ['Glotona',     { comida: 3,   amenaza: 0.5, presa: 1,   poder: 0,   salidas: 0   }],
    ['Miedosa',     { comida: 0.5, amenaza: 3,   presa: 0,   poder: 1.5, salidas: 1   }],
    ['Cazadora',    { comida: 1,   amenaza: 1,   presa: 3,   poder: 2.5, salidas: 0   }]
  ];

  var IHERR = [
    ['pac', 'Ms. Pac-Man'], ['fantasma', 'Fantasma'], ['comestible', 'Comestible'],
    ['pildora', 'Píldora'], ['poder', 'Píldora de poder'], ['muro', 'Muro'], ['borrar', 'Borrar']
  ];

  // Cinco tramos y no un degradado continuo: un mapa se depura leyéndolo, y
  // para leerlo hacen falta escalones. Es la misma razón por la que un mapa
  // de alturas lleva curvas de nivel.
  var IBANDA = [0.2, 0.4, 0.6, 0.8, 1];
  var IOPAC = [0.14, 0.3, 0.46, 0.62, 0.8];

  // La retícula, para poder contar pasos con el dedo. Es fija, así que se
  // arma una sola vez.
  var IRED = (function () {
    var d = '', i;
    for (i = 1; i < IW; i++) d += 'M' + i * IC + ' 0V' + H;
    for (i = 1; i < IH; i++) d += 'M0 ' + i * IC + 'H' + W;
    return d;
  })();
  function iredPath() { return IRED; }

  // Las figuras se dibujan por centro y radio, y no por casilla, porque la
  // leyenda tiene que enseñar exactamente las mismas.
  function ipathFantasma(x, y, r) {
    var m = r * 0.5;
    return 'M' + (x - r) + ' ' + (y + r * 0.95) + 'v' + (-r * 0.95) +
           'a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0v' + (r * 0.95) +
           'l' + (-m) + ' ' + (-r * 0.34) + 'l' + (-m) + ' ' + (r * 0.34) +
           'l' + (-m) + ' ' + (-r * 0.34) + 'z';
  }
  function icunaPac(g, x, y, r, giro) {
    var e = svgEl('g', {
      transform: 'translate(' + x + ' ' + y + ') rotate(' + giro + ') scale(' + (r / 13) + ')'
    });
    e.appendChild(svgEl('path', { d: 'M0 0 L11.26 -6.5 A13 13 0 1 0 11.26 6.5 Z', class: 'dm-a' }));
    g.appendChild(e);
    return e;
  }
  // El sitio que ha elegido la decisión. Va en verde y no en la diana roja del
  // resto de los ejemplos: en este el rojo ya significa «aquí te comen», y
  // marcar de rojo el mejor sitio del mapa diría justo lo contrario.
  function imarcaMeta(g, p) {
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 6.5, class: 'dm-inf-meta' }));
    g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.4, class: 'dm-inf-meta2' }));
  }

  function ibandas(g, val, max, libre, cls) {
    var d = ['', '', '', '', ''], k, v, b;
    if (!(max > 0)) return;
    for (k = 0; k < ICELDAS; k++) {
      if (!libre[k]) continue;
      v = Math.abs(val[k]) / max;
      if (v < 0.1) continue;
      b = 0;
      while (b < 4 && v > IBANDA[b]) b++;
      d[b] += 'M' + icx(k) * IC + ' ' + icy(k) * IC + 'h' + IC + 'v' + IC + 'h-' + IC + 'z';
    }
    for (b = 0; b < 5; b++) {
      if (d[b]) g.appendChild(svgEl('path', { class: cls, 'fill-opacity': IOPAC[b], d: d[b] }));
    }
  }

  function icifra(v) {
    return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace('-', '−');
  }
  // la misma cifra sin ceros de relleno, para lo que se lee como una fórmula
  function icorta(v) {
    return icifra(v).replace(/,?0+$/, '') || '0';
  }
  function imaxAbs(v) {
    var m = 0, k;
    for (k = 0; k < v.length; k++) if (Math.abs(v[k]) > m) m = Math.abs(v[k]);
    return m;
  }
  function inombreCelda(k) { return '(' + icx(k) + ',' + icy(k) + ')'; }
  // Columna de ancho fijo, con sitio de sobra para la cabecera más larga: una
  // tabla con las columnas justas se lee a saltos y deja de servir para comparar.
  function col(txt, ancho) {
    var s = String(txt);
    while (s.length < ancho) s += ' ';
    return s;
  }
  function idireccion(desde, hasta) {
    if (hasta < 0) return '—';
    var dx = icx(hasta) - icx(desde), dy = icy(hasta) - icy(desde);
    if (dx > 0) return 'derecha';
    if (dx < 0) return 'izquierda';
    if (dy > 0) return 'abajo';
    if (dy < 0) return 'arriba';
    return '—';
  }

  function creaInfluencia(nodo) {
    var esc = iescena(), inicio = icopia(esc);
    var par = {
      tecnica: 'mapa', caida: 0.75, horizonte: 8, base: 1, rastro: false,
      ver: 'total', numeros: false, umbral: 5, orden: 'seguro'
    };
    var w = {}, herramienta = 'pac', cs = null, u = null, dec = null, reloj = null, aviso = '';
    Object.keys(IPESOS[0][1]).forEach(function (k) { w[k] = IPESOS[0][1][k]; });

    /* ---- armazón ---- */
    var escenario = nodo.querySelector('.demo-stage');
    escenario.textContent = '';
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'demo-svg',
      role: 'img', 'aria-label': 'Laberinto de ejemplo con el mapa pintado encima'
    });
    escenario.appendChild(svg);
    svg.addEventListener('pointerdown', enPulsacion);

    var leyenda = el('div', 'demo-leyenda');
    escenario.parentNode.insertBefore(leyenda, escenario.nextSibling);

    var barras = nodo.querySelector('.demo-controls');
    barras.textContent = '';
    var barraTec = el('div', 'demo-bar');
    var barraColoca = el('div', 'demo-bar');
    var barraPesos = el('div', 'demo-bar');
    var barraMapa = el('div', 'demo-bar');
    var barraReglas = el('div', 'demo-bar');
    var barraPlay = el('div', 'demo-bar demo-bar-play');
    [barraTec, barraColoca, barraPesos, barraMapa, barraReglas, barraPlay].forEach(function (b) {
      barras.appendChild(b);
    });
    var lectura = nodo.querySelector('.demo-read');
    var definicion = el('p', 'demo-def');
    var traqueo = el('p', 'demo-traza');
    barras.parentNode.insertBefore(definicion, lectura);
    barras.parentNode.insertBefore(traqueo, lectura);

    /* ---- técnica ---- */
    barraTec.appendChild(opciones('Decide con',
      [['El mapa', 'mapa'], ['Una función de evaluación', 'evaluacion'], ['Reglas con prioridad', 'reglas']],
      par.tecnica, function (v) {
        par.tecnica = v;
        if (v === 'reglas' && par.ver === 'total') { par.ver = 'nada'; grupoVer.pon('nada'); }
        if (v !== 'reglas' && par.ver === 'nada') { par.ver = 'total'; grupoVer.pon('total'); }
        cambio();
      }));

    /* ---- qué se coloca ---- */
    barraColoca.appendChild(el('span', 'demo-tag', 'Colocas'));
    var botHerr = {};
    IHERR.forEach(function (h) {
      var b = el('button', 'demo-btn demo-btn-mini', h[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(h[0] === herramienta));
      b.onclick = function () { herramienta = h[0]; pintaHerramientas(); };
      botHerr[h[0]] = b;
      barraColoca.appendChild(b);
    });
    var bVaciar = el('button', 'demo-btn', 'Vaciar');
    bVaciar.type = 'button';
    bVaciar.onclick = function () {
      esc.fantasmas = []; esc.pildoras = []; esc.poder = [];
      esc.turnos = 0; esc.comidas = 0; esc.cazados = 0; esc.reloj = 0; esc.fin = '';
      guarda();
    };
    barraColoca.appendChild(bVaciar);

    /* ---- los pesos: la función objetivo, a la vista ---- */
    barraPesos.appendChild(el('span', 'demo-tag', 'Pesos'));
    var desl = {};
    ICAPAS.forEach(function (c) {
      desl[c.id] = deslizador((c.signo < 0 ? '− ' : '+ ') + c.txt, 0, 4, 0.25, w[c.id], function (v) {
        w[c.id] = v; cambio();
      });
      barraPesos.appendChild(desl[c.id].raiz);
    });
    var grupoPre = el('span', 'demo-grupo');
    grupoPre.appendChild(el('span', 'demo-tag', 'A lo'));
    IPESOS.forEach(function (p) {
      var b = el('button', 'demo-btn demo-btn-mini', p[0]);
      b.type = 'button';
      b.onclick = function () {
        Object.keys(p[1]).forEach(function (k) { w[k] = p[1][k]; desl[k].pon(p[1][k]); });
        cambio();
      };
      grupoPre.appendChild(b);
    });
    barraPesos.appendChild(grupoPre);

    /* ---- cómo se pinta el mapa ---- */
    barraMapa.appendChild(el('span', 'demo-tag', 'Mapa'));
    barraMapa.appendChild(deslizador('Caída', 0.4, 0.95, 0.05, par.caida, function (v) {
      par.caida = v; cambio();
    }).raiz);
    var campoHor = deslizador('Horizonte', 3, 16, 1, par.horizonte, function (v) { par.horizonte = v; cambio(); });
    barraMapa.appendChild(campoHor.raiz);
    barraMapa.appendChild(interruptor('Por dónde viene', par.rastro, function (v) { par.rastro = v; cambio(); }));
    var grupoVer = opciones('Ver', [['Todo el mapa', 'total'], ['Comida', 'comida'], ['Amenaza', 'amenaza'],
                                    ['Presa', 'presa'], ['Poder', 'poder'], ['Salidas', 'salidas'], ['Nada', 'nada']],
      par.ver, function (v) { par.ver = v; cambio(); });
    barraMapa.appendChild(grupoVer);
    barraMapa.appendChild(interruptor('Números', par.numeros, function (v) { par.numeros = v; pinta(); }));

    /* ---- las reglas ---- */
    barraReglas.appendChild(el('span', 'demo-tag', 'Reglas'));
    barraReglas.appendChild(opciones('Orden', [['Primero no morir', 'seguro'], ['Primero comer', 'goloso']],
      par.orden, function (v) { par.orden = v; cambio(); }));
    barraReglas.appendChild(deslizador('Umbral', 2, 12, 1, par.umbral, function (v) { par.umbral = v; cambio(); }).raiz);

    /* ---- jugar ---- */
    var bPlay = el('button', 'demo-btn demo-play', '▶  Jugar');
    bPlay.type = 'button';
    bPlay.onclick = alternaReproduccion;
    barraPlay.appendChild(bPlay);
    var bPaso = el('button', 'demo-btn', '›  Un turno');
    bPaso.type = 'button';
    bPaso.onclick = function () { para(); unTurno(); };
    barraPlay.appendChild(bPaso);
    var bVolver = el('button', 'demo-btn', '⏮  Al principio');
    bVolver.type = 'button';
    bVolver.onclick = function () { para(); esc = icopia(inicio); cambio(); };
    barraPlay.appendChild(bVolver);
    var bReset = el('button', 'demo-btn', 'Escena de ejemplo');
    bReset.type = 'button';
    bReset.onclick = function () { para(); esc = iescena(); guarda(); };
    barraPlay.appendChild(bReset);

    /* ---- edición ---- */
    function enPulsacion(ev) {
      var p = enMundo(svg, ev);
      if (!p) return;
      ev.preventDefault();
      para();
      var x = Math.floor(p.x / IC), y = Math.floor(p.y / IC);
      if (x < 0 || y < 0 || x >= IW || y >= IH) return;
      aplica(iid(x, y));
    }

    function quita(k) {
      var i = esc.pildoras.indexOf(k);
      if (i >= 0) esc.pildoras.splice(i, 1);
      i = esc.poder.indexOf(k);
      if (i >= 0) esc.poder.splice(i, 1);
      esc.fantasmas = esc.fantasmas.filter(function (f) { return f.c !== k; });
    }

    function aplica(k) {
      var i;
      aviso = '';
      if (herramienta === 'muro') {
        if (k === esc.pac) { aviso = 'ahí está ella'; pinta(); return; }
        quita(k);
        esc.libre[k] = false;
      } else if (herramienta === 'borrar') {
        if (!esc.libre[k]) esc.libre[k] = true; else quita(k);
      } else {
        if (!esc.libre[k]) esc.libre[k] = true;
        if (herramienta === 'pac') { quita(k); esc.pac = k; esc.ult = -1; }
        else if (herramienta === 'fantasma' || herramienta === 'comestible') {
          for (i = 0; i < esc.fantasmas.length; i++) {
            if (esc.fantasmas[i].c === k) { esc.fantasmas[i].comestible = herramienta === 'comestible'; guarda(); return; }
          }
          if (k === esc.pac) { aviso = 'ahí está ella'; pinta(); return; }
          esc.fantasmas.push({ c: k, casa: k, comestible: herramienta === 'comestible', ult: -1 });
        } else if (herramienta === 'pildora') {
          if (k === esc.pac || esc.poder.indexOf(k) >= 0) quita(k);
          if (esc.pildoras.indexOf(k) < 0 && k !== esc.pac) esc.pildoras.push(k);
        } else if (herramienta === 'poder') {
          if (k === esc.pac) { aviso = 'ahí está ella'; pinta(); return; }
          quita(k);
          if (esc.poder.indexOf(k) < 0) esc.poder.push(k);
        }
      }
      guarda();
    }

    // Tocar la escena la convierte en la nueva escena de partida: lo que se
    // edita es la situación, no la partida que estuviera en marcha.
    function guarda() {
      esc.turnos = 0; esc.comidas = 0; esc.cazados = 0; esc.reloj = 0; esc.fin = '';
      esc.fantasmas.forEach(function (f) { f.casa = f.c; f.ult = -1; });
      inicio = icopia(esc);
      cambio();
    }

    /* ---- turnos ---- */
    function para() {
      if (reloj) { clearInterval(reloj); reloj = null; }
      bPlay.textContent = '▶  Jugar';
      bPlay.setAttribute('aria-pressed', 'false');
    }
    function alternaReproduccion() {
      if (reloj) { para(); return; }
      if (esc.fin) { esc = icopia(inicio); cambio(); }
      bPlay.textContent = '⏸  Parar';
      bPlay.setAttribute('aria-pressed', 'true');
      reloj = setInterval(function () {
        unTurno();
        if (esc.fin) para();
      }, 280);
    }
    function unTurno() {
      if (esc.fin) return;
      iturno(esc, par, w);
      cambio();
    }

    /* ---- recalcular y repintar ---- */
    function cambio() {
      cs = icapas(esc, par);
      u = iutilidad(cs, w);
      dec = idecide(esc, cs, u, par, w);
      barraPesos.hidden = par.tecnica === 'reglas';
      barraReglas.hidden = par.tecnica !== 'reglas';
      campoHor.raiz.hidden = par.tecnica === 'evaluacion';
      pintaHerramientas();
      pinta();
      pintaLeyenda();
      definicion.textContent = textoDefinicion();
      traqueo.textContent = textoTraza();
      lectura.textContent = textoLectura();
    }

    function pintaHerramientas() {
      IHERR.forEach(function (h) {
        botHerr[h[0]].setAttribute('aria-pressed', String(h[0] === herramienta));
      });
    }

    /* ---- dibujo ---- */
    function caminoPts(celdas) { return celdas.map(icentro); }

    // La ruta, con un halo del color del papel debajo: a oscuras --pill-ink y
    // --pill son casi el mismo amarillo, y sin el halo la línea desaparece justo
    // encima de las casillas buenas, que son las que hay que mirar.
    function trazaRuta(d) {
      svg.appendChild(svgEl('path', { class: 'dm-inf-halo', d: d }));
      svg.appendChild(svgEl('path', { class: 'dm-ruta', d: d }));
    }

    function pathMuros() {
      var d = '', k;
      for (k = 0; k < ICELDAS; k++) {
        if (esc.libre[k]) continue;
        d += 'M' + icx(k) * IC + ' ' + icy(k) * IC + 'h' + IC + 'v' + IC + 'h-' + IC + 'z';
      }
      return d;
    }

    // Con los números puestos las figuras suben un poco: la cifra va al pie de
    // la casilla y si no se pisan.
    function icentroFig(k) {
      var c = icentro(k);
      return par.numeros ? pt(c.x, c.y - 2.6) : c;
    }

    function pathFantasma(k) {
      var c = icentroFig(k);
      return ipathFantasma(c.x, c.y, 6.2);
    }

    // Mira a donde va, no a donde estuvo: la cuña sin girar abre la boca a la
    // derecha. Si todavía no hay decisión, hacia donde venía.
    function dibujaPac(g, k) {
      var c = icentroFig(k), a = 0, hacia = dec && dec.paso >= 0 ? dec.paso : -1, dx, dy;
      if (hacia < 0 && esc.ult >= 0 && esc.ult !== k) hacia = 2 * k - esc.ult;
      if (hacia >= 0) {
        dx = icx(hacia) - icx(k); dy = icy(hacia) - icy(k);
        if (dx < 0) a = 180;
        else if (dy < 0) a = -90;
        else if (dy > 0) a = 90;
      }
      icunaPac(g, c.x, c.y, 6.8, a);
    }

    function valorPintado() {
      if (par.ver === 'nada') return null;
      if (par.ver === 'total') return { val: u, max: imaxAbs(u), signo: 0 };
      var i;
      for (i = 0; i < ICAPAS.length; i++) {
        if (ICAPAS[i].id === par.ver) return { val: cs[par.ver], max: 1, signo: ICAPAS[i].signo };
      }
      return null;
    }

    function pinta() {
      var k, g, p, v = valorPintado();
      svg.textContent = '';
      svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'dm-inf-suelo' }));

      if (v && v.max > 0) {
        if (v.signo > 0) ibandas(svg, v.val, v.max, esc.libre, 'dm-inf-bien');
        else if (v.signo < 0) ibandas(svg, v.val, v.max, esc.libre, 'dm-inf-mal');
        else {
          ibandas(svg, v.val.map(function (x) { return x > 0 ? x : 0; }), v.max, esc.libre, 'dm-inf-bien');
          ibandas(svg, v.val.map(function (x) { return x < 0 ? -x : 0; }), v.max, esc.libre, 'dm-inf-mal');
        }
      }
      svg.appendChild(svgEl('path', { class: 'dm-inf-red', d: iredPath() }));
      svg.appendChild(svgEl('path', { class: 'dm-inf-muro', d: pathMuros() }));

      if (par.numeros && v) {
        g = svgEl('g', { class: 'dm-inf-num' });
        for (k = 0; k < ICELDAS; k++) {
          if (!esc.libre[k]) continue;
          g.appendChild(svgEl('text', {
            x: icx(k) * IC + IC / 2, y: icy(k) * IC + IC - 1.6
          })).textContent = Math.abs(v.val[k]) < 0.005 ? '·'
            : icifra(v.val[k]).replace(/^(−?)0,/, '$1,');
        }
        svg.appendChild(g);
      }

      // el camino que sale de la decisión, por debajo de las figuras
      if (par.tecnica === 'evaluacion' && dec.filas) {
        dec.filas.forEach(function (f) {
          var d = ruta(caminoPts([esc.pac].concat(f.celdas)));
          if (f.paso === dec.paso) trazaRuta(d);
          else svg.appendChild(svgEl('path', { class: 'dm-inf-opcion', d: d }));
        });
      } else if (dec.camino && dec.camino.length > 1) {
        trazaRuta(ruta(caminoPts(dec.camino)));
      }
      if (dec.destino != null && dec.destino >= 0) imarcaMeta(svg, icentro(dec.destino));

      esc.pildoras.forEach(function (k2) {
        p = icentroFig(k2);
        svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 1.8, class: 'dm-inf-pi' }));
      });
      esc.poder.forEach(function (k2) {
        p = icentroFig(k2);
        svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 4, class: 'dm-inf-po' }));
      });
      esc.fantasmas.forEach(function (f) {
        svg.appendChild(svgEl('path', { class: f.comestible ? 'dm-inf-gc' : 'dm-inf-gh', d: pathFantasma(f.c) }));
      });
      if (esc.libre[esc.pac]) dibujaPac(svg, esc.pac);

      // las puntuaciones de cada salida, encima de todo
      if (par.tecnica === 'evaluacion' && dec.filas) {
        dec.filas.forEach(function (f) {
          var c = icentro(f.cruce), t = icifra(f.valor);
          svg.appendChild(svgEl('rect', {
            x: c.x - 11, y: c.y - 5.5, width: 22, height: 11, rx: 2, class: 'dm-plato'
          }));
          svg.appendChild(svgEl('text', {
            x: c.x, y: c.y + 3.2,
            class: 'dm-etq' + (f.paso === dec.paso ? ' dm-inf-gana' : '')
          })).textContent = t;
        });
      }
    }

    /* ---- la leyenda ----
       Sin esto el color no se puede leer: el rojo sale dos veces —el fantasma
       que persigue y la casilla que no conviene— y el amarillo cuatro, así que
       hay que decir cuál es cuál y, sobre todo, hacia qué lado crece. */
    function trozo(dibuja) {
      var sv = svgEl('svg', {
        viewBox: '0 0 16 16', width: '16', height: '16',
        class: 'lg-fig', 'aria-hidden': 'true'
      });
      dibuja(sv);
      return sv;
    }
    function itemLey(sv, txt) {
      var e = el('span', 'lg');
      if (sv) e.appendChild(sv);
      e.appendChild(el('span', null, txt));
      return e;
    }
    function tramosLey(cls, alReves) {
      var e = el('span', 'lg-tramos'), i, b;
      for (i = 0; i < IOPAC.length; i++) {
        b = el('i');
        b.className = cls;
        b.style.opacity = IOPAC[alReves ? IOPAC.length - 1 - i : i];
        e.appendChild(b);
      }
      return e;
    }
    function escalaLey() {
      var e = el('span', 'lg lg-escala'), v = valorPintado(), tope;
      if (!v) {
        e.appendChild(el('span', 'lg-tag', 'el mapa está apagado'));
        return e;
      }
      if (par.ver === 'total') {
        tope = v.max || 1;
        e.appendChild(el('b', null, 'U(c)'));
        e.appendChild(el('span', 'lg-tag', 'peor'));
        e.appendChild(el('b', null, '−' + icifra(tope)));
        e.appendChild(tramosLey('mal', true));
        e.appendChild(el('b', null, '0'));
        e.appendChild(tramosLey('bien', false));
        e.appendChild(el('b', null, '+' + icifra(tope)));
        e.appendChild(el('span', 'lg-tag', 'mejor'));
        return e;
      }
      e.appendChild(el('b', null, 'capa ' + par.ver));
      e.appendChild(el('span', 'lg-tag', 'lejos'));
      e.appendChild(el('b', null, '0'));
      e.appendChild(tramosLey(v.signo < 0 ? 'mal' : 'bien', false));
      e.appendChild(el('b', null, '1'));
      e.appendChild(el('span', 'lg-tag', 'en la fuente'));
      return e;
    }

    function pintaLeyenda() {
      leyenda.textContent = '';
      leyenda.appendChild(escalaLey());
      var fig = el('span', 'lg-figs');
      fig.appendChild(itemLey(trozo(function (sv) { icunaPac(sv, 8, 8, 6.5, 0); }), 'Ms. Pac-Man'));
      fig.appendChild(itemLey(trozo(function (sv) {
        sv.appendChild(svgEl('path', { class: 'dm-inf-gh', d: ipathFantasma(8, 8.5, 6) }));
      }), 'persigue'));
      fig.appendChild(itemLey(trozo(function (sv) {
        sv.appendChild(svgEl('path', { class: 'dm-inf-gc', d: ipathFantasma(8, 8.5, 6) }));
      }), 'comestible'));
      fig.appendChild(itemLey(trozo(function (sv) {
        sv.appendChild(svgEl('circle', { cx: 8, cy: 8, r: 2, class: 'dm-inf-pi' }));
      }), 'píldora'));
      fig.appendChild(itemLey(trozo(function (sv) {
        sv.appendChild(svgEl('circle', { cx: 8, cy: 8, r: 4.2, class: 'dm-inf-po' }));
      }), 'de poder'));
      fig.appendChild(itemLey(trozo(function (sv) {
        sv.appendChild(svgEl('path', { class: 'dm-ruta', d: 'M1 8 H15' }));
      }), par.tecnica === 'evaluacion' ? 'la salida que gana' : 'por dónde va'));
      if (par.tecnica === 'evaluacion') {
        fig.appendChild(itemLey(trozo(function (sv) {
          sv.appendChild(svgEl('path', { class: 'dm-inf-opcion', d: 'M1 8 H15' }));
        }), 'las descartadas'));
      } else {
        fig.appendChild(itemLey(trozo(function (sv) { imarcaMeta(sv, pt(8, 8)); }), 'a dónde va'));
      }
      leyenda.appendChild(fig);
    }

    /* ---- lo que se lee debajo ---- */
    // Una línea por paso de la cuenta. Todo seguido no hay quien lo siga, y lo
    // que hace falta es poder comprobar de dónde sale cada número.
    function textoDefinicion() {
      var l = [
        'influencia de una fuente en la casilla c = caída ^ pasos(c, fuente)',
        '    caída = ' + icorta(par.caida) + ', y los pasos se cuentan por el pasillo, no en línea recta',
        '    cada capa se divide por su máximo, para que los pesos se puedan comparar entre sí'
      ];
      if (par.tecnica === 'reglas') {
        l.push('la primera regla que se cumple manda, y las demás no llegan a mirarse');
        l.push('    umbral = ' + par.umbral + ' pasos');
        l.push('    aquí los pesos no pintan nada: lo que se toca es el orden y el umbral');
        return l.join('\n');
      }
      l.push('U(c) = ' + ICAPAS.map(function (c) {
        return (c.signo < 0 ? '− ' : '+ ') + icorta(w[c.id]) + ' × ' + c.txt + '(c)';
      }).join('\n       ').replace(/^\+ /, '  '));
      if (par.tecnica === 'evaluacion') {
        l.push('valor de una salida = U del cruce al que lleva');
        l.push('    gana la mayor');
      } else {
        l.push('coste de entrar en c = máx(0,2 ; 1 − U(c))');
        l.push('    destino = la mejor U a ' + par.horizonte + ' pasos o menos');
        l.push('    camino = el más barato hasta ella, con esos costes');
      }
      return l.join('\n');
    }

    function textoTraza() {
      var i, s;
      if (par.tecnica === 'reglas') {
        if (!dec.lista) return 'no hay reglas que probar';
        return dec.lista.map(function (r, j) {
          return (j === dec.regla ? '▸ ' : '  ') + (j + 1) + '. ' + r.txt +
                 (r.vale ? '   [se cumple]' : '');
        }).join('\n');
      }
      if (par.tecnica === 'evaluacion') {
        if (!dec.filas || !dec.filas.length) return 'no hay salidas';
        s = col('por dónde', 12) + col('cruce', 9) + col('pasos', 7) +
            ICAPAS.map(function (c) { return col(c.txt, 10); }).join('') + 'total';
        dec.filas.forEach(function (f) {
          s += '\n' + col(idireccion(esc.pac, f.paso), 12) +
               col(inombreCelda(f.cruce), 9) + col(String(f.pasos), 7) +
               ICAPAS.map(function (c) { return col(icifra(f.t[c.id]), 10); }).join('') +
               icifra(f.valor) + (f.paso === dec.paso ? '   ←' : '');
        });
        return s;
      }
      if (dec.destino < 0) return 'no hay ninguna casilla mejor al alcance de la vista';
      return 'mejor casilla a ' + par.horizonte + ' pasos o menos: ' + inombreCelda(dec.destino) +
             ', con U = ' + icifra(dec.valor) +
             '\ncamino más barato hasta ella: ' + (dec.camino.length - 1) + ' casillas, coste ' +
             icifra(dec.coste) + '   ·   primer paso: ' + idireccion(esc.pac, dec.paso);
    }

    function textoLectura() {
      var t = par.tecnica === 'mapa' ? 'el mapa'
            : par.tecnica === 'evaluacion' ? 'la función de evaluación' : 'las reglas';
      t = 'decide ' + t + ' · turno ' + esc.turnos +
          ' · comidas ' + esc.comidas + ' de ' + (esc.comidas + esc.pildoras.length) +
          ' · ' + esc.cazados + ' fantasmas cazados';
      if (esc.reloj > 0) t += ' · queda' + (esc.reloj === 1 ? '' : 'n') + ' ' + esc.reloj +
                                 ' turno' + (esc.reloj === 1 ? '' : 's') + ' de poder';
      if (aviso) return t + ' — ' + aviso;
      if (esc.fin === 'comida') return t + ' — la han comido';
      if (esc.fin === 'limpio') return t + ' — nivel limpio';
      return t + ' · va ' + idireccion(esc.pac, dec.paso);
    }

    cambio();
  }

  function crea(nodo) {
    var tipo = nodo.getAttribute('data-demo');
    var esTodo = tipo === 'todo';
    var esDijkstra = tipo === 'dijkstra';
    var esAstar = tipo === 'astar';
    var esCoste = esDijkstra || esAstar;               // los dos llevan g y cola por prioridad
    var esGrafo = tipo === 'grafo' || esCoste;         // los tres editan un grafo
    var esc = esGrafo ? copiaRed(esAstar ? ASTAR : esDijkstra ? RED : GRAFO) : {
      obstaculos: PRESET.map(function (p) { return p.map(function (q) { return pt(q.x, q.y); }); }),
      waypoints: [],
      a: pt(30, 170),
      b: pt(292, 172)
    };
    var aristaSel = -1;   // primer nodo elegido con la herramienta Arista
    var hs = null;        // la h de cada nodo, para pintarla

    // En A* el coste de una arista es su longitud, redondeada hacia ARRIBA, y
    // la h la distancia en línea recta al destino redondeada hacia ABAJO. Así
    // la h nunca sobreestima por mucho que se muevan los nodos: es admisible
    // por construcción, y sólo deja de serlo si se le sube el peso por encima
    // de 1, que es justo lo que el deslizador deja probar.
    function costeDe(e) {
      if (esAstar) {
        var m = e[2] == null || e[2] < 1 ? 1 : e[2];     // 1 normal, más es terreno lento
        return Math.ceil(Math.ceil(dist(esc.nodos[e[0]], esc.nodos[e[1]]) / 10) * m);
      }
      return costeArista(e, par.costes);
    }
    function heuristicaDe(k) {
      if (!esAstar || esc.b == null || !esc.nodos[esc.b]) return 0;
      return Math.floor(dist(esc.nodos[k], esc.nodos[esc.b]) * par.peso / 10);
    }
    var par = {
      margen: 9, auto: true,            // puntos de ruta
      lado: 20, vecindad: 4,            // rejilla
      fundir: true, cuerda: true, portales: true,  // malla
      modo: 'anchura',                             // grafo
      costes: 'mano', coste: 3,                    // dijkstra
      peso: 1, terreno: 2,                         // astar
      particion: 'rejilla', algoritmo: 'astar'     // todo junto
    };
    var herramienta = esGrafo ? 'nodo' : 'obstaculo', forma = 'bloque', tam = 52;
    var descomp = null, resultado = null, aviso = '';
    // paso a paso de la rejilla: la traza de la búsqueda, en qué paso estamos
    // (null = se enseña el resultado final) y el reloj de la reproducción
    var traza = null, orden = null, trazaFin = -1, paso = null, reloj = null;

    /* ---- armazón ---- */
    var escena = nodo.querySelector('.demo-stage');
    escena.textContent = '';
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'demo-svg',
      role: 'img', 'aria-label': 'Escena editable del ejemplo'
    });
    escena.appendChild(svg);

    var barras = nodo.querySelector('.demo-controls');
    barras.textContent = '';
    var barraColoca = el('div', 'demo-bar');
    var barraPar = el('div', 'demo-bar');
    var barraPlay = el('div', 'demo-bar demo-bar-play');
    barras.appendChild(barraColoca);
    barras.appendChild(barraPar);
    barras.appendChild(barraPlay);

    var lectura = nodo.querySelector('.demo-read');

    /* ---- barra de colocación ---- */
    barraColoca.appendChild(el('span', 'demo-tag', 'Colocas'));
    var botHerr = {};
    HERRAMIENTAS.forEach(function (h) {
      if (h.solo && h.solo !== tipo) return;
      if (h.red && !esGrafo) return;
      if (h.escena && esGrafo) return;
      if (h.conCoste && !esCoste) return;
      if (h.conCoste && esAstar) h = { id: h.id, txt: 'Terreno' };
      var b = el('button', 'demo-btn', h.txt);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(h.id === herramienta));
      b.onclick = function () { herramienta = h.id; pintaHerramientas(); };
      botHerr[h.id] = b;
      barraColoca.appendChild(b);
    });
    var grupoForma = el('span', 'demo-grupo');
    Object.keys(FORMAS).forEach(function (f) {
      var b = el('button', 'demo-btn demo-btn-mini', NOMBRE_FORMA[f]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(f === forma));
      b.onclick = function () { forma = f; pintaHerramientas(); };
      b.setAttribute('data-forma', f);
      grupoForma.appendChild(b);
    });
    barraColoca.appendChild(grupoForma);
    var talla = deslizador('Tamaño', 26, 86, 2, tam, function (v) { tam = v; });
    barraColoca.appendChild(talla.raiz);
    var pesa = esDijkstra ? deslizador('Coste', 1, 9, 1, par.coste, function (v) { par.coste = v; })
             : esAstar ? deslizador('Terreno ×', 1, 5, 0.5, par.terreno, function (v) { par.terreno = v; })
             : null;
    if (pesa) barraColoca.appendChild(pesa.raiz);
    var bVaciar = el('button', 'demo-btn', 'Vaciar');
    bVaciar.type = 'button';
    bVaciar.onclick = function () { esc.obstaculos = []; esc.waypoints = []; cambio(); };
    barraColoca.appendChild(bVaciar);

    /* ---- barra de parámetros, propia de cada método ---- */
    barraPar.appendChild(el('span', 'demo-tag', 'Parámetros'));
    if (esTodo) {
      barraPar.appendChild(opciones('Partición',
        [['Puntos de ruta', 'waypoints'], ['Rejilla', 'rejilla'], ['Triangulación', 'malla']],
        par.particion, function (v) { par.particion = v; cambio(); }));
      var ladoT = deslizador('Lado de celda', 10, 40, 5, par.lado, function (v) { par.lado = v; cambio(); });
      barraPar.appendChild(ladoT.raiz);
      var barraAlg = el('div', 'demo-bar');
      barras.insertBefore(barraAlg, barraPlay);
      barraAlg.appendChild(el('span', 'demo-tag', 'Algoritmo'));
      barraAlg.appendChild(opciones('',
        [['Anchura', 'anchura'], ['Profundidad', 'profundidad'],
         ['Coste uniforme', 'coste'], ['A*', 'astar']],
        par.algoritmo, function (v) { par.algoritmo = v; cambio(); }));
    } else if (esAstar) {
      var pesoH = deslizador('Peso de la h', 0, 2, 0.25, par.peso, function (v) { par.peso = v; cambio(); });
      barraPar.appendChild(pesoH.raiz);
      [['0 · Dijkstra', 0], ['1 · A*', 1], ['2 · inflada', 2]].forEach(function (o) {
        var bb = el('button', 'demo-btn demo-btn-mini', o[0]);
        bb.type = 'button';
        bb.onclick = function () { par.peso = o[1]; pesoH.pon(o[1]); cambio(); };
        barraPar.appendChild(bb);
      });
    } else if (esDijkstra) {
      barraPar.appendChild(opciones('Costes', [['Los de las aristas', 'mano'], ['Todos a 1', 'uno']],
                                    par.costes, function (v) { par.costes = v; cambio(); }));
    } else if (esGrafo) {
      barraPar.appendChild(opciones('Método', [['Anchura (cola FIFO)', 'anchura'],
                                               ['Profundidad (pila LIFO)', 'profundidad']],
                                    par.modo, function (v) { par.modo = v; cambio(); }));
    } else if (tipo === 'waypoints') {
      barraPar.appendChild(interruptor('Puntos en las esquinas', par.auto, function (v) { par.auto = v; cambio(); }));
      barraPar.appendChild(deslizador('Margen', 4, 22, 1, par.margen, function (v) { par.margen = v; cambio(); }).raiz);
    } else if (tipo === 'rejilla') {
      barraPar.appendChild(deslizador('Lado de celda', 5, 40, 5, par.lado, function (v) { par.lado = v; cambio(); }).raiz);
      barraPar.appendChild(opciones('Vecindad', [['4', 4], ['8', 8]], par.vecindad, function (v) { par.vecindad = v; cambio(); }));
    } else {
      barraPar.appendChild(interruptor('Fundir en sectores', par.fundir, function (v) { par.fundir = v; cambio(); }));
      barraPar.appendChild(interruptor('Ver portales', par.portales, function (v) { par.portales = v; pinta(); }));
      barraPar.appendChild(interruptor('Tirar de la cuerda', par.cuerda, function (v) { par.cuerda = v; if (resultado) calcula(); else pinta(); }));
    }

    /* ---- play ---- */
    var bPlay = el('button', 'demo-btn demo-play', '▶  Calcular la ruta');
    bPlay.type = 'button';
    bPlay.onclick = calcula;
    barraPlay.appendChild(bPlay);
    var bReset = el('button', 'demo-btn', 'Escena de ejemplo');
    bReset.type = 'button';
    bReset.onclick = function () {
      if (esGrafo) { esc = copiaRed(esAstar ? ASTAR : esDijkstra ? RED : GRAFO); aristaSel = -1; cambio(); return; }
      esc.obstaculos = PRESET.map(function (p) { return p.map(function (q) { return pt(q.x, q.y); }); });
      esc.waypoints = [];
      esc.a = pt(30, 170); esc.b = pt(292, 172);
      cambio();
    };
    barraPlay.appendChild(bReset);

    /* ---- paso a paso, sólo en la rejilla ---- */
    var conPasos = tipo === 'rejilla' || esGrafo || esTodo;
    void conPasos;
    var barraPaso = null, traqueo = null, botPaso = {}, deslPaso = null, contPaso = null;
    if (conPasos) {
      barraPaso = el('div', 'demo-bar demo-bar-paso');
      barras.appendChild(barraPaso);
      barraPaso.appendChild(el('span', 'demo-tag', 'Paso a paso'));

      botPaso.reini = boton('⏮', 'Volver al principio', function () { para(); verPaso(-1); });
      botPaso.atras = boton('‹', 'Un paso atrás', function () { para(); verPaso((paso == null ? traza.length : paso) - 1); });
      botPaso.tocar = boton('▶  Reproducir', null, alternaReproduccion);
      botPaso.alante = boton('›', 'Un paso adelante', function () { para(); verPaso((paso == null ? -1 : paso) + 1); });
      [botPaso.reini, botPaso.atras, botPaso.tocar, botPaso.alante].forEach(function (b) {
        barraPaso.appendChild(b);
      });

      var campo = el('label', 'demo-campo');
      campo.appendChild(el('span', null, 'Paso'));
      deslPaso = document.createElement('input');
      deslPaso.type = 'range'; deslPaso.min = 0; deslPaso.max = 1; deslPaso.step = 1; deslPaso.value = 0;
      deslPaso.oninput = function () { para(); verPaso(Number(deslPaso.value) - 1); };
      campo.appendChild(deslPaso);
      barraPaso.appendChild(campo);
      contPaso = el('span', 'demo-cuenta', '');
      barraPaso.appendChild(contPaso);

      traqueo = el('p', 'demo-traza');
      traqueo.hidden = true;
      barras.parentNode.insertBefore(traqueo, lectura);
    }

    // Qué está calculando el ejemplo, escrito donde se ve. En cualquier cosa
    // con A* hay que decir cuál es la h: sin eso no se puede comprobar nada de
    // lo que sale en pantalla.
    var definicion = el('p', 'demo-def');
    barras.parentNode.insertBefore(definicion, traqueo || lectura);

    function boton(txt, titulo, alPulsar) {
      var b = el('button', 'demo-btn', txt);
      b.type = 'button';
      if (titulo) b.title = titulo;
      b.onclick = alPulsar;
      return b;
    }

    function para() {
      if (reloj) { clearInterval(reloj); reloj = null; }
      if (botPaso.tocar) botPaso.tocar.textContent = '▶  Reproducir';
    }

    function alternaReproduccion() {
      if (reloj) { para(); return; }
      if (!traza || !traza.length) return;
      if (paso == null || paso >= traza.length - 1) paso = -1;
      botPaso.tocar.textContent = '⏸  Pausa';
      var ritmo = Math.max(35, Math.min(260, Math.round(9000 / traza.length)));
      reloj = setInterval(function () {
        if (!traza || paso >= traza.length - 1) { para(); return; }
        verPaso(paso + 1);
      }, ritmo);
      verPaso(paso);
    }

    function verPaso(i) {
      if (!traza || !traza.length) return;
      paso = Math.max(-1, Math.min(traza.length - 1, i));
      pinta();
    }

    function ajustaPasos() {
      if (!barraPaso) return;
      var hay = !!(traza && traza.length);
      [botPaso.reini, botPaso.atras, botPaso.tocar, botPaso.alante].forEach(function (b) {
        b.disabled = !hay;
      });
      deslPaso.disabled = !hay;
      deslPaso.max = hay ? traza.length : 1;
      deslPaso.value = hay ? (paso == null ? traza.length : paso + 1) : 0;
      traqueo.hidden = !(hay && paso != null);
      traqueo.textContent = textoTraza();
      contPaso.textContent = !hay ? ''
        : paso == null ? 'ruta terminada · ' + traza.length + ' pasos'
        : paso < 0     ? 'antes de empezar · ' + traza.length + ' pasos en total'
                       : 'paso ' + (paso + 1) + ' de ' + traza.length;
    }

    function etiquetaCelda(k) {
      var r = rectCelda(descomp, k);
      return '(' + r.c + ',' + r.f + ')';
    }

    function textoTraza() {
      if (!traza || !traza.length || paso == null) return '';
      if (esTodo) return trazaTodo();
      if (esCoste) return trazaDijkstra();
      if (esGrafo) return trazaGrafo();
      var i = paso, total = i < 0 ? 1 : traza[i].total;
      var cola = orden.slice(i + 1, total);
      var cabeza = cola.slice(0, 8).map(etiquetaCelda).join(' ');
      var resto = cola.length > 8 ? '  … y ' + (cola.length - 8) + ' más' : '';
      var l1 = 'cola (FIFO) → ' + (cola.length ? cabeza + resto : 'vacía');
      var l2;
      if (i < 0) {
        l2 = 'visitados = {' + etiquetaCelda(orden[0]) + '} · el bucle aún no ha dado la primera vuelta';
      } else {
        var t = traza[i];
        l2 = 'k ← desencolar(cola) = ' + etiquetaCelda(t.sacada) + ' · ' +
             (t.nuevas.length
               ? 'encola ' + t.nuevas.map(etiquetaCelda).join(' ')
               : 'ninguna vecina nueva') +
             ' · |visitados| = ' + total;
        if (t.sacada === trazaFin) l2 += ' · k = fin: se reconstruye el camino y se sale';
      }
      return l1 + '\n' + l2;
    }

    function trazaTodo() {
      var est = estadoGrafo(), r = redActual();
      if (!est || !r) return '';
      var cerr = 0;
      for (var k = 0; k < r.nodos.length; k++) if (est.visto[k]) cerr++;
      var estr = usaCoste() ? 'cola de prioridad por ' + (par.algoritmo === 'astar' ? 'f = g + h' : 'g')
                : par.algoritmo === 'anchura' ? 'cola FIFO' : 'pila LIFO';
      var l1 = 'frontera (' + estr + '): ' + est.frontera.length +
               ' · ' + (usaCoste() ? 'cerrados' : 'visitados') + ': ' + cerr +
               ' de ' + r.nodos.length;
      var l2;
      if (est.i < 0) {
        l2 = 'el bucle aún no ha dado la primera vuelta';
      } else if (est.t.repetido) {
        l2 = 'sale una entrada vieja de la cola y se descarta';
      } else {
        var nn = r.nodos[est.t.sacado];
        l2 = 'sale el nodo n.º ' + est.t.sacado + ' (' + Math.round(nn.x) + ', ' + Math.round(nn.y) + ')';
        if (usaCoste() && est.g) l2 += ' con g=' + Math.round(est.g[est.t.sacado]);
        var nuevos = est.t.nuevos ? est.t.nuevos.length
                   : est.t.relaj ? est.t.relaj.filter(function (x) { return x.mejora; }).length : 0;
        l2 += ' · ' + (usaCoste() ? 'relaja ' : 'añade ') + nuevos;
      }
      return l1 + '\n' + l2;
    }

    function trazaDijkstra() {
      var est = estadoGrafo();
      if (!est) return '';
      var pon = function (x) { return x === Infinity ? '∞' : String(x); };

      var f = est.t ? est.t.frontera.slice()
                    : [{ n: esc.a, g: 0, f: esAstar && hs ? hs[esc.a] : 0 }];
      var mejor = 0;
      for (var j = 1; j < f.length; j++) if (f[j].f < f[mejor].f) mejor = j;
      var trozos = f.map(function (x, jj) {
        var txt = esAstar
          ? nombreNodo(x.n) + ':' + pon(x.f) + '(' + pon(x.g) + '+' + pon(x.f - x.g) + ')'
          : nombreNodo(x.n) + ':' + pon(x.g);
        return jj === mejor ? '[' + txt + ']' : txt;
      });
      var l1 = 'frontera (cola de prioridad por ' + (esAstar ? 'f' : 'g') + ') → ' +
               (f.length ? trozos.slice(0, 10).join(' ') + (f.length > 10 ? ' …' : '') +
                           '   sale el de ' + (esAstar ? 'f' : 'g') + ' menor'
                         : 'vacía');

      var cer = [];
      for (var k = 0; k < esc.nodos.length; k++) if (est.visto[k]) cer.push(nombreNodo(k));
      var l2 = 'cerrados = {' + cer.join(', ') + '}';

      var vistos = [];
      for (k = 0; k < esc.nodos.length; k++) {
        if (est.g[k] === Infinity) continue;
        vistos.push(nombreNodo(k) + ':' + pon(est.g[k]) +
                    (esAstar && hs ? '+' + hs[k] : ''));
      }
      var l3 = (esAstar ? 'g+h = {' : 'g = {') + vistos.join(', ') + '}';

      var sacada = function (t) {
        return 'n ← sacar(frontera) = ' + nombreNodo(t.sacado) +
               (esAstar ? ' con f=' + pon(t.fSacado) + ' (g=' + pon(t.gSacado) +
                          ', h=' + pon(t.fSacado - t.gSacado) + ')'
                        : ' con g=' + pon(t.gSacado));
      };
      var l4;
      if (est.i < 0) {
        l4 = 'el bucle aún no ha dado la primera vuelta';
      } else if (est.t.repetido) {
        l4 = sacada(est.t) + ' · ya estaba cerrado: es una entrada vieja de la cola y se descarta';
      } else if (est.t.sacado === esc.b) {
        l4 = sacada(est.t) + ' · n = objetivo: se reconstruye el camino con padre';
      } else {
        l4 = sacada(est.t);
        if (est.t.relaj.length) {
          l4 += ' · relaja ' + est.t.relaj.map(function (r) {
            return nombreNodo(r.v) + ' ' + pon(r.antes) + '→' + pon(r.ahora) +
                   (r.mejora ? ' ✓' : ' ✗ no mejora');
          }).join(' · ');
        } else {
          l4 += ' · ningún vecino que relajar';
        }
      }
      return l1 + '\n' + l2 + '\n' + l3 + '\n' + l4;
    }

    function trazaGrafo() {
      var est = estadoGrafo();
      if (!est) return '';
      var fifo = par.modo === 'anchura';
      var f = est.frontera.slice();
      var cortada = f.length > 12;
      var vista = fifo ? f.slice(0, 12) : f.slice(Math.max(0, f.length - 12));
      var marca = fifo ? 0 : vista.length - 1;
      var trozos = vista.map(function (k, j) {
        return j === marca ? '[' + nombreNodo(k) + ']' : nombreNodo(k);
      });
      if (cortada) { if (fifo) trozos.push('…'); else trozos.unshift('…'); }
      var l1 = 'frontera (' + (fifo ? 'cola FIFO' : 'pila LIFO') + ') → ' +
               (f.length ? trozos.join(' ') + '   sale ' + (fifo ? 'por la izquierda' : 'por la derecha')
                         : 'vacía');

      var vis = [], pad = [];
      for (var k = 0; k < esc.nodos.length; k++) {
        if (!est.visto[k]) continue;
        vis.push(nombreNodo(k));
        if (est.padre[k] >= 0) pad.push(nombreNodo(k) + '←' + nombreNodo(est.padre[k]));
      }
      var l2 = 'visitados = {' + vis.join(', ') + '}';
      if (pad.length) l2 += ' · padre = {' + pad.join(', ') + '}';

      var l3;
      if (est.i < 0) {
        l3 = 'el bucle aún no ha dado la primera vuelta';
      } else {
        var t = est.t;
        l3 = 'n ← sacar(frontera) = ' + nombreNodo(t.sacado);
        if (t.repetido) l3 += ' · ya estaba en visitados: se descarta y se sigue';
        else if (t.sacado === esc.b) l3 += ' · n = objetivo: se reconstruye el camino con padre';
        else l3 += ' · ' + (t.nuevos.length
              ? 'añade a la frontera ' + t.nuevos.map(nombreNodo).join(' ')
              : 'ninguna vecina nueva');
      }
      return l1 + '\n' + l2 + '\n' + l3;
    }

    function pintaHerramientas() {
      Object.keys(botHerr).forEach(function (k) {
        botHerr[k].setAttribute('aria-pressed', String(k === herramienta));
      });
      Array.prototype.forEach.call(grupoForma.children, function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-forma') === forma));
      });
      grupoForma.hidden = esGrafo || herramienta !== 'obstaculo';
      talla.raiz.hidden = esGrafo || herramienta !== 'obstaculo';
      if (pesa) pesa.raiz.hidden = herramienta !== 'coste' && herramienta !== 'arista';
      if (esAstar && pesa) pesa.raiz.title = 'Multiplica el coste de la arista: 1 es terreno normal';
      if (esTodo && ladoT) ladoT.raiz.hidden = par.particion !== 'rejilla';
    }

    /* ---- clics sobre la escena ---- */
    svg.addEventListener('pointerdown', function (ev) {
      var p = enMundo(svg, ev);
      if (!p) return;
      ev.preventDefault();
      aviso = '';

      if (esGrafo) { clicGrafo(p); return; }

      if (herramienta === 'obstaculo') {
        var nuevo = normaliza(FORMAS[forma](p.x, p.y, tam));
        var c = caja(nuevo);
        if (c.x0 < 2 || c.y0 < 2 || c.x1 > W - 2 || c.y1 > H - 2) { aviso = 'ahí no cabe entero'; pinta(); return; }
        for (var i = 0; i < esc.obstaculos.length; i++) {
          if (solapanPoligonos(nuevo, esc.obstaculos[i])) {
            aviso = 'los obstáculos no pueden solaparse'; pinta(); return;
          }
        }
        if (dentroPoligono(esc.a, nuevo) || dentroPoligono(esc.b, nuevo)) {
          aviso = 'ahí están la salida o el destino'; pinta(); return;
        }
        esc.obstaculos.push(nuevo);
      } else if (herramienta === 'quitar') {
        var quitado = false;
        for (var k = esc.obstaculos.length - 1; k >= 0; k--) {
          if (dentroPoligono(p, esc.obstaculos[k])) { esc.obstaculos.splice(k, 1); quitado = true; break; }
        }
        if (!quitado) {
          for (k = esc.waypoints.length - 1; k >= 0; k--) {
            if (dist(p, esc.waypoints[k]) < 9) { esc.waypoints.splice(k, 1); quitado = true; break; }
          }
        }
        if (!quitado) { aviso = 'ahí no hay nada que quitar'; pinta(); return; }
      } else if (herramienta === 'punto') {
        if (!libre(p, esc.obstaculos, 2)) { aviso = 'un punto de ruta va en suelo libre'; pinta(); return; }
        esc.waypoints.push(p);
      } else {
        if (!libre(p, esc.obstaculos, 2)) { aviso = 'eso cae dentro de un obstáculo'; pinta(); return; }
        esc[herramienta] = p;
      }
      cambio();
    });

    // Una arista que pasa justo por encima de otros nodos no se ve: el atajo
    // del ejemplo va de una esquina de abajo a la otra, o sea por encima de
    // toda la fila. Esas se dibujan combadas, que es lo que se hace siempre que
    // dos aristas se solapan. El coste sigue siendo el de la línea recta.
    function curvaDe(a, b) {
      var estorba = false;
      for (var i = 0; i < esc.nodos.length && !estorba; i++) {
        var q = esc.nodos[i];
        if (q === a || q === b) continue;
        if (distanciaAsegmento(q, a, b) < 10) estorba = true;
      }
      if (!estorba) return null;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L;
      // se comba hacia fuera, alejándose del centro del lienzo
      if ((mx - W / 2) * nx + (my - H / 2) * ny < 0) { nx = -nx; ny = -ny; }
      return pt(mx + nx * 44, my + ny * 44);
    }

    // el trazo que recorre una serie de nodos siguiendo las aristas de verdad:
    // si alguna va combada, el trazo se comba con ella
    function trazoPorNodos(ids) {
      var d = '';
      for (var i = 0; i < ids.length; i++) {
        var p = esc.nodos[ids[i]];
        if (i === 0) { d = 'M' + p.x + ' ' + p.y; continue; }
        var c = curvaDe(esc.nodos[ids[i - 1]], p);
        d += c ? ' Q' + c.x + ' ' + c.y + ' ' + p.x + ' ' + p.y : ' L' + p.x + ' ' + p.y;
      }
      return d;
    }

    function lineaOArco(g, a, b, cls) {
      var c = curvaDe(a, b);
      g.appendChild(c
        ? svgEl('path', { d: 'M' + a.x + ' ' + a.y + ' Q' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y,
                          class: cls + ' dm-curva' })
        : svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls }));
    }

    // el punto medio por el que pasa de verdad la arista, recta o combada
    function medioDe(a, b) {
      var c = curvaDe(a, b);
      if (!c) return pt((a.x + b.x) / 2, (a.y + b.y) / 2);
      return pt((a.x + 2 * c.x + b.x) / 4, (a.y + 2 * c.y + b.y) / 4);
    }

    function nodoCerca(p, radio) {
      var mejor = -1, d = radio == null ? 13 : radio;
      for (var i = 0; i < esc.nodos.length; i++) {
        var dd = dist(p, esc.nodos[i]);
        if (dd < d) { d = dd; mejor = i; }
      }
      return mejor;
    }

    function aristaCerca(p) {
      var mejor = -1, d = 8;
      for (var i = 0; i < esc.aristas.length; i++) {
        var e = esc.aristas[i], a = esc.nodos[e[0]], b = esc.nodos[e[1]];
        var c = curvaDe(a, b), dd;
        if (!c) dd = distanciaAsegmento(p, a, b);
        else {
          // la combada, a trozos: basta con muestrear la curva
          dd = Infinity;
          var ant = a;
          for (var t = 1; t <= 8; t++) {
            var u = t / 8, k = (1 - u) * (1 - u), k2 = 2 * (1 - u) * u, k3 = u * u;
            var q = pt(k * a.x + k2 * c.x + k3 * b.x, k * a.y + k2 * c.y + k3 * b.y);
            dd = Math.min(dd, distanciaAsegmento(p, ant, q));
            ant = q;
          }
        }
        if (dd < d) { d = dd; mejor = i; }
      }
      return mejor;
    }

    function clicGrafo(p) {
      var i = nodoCerca(p);

      if (herramienta === 'nodo') {
        if (i >= 0) { aviso = 'ahí ya hay un nodo'; pinta(); return; }
        if (p.x < 12 || p.y < 12 || p.x > W - 12 || p.y > H - 12) { aviso = 'demasiado pegado al borde'; pinta(); return; }
        esc.nodos.push(p);
        cambio(); return;
      }

      if (herramienta === 'mover') {
        if (i < 0) { aviso = 'pincha en un nodo y vuelve a pinchar donde lo quieras'; pinta(); return; }
        aristaSel = i; herramienta = 'soltar'; pinta(); return;
      }
      if (herramienta === 'soltar') {
        if (p.x < 12 || p.y < 12 || p.x > W - 12 || p.y > H - 12) { aviso = 'demasiado pegado al borde'; pinta(); return; }
        esc.nodos[aristaSel] = p;
        aristaSel = -1; herramienta = 'mover'; cambio(); return;
      }
      if (herramienta === 'coste') {
        var ic = aristaCerca(p);
        if (ic < 0) { aviso = 'pincha encima de una arista'; pinta(); return; }
        esc.aristas[ic][2] = esAstar ? par.terreno : par.coste;
        cambio(); return;
      }

      if (herramienta === 'arista') {
        if (i < 0) { aviso = 'pincha en un nodo'; pinta(); return; }
        if (aristaSel < 0) { aristaSel = i; pinta(); return; }
        if (aristaSel === i) { aristaSel = -1; pinta(); return; }
        var a = Math.min(aristaSel, i), b = Math.max(aristaSel, i), k;
        for (k = 0; k < esc.aristas.length; k++) {
          if (esc.aristas[k][0] === a && esc.aristas[k][1] === b) {
            esc.aristas.splice(k, 1); aristaSel = -1; cambio(); return;   // ya estaba: se quita
          }
        }
        esc.aristas.push([a, b, esDijkstra ? par.coste : esAstar ? par.terreno : 1]);
        aristaSel = -1; cambio(); return;
      }

      if (herramienta === 'quitar') {
        if (i >= 0) {
          if (esc.nodos.length <= 2) { aviso = 'hacen falta al menos dos nodos'; pinta(); return; }
          esc.nodos.splice(i, 1);
          esc.aristas = esc.aristas.filter(function (e) { return e[0] !== i && e[1] !== i; })
                                   .map(function (e) { return [e[0] > i ? e[0] - 1 : e[0], e[1] > i ? e[1] - 1 : e[1]]; });
          if (esc.a === i) esc.a = 0;
          if (esc.b === i) esc.b = esc.nodos.length - 1;
          if (esc.a > i) esc.a--;
          if (esc.b > i) esc.b--;
          aristaSel = -1; cambio(); return;
        }
        var ia = aristaCerca(p);
        if (ia >= 0) { esc.aristas.splice(ia, 1); cambio(); return; }
        aviso = 'ahí no hay nada que quitar'; pinta(); return;
      }

      // salida y destino
      if (i < 0) { aviso = 'pincha en un nodo'; pinta(); return; }
      if (herramienta === 'a' && i === esc.b) { aviso = 'la salida y el destino no pueden ser el mismo'; pinta(); return; }
      if (herramienta === 'b' && i === esc.a) { aviso = 'la salida y el destino no pueden ser el mismo'; pinta(); return; }
      esc[herramienta] = i;
      cambio();
    }

    function cambio() {
      aviso = ''; resultado = null;
      para(); traza = null; orden = null; paso = null;
      descompone(); pinta();
    }

    /* ---- los tres métodos ---- */
    function usaCoste() {
      return esCoste || (esTodo && (par.algoritmo === 'coste' || par.algoritmo === 'astar'));
    }
    function redActual() {
      return esTodo ? (descomp && descomp.red) : esc;
    }

    function descompone() {
      if (esTodo) { descomp = construyeRed(esc, par); return; }
      if (esGrafo) {
        descomp = adyacencia(esc);
        hs = esAstar ? esc.nodos.map(function (_, k) { return heuristicaDe(k); }) : null;
        return;
      }
      if (tipo === 'waypoints') {
        descomp = redWaypoints(esc, par);
      } else if (tipo === 'rejilla') {
        descomp = rejilla(esc, par.lado);
      } else {
        var cosido = esc.obstaculos.length ? cosePoligono(esc.obstaculos)
                                           : [pt(0, 0), pt(W, 0), pt(W, H), pt(0, H)];
        if (!cosido) { descomp = null; return; }
        var c = canoniza(cosido, orejas(cosido));
        descomp = {
          pts: c.pts, tris: c.tris,
          secs: par.fundir ? fundeSectores(c.pts, c.tris) : c.tris
        };
        descomp.portales = vecinos(descomp.secs).portales;
      }
    }

    function calcula() {
      aviso = '';
      if (esTodo) {
        if (!descomp || descomp.falla) {
          resultado = { falla: (descomp && descomp.falla) || 'no se ha podido partir el espacio' };
          traza = null; pinta(); return;
        }
        var r = descomp.red, bu2;
        var largoDe2 = function (e) { return dist(r.nodos[e[0]], r.nodos[e[1]]); };
        if (par.algoritmo === 'coste') bu2 = busquedaCoste(r, largoDe2, function () { return 0; });
        else if (par.algoritmo === 'astar') bu2 = busquedaCoste(r, largoDe2,
          function (k) { return dist(r.nodos[k], r.nodos[r.b]); });
        else bu2 = busquedaCiega(r, par.algoritmo);
        if (!bu2) { resultado = { falla: 'hacen falta una salida y un destino' }; pinta(); return; }
        traza = bu2.traza; orden = null; paso = null;
        resultado = bu2.camino
          ? { camino: bu2.camino, cerrados: bu2.cerrados == null ? bu2.camino && null : bu2.cerrados }
          : { falla: 'no hay camino por esta partición' };
        if (bu2.camino) {
          var pts = bu2.camino.map(function (k) { return r.nodos[k]; });
          if (par.particion === 'rejilla') { pts.unshift(esc.a); pts.push(esc.b); }
          resultado.pts = pts;
          resultado.largo = Math.round(largoDe(pts));
          resultado.explorados = bu2.cerrados != null ? bu2.cerrados : contarVistos(bu2.traza);
        }
        pinta(); return;
      }
      if (esGrafo) {
        var bu = esCoste ? busquedaCoste(esc, costeDe, heuristicaDe) : busquedaCiega(esc, par.modo);
        if (!bu) { resultado = { falla: 'hacen falta una salida y un destino' }; pinta(); return; }
        traza = bu.traza; orden = null; paso = null;
        hs = bu.h || null;
        resultado = bu.camino ? { camino: bu.camino, coste: bu.coste, cerrados: bu.cerrados }
                              : { falla: 'no hay camino: el destino no está conectado con la salida' };
        pinta(); return;
      }
      if (tipo === 'waypoints') {
        var r = rutaWaypoints(esc, descomp);
        resultado = r ? { pts: r } : { falla: 'no hay ruta: hacen falta puntos que enlacen la salida con el destino' };
      } else if (tipo === 'rejilla') {
        var g = rutaRejilla(descomp, esc, par.vecindad);
        traza = g.traza || null;  orden = g.orden || null;  trazaFin = g.fin;
        paso = null;
        resultado = g.camino ? { pts: g.camino, celdas: g.celdas } : { falla: g.motivo };
      } else {
        if (!descomp) { resultado = { falla: 'esta escena no se ha podido triangular' }; pinta(); return; }
        var s = rutaSectores(descomp.pts, descomp.secs, esc);
        if (!s) { resultado = { falla: 'no hay camino entre los dos sectores' }; }
        else {
          resultado = {
            pts: par.cuerda ? tiraDeLaCuerda(esc.a, esc.b, s.portales)
                            : porLosPortales(esc.a, esc.b, s.portales),
            sectores: s.sectores, portalesRuta: s.portales
          };
        }
      }
      pinta();
    }

    function contarVistos(tr) {
      if (!tr.length) return 0;
      var u = tr[tr.length - 1].visto, n = 0;
      for (var i = 0; i < u.length; i++) if (u[i]) n++;
      return n;
    }

    /* ---- dibujo ---- */
    function pinta() {
      svg.textContent = '';
      var gFondo = svgEl('g', {}), gDesc = svgEl('g', {}), gObs = svgEl('g', {}),
          gRuta = svgEl('g', {}), gMarcas = svgEl('g', {});
      svg.appendChild(gFondo); svg.appendChild(gDesc); svg.appendChild(gObs);
      svg.appendChild(gRuta); svg.appendChild(gMarcas);

      gFondo.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'dm-suelo' }));

      if (esTodo) {
        pintaTodo(gDesc, gRuta);
        esc.obstaculos.forEach(function (o) {
          gObs.appendChild(svgEl('path', { d: cerrada(o), class: 'dm-obs' }));
        });
        marcaSalida(gMarcas, esc.a);
        marcaDestino(gMarcas, esc.b);
      } else if (esGrafo) {
        pintaGrafo(gDesc, gRuta, gMarcas);
      } else {
        if (tipo === 'waypoints') pintaWaypoints(gDesc, gRuta);
        else if (tipo === 'rejilla') pintaRejilla(gDesc, gRuta);
        else pintaMalla(gDesc, gRuta);

        esc.obstaculos.forEach(function (o) {
          gObs.appendChild(svgEl('path', { d: cerrada(o), class: 'dm-obs' }));
        });
        marcaSalida(gMarcas, esc.a);
        marcaDestino(gMarcas, esc.b);
      }

      svg.setAttribute('aria-label', textoLectura(true));
      lectura.textContent = textoLectura(false);
      pintaHerramientas();
      ajustaPasos();
      definicion.textContent = textoDefinicion();
    }

    // El estado de la búsqueda en el paso que se esté mirando. El paso -1 es
    // «antes de la primera vuelta»: la frontera sólo tiene la salida.
    function estadoGrafo() {
      var r = redActual();
      if (!r) return null;
      var N = r.nodos.length;
      if (paso == null || !traza || !traza.length) return null;
      var i = Math.max(-1, Math.min(paso, traza.length - 1)), k;
      if (i >= 0) {
        var t = traza[i];
        return {
          i: i, t: t, padre: t.padre, g: t.g,
          frontera: usaCoste() ? t.frontera.map(function (x) { return x.n; }) : t.frontera,
          visto: usaCoste() ? t.cerrado : t.visto
        };
      }
      var visto = new Uint8Array(N);
      if (!usaCoste() && par.modo === 'anchura') visto[r.a] = 1;
      var padre = new Int32Array(N);
      for (k = 0; k < N; k++) padre[k] = -1;
      var g = null;
      if (usaCoste()) { g = new Array(N); for (k = 0; k < N; k++) g[k] = Infinity; g[r.a] = 0; }
      return { i: -1, t: null, frontera: [r.a], visto: visto, padre: padre, g: g };
    }

    function pintaGrafo(g, gr, gm) {
      var N = esc.nodos.length, est = estadoGrafo(), k;
      var enFrontera = new Uint8Array(N);
      if (est) est.frontera.forEach(function (x) { enFrontera[x] = 1; });

      var relajadas = {};
      if (esDijkstra && est && est.t && !est.t.repetido) {
        est.t.relaj.forEach(function (r) {
          relajadas[Math.min(est.t.sacado, r.v) + ':' + Math.max(est.t.sacado, r.v)] = r.mejora;
        });
      }

      esc.aristas.forEach(function (e) {
        var a = esc.nodos[e[0]], b = esc.nodos[e[1]];
        var cla = esAstar && e[2] > 1 ? 'dm-arista-g dm-lenta' : 'dm-arista-g';
        var rel = relajadas[Math.min(e[0], e[1]) + ':' + Math.max(e[0], e[1])];
        if (rel === true) cla = 'dm-relaja';
        else if (rel === false) cla = 'dm-relaja-no';
        var c = curvaDe(a, b);
        g.appendChild(c
          ? svgEl('path', { d: 'M' + a.x + ' ' + a.y + ' Q' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y,
                            class: cla + ' dm-curva' })
          : svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cla }));
      });
      // el árbol que se va guardando en `padre`
      if (est) {
        for (k = 0; k < N; k++) {
          var pa = est.padre[k];
          if (pa < 0 || !est.visto[k]) continue;
          lineaOArco(g, esc.nodos[pa], esc.nodos[k], 'dm-padre');
        }
      }

      // el camino: al terminar, o en el último paso de una búsqueda con éxito
      var enseñaCamino = resultado && resultado.camino &&
        (est == null || (est.t && est.t.sacado === esc.b && !est.t.repetido));
      if (enseñaCamino) {
        gr.appendChild(svgEl('path', { d: trazoPorNodos(resultado.camino), class: 'dm-ruta dm-curva' }));
      }

      esc.nodos.forEach(function (p, k2) {
        var cls = 'dm-nodo';
        if (est) {
          if (est.t && est.t.sacado === k2) cls = 'dm-nodo dm-nodo-ahora';
          else if (enFrontera[k2]) cls = 'dm-nodo dm-nodo-frontera';
          else if (est.visto[k2]) cls = 'dm-nodo dm-nodo-visto';
        }
        g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 9, class: cls }));
        g.appendChild(svgEl('text', { x: p.x, y: p.y + 3.4, class: 'dm-etq' })).textContent = nombreNodo(k2);
      });

      // la g de cada nodo, que es lo que hay que mirar cambiar
      var gs = est ? est.g : (esCoste && traza && traza.length ? traza[traza.length - 1].g : null);
      if (esCoste && gs) {
        esc.nodos.forEach(function (p, k2) {
          var val = gs[k2] === Infinity ? '∞' : String(gs[k2]);
          var cambia = est && est.t && !est.t.repetido &&
                       est.t.relaj.some(function (r) { return r.v === k2 && r.mejora; });
          var anillo = k2 === esc.a || k2 === esc.b;
          // en A* interesa ver de qué se compone la f, no sólo la g
          var txt = !esAstar || !hs ? 'g=' + val
            : gs[k2] === Infinity ? 'h=' + hs[k2]
            : val + '+' + hs[k2] + '=' + (gs[k2] + hs[k2]);
          rotulo(g, p.x, p.y - (anillo ? 17 : 13), txt, cambia ? 'dm-g dm-g-nueva' : 'dm-g');
        });
      }

      if (aristaSel >= 0 && esc.nodos[aristaSel]) {
        gm.appendChild(svgEl('circle', {
          cx: esc.nodos[aristaSel].x, cy: esc.nodos[aristaSel].y, r: 13, class: 'dm-elegido'
        }));
      }
      marcaNodo(gm, esc.a, 'dm-anillo-a', 'salida');
      marcaNodo(gm, esc.b, 'dm-anillo-b', 'destino');

      // los costes, los últimos: si no, la ruta les pasa por encima
      if (esCoste) {
        esc.aristas.forEach(function (e) {
          var a = esc.nodos[e[0]], b = esc.nodos[e[1]], m = medioDe(a, b);
          // en las verticales, el punto medio cae justo donde va la etiqueta
          // del nodo, así que el coste se aparta a un lado
          var x = m.x;
          if (Math.abs(b.y - a.y) > Math.abs(b.x - a.x)) x += (m.x > W / 2 ? -26 : 26);
          rotulo(gm, x, m.y + 2.6, String(costeDe(e)), 'dm-coste');
        });
      }
    }

    // un rótulo con su plato detrás, que si no las aristas lo cruzan y no se lee
    function rotulo(gm, x, y, txt, cls) {
      var ancho = txt.length * 4.6 + 6;
      gm.appendChild(svgEl('rect', {
        x: Math.max(1, Math.min(W - ancho - 1, x - ancho / 2)), y: y - 7.2,
        width: ancho, height: 9.6, rx: 2, class: 'dm-plato'
      }));
      var t = svgEl('text', { x: x, y: y, class: cls });
      t.textContent = txt;
      gm.appendChild(t);
    }

    function marcaNodo(gm, k, cls, txt) {
      var p = esc.nodos[k];
      if (!p) return;
      gm.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 12.5, class: cls }));
      var y = p.y < H - 26 ? p.y + 24 : p.y - 17;
      // un plato detrás del rótulo: si no, las aristas que salen del nodo se le
      // cruzan por encima y no hay quien lo lea
      var ancho = txt.length * 4.9 + 7;
      gm.appendChild(svgEl('rect', {
        x: Math.max(1, Math.min(W - ancho - 1, p.x - ancho / 2)), y: y - 8,
        width: ancho, height: 11, rx: 2, class: 'dm-plato'
      }));
      var t = svgEl('text', { x: p.x, y: y, class: 'dm-pie' });
      t.textContent = txt;
      gm.appendChild(t);
    }

    function pintaTodo(g, gr) {
      if (!descomp || descomp.falla) return;
      var r = descomp.red, est = estadoGrafo(), i;
      var enF = new Uint8Array(r.nodos.length);
      if (est) est.frontera.forEach(function (x) { enF[x] = 1; });
      var clase = function (k) {
        if (!est) return '';
        if (est.t && est.t.sacado === k) return 'dm-celda-ahora';
        if (enF[k]) return 'dm-celda-cola';
        if (est.visto[k]) return 'dm-celda-vista';
        return '';
      };

      if (descomp.grid) {
        var gg = descomp.grid, libres = 0;
        for (var f = 0; f < gg.filas; f++) {
          for (var c = 0; c < gg.cols; c++) {
            var kk = f * gg.cols + c, rr = rectCelda(gg, kk);
            var cl = gg.bloqueada[kk] ? 'dm-celda dm-celda-no' : 'dm-celda';
            g.appendChild(svgEl('rect', { x: rr.x, y: rr.y, width: rr.w, height: rr.h, class: cl }));
            if (!gg.bloqueada[kk]) {
              var est2 = clase(libres++);
              if (est2) g.appendChild(svgEl('rect', { x: rr.x, y: rr.y, width: rr.w, height: rr.h, class: est2 }));
            }
          }
        }
      } else if (descomp.secs) {
        descomp.secs.forEach(function (sec, k) {
          var poly = sec.map(function (x) { return descomp.pts[x]; });
          g.appendChild(svgEl('path', { d: cerrada(poly), class: 'dm-sector' }));
          var est3 = clase(k);
          if (est3) g.appendChild(svgEl('path', { d: cerrada(poly), class: est3 }));
        });
        descomp.portales.forEach(function (e) {
          g.appendChild(svgEl('line', { x1: descomp.pts[e[0]].x, y1: descomp.pts[e[0]].y,
                                        x2: descomp.pts[e[1]].x, y2: descomp.pts[e[1]].y, class: 'dm-portal' }));
        });
      } else {
        r.aristas.forEach(function (e) {
          g.appendChild(svgEl('line', { x1: r.nodos[e[0]].x, y1: r.nodos[e[0]].y,
                                        x2: r.nodos[e[1]].x, y2: r.nodos[e[1]].y, class: 'dm-arista' }));
        });
        for (i = 0; i < r.nodos.length; i++) {
          var cl2 = clase(i);
          g.appendChild(svgEl('circle', {
            cx: r.nodos[i].x, cy: r.nodos[i].y, r: cl2 ? 4 : 2.8,
            class: cl2 ? 'dm-punto ' + cl2 : 'dm-wp'
          }));
        }
      }

      if (est && est.padre) {
        for (i = 0; i < r.nodos.length; i++) {
          var pa = est.padre[i];
          if (pa < 0 || !est.visto[i]) continue;
          g.appendChild(svgEl('line', { x1: r.nodos[pa].x, y1: r.nodos[pa].y,
                                        x2: r.nodos[i].x, y2: r.nodos[i].y, class: 'dm-padre' }));
        }
      }
      if (resultado && resultado.pts && (est == null || (est.t && est.t.sacado === r.b))) {
        gr.appendChild(svgEl('path', { d: ruta(resultado.pts), class: 'dm-ruta' }));
      }
    }

    function pintaWaypoints(g, gr) {
      if (!descomp) return;
      descomp.aristas.forEach(function (e) {
        var a = descomp.puntos[e[0]], b = descomp.puntos[e[1]];
        g.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'dm-arista' }));
      });
      descomp.puntos.forEach(function (p) {
        g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 2.8, class: 'dm-wp' }));
      });
      if (resultado && resultado.pts) {
        gr.appendChild(svgEl('path', { d: ruta(resultado.pts), class: 'dm-ruta' }));
      }
    }

    function pintaRejilla(g, gr) {
      var gg = descomp, i;
      for (var f = 0; f < gg.filas; f++) {
        for (var c = 0; c < gg.cols; c++) {
          var x = c * gg.lado, y = f * gg.lado;
          var w = Math.min(gg.lado, W - x), h = Math.min(gg.lado, H - y);
          g.appendChild(svgEl('rect', {
            x: x, y: y, width: w, height: h,
            class: gg.bloqueada[f * gg.cols + c] ? 'dm-celda dm-celda-no' : 'dm-celda'
          }));
        }
      }
      if (paso != null && traza && traza.length) { pintaBusqueda(gr); return; }

      if (resultado && resultado.celdas) {
        resultado.celdas.forEach(function (k) {
          var r = rectCelda(gg, k);
          gr.appendChild(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'dm-celda-ruta' }));
        });
      }
      if (resultado && resultado.pts) {
        gr.appendChild(svgEl('path', { d: ruta(resultado.pts), class: 'dm-ruta' }));
      }
    }

    // El estado del bucle en un paso concreto. No hace falta guardar una copia
    // de la cola por paso: con el orden de encolado basta, porque una anchura
    // desencola justo en ese mismo orden. Tras el paso i se han sacado las
    // i+1 primeras, así que la cola es el tramo que va de i+1 hasta las que
    // llevan encoladas, y los visitados son todas esas.
    function pintaBusqueda(gr) {
      var gg = descomp, i = paso;
      var total = i < 0 ? 1 : traza[i].total;
      var marca = new Uint8Array(gg.cols * gg.filas), t;
      for (t = 0; t < total; t++) marca[orden[t]] = 1;          // visitada
      for (t = i + 1; t < total; t++) marca[orden[t]] = 2;      // y además en la cola

      for (var k = 0; k < marca.length; k++) {
        if (!marca[k]) continue;
        var r = rectCelda(gg, k);
        gr.appendChild(svgEl('rect', {
          x: r.x, y: r.y, width: r.w, height: r.h,
          class: marca[k] === 2 ? 'dm-celda-cola' : 'dm-celda-vista'
        }));
      }
      if (i >= 0) {
        traza[i].nuevas.forEach(function (k) {
          var r = rectCelda(gg, k);
          gr.appendChild(svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'dm-celda-nueva' }));
        });
        var a = rectCelda(gg, traza[i].sacada);
        gr.appendChild(svgEl('rect', { x: a.x, y: a.y, width: a.w, height: a.h, class: 'dm-celda-ahora' }));
      }
      // al llegar al final, el camino que se reconstruye
      if (i >= 0 && traza[i].sacada === trazaFin && resultado && resultado.pts) {
        gr.appendChild(svgEl('path', { d: ruta(resultado.pts), class: 'dm-ruta' }));
      }
    }

    function pintaMalla(g, gr) {
      if (!descomp) return;
      var pts = descomp.pts;
      descomp.secs.forEach(function (s, i) {
        var poly = s.map(function (k) { return pts[k]; });
        var activo = resultado && resultado.sectores && resultado.sectores.indexOf(i) >= 0;
        g.appendChild(svgEl('path', { d: cerrada(poly), class: activo ? 'dm-sector dm-sector-on' : 'dm-sector' }));
      });
      if (par.portales) {
        descomp.portales.forEach(function (e) {
          g.appendChild(svgEl('line', {
            x1: pts[e[0]].x, y1: pts[e[0]].y, x2: pts[e[1]].x, y2: pts[e[1]].y, class: 'dm-portal'
          }));
        });
      }
      if (par.portales && resultado && resultado.portalesRuta) {
        resultado.portalesRuta.forEach(function (p) {
          gr.appendChild(svgEl('line', {
            x1: p[0].x, y1: p[0].y, x2: p[1].x, y2: p[1].y, class: 'dm-portal-on'
          }));
        });
      }
      if (resultado && resultado.pts) {
        gr.appendChild(svgEl('path', { d: ruta(resultado.pts), class: 'dm-ruta' }));
      }
    }

    /* ---- lectura ---- */
    function textoDefinicion() {
      var sep = '\n';
      if (esAstar) {
        return 'coste(a, b) = ⌈ dist(a, b) / 10 ⌉ × terreno   (terreno 1 = normal)' + sep +
               'h(n) = ⌊ ' + par.peso + ' × dist(n, destino) / 10 ⌋' +
               (par.peso === 0 ? '   →   h = 0, o sea coste uniforme'
                : par.peso <= 1 ? '   →   admisible: nunca se pasa'
                                : '   →   inflada: ya puede pasarse') + sep +
               '⌈ ⌉ redondea hacia arriba y ⌊ ⌋ hacia abajo: por eso, con el peso a 1, la h nunca se pasa';
      }
      if (esDijkstra) {
        return 'coste(a, b) = el número que lleva cada arista' + sep +
               'h(n) = 0   ·   el coste uniforme es A* sin heurística';
      }
      if (esGrafo) {
        return 'todas las aristas cuentan igual · sin costes y sin heurística' + sep +
               'lo único que cambia entre los dos métodos es de qué punta sale el siguiente nodo';
      }
      if (esTodo) {
        var l1 = 'coste(a, b) = dist(a, b), la distancia entre los dos nodos';
        var l2 = par.algoritmo === 'astar' ? 'h(n) = dist(n, destino), en línea recta   ·   admisible en las tres particiones'
               : par.algoritmo === 'coste' ? 'h(n) = 0'
               : 'anchura y profundidad no miran el coste: cuentan aristas';
        return l1 + sep + l2;
      }
      if (tipo === 'waypoints') {
        return 'aristas por visibilidad, con coste = distancia entre los dos puntos' + sep +
               'la ruta sale de un Dijkstra sobre ese grafo';
      }
      if (tipo === 'rejilla') {
        return 'vecinas libres, todas al mismo precio' + sep +
               'la ruta sale de una anchura: cuenta casillas, no distancias';
      }
      return 'sectores vecinos, con coste = distancia entre sus centros' + sep +
             'la ruta sale de un Dijkstra sobre los sectores, y después se tensa con el embudo';
    }

    function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

    function textoLectura(paraLector) {
      var t = '';
      if (esTodo) {
        if (!descomp || descomp.falla) return (descomp && descomp.falla) || 'sin partición';
        t = NOMBRE_PARTICION[par.particion] +
            (par.particion === 'rejilla' ? ' de ' + par.lado : '') + ' · ' +
            plural(descomp.red.nodos.length, 'nodo', 'nodos') + ' · ' + NOMBRE_ALGORITMO[par.algoritmo];
        if (aviso) return t + ' — ' + aviso;
        if (!resultado) return t + (paraLector ? '' : ' · pulsa «Calcular la ruta»');
        if (resultado.falla) return t + ' — ' + resultado.falla;
        return t + ' · ' + resultado.explorados + ' nodos explorados · ruta de ' +
               resultado.largo + ' unidades en ' +
               plural(traza.length, 'vuelta del bucle', 'vueltas del bucle');
      }
      if (esGrafo) {
        t = plural(esc.nodos.length, 'nodo', 'nodos') + ' · ' +
            plural(esc.aristas.length, 'arista', 'aristas') + ' · ' +
            (esAstar ? (par.peso === 0 ? 'A* con h = 0, o sea Dijkstra' : 'A* con la h al ' + par.peso)
             : esDijkstra ? (par.costes === 'uno' ? 'coste uniforme con todo a 1' : 'coste uniforme')
             : (par.modo === 'anchura' ? 'anchura' : 'profundidad')) +
            ' de ' + nombreNodo(esc.a) + ' a ' + nombreNodo(esc.b);
        if (aviso) return t + ' — ' + aviso;
        if (!resultado) return t + (paraLector ? '' : ' · pulsa «Calcular la ruta»');
        if (resultado.falla) return t + ' — ' + resultado.falla;
        var cam = esAstar
          ? ' · camino de ' + plural(resultado.camino.length - 1, 'arista', 'aristas')
          : ' · camino ' + resultado.camino.map(nombreNodo).join(' → ');
        return t + cam +
               (esCoste ? ' · coste ' + resultado.coste
                        : ' · ' + plural(resultado.camino.length - 1, 'arista', 'aristas')) +
               (esAstar ? ' · ' + resultado.cerrados + ' de ' + esc.nodos.length + ' nodos cerrados' : '') +
               ' · ' + plural(traza.length, 'vuelta del bucle', 'vueltas del bucle');
      }
      if (tipo === 'waypoints') {
        t = plural(descomp.puntos.length, 'punto', 'puntos') + ' · ' +
            plural(descomp.aristas.length, 'conexión visible', 'conexiones visibles');
      } else if (tipo === 'rejilla') {
        var n = descomp.cols * descomp.filas, b = 0;
        for (var i = 0; i < n; i++) if (descomp.bloqueada[i]) b++;
        t = descomp.cols + ' × ' + descomp.filas + ' = ' + n + ' celdas · ' +
            plural(b, 'bloqueada', 'bloqueadas');
      } else if (descomp) {
        t = plural(descomp.secs.length, 'sector', 'sectores') + ' · ' +
            plural(descomp.portales.length, 'portal', 'portales');
        if (par.fundir) t += ' (de ' + plural(descomp.tris.length, 'triángulo', 'triángulos') + ')';
      } else {
        t = 'esta escena no se ha podido triangular';
      }
      if (aviso) return t + ' — ' + aviso;
      if (!resultado) return t + (paraLector ? '' : ' · pulsa «Calcular la ruta»');
      if (resultado.falla) return t + ' — ' + resultado.falla;
      var largo = Math.round(largoDe(resultado.pts));
      if (tipo === 'waypoints') {
        return t + ' · ruta de ' + largo + ' unidades por ' +
               plural(resultado.pts.length - 2, 'punto', 'puntos');
      }
      if (tipo === 'rejilla') {
        return t + ' · ruta de ' + plural(resultado.celdas.length, 'casilla', 'casillas') +
               ', ' + largo + ' unidades';
      }
      return t + ' · la ruta cruza ' + plural(resultado.sectores.length, 'sector', 'sectores') +
             ', ' + largo + ' unidades';
    }

    cambio();
  }

  function deslizador(etiq, min, max, paso, val, alCambiar) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(el('span', null, etiq));
    var i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = paso; i.value = val;
    var out = el('b', null, String(val));
    i.oninput = function () { out.textContent = i.value; alCambiar(Number(i.value)); };
    raiz.appendChild(i);
    raiz.appendChild(out);
    return {
      raiz: raiz, input: i,
      pon: function (v) { i.value = v; out.textContent = i.value; }
    };
  }

  function interruptor(etiq, val, alCambiar) {
    var b = el('button', 'demo-btn', etiq);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(val));
    b.onclick = function () {
      val = !val;
      b.setAttribute('aria-pressed', String(val));
      alCambiar(val);
    };
    return b;
  }

  function opciones(etiq, pares, val, alCambiar) {
    var raiz = el('span', 'demo-grupo');
    raiz.appendChild(el('span', 'demo-tag', etiq));
    pares.forEach(function (p) {
      var b = el('button', 'demo-btn demo-btn-mini', p[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(p[1] === val));
      b.onclick = function () {
        val = p[1];
        Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        alCambiar(val);
      };
      raiz.appendChild(b);
    });
    // para cambiar la opción marcada sin pulsarla, cuando la cambia otro control
    raiz.pon = function (v) {
      val = v;
      Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o, i) {
        o.setAttribute('aria-pressed', String(pares[i][1] === v));
      });
    };
    return raiz;
  }

  function enMundo(svg, ev) {
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return pt((ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H);
  }

  var nodos = document.querySelectorAll('[data-demo]');
  Array.prototype.forEach.call(nodos, function (n) {
    try { (n.getAttribute('data-demo') === 'influencia' ? creaInfluencia : crea)(n); } catch (e) {
      if (window.console) console.error('demo', n.getAttribute('data-demo'), e);
    }
  });
})();
