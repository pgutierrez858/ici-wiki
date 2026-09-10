// Genera las regiones de la wiki que dependen de fechas y las inserta
// en su sitio dentro de los HTML.  Idempotente: se puede ejecutar mil veces.
//
//   node tools/build.mjs
//
// Marcadores que reconoce, en cualquier archivo de wiki/:
//   <!--ICI:CAL-->      ... <!--/ICI:CAL-->      el tablero del curso
//   <!--ICI:LEGEND-->   ... <!--/ICI:LEGEND-->   la leyenda de bloques
//   <!--ICI:BLOCKS-->   ... <!--/ICI:BLOCKS-->   la lista de bloques

import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { BLOQUES, TABLERO, MESES, DIAS, DIAS_C, CURSO, VISIBLE, d, iso, corto, largo } from './curso.mjs';

const CURSO_TXT = CURSO;

// sección a la que pertenece una ruta de la wiki
const PAGINAS = { 'index.html': 'inicio', 'calendario.html': 'calendario', 'presentacion.html': 'presentacion', '404.html': 'inicio' };
const seccionDe = (href) => {
  const primero = String(href).split('#')[0].split('/')[0];
  return primero.endsWith('.html') ? (PAGINAS[primero] || 'inicio') : primero;
};
const abierta = (sec) => VISIBLE[sec] !== false;

// Vuelve a convertir en enlace un <span class="off"> cuando su sección se
// abre. Cuenta los <span> anidados: el contenido de un enlace de índice lleva
// spans dentro, y una expresión regular perezosa cerraría en el primero,
// dejando el HTML roto.
function reabre(src) {
  const marca = /<span class="off" data-gate="([a-z]+)" data-href="([^"]*)">/g;
  let out = '', ultimo = 0, m;
  while ((m = marca.exec(src))) {
    const g = m[1], href = m[2], desde = m.index + m[0].length;
    const dentro = /<span\b|<\/span>/g;
    dentro.lastIndex = desde;
    let prof = 1, fin = -1, mm;
    while ((mm = dentro.exec(src))) {
      if (mm[0] === '</span>') { prof--; if (prof === 0) { fin = mm.index; break; } }
      else prof++;
    }
    if (fin < 0) break;
    const inner = src.slice(desde, fin);
    out += src.slice(ultimo, m.index);
    out += abierta(g) ? `<a href="${href}" data-gate="${g}">${inner}</a>` : src.slice(m.index, fin + 7);
    ultimo = fin + 7;
    marca.lastIndex = ultimo;
  }
  return out + src.slice(ultimo);
}
const enlazable = (href) => !!href && abierta(seccionDe(href));

const ROOT = 'wiki';
let RUTA = (href) => href;
const HOY = process.env.ICI_HOY ? d(process.env.ICI_HOY) : new Date();
const HOY0 = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate());

