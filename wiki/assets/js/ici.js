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
      btn.setAttribute('aria-label', 'Tema de la página: ' + NAMES[mode] + '. Pulsa para cambiar.');
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
    if (!next && today <= due) next = { el: el, due: due };

    var slot = el.querySelector('[data-state]');
    if (!slot) return;
    if (today > due) {
      slot.className = 'chip done';
      slot.textContent = 'Entregada';
    } else if (today >= start) {
      slot.className = 'chip now';
      slot.textContent = 'En curso';
      el.setAttribute('aria-current', 'true');
    } else {
      slot.className = 'chip soon';
      slot.textContent = 'Por abrir';
    }
  });

  if (next) {
    var days = Math.round((next.due - today) / 86400000);
    // un bloque puede no tener todavía fecha firme de entrega
    var txt = next.el.getAttribute('data-due-txt');
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
      if (name) el.textContent = name;
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
})();
