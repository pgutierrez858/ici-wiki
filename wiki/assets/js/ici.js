/* ICI — wiki de la asignatura.
   Tres comportamientos: el tema, la fecha de hoy y copiar los bloques
   de código.
   Todo lo que se escribe aquí ya está en el HTML como texto
   correcto en el momento de publicar; esto sólo lo mantiene
   al día conforme avanza el curso. */

(function () {
  'use strict';

  /* ---------- tema: auto / claro / oscuro ---------- */
  var KEY = 'ici-tema';
  var ORDER = ['auto', 'light', 'dark'];
  var NAMES = { auto: 'auto', light: 'claro', dark: 'oscuro' };

  function apply(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }

  function current() {
    try {
      var v = localStorage.getItem(KEY);
      return ORDER.indexOf(v) > -1 ? v : 'auto';
    } catch (e) { return 'auto'; }
  }

  var btn = document.querySelector('.theme');
  if (btn) {
    var paint = function (mode) {
      btn.innerHTML = 'Tema · <b>' + NAMES[mode] + '</b>';
      // empieza por lo que se ve, para que funcione también por voz (WCAG 2.5.3)
      btn.setAttribute('aria-label', 'Tema · ' + NAMES[mode] + '. Pulsa para cambiar.');
    };
    paint(current());
    btn.addEventListener('click', function () {
      var next = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
      paint(next);
    });
  }

  /* ---------- estado del curso ---------- */
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
             'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function parse(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function fmt(d) { return DIA[d.getDay()] + ' ' + d.getDate() + ' ' + MES[d.getMonth()]; }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  var blocks = [].slice.call(document.querySelectorAll('[data-start][data-due]'));
  var live = null, next = null;

  blocks.forEach(function (el) {
    var start = parse(el.getAttribute('data-start'));
    var due = parse(el.getAttribute('data-due'));
    if (today >= start && today <= due) live = { el: el, due: due };
    // una entrega intermedia del bloque va antes que la del domingo final
    var hito = el.getAttribute('data-hito');
    if (!next && hito && today <= parse(hito)) next = { el: el, due: parse(hito), hito: el.getAttribute('data-hito-txt') };
    if (!next && today <= due) next = { el: el, due: due };

    var slot = el.querySelector('[data-state]');
    if (!slot) return;
    var st = estado(el);
    slot.className = 'chip ' + st[0];
    slot.textContent = st[1];
    if (st[0] === 'now') el.setAttribute('aria-current', 'true');
  });

  // [clase, texto] de un bloque a fecha de hoy; build.mjs hace lo mismo al publicar
  function estado(el) {
    var start = parse(el.getAttribute('data-start'));
    if (today > parse(el.getAttribute('data-due'))) return ['done', 'Cerrada'];
    if (today >= start) return ['now', 'En curso'];
    return ['soon', el.hasAttribute('data-enun')
      ? 'Abre el ' + start.getDate() + ' ' + MES[start.getMonth()].slice(0, 3) : 'Por abrir'];
  }

  /* ---------- franja Ahora ----------
     Recoloca la cuña de Ms. Pac-Man, come las píldoras de los bloques
     cerrados y rehace la línea de "qué toca" con la fecha de hoy. */
  var franja = document.querySelector('.ahora');
  if (franja) {
    var pills = [].slice.call(franja.querySelectorAll('.ap'));
    var vivo = null, obj = null;
    pills.forEach(function (li) {
      var st = estado(li);
      li.setAttribute('data-ap', st[0]);
      li.removeAttribute('data-objetivo');
      var a = li.querySelector('a');
      if (a) a.removeAttribute('aria-current');
      var sr = li.querySelector('.sr-only');
      if (sr) sr.textContent = li.getAttribute('data-name') + ' · ' + li.getAttribute('data-tema') + ', ' + st[1].toLowerCase();
      if (st[0] === 'now' && !vivo) vivo = li;
      if (st[0] === 'soon' && !obj) obj = li;
    });
    obj = vivo || obj;
    var pac = franja.querySelector('.ap-pac');
    var dias = function (x) { var n = Math.round((x - today) / 86400000); return n === 0 ? 'es hoy' : n === 1 ? 'queda 1 día' : 'quedan ' + n + ' días'; };
    var cuando = 'Todas las prácticas cerradas', rel = '', nombre = 'Curso terminado';
    if (obj) {
      obj.setAttribute('data-objetivo', '');
      var oa = obj.querySelector('a');
      if (oa) oa.setAttribute('aria-current', 'step');
      if (pac) obj.querySelector('.ap-dot').insertBefore(pac, obj.querySelector('.ap-pill'));
      nombre = obj.getAttribute('data-name') + ' · ' + obj.getAttribute('data-tema');
      var hito = obj.getAttribute('data-hito'), dueTxt = obj.getAttribute('data-due-txt');
      if (!vivo) {
        var abre = parse(obj.getAttribute('data-start'));
        cuando = 'Abre el ' + fmt(abre); rel = dias(abre);
      } else if (hito && today <= parse(hito)) {
        cuando = 'Entrega del ' + obj.getAttribute('data-hito-txt') + ' el ' + fmt(parse(hito)); rel = dias(parse(hito));
      } else if (dueTxt) {
        cuando = 'Entrega: ' + dueTxt.toLowerCase();
      } else {
        var vence = parse(obj.getAttribute('data-due'));
        cuando = 'Entrega el ' + fmt(vence); rel = dias(vence);
      }
    } else if (pac) {
      pac.parentNode.removeChild(pac);
    }
    var pon = function (sel, txt) { var x = franja.querySelector(sel); if (x) x.textContent = txt; };
    pon('[data-ahora-name]', nombre);
    pon('[data-ahora-when]', cuando);
    pon('[data-ahora-rel]', rel);
    [['enun', 'data-enun'], ['guia', 'data-guia'], ['apuntes', 'data-apuntes']].forEach(function (k) {
      var a = franja.querySelector('[data-ahora-' + k[0] + ']');
      if (!a) return;
      var href = obj && obj.getAttribute(k[1]);
      a.parentNode.hidden = !href;
      if (href) a.setAttribute('href', href);
      if (k[0] === 'guia' && href) a.firstChild.nodeValue = obj.getAttribute('data-guia-txt') + ' ';
    });
  }

  if (next) {
    var days = Math.round((next.due - today) / 86400000);
    // un bloque puede no tener todavía fecha firme de entrega
    var txt = next.hito ? null : next.el.getAttribute('data-due-txt');
    document.querySelectorAll('[data-next-due]').forEach(function (el) {
      el.textContent = txt || fmt(next.due);
    });
    document.querySelectorAll('[data-next-due-rel]').forEach(function (el) {
      el.textContent = txt ? 'Fecha por confirmar'
        : days === 0 ? 'Es hoy'
        : days === 1 ? 'Queda 1 día'
        : 'Quedan ' + days + ' días';
    });
    document.querySelectorAll('[data-next-name]').forEach(function (el) {
      var name = next.el.getAttribute('data-name');
      if (name) el.textContent = next.hito ? name + ' · ' + next.hito : name;
    });
  } else if (blocks.length) {
    // curso terminado: no dejar congelada la última entrega
    document.querySelectorAll('[data-next-due]').forEach(function (el) {
      el.textContent = 'Nada pendiente';
    });
    document.querySelectorAll('[data-next-due-rel]').forEach(function (el) {
      el.textContent = 'Curso terminado';
    });
    document.querySelectorAll('[data-next-name]').forEach(function (el) {
      el.textContent = 'todas entregadas';
    });
  }


  /* ---------- copiar un bloque de código ----------
     Se añade desde aquí y no en el HTML: sin JavaScript el bloque
     sigue siendo texto seleccionable, que es lo que importa. */
  var aviso = null;
  function avisa(txt) {
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'sr-only';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = txt;
  }

  var ICONO_COPIA = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<rect x="5.5" y="1.5" width="9" height="11" rx="1.5"/>' +
    '<path d="M10.5 14.5H3A1.5 1.5 0 0 1 1.5 13V4.5"/></svg>';
  var ICONO_HECHO = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M2.5 8.5 6 12l7.5-8"/></svg>';

  function copiaTexto(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt);
    }
    return new Promise(function (ok, mal) {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var bien = false;
      try { bien = document.execCommand('copy'); } catch (e) { bien = false; }
      document.body.removeChild(ta);
      bien ? ok() : mal(new Error('sin portapapeles'));
    });
  }

  [].slice.call(document.querySelectorAll('pre')).forEach(function (pre) {
    if (pre.closest('.deck') || pre.classList.contains('pseudo')) return;

    var caja = document.createElement('div');
    caja.className = 'codigo';
    pre.parentNode.insertBefore(caja, pre);
    caja.appendChild(pre);

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copiar';
    b.innerHTML = ICONO_COPIA;
    b.setAttribute('aria-label', 'Copiar el código');
    b.title = 'Copiar';
    caja.appendChild(b);

    var vuelve = null;
    b.addEventListener('click', function () {
      var txt = (pre.textContent || '').replace(/\s+$/, '');
      copiaTexto(txt).then(function () {
        b.innerHTML = ICONO_HECHO;
        b.classList.add('hecho');
        b.setAttribute('aria-label', 'Código copiado');
        b.title = 'Copiado';
        avisa('Código copiado al portapapeles.');
      }, function () {
        b.classList.add('falla');
        b.setAttribute('aria-label', 'No he podido copiar: selecciona el código a mano');
        b.title = 'No se ha podido copiar';
        avisa('No he podido copiar. Selecciona el código a mano.');
      });
      clearTimeout(vuelve);
      vuelve = setTimeout(function () {
        b.innerHTML = ICONO_COPIA;
        b.classList.remove('hecho', 'falla');
        b.setAttribute('aria-label', 'Copiar el código');
        b.title = 'Copiar';
      }, 2000);
    });
  });

  /* día de hoy en el tablero */
  var iso = today.getFullYear() + '-' +
            ('0' + (today.getMonth() + 1)).slice(-2) + '-' +
            ('0' + today.getDate()).slice(-2);
  var cell = document.querySelector('.d[data-day="' + iso + '"]');
  if (cell) {
    cell.classList.add('today');
    cell.setAttribute('aria-current', 'date');
    var t = cell.getAttribute('title');
    cell.setAttribute('title', t ? t + ' · hoy' : 'Hoy');
  }

  /* ---------- listas para tachar ----------
     Una .check con data-guardar se vuelve una lista de casillas que se
     recuerdan en este navegador. Sin JavaScript sigue siendo la lista
     impresa de siempre. Con data-reiniciar lleva un botón para empezar
     otra vuelta, que es lo que pide una lista que se repite. */
  [].slice.call(document.querySelectorAll('ul.check[data-guardar]')).forEach(function (ul) {
    var clave = 'ici-lista:' + ul.getAttribute('data-guardar');
    var marcadas = [];
    try { marcadas = JSON.parse(localStorage.getItem(clave) || '[]'); } catch (e) { marcadas = []; }
    if (!Array.isArray(marcadas)) marcadas = [];

    var casillas = [].slice.call(ul.children).map(function (li, i) {
      var label = document.createElement('label');
      var caja = document.createElement('input');
      caja.type = 'checkbox';
      caja.checked = marcadas.indexOf(i) > -1;
      var texto = document.createElement('span');
      while (li.firstChild) texto.appendChild(li.firstChild);
      label.appendChild(caja);
      label.appendChild(texto);
      li.appendChild(label);
      return caja;
    });
    ul.classList.add('tachar');

    function guarda() {
      var hechas = [];
      casillas.forEach(function (c, i) { if (c.checked) hechas.push(i); });
      try { localStorage.setItem(clave, JSON.stringify(hechas)); } catch (e) {}
    }
    casillas.forEach(function (c) { c.addEventListener('change', guarda); });

    if (ul.hasAttribute('data-reiniciar')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'demo-btn lista-otra';
      b.textContent = 'Desmarcar para la versión siguiente';
      b.addEventListener('click', function () {
        casillas.forEach(function (c) { c.checked = false; });
        guarda();
        avisa('Lista desmarcada.');
      });
      ul.parentNode.insertBefore(b, ul.nextSibling);
    }
  });

  /* ---------- listas barajadas ----------
     Una lista con data-barajar sale en un orden al azar, el mismo siempre en
     este navegador, y las misiones a las que enlaza se ponen en ese orden:
     así no todos los grupos las hacen en el mismo. Va después de las casillas,
     que se guardan por su posición original. */
  [].slice.call(document.querySelectorAll('ul[data-barajar]')).forEach(function (ul) {
    var clave = 'ici-orden:' + ul.getAttribute('data-barajar');
    var lis = [].slice.call(ul.children);
    var ids = lis.map(function (li) {
      var a = li.querySelector('a[href^="#"]');
      return a ? a.getAttribute('href').slice(1) : '';
    });
    var orden = null;
    try { orden = JSON.parse(localStorage.getItem(clave)); } catch (e) {}
    var vale = Array.isArray(orden) && orden.length === ids.length &&
      ids.every(function (id) { return orden.indexOf(id) > -1; });
    if (!vale) {   // primera visita, o la lista ha cambiado: se baraja y se guarda
      orden = ids.slice();
      for (var i = orden.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = orden[i];
        orden[i] = orden[j]; orden[j] = t;
      }
      try { localStorage.setItem(clave, JSON.stringify(orden)); } catch (e) {}
    }
    orden.forEach(function (id) {
      ul.appendChild(lis[ids.indexOf(id)]);
      var destino = id && document.getElementById(id);
      if (destino) destino.parentNode.appendChild(destino);
    });
  });

  /* ---------- marcador de puntos ----------
     Un [data-marcador="10"] suma los data-puntos de las casillas tachadas de
     sus listas. Las de data-grupo="retos" cuentan como mucho tres, y entre
     todas como mucho la mitad del total: son las misiones de la práctica. */
  [].slice.call(document.querySelectorAll('[data-marcador]')).forEach(function (m) {
    var maximo = Number(m.getAttribute('data-marcador')) || 10;
    var msg = m.querySelector('[data-mensaje]');
    var inicial = msg ? msg.textContent : '';
    // copias del marcador (la del raíl): repiten total, barra y lo tachado, sin casillas propias
    var espejos = m.id ? [].slice.call(document.querySelectorAll('[data-espejo="' + m.id + '"]')) : [];
    var estaba = null;   // lleno en la cuenta anterior; null en la primera, que no anima
    function num(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }
    function cuenta() {
      var base = 0, retos = [];
      [].slice.call(m.querySelectorAll('li[data-puntos]')).forEach(function (li) {
        var c = li.querySelector('input[type=checkbox]');
        if (!c || !c.checked) return;
        var v = Number(li.getAttribute('data-puntos'));
        if (li.getAttribute('data-grupo') === 'retos') retos.push(v); else base += v;
      });
      retos.sort(function (a, b) { return b - a; });
      var deRetos = Math.min(maximo / 2, retos.slice(0, 3).reduce(function (a, b) { return a + b; }, 0));
      var t = Math.min(maximo, base + deRetos), lleno = t >= maximo;
      [m].concat(espejos).forEach(function (el) {
        el.querySelector('[data-total]').textContent = num(t);
        el.querySelector('[data-barra]').style.transform = 'scaleX(' + (t / maximo) + ')';
        el.classList.toggle('lleno', lleno);
        if (lleno && estaba === false) {   // la cuña muerde una vez al llegar al máximo
          el.classList.remove('muerde'); void el.offsetWidth; el.classList.add('muerde');
        }
      });
      estaba = lleno;
      espejos.forEach(function (el) {
        [].slice.call(el.querySelectorAll('li > a[href^="#"]')).forEach(function (a) {
          var o = m.querySelector('li a[href="' + a.getAttribute('href') + '"]');
          var c = o && o.closest('li').querySelector('input[type=checkbox]');
          var li = a.parentNode, hecho = !!(c && c.checked), sr = li.querySelector('.sr-only');
          li.classList.toggle('hecho', hecho);
          if (!sr) { sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' (hecho)'; li.appendChild(sr); }
          sr.hidden = !hecho;
        });
      });
      if (msg) msg.textContent = t >= maximo ? '¡Práctica completa!'
        : retos.length > 3 ? 'Ya tenéis más de tres retos: cuentan los tres que más valen.' : inicial;
    }
    m.addEventListener('change', cuenta);
    cuenta();
  });

  /* ---------- misiones con su casilla ----------
     Cada .mision enlazada desde una lista para tachar lleva una casilla
     "Hecha" que es la misma que la de la lista: marcar una marca la otra. */
  [].slice.call(document.querySelectorAll('.check.tachar li a[href^="#"]')).forEach(function (a) {
    var mision = document.getElementById(a.getAttribute('href').slice(1));
    var origen = a.closest('li').querySelector('input[type=checkbox]');
    if (!mision || !mision.classList.contains('mision') || !origen) return;
    var label = document.createElement('label');
    label.className = 'hecha';
    var caja = document.createElement('input');
    caja.type = 'checkbox';
    label.appendChild(caja);
    label.appendChild(document.createTextNode('Hecha'));
    (mision.querySelector('h3, h4') || mision).appendChild(label);
    function pinta() { caja.checked = origen.checked; mision.classList.toggle('mision-hecha', origen.checked); }
    caja.addEventListener('change', function () {
      origen.checked = caja.checked;
      origen.dispatchEvent(new Event('change', { bubbles: true }));   // guarda y recuenta el marcador
    });
    origen.addEventListener('change', pinta);
    pinta();
  });

  /* ---------- apuntes: guía en curso, índice en móvil y píldoras ----------
     Las tres cosas son ayudas de navegación: sin JavaScript la página ya
     tiene su raíl (en escritorio), su pager y el índice del tema. */

  // en el índice de apuntes, la guía del bloque en curso sube arriba
  var enCurso = document.getElementById('en-curso');
  if (enCurso) {
    var arriba = enCurso.querySelector('.guia-p');
    var viva = document.querySelector('.guia-p[aria-current="true"]');
    var primera = document.querySelector('#anteriores .guia-p');
    if (viva && arriba && viva !== arriba && primera) {
      primera.parentNode.insertBefore(arriba, primera);
      enCurso.appendChild(viva);
    } else if (!viva) {
      var hEnCurso = enCurso.querySelector('[data-en-curso]');
      if (hEnCurso) hEnCurso.textContent = 'La última práctica';
    }
  }

  // por debajo de 1020 px el raíl no se ve: su índice se copia en un
  // desplegable al principio de main
  var railDentro = document.querySelector('.rail .rail-inner');
  var principal = document.querySelector('.cols > main');
  var navsRail = railDentro ? [].slice.call(railDentro.querySelectorAll('nav')) : [];
  if (principal && navsRail.length) {
    var det = document.createElement('details');
    det.className = 'indice-movil';
    var resumen = document.createElement('summary');
    var nPag = navsRail[0].querySelectorAll('a').length;
    var esTema = navsRail[0].getAttribute('aria-labelledby') === 'del-tema';
    resumen.textContent = (esTema ? 'Índice del tema · ' : 'Índice de la página · ') + nPag +
      (esTema ? ' páginas' : nPag === 1 ? ' sección' : ' secciones');
    det.appendChild(resumen);
    navsRail.forEach(function (nav) {
      var copia = nav.cloneNode(true);
      var tit = copia.querySelector('h2');
      copia.removeAttribute('aria-labelledby');
      if (tit) {
        copia.setAttribute('aria-label', tit.textContent);
        var p = document.createElement('p');
        p.className = 'indice-movil-h';
        p.textContent = tit.textContent;
        tit.parentNode.replaceChild(p, tit);
      }
      [].slice.call(copia.querySelectorAll('[id]')).forEach(function (e) { e.removeAttribute('id'); });
      det.appendChild(copia);
    });
    det.addEventListener('click', function (e) { if (e.target.closest('a')) det.open = false; });
    principal.insertBefore(det, principal.firstChild);
  }

  // al pie de cada página de apuntes, una píldora por página del tema: las
  // leídas en este navegador, comidas; la actual, con Ms. Pac-Man
  var enTema = location.pathname.match(/\/guias\/(tema\d|bonus)\/[^\/]*$/);
  if (enTema && principal) {
    var COLOR = { tema2: 'p1', tema3: 'p3', tema4: 'p4', tema5: 'p5', tema6: 'cb', bonus: 'bn' };
    var carpeta = location.pathname.replace(/[^\/]*$/, '');
    var aqui = /\/$/.test(location.pathname) ? location.pathname + 'index.html' : location.pathname;
    var fuente = document.querySelectorAll('nav[aria-labelledby="del-tema"] a');
    if (!fuente.length) fuente = principal.querySelectorAll('.links a');
    var paginas = [];
    [].forEach.call(fuente, function (a) {
      var ruta = new URL(a.getAttribute('href'), location.href).pathname;
      if (ruta.replace(/[^\/]*$/, '') !== carpeta || /\/index\.html$/.test(ruta)) return;
      if (paginas.some(function (x) { return x.ruta === ruta; })) return;
      var lt = a.querySelector('.lt');
      var nombre = (lt ? lt.textContent : a.textContent).replace(/^\s*\d+\s*/, '').trim();
      paginas.push({ ruta: ruta, href: a.getAttribute('href'), nombre: nombre });
    });

    var LEIDAS = 'ici-leidas';
    var leidas = [];
    try { leidas = JSON.parse(localStorage.getItem(LEIDAS) || '[]'); } catch (e) { leidas = []; }
    if (!Array.isArray(leidas)) leidas = [];
    if (paginas.some(function (x) { return x.ruta === aqui; }) && leidas.indexOf(aqui) < 0) {
      leidas.push(aqui);
      try { localStorage.setItem(LEIDAS, JSON.stringify(leidas)); } catch (e) {}
    }

    if (paginas.length > 1) {
      var nombreTema = enTema[1] === 'bonus' ? 'Tema bonus' : 'Tema ' + enTema[1].slice(4);
      var hechas = paginas.filter(function (x) { return leidas.indexOf(x.ruta) > -1; }).length;
      var todas = hechas === paginas.length;
      var fila = document.createElement('nav');
      fila.className = 'pildoras' + (todas ? ' completo' : '');
      fila.setAttribute('data-b', COLOR[enTema[1]]);
      fila.setAttribute('aria-label', 'Páginas del ' + nombreTema.toLowerCase() + ' que habéis leído');
      var rotulo = document.createElement('p');
      rotulo.className = 'pildoras-txt';
      rotulo.textContent = nombreTema + ' · ' + (todas ? 'completado, las ' + paginas.length + ' páginas leídas'
        : hechas + ' de ' + paginas.length + ' páginas leídas');
      fila.appendChild(rotulo);
      var ol = document.createElement('ol');
      paginas.forEach(function (x) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = x.href;
        a.title = x.nombre;
        if (x.ruta === aqui) {
          a.setAttribute('aria-current', 'page');
          a.setAttribute('aria-label', x.nombre + ', la estáis leyendo');
          a.innerHTML = '<svg class="pildora-pac" viewBox="0 0 26 26" aria-hidden="true" focusable="false">' +
            '<path d="M13 13 24.26 6.5A13 13 0 1 0 24.26 19.5Z"/></svg>';
        } else {
          var comida = leidas.indexOf(x.ruta) > -1;
          a.setAttribute('aria-label', x.nombre + (comida ? ', leída' : ', sin leer'));
          a.innerHTML = '<span class="pildora' + (comida ? ' comida' : '') + '" aria-hidden="true"></span>';
        }
        li.appendChild(a);
        ol.appendChild(li);
      });
      var poder = document.createElement('li');
      poder.className = 'pildora-poder';
      poder.setAttribute('aria-hidden', 'true');
      poder.innerHTML = '<span></span>';
      ol.appendChild(poder);
      fila.appendChild(ol);
      var pager = principal.querySelector('.pager');
      principal.insertBefore(fila, pager || null);
    }
  }
})();