// Días no lectivos que caen dentro del tablero (edítalos aquí).
const FESTIVOS = {
  '2026-10-12': 'Fiesta Nacional',
  '2026-11-09': 'La Almudena',
  '2026-12-08': 'La Inmaculada',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function bloqueDe(day) {
  return BLOQUES.find((b) => day >= d(b.start) && day <= d(b.due)) || null;
}

/* ---------------- tablero ---------------- */
function calendario() {
  const first = d(TABLERO.desde);
  const last = d(TABLERO.hasta);
  const L = [];
  L.push('<div class="cal">');
  L.push('  <div class="cal-head" aria-hidden="true">');
  L.push('    <span class="cal-corner"></span>' + ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join(''));
  L.push('  </div>');

  // agrupa semanas por el mes de su lunes
  const semanas = [];
  for (let cur = new Date(first); cur <= last; cur.setDate(cur.getDate() + 7)) semanas.push(new Date(cur));
  const meses = [];
  for (const lunes of semanas) {
    const k = lunes.getMonth();
    if (!meses.length || meses[meses.length - 1].mes !== k) meses.push({ mes: k, semanas: [] });
    meses[meses.length - 1].semanas.push(lunes);
  }

  for (const m of meses) {
    L.push('  <div class="cal-month">');
    L.push(`    <h3 class="cal-mname">${cap(MESES[m.mes])}</h3>`);
    L.push('    <div class="cal-weeks">');
    for (const lunes of m.semanas) {
      const dom = new Date(lunes); dom.setDate(dom.getDate() + 6);
      const b = bloqueDe(lunes);
      const cls = ['cal-week', b && b.sinEntorno ? 'mx' : ''].filter(Boolean).join(' ');
      const etiqueta = b ? `${b.nombre} · ${b.tema}` : 'Sin bloque asignado';
      L.push(`      <div class="${cls}"${b ? ` data-b="${b.id}"` : ''} role="group" aria-label="Semana del ${lunes.getDate()} de ${MESES[lunes.getMonth()]} al ${dom.getDate()} de ${MESES[dom.getMonth()]} · ${etiqueta}">`);
      if (b && b.sinEntorno) L.push('        <div class="mx-wave" aria-hidden="true"></div>');
      for (let i = 0; i < 7; i++) {
        const day = new Date(lunes); day.setDate(day.getDate() + i);
        const key = iso(day);
        const cs = ['d'];
        if (day.getMonth() !== m.mes) cs.push('other');
        const bb = bloqueDe(day);
        if (!bb) cs.push('free');
        if (FESTIVOS[key]) cs.push('holi');
        const vence = bb && key === bb.due;
        if (vence) cs.push('due');
        let t = `${DIAS[day.getDay()]} ${day.getDate()} de ${MESES[day.getMonth()]}`;
        if (FESTIVOS[key]) t += ` · ${FESTIVOS[key]}, no lectivo`;
        if (vence) t += ` · entrega de ${bb.nombre}${bb.dueTxt ? ' (fecha por confirmar)' : ''}`;
        L.push(`        <div class="${cs.join(' ')}" data-day="${key}" title="${esc(t)}" aria-label="${esc(t)}">${day.getDate()}</div>`);
      }
      L.push('      </div>');
    }
    L.push('    </div>');
    L.push('  </div>');
  }
  L.push('</div>');
  return L;
}

/* ---------------- leyenda ---------------- */
function leyenda(pre) {
  const L = ['<ul class="legend">'];
  for (const b of BLOQUES) {
    const nombre = `${b.nombre} · ${b.tema}`;
    const when = `${corto(b.start)} – ${corto(b.due)}`;
    const due = b.dueTxt ? b.dueTxt : `Entrega ${largo(b.due)}`;
    const inner =
      `<span class="sw" aria-hidden="true"></span>` +
      `<span class="lg-name">${esc(nombre)}</span>` +
      `<span class="lg-when">${esc(when)}</span>` +
      `<span class="lg-due">${esc(due)}</span>`;
    L.push(`  <li data-b="${b.id}">` +
      (enlazable(b.href) ? `<a href="${RUTA(b.href)}">${inner}</a>` : `<div class="row">${inner}</div>`) +
      '</li>');
  }
  L.push('</ul>');
  return L;
}

/* ---------------- leyenda compacta (para las diapositivas) ---------------- */
function leyendaMini() {
  const L = ['<ul class="legend-mini">'];
  for (const b of BLOQUES) {
    // el calendario ya dice las fechas: aquí sólo hace falta el color y el nombre
    const corto2 = b.nombre.startsWith('Práctica') ? 'P' + b.num.replace(/^0/, '') : b.nombre;
    L.push(`  <li data-b="${b.id}"><span class="sw" aria-hidden="true"></span>` +
           `<b>${esc(corto2)}</b> ${esc(b.tema)}</li>`);
  }
  L.push('</ul>');
  return L;
}

/* ---------------- bloques ---------------- */
function bloques(pre) {
  const L = ['<ol class="blocks">'];
  for (const b of BLOQUES) {
    const vence = d(b.due), arranca = d(b.start);
    let chip = ['chip soon', 'Por abrir'];
    if (HOY0 > vence) chip = ['chip done', 'Entregada'];
    else if (HOY0 >= arranca) chip = ['chip now', 'En curso'];
    const nombre = `${b.nombre} · ${b.tema}`;
    L.push(`  <li class="blk" data-b="${b.id}" data-start="${b.start}" data-due="${b.due}" data-name="${esc(b.nombre)}"${b.dueTxt ? ` data-due-txt="${esc(b.dueTxt)}"` : ''}>`);
    L.push(`    <span class="blk-num" aria-hidden="true">${b.num}</span>`);
    L.push('    <div class="blk-main">');
    L.push(`      <h3 class="blk-title">${enlazable(b.href) ? `<a href="${RUTA(b.href)}">${esc(nombre)}</a>` : esc(nombre)}` +
           ` <span class="${chip[0]}" data-state>${chip[1]}</span></h3>`);
    L.push(`      <p class="blk-desc">${esc(b.desc)}</p>`);
    L.push('    </div>');
    L.push('    <div class="blk-meta">');
    L.push(`      <span>${b.dueTxt ? `Entrega <b>${esc(b.dueTxt)}</b>` : `Entrega <b>${esc(largo(b.due))}</b>`}</span>`);
    L.push(`      <span class="env">Entorno: ${esc(b.entorno)}</span>`);
    L.push(`      <span>${esc(b.grupo)}</span>`);
    L.push('    </div>');
    L.push('    <ul class="blk-links">');
    L.push(`      <li>${enlazable(b.href)
      ? `<a href="${RUTA(b.href)}">Enunciado <span aria-hidden="true">→</span></a>`
      : '<span class="off">Enunciado por publicar</span>'}</li>`);
    if (b.teoria) {
      L.push(`      <li>${enlazable(b.teoria.href)
        ? `<a href="${RUTA(b.teoria.href)}">${esc(b.teoria.txt)} <span aria-hidden="true">→</span></a>`
        : `<span class="off">${esc(b.teoria.txt)}</span>`}</li>`);
    }
    L.push('    </ul>');
    L.push('  </li>');
  }
  L.push('</ol>');
  return L;
}

/* ---------------- cabecera y pie comunes ---------------- */
const NAV = [
  ['inicio',       'index.html',           'Inicio'],
  ['presentacion', 'presentacion.html',    'Presentación'],
  ['calendario',   'calendario.html',      'Calendario'],
  ['practicas',    'practicas/index.html', 'Prácticas'],
  ['teoria',       'teoria/index.html',    'Teoría'],
  ['guias',        'guias/index.html',     'Guías'],
];

function nav(pre, page) {
  const L = [];
  L.push('<header class="site">');
  L.push('  <div class="site-inner">');
  L.push(`    <a class="mark" href="${pre}index.html"${page === 'inicio' ? ' aria-current="page"' : ''}>`);
  L.push('      <svg width="26" height="26" viewBox="0 0 26 26" role="img" aria-label="Ms. Pac-Man">');
  L.push('        <path class="pac pac-a" d="M13 13 24.26 6.5A13 13 0 1 0 24.26 19.5Z"/>');
  L.push('        <path class="pac pac-b" d="M13 13 25.74 10.41A13 13 0 1 0 25.74 15.59Z"/>');
  L.push('      </svg>');
  L.push('      <span class="mark-name">ICI <small>Comportamientos inteligentes</small></span>');
  L.push('    </a>');
  L.push('    <nav class="site-nav" aria-label="Secciones de la asignatura">');
  L.push('      <ul>');
  for (const [key, href, txt] of NAV) {
    if (!abierta(key)) continue;
    L.push(`        <li><a href="${pre + href}"${page === key ? ' aria-current="page"' : ''}>${txt}</a></li>`);
  }
  L.push('      </ul>');
  L.push('    </nav>');
  L.push('    <button class="theme" type="button">Tema · <b>auto</b></button>');
  L.push('  </div>');
  L.push('</header>');
  return L;
}

function pie(pre) {
  const sello = `${HOY0.getDate()} de ${MESES[HOY0.getMonth()]} de ${HOY0.getFullYear()}`;
  return [
    '<footer class="page">',
    '  <p>',
    '    <strong>Ingeniería de Comportamientos Inteligentes</strong> · Curso ' + CURSO_TXT + ' ·',
    '    Facultad de Informática, Universidad Complutense de Madrid.',
    '  </p>',
    '  <p>',
    '    Pablo Gutiérrez Sánchez · despacho 409 ·',
    '    <a href="mailto:pabgut02@ucm.es">pabgut02@ucm.es</a> ·',
    `    <a href="${pre}index.html#profesor">tutorías</a>`,
    '  </p>',
    '  <p class="fine">',
    `    Los comunicados oficiales y las entregas van por el Campus Virtual: esta wiki es el material de consulta. Última actualización: ${sello}.`,
    '  </p>',
    '  <p class="credito">',
    '    Los enunciados están adaptados del material original de Juan A. Recio-García. El simulador es una',
    '    adaptación del motor de la competición <em>Ms. Pac-Man vs Ghosts</em> (Piers R. Williams,',
    '    University of Essex) realizada en el grupo GAIA de la UCM, y se distribuye bajo GNU GPL v3.',
    '  </p>',
    '</footer>',
  ];
}

function cabecera(_pre, page) {
  if (abierta(page)) return ['<!-- página publicada -->'];
  return [
    '<!-- sección todavía sin publicar: fuera de los buscadores hasta que se abra -->',
    '<meta name="robots" content="noindex, nofollow">',
  ];
}

/* ---------------- inserción ---------------- */
const GEN = { CAL: () => calendario(), LEGEND: leyenda, LEGENDMINI: () => leyendaMini(), BLOCKS: bloques, NAV: nav, FOOT: pie, HEAD: cabecera };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

let tocados = 0;
for (const file of walk(ROOT)) {
  const dir = dirname(file);
  const depth = relative(ROOT, dir).split(sep).filter(Boolean).length;
  const pre = '../'.repeat(depth);
  // enlace entre páginas de la wiki, resuelto desde la carpeta del archivo
  RUTA = (href) => {
    const [ruta, ancla] = href.split('#');
    const r = relative(dir, join(ROOT, ruta)).split(sep).join('/') || './';
    return ancla ? `${r}#${ancla}` : r;
  };
  let src = readFileSync(file, 'utf8');
  const antes = src;
  const page = (src.match(/<body[^>]*data-page="([^"]+)"/) || [])[1] || '';
  for (const [name, gen] of Object.entries(GEN)) {
    const re = new RegExp(`([ \\t]*)<!--ICI:${name}-->[\\s\\S]*?<!--/ICI:${name}-->`, 'g');
    src = src.replace(re, (_m, ind) => {
      const body = gen(pre, page).map((l) => ind + l).join('\n');
      return `${ind}<!--ICI:${name}-->\n${body}\n${ind}<!--/ICI:${name}-->`;
    });
  }
  // enlaces marcados con data-gate: se apagan y se vuelven a encender solos
  // según VISIBLE, conservando el destino en data-href
  src = src.replace(/<a\s+href="([^"]*)"\s+data-gate="([a-z]+)">([\s\S]*?)<\/a>/g,
    (m, href, g, inner) => (abierta(g) ? m : `<span class="off" data-gate="${g}" data-href="${href}">${inner}</span>`));
  src = reabre(src);

  if (src !== antes) { writeFileSync(file, src); tocados++; console.log('  ·', file); }
}
console.log(tocados ? `\n${tocados} archivo(s) actualizados.` : '\nNada que actualizar (¿faltan los marcadores?).');

