/* Ejemplos interactivos de los apuntes de sistemas de reglas.
 *
 * Dentro hay un motor de reglas pequeño, un subconjunto de CLIPS/Jess que
 * basta para los ejemplos de los apuntes: deftemplate, deffacts, defrule con
 * salience, patrones ordenados y con plantilla, variables, comodines,
 * restricciones (& | ~ :), test, not, y en la derecha assert, retract, modify
 * y printout. Las estrategias depth y breadth ordenan la agenda como Jess 7.1
 * (salience, y después la antigüedad del hecho más reciente de la activación),
 * y los ejemplos de los apuntes dan aquí lo mismo que en Jess: se comprobó
 * lanzándolos en los dos. La excepción son los empates completos, dos
 * activaciones con la misma salience y los mismos hechos: Jess los rompe según
 * cómo haya montado su red, y aquí gana la regla escrita antes. No es Jess: no
 * hay Rete, ni módulos, ni funciones definidas por el usuario, y los mensajes de
 * error son nuestros.
 *
 * Sin dependencias y sin build, como el resto del sitio. Sin JavaScript cada
 * bloque conserva su aviso y la página se lee igual.
 */
(function (raizGlobal) {
  'use strict';

  /* ============================ el motor ============================ */

  // Valores: los números son number, los símbolos string y las cadenas {s: '...'}.
  function esCadena(v) { return v !== null && typeof v === 'object' && 's' in v; }
  function verdad(v) { return !(v === 'FALSE' || v === 'nil'); }
  function booleano(b) { return b ? 'TRUE' : 'FALSE'; }
  function texto(v) {
    if (typeof v === 'number') return fmtNum(v);
    if (esCadena(v)) return v.s;
    if (Array.isArray(v)) return v.map(texto).join(' ');
    return String(v);
  }
  function fmtNum(n) {
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1e6) / 1e6);
  }
  function muestra(v) {
    if (esCadena(v)) return '"' + v.s + '"';
    return texto(v);
  }
  function iguales(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (esCadena(a) && esCadena(b)) return a.s === b.s;
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    return false;
  }

  function ErrorReglas(msg) { this.message = msg; }
  ErrorReglas.prototype = Object.create(Error.prototype);

  /* ---------- lector: texto → listas ---------- */

  function tokens(src) {
    var t = [], i = 0, n = src.length, linea = 1;
    while (i < n) {
      var c = src[i];
      if (c === '\n') { linea++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === ';') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '(' || c === ')') { t.push({ k: c, l: linea }); i++; continue; }
      if (c === '"') {
        var j = i + 1, s = '';
        while (j < n && src[j] !== '"') { if (src[j] === '\\' && j + 1 < n) j++; s += src[j]; j++; }
        if (j >= n) throw new ErrorReglas('línea ' + linea + ': cadena sin cerrar');
        t.push({ k: 'str', v: s, l: linea }); i = j + 1; continue;
      }
      if (c === '&' || c === '|' || c === '~') { t.push({ k: c, l: linea }); i++; continue; }
      if (c === ':' && src[i + 1] === '(') { t.push({ k: ':', l: linea }); i++; continue; }
      var j2 = i;
      while (j2 < n && !/[\s()";&|~]/.test(src[j2])) j2++;
      var w = src.slice(i, j2);
      i = j2;
      if (w === '=>' || w === '<-') { t.push({ k: w, l: linea }); continue; }
      if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(w)) { t.push({ k: 'num', v: Number(w), l: linea }); continue; }
      if (/^\$\?[^\s]*$/.test(w)) { t.push({ k: 'mvar', v: w.slice(2), l: linea }); continue; }
      if (/^\?[^\s]*$/.test(w)) { t.push({ k: 'var', v: w.slice(1), l: linea }); continue; }
      t.push({ k: 'sym', v: w, l: linea });
    }
    return t;
  }

  // Árbol de listas: cada lista es {lista: [...], l}; las hojas, los tokens.
  function lee(src) {
    var t = tokens(src), pos = 0;
    function uno() {
      var x = t[pos++];
      if (x.k === ')') throw new ErrorReglas('línea ' + x.l + ': sobra un paréntesis de cierre');
      if (x.k !== '(') return x;
      var hijos = [];
      while (true) {
        if (pos >= t.length) throw new ErrorReglas('línea ' + x.l + ': falta cerrar este paréntesis');
        if (t[pos].k === ')') { pos++; break; }
        hijos.push(uno());
      }
      return { k: 'list', v: hijos, l: x.l };
    }
    var out = [];
    while (pos < t.length) out.push(uno());
    return out;
  }

  function cabeza(x) { return x && x.k === 'list' && x.v.length && x.v[0].k === 'sym' ? x.v[0].v : null; }

  /* ---------- funciones de la parte de cálculo ---------- */

  function num(v, f) {
    if (typeof v !== 'number') throw new ErrorReglas('(' + f + ') esperaba un número y recibió ' + muestra(v));
    return v;
  }
  var FUNCIONES = {
    '+': function (a) { return a.reduce(function (s, x) { return s + num(x, '+'); }, 0); },
    '*': function (a) { return a.reduce(function (s, x) { return s * num(x, '*'); }, 1); },
    '-': function (a) { return a.length === 1 ? -num(a[0], '-') : a.slice(1).reduce(function (s, x) { return s - num(x, '-'); }, num(a[0], '-')); },
    '/': function (a) { return a.slice(1).reduce(function (s, x) { return s / num(x, '/'); }, num(a[0], '/')); },
    '<': function (a) { return cadena(a, function (x, y) { return num(x, '<') < num(y, '<'); }); },
    '>': function (a) { return cadena(a, function (x, y) { return num(x, '>') > num(y, '>'); }); },
    '<=': function (a) { return cadena(a, function (x, y) { return num(x, '<=') <= num(y, '<='); }); },
    '>=': function (a) { return cadena(a, function (x, y) { return num(x, '>=') >= num(y, '>='); }); },
    '=': function (a) { return cadena(a, function (x, y) { return num(x, '=') === num(y, '='); }); },
    '<>': function (a) { return cadena(a, function (x, y) { return num(x, '<>') !== num(y, '<>'); }); },
    'eq': function (a) { return booleano(a.slice(1).every(function (x) { return iguales(a[0], x); })); },
    'neq': function (a) { return booleano(a.slice(1).every(function (x) { return !iguales(a[0], x); })); },
    'and': function (a) { return booleano(a.every(verdad)); },
    'or': function (a) { return booleano(a.some(verdad)); },
    'not': function (a) { return booleano(!verdad(a[0])); },
    'abs': function (a) { return Math.abs(num(a[0], 'abs')); },
    'min': function (a) { return Math.min.apply(null, a.map(function (x) { return num(x, 'min'); })); },
    'max': function (a) { return Math.max.apply(null, a.map(function (x) { return num(x, 'max'); })); },
    'mod': function (a) { return num(a[0], 'mod') % num(a[1], 'mod'); },
    'str-cat': function (a) { return { s: a.map(texto).join('') }; },
    'sym-cat': function (a) { return a.map(texto).join(''); }
  };
  function cadena(a, f) {
    for (var i = 0; i + 1 < a.length; i++) if (!f(a[i], a[i + 1])) return 'FALSE';
    return 'TRUE';
  }

  function evalua(x, env) {
    if (x.k === 'num') return x.v;
    if (x.k === 'str') return { s: x.v };
    if (x.k === 'sym') return x.v;
    if (x.k === 'var') {
      if (!(x.v in env)) throw new ErrorReglas('línea ' + x.l + ': la variable ?' + x.v + ' no tiene valor');
      return env[x.v];
    }
    if (x.k === 'mvar') {
      if (!(x.v in env)) throw new ErrorReglas('línea ' + x.l + ': la variable $?' + x.v + ' no tiene valor');
      return env[x.v];
    }
    if (x.k === 'list') {
      var f = cabeza(x);
      if (!f) throw new ErrorReglas('línea ' + x.l + ': esto no es una llamada a función');
      if (!FUNCIONES[f]) throw new ErrorReglas('línea ' + x.l + ': función desconocida (' + f + ')');
      var args = [];
      x.v.slice(1).forEach(function (a) {
        var v = evalua(a, env);
        if (Array.isArray(v)) args.push.apply(args, v); else args.push(v);
      });
      return FUNCIONES[f](args);
    }
    throw new ErrorReglas('línea ' + x.l + ': no sé qué hacer con "' + x.k + '"');
  }

  /* ---------- restricciones de un campo ---------- */

  // Una restricción es una lista de alternativas (|), cada una una lista de
  // términos que se cumplen todos (&). Un término: variable, comodín,
  // constante, :(expresión) o ~término.
  function leeRestriccion(items, i) {
    var alts = [[]], neg = false;
    function termino() {
      var x = items[i];
      if (!x) throw new ErrorReglas('restricción incompleta');
      if (x.k === '~') { i++; neg = !neg; return termino(); }
      i++;
      var r;
      if (x.k === ':') { r = { t: 'pred', e: items[i++] }; }
      else if (x.k === 'var') r = x.v === '' ? { t: 'any' } : { t: 'var', v: x.v };
      else if (x.k === 'num' || x.k === 'sym' || x.k === 'str') r = { t: 'const', v: x.k === 'str' ? { s: x.v } : x.v };
      else throw new ErrorReglas('línea ' + x.l + ': no entiendo esta restricción');
      if (neg) { r = { t: 'not', r: r }; neg = false; }
      return r;
    }
    alts[0].push(termino());
    while (items[i] && (items[i].k === '&' || items[i].k === '|')) {
      var op = items[i++].k;
      if (op === '|') alts.push([]);
      alts[alts.length - 1].push(termino());
    }
    return { r: alts, i: i };
  }

  // ¿Cumple v la restricción? Devuelve el entorno ampliado, o null.
  function cumple(restr, v, env) {
    for (var a = 0; a < restr.length; a++) {
      var e = Object.assign({}, env), ok = true;
      for (var k = 0; k < restr[a].length && ok; k++) ok = termOk(restr[a][k], v, e);
      if (ok) return e;
    }
    return null;
  }
  function termOk(t, v, e) {
    switch (t.t) {
      case 'any': return true;
      case 'const': return iguales(t.v, v);
      case 'var':
        if (t.v in e) return iguales(e[t.v], v);
        e[t.v] = v; return true;
      case 'pred': return verdad(evalua(t.e, e));
      case 'not': { var e2 = Object.assign({}, e); return !termOk(t.r, v, e2); }
    }
    return false;
  }

  // Campos de un patrón ordenado (o de un multislot): restricciones simples y
  // variables multicampo, que se emparejan probando todos los cortes.
  function leeCampos(items) {
    var out = [], i = 0;
    while (i < items.length) {
      var x = items[i];
      if (x.k === 'mvar') { out.push({ multi: true, v: x.v }); i++; continue; }
      var r = leeRestriccion(items, i);
      out.push({ multi: false, r: r.r });
      i = r.i;
    }
    return out;
  }
  function casaCampos(campos, vals, env, ci, vi, alFinal) {
    if (ci === campos.length) { if (vi === vals.length) alFinal(env); return; }
    var c = campos[ci];
    if (!c.multi) {
      if (vi >= vals.length) return;
      var e = cumple(c.r, vals[vi], env);
      if (e) casaCampos(campos, vals, e, ci + 1, vi + 1, alFinal);
      return;
    }
    for (var fin = vi; fin <= vals.length; fin++) {
      var trozo = vals.slice(vi, fin);
      var e2 = Object.assign({}, env);
      if (c.v !== '') {
        if (c.v in e2) {
          var prev = e2[c.v];
          if (!Array.isArray(prev) || prev.length !== trozo.length || !prev.every(function (p, k) { return iguales(p, trozo[k]); })) continue;
        } else e2[c.v] = trozo;
      }
      casaCampos(campos, vals, e2, ci + 1, fin, alFinal);
    }
  }

  /* ---------- el motor ---------- */

  function Motor() {
    this.plantillas = {};
    this.deffacts = [];
    this.reglas = [];
    this.estrategia = 'depth';
    this.limpia();
  }

  Motor.prototype.limpia = function () {
    this.hechos = [];          // {id, rel, plantilla?, campos | slots, t}
    this.siguienteId = 0;
    this.reloj = 0;
    this.disparadas = {};      // refracción: claves de activaciones ya disparadas
    this.vistas = {};          // clave → orden de llegada, para desempatar
    this.llegada = 0;
    this.agenda = [];
    this.disparos = 0;
    this.parado = false;
  };

  Motor.prototype.carga = function (src) {
    var self = this;
    this.plantillas = {}; this.deffacts = []; this.reglas = [];
    lee(src).forEach(function (x) {
      var f = cabeza(x);
      if (f === 'deftemplate') self.defPlantilla(x);
      else if (f === 'deffacts') self.deffacts.push.apply(self.deffacts, x.v.slice(2).filter(function (h) { return h.k === 'list'; }));
      else if (f === 'defrule') self.defRegla(x);
      else if (f === 'set-strategy') self.estrategia = x.v[1] && x.v[1].v === 'breadth' ? 'breadth' : 'depth';
      else throw new ErrorReglas('línea ' + x.l + ': aquí sólo caben deftemplate, deffacts y defrule' + (f ? ' (y has puesto ' + f + ')' : ''));
    });
  };

  Motor.prototype.defPlantilla = function (x) {
    var nombre = x.v[1].v, slots = {}, orden = [];
    x.v.slice(2).forEach(function (s) {
      var tipo = cabeza(s);
      if (tipo !== 'slot' && tipo !== 'multislot') return;   // el comentario
      var def = tipo === 'multislot' ? [] : 'nil';
      s.v.slice(2).forEach(function (a) {
        var q = cabeza(a);
        if (q === 'range' || /^allowed-/.test(q || '')) {
          throw new ErrorReglas('línea ' + a.l + ': Jess 7.1 no entiende (' + q + ' …): es de CLIPS. Quitadlo y comprobad el valor en la regla');
        }
        if (q === 'default') {
          def = tipo === 'multislot' ? a.v.slice(1).map(function (y) { return evalua(y, {}); }) : evalua(a.v[1], {});
        }
      });
      slots[s.v[1].v] = { multi: tipo === 'multislot', def: def };
      orden.push(s.v[1].v);
    });
    this.plantillas[nombre] = { slots: slots, orden: orden };
  };

  Motor.prototype.defRegla = function (x) {
    var self = this;
    var nombre = x.v[1].v, i = 2, salience = 0;
    if (x.v[i] && x.v[i].k === 'str') i++;
    if (cabeza(x.v[i]) === 'declare') {
      x.v[i].v.slice(1).forEach(function (d) { if (cabeza(d) === 'salience') salience = evalua(d.v[1], {}); });
      i++;
    }
    var lhs = [], rhs = [];
    var flecha = -1;
    for (var k = i; k < x.v.length; k++) if (x.v[k].k === '=>') { flecha = k; break; }
    if (flecha < 0) throw new ErrorReglas('línea ' + x.l + ': a la regla ' + nombre + ' le falta el =>');
    var izq = x.v.slice(i, flecha);
    for (var j = 0; j < izq.length; j++) {
      var ce = izq[j], ligado = null;
      if (ce.k === 'var' && izq[j + 1] && izq[j + 1].k === '<-') { ligado = ce.v; j += 2; ce = izq[j]; }
      lhs.push(self.leeCE(ce, ligado));
    }
    rhs = x.v.slice(flecha + 1);
    this.reglas.push({ nombre: nombre, salience: salience, lhs: lhs, rhs: rhs, l: x.l });
  };

  Motor.prototype.leeCE = function (ce, ligado) {
    var f = cabeza(ce);
    if (f === 'test') return { t: 'test', e: ce.v[1] };
    if (f === 'not') return { t: 'not', ce: this.leeCE(ce.v[1], null) };
    if (!f) throw new ErrorReglas('línea ' + ce.l + ': un patrón tiene que empezar por un nombre');
    var pl = this.plantillas[f];
    if (pl) {
      var slots = {};
      ce.v.slice(1).forEach(function (s) {
        var nom = cabeza(s);
        if (!nom || !(nom in pl.slots)) throw new ErrorReglas('línea ' + ce.l + ': la plantilla ' + f + ' no tiene ningún slot llamado ' + (nom || '?'));
        if (pl.slots[nom].multi) slots[nom] = { multi: true, campos: leeCampos(s.v.slice(1)) };
        else slots[nom] = { multi: false, r: leeRestriccion(s.v.slice(1), 0).r };
      });
      return { t: 'pat', rel: f, plantilla: true, slots: slots, ligado: ligado };
    }
    if (ce.v.slice(1).some(function (y) { return y.k === 'list'; })) {
      throw new ErrorReglas('línea ' + ce.l + ': ' + f + ' no tiene deftemplate, así que (' + (cabeza(ce.v.slice(1).filter(function (y) { return y.k === 'list'; })[0]) || '…') + ' …) no se puede leer como un slot');
    }
    return { t: 'pat', rel: f, plantilla: false, campos: leeCampos(ce.v.slice(1)), ligado: ligado };
  };

  // Construye un hecho a partir de su forma escrita, evaluando lo que haga falta.
  Motor.prototype.construye = function (x, env) {
    var rel = cabeza(x);
    if (!rel) throw new ErrorReglas('línea ' + x.l + ': un hecho tiene que empezar por un nombre');
    var pl = this.plantillas[rel];
    if (pl) {
      var slots = {};
      pl.orden.forEach(function (s) { slots[s] = pl.slots[s].def; });
      x.v.slice(1).forEach(function (s) {
        var nom = cabeza(s);
        if (!nom || !(nom in pl.slots)) throw new ErrorReglas('línea ' + x.l + ': la plantilla ' + rel + ' no tiene ningún slot llamado ' + (nom || '?'));
        var vals = [];
        s.v.slice(1).forEach(function (y) { var v = evalua(y, env); if (Array.isArray(v)) vals.push.apply(vals, v); else vals.push(v); });
        slots[nom] = pl.slots[nom].multi ? vals : (vals.length ? vals[0] : 'nil');
      });
      return { rel: rel, plantilla: true, slots: slots };
    }
    if (/^[A-Z][A-Z]+$/.test(rel) && x.v.length > 1 && x.v[1].k === 'list') {
      // (BLINKY (edible true)) sin deftemplate: Jess lo lee como llamada a función
      throw new ErrorReglas('línea ' + x.l + ': ' + rel + ' no tiene deftemplate, y sin él (' + cabeza(x.v[1]) + ' …) no es un slot sino una llamada a una función que no existe');
    }
    var campos = [];
    x.v.slice(1).forEach(function (y) { var v = evalua(y, env); if (Array.isArray(v)) campos.push.apply(campos, v); else campos.push(v); });
    return { rel: rel, plantilla: false, campos: campos };
  };

  function mismoHecho(a, b) {
    if (a.rel !== b.rel || a.plantilla !== b.plantilla) return false;
    if (!a.plantilla) return a.campos.length === b.campos.length && a.campos.every(function (v, i) { return iguales(v, b.campos[i]); });
    return Object.keys(a.slots).every(function (k) {
      var x = a.slots[k], y = b.slots[k];
      if (Array.isArray(x)) return Array.isArray(y) && x.length === y.length && x.every(function (v, i) { return iguales(v, y[i]); });
      return iguales(x, y);
    });
  }

  Motor.prototype.escribeHecho = function (h) {
    if (!h.plantilla) return '(' + [h.rel].concat(h.campos.map(muestra)).join(' ') + ')';
    var pl = this.plantillas[h.rel];
    return '(' + h.rel + pl.orden.map(function (s) {
      var v = h.slots[s];
      return ' (' + s + (Array.isArray(v) ? (v.length ? ' ' + v.map(muestra).join(' ') : '') : ' ' + muestra(v)) + ')';
    }).join('') + ')';
  };
  Motor.prototype.nombre = function (h) { return 'f-' + h.id; };

  Motor.prototype.aserta = function (h, log) {
    for (var i = 0; i < this.hechos.length; i++) if (mismoHecho(this.hechos[i], h)) return null;  // Jess no duplica
    h.id = this.siguienteId++;
    h.t = ++this.reloj;
    this.hechos.push(h);
    if (log) log('aserta', ' ==> ' + this.nombre(h) + ' ' + this.escribeHecho(h));
    return h;
  };
  Motor.prototype.retira = function (h, log) {
    var i = this.hechos.indexOf(h);
    if (i < 0) return;
    this.hechos.splice(i, 1);
    if (log) log('retira', ' <== ' + this.nombre(h) + ' ' + this.escribeHecho(h));
  };

  Motor.prototype.reset = function (log) {
    var self = this;
    this.limpia();
    this.aserta({ rel: 'initial-fact', plantilla: false, campos: [] }, log);
    this.deffacts.forEach(function (x) { self.aserta(self.construye(x, {}), log); });
    this.actualizaAgenda(log);
  };

  // Todas las formas de satisfacer la parte izquierda de una regla.
  Motor.prototype.casa = function (regla) {
    var self = this, out = [];
    function paso(k, env, usados) {
      if (k === regla.lhs.length) { out.push({ env: env, hechos: usados }); return; }
      var ce = regla.lhs[k];
      if (ce.t === 'test') { if (verdad(evalua(ce.e, env))) paso(k + 1, env, usados); return; }
      if (ce.t === 'not') {
        var alguno = false;
        self.hechos.forEach(function (h) { if (!alguno && self.casaPatron(ce.ce, h, env)) alguno = true; });
        if (!alguno) paso(k + 1, env, usados);
        return;
      }
      self.hechos.forEach(function (h) {
        var e = self.casaPatron(ce, h, env);
        if (e) {
          if (ce.ligado) { e = Object.assign({}, e); e[ce.ligado] = { hecho: h }; }
          paso(k + 1, e, usados.concat([h]));
        }
      });
    }
    paso(0, {}, []);
    return out;
  };

  Motor.prototype.casaPatron = function (ce, h, env) {
    if (h.rel !== ce.rel) return null;
    if (!ce.plantilla) {
      if (h.plantilla) return null;
      var res = null;
      casaCampos(ce.campos, h.campos, env, 0, 0, function (e) { if (!res) res = e; });
      return res;
    }
    if (!h.plantilla) return null;
    var e = env;
    for (var s in ce.slots) {
      var c = ce.slots[s];
      if (c.multi) {
        var r2 = null;
        casaCampos(c.campos, h.slots[s] || [], e, 0, 0, function (x) { if (!r2) r2 = x; });
        if (!r2) return null;
        e = r2;
      } else {
        e = cumple(c.r, h.slots[s], e);
        if (!e) return null;
      }
    }
    return e;
  };

  function clave(regla, hechos) {
    return regla.nombre + '|' + hechos.map(function (h) { return h.id + ':' + h.t; }).join(',');
  }

  // Recalcula la agenda entera. Es lo que Rete se ahorra; aquí no importa.
  Motor.prototype.actualizaAgenda = function (log) {
    var self = this, nuevas = [], vivas = {};
    this.reglas.forEach(function (r, ir) {
      self.casa(r).forEach(function (m) {
        var k = clave(r, m.hechos);
        vivas[k] = true;
        if (self.disparadas[k]) return;
        nuevas.push({ regla: r, ir: ir, env: m.env, hechos: m.hechos, k: k });
      });
    });
    // las que desaparecen sin dispararse salen de la agenda
    this.agenda.forEach(function (a) {
      if (!vivas[a.k] && !self.disparadas[a.k] && log) log('desactiva', '<== Activation: ' + a.regla.nombre + ' : ' + self.ids(a.hechos));
    });
    Object.keys(this.disparadas).forEach(function (k) { if (!vivas[k]) delete self.disparadas[k]; });
    Object.keys(this.vistas).forEach(function (k) { if (!vivas[k]) delete self.vistas[k]; });
    nuevas.forEach(function (a) {
      if (!(a.k in self.vistas)) {
        self.vistas[a.k] = ++self.llegada;
        if (log) log('activa', '==> Activation: ' + a.regla.nombre + ' : ' + self.ids(a.hechos));
      }
      a.n = self.vistas[a.k];
      a.t = a.hechos.reduce(function (m, h) { return Math.max(m, h.t); }, 0);
    });
    var prof = this.estrategia === 'depth';
    nuevas.sort(function (x, y) {
      if (x.regla.salience !== y.regla.salience) return y.regla.salience - x.regla.salience;
      if (x.t !== y.t) return prof ? y.t - x.t : x.t - y.t;
      return x.n - y.n;
    });
    this.agenda = nuevas;
  };

  Motor.prototype.ids = function (hs) {
    var self = this;
    return hs.filter(function (h) { return h.rel !== 'initial-fact'; }).map(function (h) { return self.nombre(h); }).join(', ') || 'f-0';
  };

  // Dispara la primera activación de la agenda. Devuelve false si no había.
  Motor.prototype.paso = function (log, salida) {
    if (!this.agenda.length || this.parado) return false;
    var a = this.agenda[0], self = this;
    this.disparadas[a.k] = true;
    this.disparos++;
    if (log) log('dispara', 'FIRE ' + this.disparos + ' ' + a.regla.nombre + ' ' + this.ids(a.hechos), a.regla.nombre);
    var env = Object.assign({}, a.env);
    a.regla.rhs.forEach(function (acc) { self.ejecuta(acc, env, log, salida); });
    this.actualizaAgenda(log);
    return true;
  };

  Motor.prototype.ejecuta = function (acc, env, log, salida) {
    var self = this, f = cabeza(acc);
    if (f === 'assert') {
      acc.v.slice(1).forEach(function (x) { self.aserta(self.construye(x, env), log); });
    } else if (f === 'retract') {
      acc.v.slice(1).forEach(function (x) {
        var v = evalua(x, env);
        if (!v || !v.hecho) throw new ErrorReglas('línea ' + acc.l + ': retract necesita una variable ligada con <-');
        self.retira(v.hecho, log);
      });
    } else if (f === 'modify') {
      var v = evalua(acc.v[1], env);
      if (!v || !v.hecho) throw new ErrorReglas('línea ' + acc.l + ': modify necesita una variable ligada con <-');
      var h = v.hecho;
      if (!h.plantilla) throw new ErrorReglas('línea ' + acc.l + ': modify sólo vale para hechos con plantilla');
      if (this.hechos.indexOf(h) < 0) return;
      acc.v.slice(2).forEach(function (s) {
        var nom = cabeza(s);
        var pl = self.plantillas[h.rel];
        if (!nom || !(nom in pl.slots)) throw new ErrorReglas('línea ' + acc.l + ': la plantilla ' + h.rel + ' no tiene ningún slot llamado ' + (nom || '?'));
        var vals = [];
        s.v.slice(1).forEach(function (y) { var w = evalua(y, env); if (Array.isArray(w)) vals.push.apply(vals, w); else vals.push(w); });
        h.slots[nom] = pl.slots[nom].multi ? vals : vals[0];
      });
      // en Jess, modificar es retirar y volver a asertar con el mismo número
      h.t = ++this.reloj;
      if (log) log('modifica', ' <=> ' + this.nombre(h) + ' ' + this.escribeHecho(h));
    } else if (f === 'printout') {
      var partes = acc.v.slice(2).map(function (x) {
        if (x.k === 'sym' && x.v === 'crlf') return '\n';
        return texto(evalua(x, env));
      });
      if (salida) salida(partes.join(''));
    } else if (f === 'halt') {
      this.parado = true;
    } else {
      throw new ErrorReglas('línea ' + acc.l + ': en la derecha de una regla sólo caben assert, retract, modify, printout y halt' + (f ? ' (y has puesto ' + f + ')' : ''));
    }
  };

  Motor.prototype.run = function (max, log, salida) {
    var n = 0;
    while ((max == null || n < max) && this.paso(log, salida)) n++;
    return n;
  };

  var API = { Motor: Motor, lee: lee, ErrorReglas: ErrorReglas, texto: texto };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document === 'undefined') return;

  /* ============================ la página ============================ */

  var NS = 'http://www.w3.org/2000/svg';
  function el(t, cls, txt) {
    var e = document.createElement(t);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function svgEl(t, at, txt) {
    var e = document.createElementNS(NS, t);
    for (var k in at) e.setAttribute(k, at[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }
  function boton(txt, alPulsar, cls) {
    var b = el('button', 'demo-btn' + (cls ? ' ' + cls : ''), txt);
    b.type = 'button';
    b.onclick = alPulsar;
    return b;
  }
  function opciones(etiq, pares, val, alCambiar) {
    var raiz = el('span', 'demo-grupo');
    if (etiq) raiz.appendChild(el('span', 'demo-tag', etiq));
    pares.forEach(function (p) {
      var b = el('button', 'demo-btn demo-btn-mini', p[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(p[1] === val));
      b.onclick = function () {
        val = p[1];
        Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        alCambiar(val);
      };
      raiz.appendChild(b);
    });
    raiz.pon = function (v) {
      val = v;
      Array.prototype.forEach.call(raiz.querySelectorAll('button'), function (o, i) { o.setAttribute('aria-pressed', String(pares[i][1] === v)); });
    };
    return raiz;
  }
  function deslizador(etiq, min, max, val, alCambiar) {
    var raiz = el('label', 'demo-campo');
    raiz.appendChild(document.createTextNode(etiq));
    var i = el('input');
    i.type = 'range'; i.min = min; i.max = max; i.value = val;
    var out = el('b', null, String(val));
    i.oninput = function () { out.textContent = i.value; alCambiar(Number(i.value)); };
    raiz.appendChild(i);
    raiz.appendChild(out);
    return raiz;
  }
  function barra(cls) { return el('div', 'demo-bar' + (cls ? ' ' + cls : '')); }
  function prepara(nodo) {
    var stage = nodo.querySelector('.demo-stage');
    stage.innerHTML = '';
    return { stage: stage, controls: nodo.querySelector('.demo-controls'), read: nodo.querySelector('.demo-read') };
  }

  /* ---------- 1 · el banco de pruebas: escribir reglas y ejecutarlas ---------- */

  var PRESETS = {
    persona: {
      txt: 'Casar a los mayores de 25',
      src: [
        '(deftemplate persona',
        '   (slot nombre)',
        '   (slot edad (default 20))',
        '   (slot estado (default soltero)))',
        '',
        '(deffacts personas',
        '   (persona (nombre Pepe))',
        '   (persona (nombre Juan) (edad 25)))',
        '',
        '(defrule casa-mayores-25',
        '   ?p <- (persona (nombre ?nombre) (edad ?edad) (estado soltero))',
        '   (test (>= ?edad 25))',
        '   =>',
        '   (modify ?p (estado casado))',
        '   (printout t ?nombre " tiene " ?edad " años" crlf))'
      ].join('\n')
    },
    cadena: {
      txt: 'Encadenar: h6 → … → h1',
      src: [
        '; el ejemplo de encadenamiento hacia delante de los apuntes',
        '(deffacts inicio (h6) (h7) (h9) (h8) (h4) (h5))',
        '',
        '(defrule R1 (h2) (h5) => (assert (h1)))',
        '(defrule R2 (h4) (h3) => (assert (h2)))',
        '(defrule R3 (h6)      => (assert (h3)))'
      ].join('\n')
    },
    letras: {
      txt: 'Ordenar letras',
      src: [
        '; ordena una cadena de letras a, b y c intercambiando parejas',
        '(deffacts inicio (cadena c b a c a b))',
        '',
        '(defrule ba ?f <- (cadena $?x b a $?y) => (retract ?f) (assert (cadena $?x a b $?y)))',
        '(defrule ca ?f <- (cadena $?x c a $?y) => (retract ?f) (assert (cadena $?x a c $?y)))',
        '(defrule cb ?f <- (cadena $?x c b $?y) => (retract ?f) (assert (cadena $?x b c $?y)))'
      ].join('\n')
    },
    ojos: {
      txt: 'Variables: ojos azules',
      src: [
        '(deftemplate personaje (slot nombre) (slot ojos) (slot pelo))',
        '',
        '(deffacts gente',
        '   (personaje (nombre Juan) (ojos azules) (pelo castaño))',
        '   (personaje (nombre Luis) (ojos verdes) (pelo rojo))',
        '   (personaje (nombre Pedro) (ojos azules) (pelo rubio))',
        '   (personaje (nombre María) (ojos castaños) (pelo negro)))',
        '',
        '(defrule busca-ojos-azules',
        '   (personaje (nombre ?nombre) (ojos azules))',
        '   =>',
        '   (printout t ?nombre " tiene los ojos azules." crlf))'
      ].join('\n')
    },
    fantasma: {
      txt: 'Un turno de Blinky',
      src: [
        '; los hechos que GhostsInput aserta en un turno: cambiadlos y volved a ejecutar',
        '(deftemplate BLINKY (slot edible) (slot distancia))',
        '(deftemplate MSPACMAN (slot mindistancePPill))',
        '(deftemplate ACTION (slot id) (slot info (default "")) (slot priority (default 0)))',
        '',
        '(deffacts turno',
        '   (BLINKY (edible false) (distancia 14))',
        '   (MSPACMAN (mindistancePPill 25)))',
        '',
        '(defrule BLINKYrunsAwayPPill',
        '   (MSPACMAN (mindistancePPill ?d&:(<= ?d 30)))',
        '   =>',
        '   (assert (ACTION (id BLINKYrunsAway) (info "MsPacMan cerca de la PPill") (priority 50))))',
        '',
        '(defrule BLINKYrunsAway',
        '   (BLINKY (edible true))',
        '   =>',
        '   (assert (ACTION (id BLINKYrunsAway) (info "comestible: huir") (priority 30))))',
        '',
        '(defrule BLINKYchases',
        '   (BLINKY (edible false))',
        '   =>',
        '   (assert (ACTION (id BLINKYchases) (info "no comestible: perseguir") (priority 10))))'
      ].join('\n')
    },
    mspacman: {
      txt: 'Ms. Pac-Man con siete reglas',
      src: [
        '; las siete reglas de la Práctica 3, tal cual: cambiad el turno de abajo y volved a ejecutar',
        ';; ---- Los hechos que aserta MsPacManInput en cada turno ----------------',
        '(deftemplate MSPACMAN',
        '   (slot distFantasma (type NUMBER))   ; al peligroso más cercano; 1000 si no hay',
        '   (slot distPPill    (type NUMBER))   ; a la PPill más cercana; 1000 si no quedan',
        '   (slot ultima       (type SYMBOL)))  ; la acción que ganó el turno anterior',
        '',
        '(deftemplate FANTASMA',
        '   (slot nombre     (type SYMBOL))     ; BLINKY, INKY, PINKY, SUE',
        '   (slot comestible (type SYMBOL))     ; true o false, en minúsculas, como Java',
        '   (slot distancia  (type NUMBER))',
        '   (slot tiempo     (type NUMBER)))    ; turnos que le quedan de comestible',
        '',
        ';; ---- Un hecho intermedio: lo asertan unas reglas y lo leen otras ------',
        '(deftemplate PELIGRO)',
        '',
        ';; ---- El hecho de salida ------------------------------------------------',
        '(deftemplate ACTION',
        '   (slot id) (slot info (default "")) (slot priority (type NUMBER))',
        '   (slot fantasma (type SYMBOL)))      ; el parámetro de "perseguir"',
        '',
        ';; ---- Un turno, como lo aserta MsPacManInput: cambiadlo y haced reset --',
        '(deffacts turno',
        '   (FANTASMA (nombre PINKY) (comestible true) (distancia 30) (tiempo 100))',
        '   (FANTASMA (nombre SUE) (comestible false) (distancia 15) (tiempo 0))',
        '   (MSPACMAN (distFantasma 15) (distPPill 40) (ultima comer)))',
        '',
        ';; R1 · si no pasa nada más, comer',
        '(defrule comer',
        '   (MSPACMAN)',
        '   =>',
        '   (assert (ACTION (id comer) (info "R1: no pasa nada") (priority 10))))',
        '',
        ';; R2 · un fantasma peligroso a menos de 20 es peligro',
        '(defrule peligro',
        '   (declare (salience 10))             ; antes que las que preguntan por PELIGRO',
        '   (MSPACMAN (distFantasma ?d&:(< ?d 20)))',
        '   =>',
        '   (assert (PELIGRO)))',
        '',
        ';; R3 · si ya venía huyendo, sigue siendo peligro hasta los 30',
        '(defrule sigueElPeligro',
        '   (declare (salience 10))',
        '   (MSPACMAN (ultima huir) (distFantasma ?d&:(< ?d 30)))',
        '   =>',
        '   (assert (PELIGRO)))',
        '',
        ';; R4 · con peligro, huir',
        '(defrule huir',
        '   (PELIGRO)',
        '   =>',
        '   (assert (ACTION (id huir) (info "R4: hay peligro") (priority 80))))',
        '',
        ';; R5 · con peligro, si la píldora de poder está más cerca que el fantasma, a por ella',
        '(defrule aLaPPill',
        '   (PELIGRO)',
        '   (MSPACMAN (distFantasma ?f) (distPPill ?p&:(< ?p ?f)))',
        '   =>',
        '   (assert (ACTION (id irAPPill) (priority 90)',
        '                   (info "R5: la PPill está más cerca que él"))))',
        '',
        ';; R6 · sin peligro, a por el comestible más cercano, si llego antes de que se le pase',
        '(defrule cazar',
        '   (not (PELIGRO))',
        '   (FANTASMA (nombre ?g) (comestible true)',
        '             (distancia ?d) (tiempo ?t&:(> ?t ?d)))',
        '   (not (FANTASMA (comestible true) (distancia ?d2&:(< ?d2 ?d))))',
        '   =>',
        '   (assert (ACTION (id perseguir) (fantasma ?g) (priority 60)',
        '                   (info (str-cat "R6: cazar a " ?g)))))',
        '',
        ';; R7 · un comestible a menos de 10 se remata, aunque haya peligro',
        '(defrule rematar',
        '   (FANTASMA (nombre ?g) (comestible true)',
        '             (distancia ?d&:(< ?d 10)) (tiempo ?t&:(> ?t ?d)))',
        '   =>',
        '   (assert (ACTION (id perseguir) (fantasma ?g) (priority 85)',
        '                   (info (str-cat "R7: rematar a " ?g)))))'
      ].join('\n')
    },
    bucle: {
      txt: 'Un modify que no para',
      src: [
        '; modify cambia el hecho, y un hecho cambiado vuelve a activar la regla.',
        '; Ejecutad paso a paso: la refracción no lo frena. El ejemplo corta a los 25 disparos.',
        '(deftemplate fantasma (slot nombre) (slot peligro (default 0)))',
        '',
        '(deffacts f (fantasma (nombre blinky)))',
        '',
        '(defrule sube-el-peligro',
        '   ?f <- (fantasma (peligro ?p))',
        '   =>',
        '   (printout t "peligro " ?p crlf)',
        '   (modify ?f (peligro (+ ?p 1))))'
      ].join('\n')
    }
  };

  function creaBanco(nodo) {
    var d = prepara(nodo);
    var lista = (nodo.getAttribute('data-presets') || 'persona').split(/\s+/);
    var actual = lista[0];
    var motor = new Motor();
    var listo = false;          // ¿se ha hecho reset tras el último cambio?
    var LIMITE = 25;

    var marco = el('div', 'rg-banco');
    var ed = el('textarea', 'rg-editor');
    ed.spellcheck = false;
    ed.setAttribute('aria-label', 'Reglas y hechos, en CLIPS');
    ed.value = PRESETS[actual].src;
    ed.rows = Math.min(18, PRESETS[actual].src.split('\n').length + 1);
    marco.appendChild(ed);

    var paneles = el('div', 'rg-paneles');
    var pH = el('div', 'rg-panel'), pA = el('div', 'rg-panel');
    pH.appendChild(el('span', 'demo-tag', 'Memoria de trabajo · (facts)'));
    var hechosOl = el('ol', 'rg-lista'); pH.appendChild(hechosOl);
    pA.appendChild(el('span', 'demo-tag', 'Agenda · la primera es la siguiente'));
    var agendaOl = el('ol', 'rg-lista'); pA.appendChild(agendaOl);
    paneles.appendChild(pH); paneles.appendChild(pA);
    marco.appendChild(paneles);
    d.stage.appendChild(marco);

    var traza = el('pre', 'demo-traza rg-traza');
    traza.setAttribute('aria-label', 'Lo que va diciendo el motor');
    nodo.insertBefore(traza, d.read);

    var lineas = [];
    function log(tipo, txt) { lineas.push({ tipo: tipo, txt: txt }); }
    function salida(txt) {
      txt.split('\n').forEach(function (l, i, arr) { if (l !== '' || i < arr.length - 1) lineas.push({ tipo: 'sale', txt: l }); });
    }
    function pintaTraza() {
      traza.innerHTML = '';
      lineas.slice(-60).forEach(function (l) {
        var s = el('span', 'rg-l rg-' + l.tipo, l.txt);
        traza.appendChild(s);
        traza.appendChild(document.createTextNode('\n'));
      });
      traza.scrollTop = traza.scrollHeight;
    }
    function pinta() {
      hechosOl.innerHTML = '';
      motor.hechos.forEach(function (h) {
        var li = el('li');
        li.appendChild(el('b', null, motor.nombre(h)));
        li.appendChild(document.createTextNode(' ' + motor.escribeHecho(h)));
        hechosOl.appendChild(li);
      });
      if (!motor.hechos.length) hechosOl.appendChild(el('li', 'rg-vacio', 'vacía: pulsad reset'));
      agendaOl.innerHTML = '';
      motor.agenda.forEach(function (a, i) {
        var li = el('li', i === 0 ? 'rg-sig' : null);
        li.appendChild(el('b', null, a.regla.nombre));
        li.appendChild(document.createTextNode(' : ' + motor.ids(a.hechos) + (a.regla.salience ? '  · salience ' + a.regla.salience : '')));
        agendaOl.appendChild(li);
      });
      if (!motor.agenda.length) agendaOl.appendChild(el('li', 'rg-vacio', listo ? 'vacía: ya no hay nada que disparar' : '—'));
      pintaTraza();
      bPaso.disabled = bRun.disabled = !listo || !motor.agenda.length || motor.disparos >= LIMITE;
    }
    function error(e) {
      lineas.push({ tipo: 'error', txt: 'Error: ' + (e && e.message ? e.message : String(e)) });
      listo = false;
      pinta();
      d.read.textContent = 'Hay un error: está en la última línea de la traza.';
    }
    function reset() {
      lineas = [];
      try {
        motor.estrategia = estr;
        motor.carga(ed.value);
        motor.estrategia = estr;
        lineas.push({ tipo: 'cmd', txt: 'Jess> (reset)' });
        motor.reset(log);
        listo = true;
        pinta();
        var na = motor.agenda.length;
        d.read.textContent = motor.hechos.length + ' hechos en memoria y ' + na + (na === 1 ? ' activación' : ' activaciones') +
          ' en la agenda. Disparad de una en una con "Paso" o todas con "Run".';
      } catch (e) { error(e); }
    }
    function paso(max) {
      if (!listo) return;
      try {
        lineas.push({ tipo: 'cmd', txt: max === 1 ? 'Jess> (run 1)' : 'Jess> (run)' });
        var n = motor.run(Math.min(max == null ? LIMITE : max, LIMITE - motor.disparos), log, salida);
        var fin = !motor.agenda.length;
        // lo que haría RuleEngine.run del motor de Ms. Pac-Man: el ACTION de priority más alta
        var gana = null;
        motor.hechos.forEach(function (h) {
          if (h.rel === 'ACTION' && h.plantilla && typeof h.slots.priority === 'number' &&
              (!gana || h.slots.priority > gana.slots.priority)) gana = h;
        });
        if (fin && gana) lineas.push({ tipo: 'gana', txt: 'RuleEngine elige ' + motor.nombre(gana) + ' ' + motor.escribeHecho(gana) });
        pinta();
        d.read.textContent = (max === 1 ? 'Disparada 1 regla. ' : 'Disparadas ' + n + ' reglas. ') +
          (fin ? 'La agenda está vacía: el motor se para. Total: ' + motor.disparos + ' disparos.'
            : motor.disparos >= LIMITE ? 'Cortado a los ' + LIMITE + ' disparos: con Jess esto no pararía nunca.'
              : 'Quedan ' + motor.agenda.length + ' en la agenda.');
      } catch (e) { error(e); }
    }

    var estr = 'depth';
    var bReset = boton('reset', reset, 'demo-play');
    var bPaso = boton('Paso · (run 1)', function () { paso(1); });
    var bRun = boton('Run · (run)', function () { paso(null); });
    var b1 = barra('demo-bar-play');
    b1.appendChild(bReset); b1.appendChild(bPaso); b1.appendChild(bRun);
    b1.appendChild(opciones('Estrategia', [['depth', 'depth'], ['breadth', 'breadth']], estr, function (v) { estr = v; reset(); }));
    d.controls.appendChild(b1);
    if (lista.length > 1) {
      var b2 = barra();
      b2.appendChild(opciones('Ejemplo', lista.map(function (p) { return [PRESETS[p].txt, p]; }), actual, function (v) {
        actual = v; ed.value = PRESETS[v].src; ed.rows = Math.min(18, PRESETS[v].src.split('\n').length + 1); reset();
      }));
      d.controls.appendChild(b2);
    }
    ed.addEventListener('input', function () {
      listo = false;
      bPaso.disabled = bRun.disabled = true;
      d.read.textContent = 'Has cambiado las reglas: pulsad reset para cargarlas.';
    });
    reset();
  }

  /* ---------- 2 · encadenar hacia delante y hacia atrás ---------- */

  var BASE_H = {
    reglas: [
      { n: 'R1', si: ['h2', 'h5'], en: 'h1' },
      { n: 'R2', si: ['h4', 'h3'], en: 'h2' },
      { n: 'R3', si: ['h6'], en: 'h3' }
    ],
    extra: [
      { n: 'R4', si: ['h7', 'h8'], en: 'h10' },
      { n: 'R5', si: ['h10', 'h9'], en: 'h11' }
    ],
    hechos: ['h6', 'h7', 'h9', 'h8', 'h4', 'h5'],
    todos: ['h4', 'h5', 'h6', 'h7', 'h8', 'h9']
  };

  // Hacia delante: prioridad por número de regla, y sin repetir (refracción).
  function adelante(reglas, ini) {
    var mt = ini.slice(), hechas = {}, pasos = [];
    while (true) {
      var agenda = reglas.filter(function (r) { return !hechas[r.n] && r.si.every(function (h) { return mt.indexOf(h) >= 0; }); });
      if (!agenda.length) { pasos.push({ mt: mt.slice(), agenda: [], dispara: null }); break; }
      var r = agenda[0];
      pasos.push({ mt: mt.slice(), agenda: agenda.map(function (x) { return x.n; }), dispara: r.n, nuevo: r.en });
      hechas[r.n] = true;
      if (mt.indexOf(r.en) < 0) mt.push(r.en);
    }
    return pasos;
  }

  // Hacia atrás: probar el objetivo; si no está, buscar reglas que lo concluyan.
  function atras(reglas, ini, objetivo) {
    var pasos = [];
    function prueba(h, prof, camino) {
      if (ini.indexOf(h) >= 0) { pasos.push({ prof: prof, h: h, txt: h + ' está en la base de hechos', ok: true }); return true; }
      if (camino.indexOf(h) >= 0) { pasos.push({ prof: prof, h: h, txt: h + ' depende de sí mismo: se descarta', ok: false }); return false; }
      var cand = reglas.filter(function (r) { return r.en === h; });
      if (!cand.length) { pasos.push({ prof: prof, h: h, txt: h + ' no está y ninguna regla lo concluye: falso (mundo cerrado)', ok: false }); return false; }
      for (var i = 0; i < cand.length; i++) {
        var r = cand[i];
        pasos.push({ prof: prof, h: h, txt: 'para ' + h + ', ' + r.n + ' pide ' + r.si.join(' y '), regla: r.n });
        var todos = true;
        for (var k = 0; k < r.si.length && todos; k++) todos = prueba(r.si[k], prof + 1, camino.concat([h]));
        if (todos) { pasos.push({ prof: prof, h: h, txt: h + ' demostrado con ' + r.n, ok: true, regla: r.n }); return true; }
      }
      pasos.push({ prof: prof, h: h, txt: 'ninguna regla demuestra ' + h, ok: false });
      return false;
    }
    var ok = prueba(objetivo, 0, []);
    return { pasos: pasos, ok: ok };
  }

  function creaEncadenar(nodo) {
    var d = prepara(nodo);
    var modo = 'adelante', conExtra = false, objetivo = 'h1', k = 0;
    var ini = BASE_H.hechos.slice();

    var W = 520, H = 250;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'demo-svg rg-svg', role: 'img',
      'aria-label': 'Grafo de reglas: hechos en círculos y reglas en rectángulos, con flechas de las condiciones a la regla y de la regla a su conclusión.' });
    d.stage.appendChild(svg);
    var tabla = el('div', 'rg-tabla');
    d.stage.appendChild(tabla);

    // posiciones fijas: hechos de partida abajo, conclusiones arriba
    var P = {
      h4: [40, 210], h5: [100, 210], h6: [160, 210], h7: [330, 210], h8: [390, 210], h9: [450, 210],
      h3: [160, 130], h2: [100, 75], h1: [100, 18], h10: [360, 130], h11: [420, 55]
    };
    var PR = { R3: [160, 172], R2: [100, 128], R1: [100, 50], R4: [360, 172], R5: [420, 95] };

    function reglas() { return conExtra ? BASE_H.reglas.concat(BASE_H.extra) : BASE_H.reglas; }
    function calcula() {
      return modo === 'adelante' ? adelante(reglas(), ini) : atras(reglas(), ini, objetivo);
    }
    var res = calcula();
    function total() { return modo === 'adelante' ? res.length : res.pasos.length; }

    function dibuja() {
      svg.innerHTML = '';
      var defs = svgEl('defs', {});
      defs.innerHTML = '<marker id="rgfa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)"/></marker>' +
        '<marker id="rgfb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--blinky)"/></marker>';
      svg.appendChild(defs);
      // estado en el paso k
      var mt = ini.slice(), activa = null, nueva = null, enAgenda = {}, probados = {}, fallados = {}, foco = null;
      if (modo === 'adelante') {
        var p = res[Math.min(k, res.length - 1)];
        mt = p.mt.slice();
        (p.agenda || []).forEach(function (n) { enAgenda[n] = true; });
        if (k < res.length && p.dispara) { activa = p.dispara; nueva = p.nuevo; }
      } else {
        for (var i = 0; i <= Math.min(k, res.pasos.length - 1); i++) {
          var q = res.pasos[i];
          if (q.ok === true) probados[q.h] = true;
          if (q.ok === false) fallados[q.h] = true;
          if (i === k) { foco = q.h; activa = q.regla || null; }
        }
        if (k >= 0 && res.pasos[k] && res.pasos[k].regla) enAgenda[res.pasos[k].regla] = true;
      }
      reglas().forEach(function (r) {
        var pr = PR[r.n];
        r.si.forEach(function (h) {
          var ph = P[h];
          var on = activa === r.n;
          svg.appendChild(svgEl('path', { d: 'M' + ph[0] + ' ' + (ph[1] - 11) + ' L' + pr[0] + ' ' + (pr[1] + 9),
            class: 'rg-flecha' + (on ? ' on' : ''), 'marker-end': on ? 'url(#rgfb)' : 'url(#rgfa)' }));
        });
        var pc = P[r.en], on2 = activa === r.n;
        svg.appendChild(svgEl('path', { d: 'M' + pr[0] + ' ' + (pr[1] - 9) + ' L' + pc[0] + ' ' + (pc[1] + 12),
          class: 'rg-flecha' + (on2 ? ' on' : ''), 'marker-end': on2 ? 'url(#rgfb)' : 'url(#rgfa)' }));
      });
      reglas().forEach(function (r) {
        var pr = PR[r.n];
        var cls = 'rg-regla' + (activa === r.n ? ' dispara' : enAgenda[r.n] ? ' agenda' : '');
        svg.appendChild(svgEl('rect', { x: pr[0] - 17, y: pr[1] - 9, width: 34, height: 18, rx: 3, class: cls }));
        svg.appendChild(svgEl('text', { x: pr[0], y: pr[1] + 3.5, class: 'rg-etq' }, r.n));
      });
      Object.keys(P).forEach(function (h) {
        if (!conExtra && (h === 'h10' || h === 'h11')) return;
        var ph = P[h];
        var esIni = BASE_H.todos.indexOf(h) >= 0;
        var cls = 'rg-hecho';
        if (modo === 'adelante') {
          if (mt.indexOf(h) >= 0) cls += ' si';
          if (h === nueva) cls += ' nuevo';
        } else {
          if (probados[h]) cls += ' si';
          else if (fallados[h]) cls += ' no';
          if (h === foco) cls += ' foco';
        }
        if (esIni && ini.indexOf(h) < 0) cls += ' quitado';
        var g = svgEl('g', { class: esIni ? 'rg-click' : '' });
        g.appendChild(svgEl('circle', { cx: ph[0], cy: ph[1], r: 12, class: cls }));
        g.appendChild(svgEl('text', { x: ph[0], y: ph[1] + 3.5, class: 'rg-etq' }, h));
        if (esIni) {
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
          g.setAttribute('aria-label', (ini.indexOf(h) >= 0 ? 'Quitar ' : 'Poner ') + h + ' de la base de hechos');
          var cambia = function () {
            var i = ini.indexOf(h);
            if (i >= 0) ini.splice(i, 1); else ini.push(h);
            ini.sort(function (a, b) { return BASE_H.hechos.indexOf(a) - BASE_H.hechos.indexOf(b); });
            res = calcula(); k = 0; todo();
          };
          g.addEventListener('click', cambia);
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cambia(); } });
        }
        svg.appendChild(g);
      });
      svg.appendChild(svgEl('text', { x: 10, y: 244, class: 'dm-pie', style: 'text-anchor:start' }, 'BASE DE HECHOS INICIAL · PULSAD UN HECHO PARA QUITARLO O PONERLO'));
    }

    function pintaTabla() {
      tabla.innerHTML = '';
      var t = el('table', 'rg-pasos');
      var th = el('thead'), tr = el('tr');
      var cab = modo === 'adelante' ? ['Iteración', 'Memoria de trabajo', 'Agenda', 'Dispara'] : ['Paso', 'Razonamiento'];
      cab.forEach(function (c) { var x = el('th', null, c); x.scope = 'col'; tr.appendChild(x); });
      th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      if (modo === 'adelante') {
        res.slice(0, k + 1).forEach(function (p, i) {
          var r = el('tr', i === k ? 'ahora' : null);
          [ 'BH' + i, p.mt.join(', '), p.agenda.join(', ') || '—', p.dispara ? p.dispara + ' → ' + p.nuevo : 'nada: fin' ]
            .forEach(function (c) { r.appendChild(el('td', null, c)); });
          tb.appendChild(r);
        });
      } else {
        res.pasos.slice(0, k + 1).forEach(function (p, i) {
          var r = el('tr', i === k ? 'ahora' : null);
          r.appendChild(el('td', null, String(i + 1)));
          var c = el('td', p.ok === true ? 'bien' : p.ok === false ? 'mal' : null);
          c.style.paddingLeft = (0.6 + p.prof * 1.1) + 'rem';
          c.textContent = (p.ok === true ? '✓ ' : p.ok === false ? '✗ ' : '→ ') + p.txt;
          r.appendChild(c);
          tb.appendChild(r);
        });
      }
      t.appendChild(tb);
      tabla.appendChild(t);
    }

    function lectura() {
      var n = total();
      if (modo === 'adelante') {
        var fin = res[res.length - 1];
        var dispar = res.filter(function (p) { return p.dispara; }).length;
        d.read.textContent = 'Paso ' + (k + 1) + ' de ' + n + '. ' + (k === n - 1
          ? 'Fin: ' + dispar + ' reglas disparadas, ' + (fin.mt.indexOf('h1') >= 0 ? 'y h1 está en la memoria.' : 'y h1 no ha salido.') +
            (conExtra ? ' Fijaos en que también ha deducido ' + fin.mt.filter(function (h) { return h === 'h10' || h === 'h11'; }).join(' y ') + ', que no servían para nada.' : '')
          : 'Pulsad "Siguiente".');
      } else {
        d.read.textContent = 'Paso ' + (k + 1) + ' de ' + n + '. ' + (k === n - 1
          ? (res.ok ? objetivo + ' queda demostrado.' : objetivo + ' no se puede demostrar con estos hechos.') +
            ' Ha mirado ' + res.pasos.length + ' pasos, y sólo las reglas que concluyen lo que buscaba.'
          : 'Pulsad "Siguiente".');
      }
    }
    function todo() { dibuja(); pintaTabla(); lectura(); bAnt.disabled = k === 0; bSig.disabled = k >= total() - 1; }

    var bAnt = boton('← Anterior', function () { if (k > 0) { k--; todo(); } });
    var bSig = boton('Siguiente →', function () { if (k < total() - 1) { k++; todo(); } }, 'demo-play');
    var bFin = boton('Hasta el final', function () { k = total() - 1; todo(); });
    var b1 = barra('demo-bar-play');
    b1.appendChild(bAnt); b1.appendChild(bSig); b1.appendChild(bFin);
    var b2 = barra();
    b2.appendChild(opciones('Sentido', [['Hacia delante', 'adelante'], ['Hacia atrás · objetivo h1', 'atras']], modo, function (v) { modo = v; res = calcula(); k = 0; todo(); }));
    b2.appendChild(opciones('Reglas', [['R1–R3', false], ['Con R4 y R5', true]], conExtra, function (v) { conExtra = v; res = calcula(); k = 0; todo(); }));
    b2.appendChild(boton('Hechos de partida', function () { ini = BASE_H.hechos.slice(); res = calcula(); k = 0; todo(); }, 'demo-btn-mini'));
    d.controls.appendChild(b1); d.controls.appendChild(b2);
    todo();
  }

  /* ---------- 3 · la agenda de un fantasma y la resolución de conflictos ---------- */

  var REGLAS_F = [
    { n: 'perseguir', si: ['no comestible'], acc: 'perseguir', p: 10,
      t: function (s) { return !s.com; } },
    { n: 'huir-comestible', si: ['comestible'], acc: 'huir', p: 30,
      t: function (s) { return s.com; } },
    { n: 'emboscar', si: ['no comestible', 'MsPacMan a < 20'], acc: 'cortarle el paso', p: 40,
      t: function (s) { return !s.com && s.dist < 20; } },
    { n: 'huir-ppill', si: ['PPill a ≤ 30'], acc: 'huir', p: 50,
      t: function (s) { return s.ppill <= 30; } },
    { n: 'fin-del-susto', si: ['comestible', 'quedan < 30 turnos'], acc: 'dejar de huir y volver hacia ella', p: 20,
      t: function (s) { return s.com && s.tiempo < 30; } },
    { n: 'a-por-ella', si: ['no comestible', 'MsPacMan a < 20', 'PPill a ≤ 30', 'yo llego antes a la PPill'], acc: 'ir a la PPill a taparla', p: 60,
      t: function (s) { return !s.com && s.dist < 20 && s.ppill <= 30 && s.antes; } }
  ];
  // el orden en que GhostsInput aserta los hechos: decide la "recencia"
  var HECHOS_F = ['comestible', 'distancia', 'ppill', 'tiempo', 'antes'];
  var USA_F = {
    'perseguir': ['comestible'], 'huir-comestible': ['comestible'], 'emboscar': ['comestible', 'distancia'],
    'huir-ppill': ['ppill'], 'fin-del-susto': ['comestible', 'tiempo'], 'a-por-ella': ['comestible', 'distancia', 'ppill', 'antes']
  };

  function creaConflicto(nodo) {
    var d = prepara(nodo);
    var s = { com: false, dist: 15, ppill: 25, tiempo: 60, antes: false };
    var estr = 'orden';

    var tabla = el('div', 'rg-tabla');
    d.stage.appendChild(tabla);
    var mem = el('p', 'demo-def');
    nodo.insertBefore(mem, d.read);

    function recencia(r) {
      return USA_F[r.n].reduce(function (m, h) { return Math.max(m, HECHOS_F.indexOf(h)); }, -1);
    }
    function ordena(agenda) {
      var a = agenda.slice();
      if (estr === 'prioridad') a.sort(function (x, y) { return y.p - x.p; });
      else if (estr === 'especificidad') a.sort(function (x, y) { return y.si.length - x.si.length || REGLAS_F.indexOf(x) - REGLAS_F.indexOf(y); });
      else if (estr === 'recencia') a.sort(function (x, y) { return recencia(y) - recencia(x) || REGLAS_F.indexOf(x) - REGLAS_F.indexOf(y); });
      return a;
    }
    function pinta() {
      var agenda = REGLAS_F.filter(function (r) { return r.t(s); });
      var orden = ordena(agenda);
      var gana = orden[0];
      tabla.innerHTML = '';
      var t = el('table', 'rg-pasos rg-conf');
      var tr = el('tr');
      ['#', 'Regla', 'Si…', 'Entonces', 'Prioridad', '¿Se cumple?', 'Puesto'].forEach(function (c) { var x = el('th', null, c); x.scope = 'col'; tr.appendChild(x); });
      var th = el('thead'); th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      REGLAS_F.forEach(function (r, i) {
        var ok = agenda.indexOf(r) >= 0;
        var row = el('tr', (r === gana ? 'gana' : '') + (ok ? '' : ' fuera'));
        row.appendChild(el('td', null, String(i + 1)));
        var c1 = el('td'); c1.appendChild(el('code', null, r.n)); row.appendChild(c1);
        row.appendChild(el('td', null, r.si.join(' y ')));
        row.appendChild(el('td', null, r.acc));
        row.appendChild(el('td', 'num', String(r.p)));
        row.appendChild(el('td', ok ? 'bien' : 'mal', ok ? '✓ a la agenda' : '✗'));
        row.appendChild(el('td', 'num', ok ? String(orden.indexOf(r) + 1) : ''));
        tb.appendChild(row);
      });
      t.appendChild(tb);
      tabla.appendChild(t);
      mem.textContent = 'Memoria de trabajo de este turno: ' +
        '(comestible ' + (s.com ? 'true' : 'false') + ') (distancia-a-MsPacMan ' + s.dist + ') (MsPacMan-a-PPill ' + s.ppill + ')' +
        (s.com ? ' (turnos-comestible ' + s.tiempo + ')' : '') + ' (llego-antes-a-PPill ' + (s.antes ? 'true' : 'false') + ')';
      d.read.textContent = agenda.length + (agenda.length === 1 ? ' regla' : ' reglas') + ' en la agenda. Con la estrategia "' + NOMBRE_E[estr] + '" gana ' +
        gana.n + ': el fantasma va a ' + gana.acc + '.' + (estr === 'recencia' ? ' Ojo: aquí "reciente" sólo quiere decir "asertado más tarde por Input".' : '');
    }
    var NOMBRE_E = { orden: 'orden en el fichero', prioridad: 'prioridad', especificidad: 'especificidad', recencia: 'recencia' };

    var b1 = barra('demo-bar-play');
    b1.appendChild(opciones('Estrategia', [['Orden', 'orden'], ['Prioridad', 'prioridad'], ['Especificidad', 'especificidad'], ['Recencia', 'recencia']], estr, function (v) { estr = v; pinta(); }));
    var b2 = barra();
    var bCom = el('button', 'demo-btn demo-btn-mini', 'Comestible');
    bCom.type = 'button'; bCom.setAttribute('aria-pressed', 'false');
    bCom.onclick = function () { s.com = !s.com; bCom.setAttribute('aria-pressed', String(s.com)); dT.hidden = !s.com; pinta(); };
    var bAntes = el('button', 'demo-btn demo-btn-mini', 'Llego antes a la PPill');
    bAntes.type = 'button'; bAntes.setAttribute('aria-pressed', 'false');
    bAntes.onclick = function () { s.antes = !s.antes; bAntes.setAttribute('aria-pressed', String(s.antes)); pinta(); };
    b2.appendChild(el('span', 'demo-tag', 'Hechos'));
    b2.appendChild(bCom); b2.appendChild(bAntes);
    var b3 = barra();
    b3.appendChild(deslizador('Fantasma → MsPacMan', 1, 80, s.dist, function (v) { s.dist = v; pinta(); }));
    b3.appendChild(deslizador('MsPacMan → PPill', 1, 120, s.ppill, function (v) { s.ppill = v; pinta(); }));
    var dT = deslizador('Turnos comestible', 0, 200, s.tiempo, function (v) { s.tiempo = v; pinta(); });
    dT.hidden = true;
    b3.appendChild(dT);
    d.controls.appendChild(b1); d.controls.appendChild(b2); d.controls.appendChild(b3);
    pinta();
  }

  /* ---------- 4 · la red Rete ---------- */

  // Tres reglas que comparten condiciones. Los nodos alfa filtran un hecho
  // suelto; los beta cruzan dos memorias; las hojas son las reglas.
  var RETE = {
    alfa: [
      { id: 'a1', txt: 'fantasma · comestible false', x: 90, t: function (h) { return h.tipo === 'fantasma' && !h.com; } },
      { id: 'a2', txt: 'fantasma · comestible true', x: 260, t: function (h) { return h.tipo === 'fantasma' && h.com; } },
      { id: 'a3', txt: 'MsPacMan · cerca de ?f', x: 430, t: function (h) { return h.tipo === 'cerca'; } }
    ],
    beta: [
      { id: 'b1', izq: 'a1', der: 'a3', txt: 'a1 ⋈ a3 por ?f', x: 160, regla: 'emboscar' },
      { id: 'b2', izq: 'a2', der: 'a3', txt: 'a2 ⋈ a3 por ?f', x: 360, regla: 'huir-ya' }
    ],
    reglas: [
      { n: 'perseguir', de: 'a1', x: 40, conds: 1 },
      { n: 'emboscar', de: 'b1', x: 160, conds: 2 },
      { n: 'huir-ya', de: 'b2', x: 360, conds: 2 }
    ],
    guion: [
      { op: '+', h: { id: 1, tipo: 'fantasma', nom: 'blinky', com: false }, txt: '(fantasma blinky (comestible false))' },
      { op: '+', h: { id: 2, tipo: 'fantasma', nom: 'pinky', com: false }, txt: '(fantasma pinky (comestible false))' },
      { op: '+', h: { id: 3, tipo: 'fantasma', nom: 'inky', com: true }, txt: '(fantasma inky (comestible true))' },
      { op: '+', h: { id: 4, tipo: 'cerca', nom: 'blinky' }, txt: '(MsPacMan cerca blinky)' },
      { op: '+', h: { id: 5, tipo: 'cerca', nom: 'inky' }, txt: '(MsPacMan cerca inky)' },
      { op: '-', id: 4, txt: '(MsPacMan cerca blinky)' },
      { op: '+', h: { id: 6, tipo: 'cerca', nom: 'pinky' }, txt: '(MsPacMan cerca pinky)' }
    ]
  };

  function creaRete(nodo) {
    var d = prepara(nodo);
    var W = 520, H = 268;
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'demo-svg rg-svg', role: 'img',
      'aria-label': 'Red Rete con tres nodos alfa arriba, dos nodos beta en medio y tres reglas abajo; los hechos entran por arriba y bajan hasta la agenda.' });
    d.stage.appendChild(svg);
    var cuenta = el('p', 'demo-def');
    nodo.insertBefore(cuenta, d.read);
    var k = -1;   // último paso del guion aplicado

    function estado(hasta) {
      var hechos = [], cRete = 0, cIngenuo = 0, toca = null;
      for (var i = 0; i <= hasta; i++) {
        var g = RETE.guion[i];
        if (g.op === '+') hechos.push(g.h);
        else hechos = hechos.filter(function (h) { return h.id !== g.id; });
        // Rete: el hecho nuevo pasa por los tres filtros alfa y sólo cruza
        // con la memoria del otro lado en los beta a los que llega
        var h = g.op === '+' ? g.h : null;
        cRete += RETE.alfa.length;
        if (h) {
          RETE.beta.forEach(function (b) {
            var A = RETE.alfa.filter(function (a) { return a.id === b.izq; })[0], B = RETE.alfa.filter(function (a) { return a.id === b.der; })[0];
            if (A.t(h)) cRete += hechos.filter(function (x) { return B.t(x); }).length;
            if (B.t(h)) cRete += hechos.filter(function (x) { return A.t(x); }).length;
          });
        }
        // ingenuo: cada regla vuelve a probar todas sus condiciones con todos los hechos
        cIngenuo += 1 * hechos.length + 2 * hechos.length * hechos.length * 2;
        if (i === hasta) toca = g;
      }
      return { hechos: hechos, cRete: cRete, cIngenuo: cIngenuo, toca: toca };
    }

    function dibuja() {
      svg.innerHTML = '';
      var e = k >= 0 ? estado(k) : { hechos: [], cRete: 0, cIngenuo: 0, toca: null };
      var nuevo = e.toca && e.toca.op === '+' ? e.toca.h : null;
      var memA = {}, memB = {}, agenda = [];
      RETE.alfa.forEach(function (a) { memA[a.id] = e.hechos.filter(a.t); });
      RETE.beta.forEach(function (b) {
        memB[b.id] = [];
        memA[b.izq].forEach(function (x) { memA[b.der].forEach(function (y) { if (x.nom === y.nom) memB[b.id].push([x, y]); }); });
      });
      RETE.reglas.forEach(function (r) {
        var m = r.de[0] === 'a' ? memA[r.de].map(function (x) { return [x]; }) : memB[r.de];
        m.forEach(function (t) { agenda.push({ r: r.n, t: t }); });
      });
      function enciende(id) {
        if (!nuevo) return false;
        if (id[0] === 'a') return RETE.alfa.filter(function (a) { return a.id === id; })[0].t(nuevo);
        var b = RETE.beta.filter(function (x) { return x.id === id; })[0];
        return memB[id].some(function (t) { return t.indexOf(nuevo) >= 0; }) && !!b;
      }
      // la raíz
      svg.appendChild(svgEl('rect', { x: 200, y: 6, width: 120, height: 22, rx: 11, class: 'rg-raiz' }));
      svg.appendChild(svgEl('text', { x: 260, y: 21, class: 'rg-etq' }, e.toca ? (e.toca.op === '+' ? 'entra ' : 'sale ') + 'f-' + (e.toca.h ? e.toca.h.id : e.toca.id) : 'hechos'));
      RETE.alfa.forEach(function (a) {
        var on = enciende(a.id);
        svg.appendChild(svgEl('path', { d: 'M260 28 L' + a.x + ' 52', class: 'rg-flecha' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('rect', { x: a.x - 72, y: 52, width: 144, height: 22, rx: 3, class: 'rg-alfa' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('text', { x: a.x, y: 67, class: 'rg-etq' }, a.txt));
        svg.appendChild(svgEl('text', { x: a.x, y: 88, class: 'rg-mem' }, memA[a.id].length ? memA[a.id].map(function (h) { return 'f-' + h.id; }).join(' ') : '∅'));
      });
      RETE.beta.forEach(function (b) {
        var on = enciende(b.id);
        var A = RETE.alfa.filter(function (a) { return a.id === b.izq; })[0], B = RETE.alfa.filter(function (a) { return a.id === b.der; })[0];
        svg.appendChild(svgEl('path', { d: 'M' + A.x + ' 94 L' + b.x + ' 128', class: 'rg-flecha' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('path', { d: 'M' + B.x + ' 94 L' + b.x + ' 128', class: 'rg-flecha' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('rect', { x: b.x - 60, y: 128, width: 120, height: 22, rx: 11, class: 'rg-beta' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('text', { x: b.x, y: 143, class: 'rg-etq' }, b.txt));
        svg.appendChild(svgEl('text', { x: b.x, y: 164, class: 'rg-mem' }, memB[b.id].length ? memB[b.id].map(function (t) { return 'f-' + t[0].id + ',f-' + t[1].id; }).join('  ') : '∅'));
      });
      RETE.reglas.forEach(function (r) {
        var src = r.de[0] === 'a' ? RETE.alfa.filter(function (a) { return a.id === r.de; })[0] : RETE.beta.filter(function (b) { return b.id === r.de; })[0];
        var y0 = r.de[0] === 'a' ? 94 : 170;
        var activa = agenda.some(function (a) { return a.r === r.n; });
        var on = enciende(r.de);
        svg.appendChild(svgEl('path', { d: 'M' + src.x + ' ' + y0 + ' L' + r.x + ' 196', class: 'rg-flecha' + (on ? ' on' : '') }));
        svg.appendChild(svgEl('rect', { x: r.x - 36, y: 196, width: 72, height: 22, rx: 3, class: 'rg-regla' + (activa ? ' agenda' : '') + (on ? ' dispara' : '') }));
        svg.appendChild(svgEl('text', { x: r.x, y: 211, class: 'rg-etq' }, r.n));
      });
      svg.appendChild(svgEl('text', { x: 10, y: 240, class: 'dm-pie', style: 'text-anchor:start' }, 'AGENDA'));
      svg.appendChild(svgEl('text', { x: 70, y: 240, class: 'rg-mem', style: 'text-anchor:start' },
        agenda.length ? agenda.map(function (a) { return a.r + ' [' + a.t.map(function (h) { return 'f-' + h.id; }).join(',') + ']'; }).join('   ') : '∅'));
      svg.appendChild(svgEl('text', { x: 10, y: 258, class: 'dm-pie', style: 'text-anchor:start' }, 'EN AMARILLO, POR DÓNDE PASA EL ÚLTIMO HECHO'));
      cuenta.textContent = k < 0 ? 'Todavía no ha entrado ningún hecho.' :
        'Paso ' + (k + 1) + ': ' + (e.toca.op === '+' ? 'se aserta ' : 'se retira ') + 'f-' + (e.toca.h ? e.toca.h.id : e.toca.id) + ' ' + e.toca.txt + '\n' +
        'Comprobaciones acumuladas · Rete: ' + e.cRete + ' · probar cada regla con todos los hechos en cada ciclo: ' + e.cIngenuo;
      d.read.textContent = k < 0 ? 'Pulsad "Siguiente hecho" para meter el primero.' :
        agenda.length + (agenda.length === 1 ? ' activación' : ' activaciones') + ' en la agenda. ' + (k === RETE.guion.length - 1 ? 'Fin del guion: la diferencia entre las dos cifras crece con cada hecho.' : '');
      bSig.disabled = k >= RETE.guion.length - 1;
      bAnt.disabled = k < 0;
    }
    var bAnt = boton('← Anterior', function () { if (k >= 0) { k--; dibuja(); } });
    var bSig = boton('Siguiente hecho →', function () { if (k < RETE.guion.length - 1) { k++; dibuja(); } }, 'demo-play');
    var bIni = boton('Vaciar', function () { k = -1; dibuja(); });
    var b1 = barra('demo-bar-play');
    b1.appendChild(bAnt); b1.appendChild(bSig); b1.appendChild(bIni);
    d.controls.appendChild(b1);
    dibuja();
  }

  var CREA = { banco: creaBanco, encadenar: creaEncadenar, conflicto: creaConflicto, rete: creaRete };
  Array.prototype.forEach.call(document.querySelectorAll('[data-reglas]'), function (n) {
    var f = CREA[n.getAttribute('data-reglas')];
    if (!f) return;
    try { f(n); } catch (e) { if (window.console) console.error('reglas', n.getAttribute('data-reglas'), e); }
  });
})(this);