/* ---------------- atajos de URL ----------------
   GitHub Pages no tiene redirecciones, así que cada atajo es una carpeta con
   un index.html que reenvía. Sirven para teclear en clase:
   .../eclipse en lugar de .../guias/eclipse.html                            */
const ATAJOS = {
  practica0:  ['practicas/practica-0.html', 'Práctica 0'],
  practicas:  ['practicas/index.html',      'Prácticas'],
  teoria:     ['teoria/index.html',         'Teoría'],
  guias:      ['guias/index.html',          'Guías'],
  eclipse:    ['guias/eclipse.html',        'Ms. Pac-Man en Eclipse'],
  'clase-game': ['guias/clase-game.html',   'La clase Game'],
  game:       ['guias/clase-game.html',     'La clase Game'],
  slides:     ['guias/clase-game-slides.html', 'La clase Game en diapositivas'],
  calendario: ['calendario.html',           'Calendario de prácticas'],
};

let atajos = 0;
for (const [nombre, [destino, titulo]] of Object.entries(ATAJOS)) {
  const dir = join(ROOT, nombre);
  const rel = '../' + destino;
  const html = [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${titulo} · ICI</title>`,
    '<meta name="robots" content="noindex">',
    `<link rel="canonical" href="${rel}">`,
    `<meta http-equiv="refresh" content="0; url=${rel}">`,
    '</head>',
    '<body>',
    `  <p>Esta dirección lleva a <a href="${rel}">${titulo}</a>.</p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, 'index.html');
  let antes = '';
  try { antes = readFileSync(dest, 'utf8'); } catch (e) { /* no existía */ }
  if (antes !== html) { writeFileSync(dest, html); atajos++; }
}
console.log(atajos ? `${atajos} atajo(s) de URL escritos.` : 'Atajos de URL al día.');
