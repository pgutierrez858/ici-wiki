// Convierte un HTML suelto (de los que se generan como artefacto: <title>,
// <style> propio y el cuerpo dentro de <div class="wrap">) en una página de la
// wiki: documento completo, hoja de estilos compartida, cabecera y pie
// generados, y migas de pan.
//
//   node tools/importar.mjs <origen.html> <destino-en-wiki.html> "<sección>" "<título corto>"
//
//   node tools/importar.mjs practica1.html wiki/practicas/practica-1.html practicas "Práctica 1"
//
// Secciones válidas: inicio, calendario, practicas, teoria, guias.
// Después ejecuta `node tools/build.mjs` para rellenar cabecera y pie.
//
// Ojo: el <style> del origen se DESCARTA. Si la página traía componentes
// propios que no están en assets/css/ici.css, hay que añadirlos allí.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { relative, dirname, sep } from 'node:path';

const [origen, destino, seccion = '', titulo = ''] = process.argv.slice(2);
if (!origen || !destino) {
  console.error('uso: node tools/importar.mjs <origen.html> <destino-en-wiki.html> [sección] [título corto]');
  process.exit(1);
}
if (!existsSync(origen)) { console.error('no existe', origen); process.exit(1); }
if (!destino.replace(/\\/g, '/').startsWith('wiki/')) {
  console.error('el destino tiene que estar dentro de wiki/, por ejemplo wiki/practicas/practica-1.html');
  process.exit(1);
}

const SECCIONES = {
  inicio:     { txt: 'Asignatura', href: 'index.html' },
  calendario: { txt: 'Calendario', href: 'calendario.html' },
  practicas:  { txt: 'Prácticas',  href: 'practicas/index.html' },
  teoria:     { txt: 'Teoría',     href: 'teoria/index.html' },
  guias:      { txt: 'Guías',      href: 'guias/index.html' },
};

const src = readFileSync(origen, 'utf8');
const pre = '../'.repeat(relative('wiki', dirname(destino)).split(sep).filter(Boolean).length);

const tit = (src.match(/<title>([\s\S]*?)<\/title>/) || [, titulo || 'ICI'])[1].trim();
const i = src.indexOf('<div class="wrap">');
if (i < 0) { console.error('no encuentro <div class="wrap"> en el origen'); process.exit(1); }
const j = src.search(/\n\s*<footer[\s>]/);
let body = src.slice(i, j > 0 ? j : src.length).replace(/\s*<\/div>\s*$/, '');
if (j > 0) body = body.replace(/\s*$/, '\n');

// el eyebrow del masthead lo sustituyen las migas de pan
body = body.replace(/\n\s*<div class="eyebrow">[\s\S]*?\n\s*<\/div>/, '');
body = body.replace('<div class="cols">', '<div class="cols" id="contenido">');
body = body.replace(/<nav>\s*<h2>/, '<nav aria-labelledby="en-esta-pagina">\n          <h2 id="en-esta-pagina">');

const s = SECCIONES[seccion];
const migas = [
  '  <nav class="crumbs" aria-label="Migas de pan">',
  `    <a href="${pre}index.html">Asignatura</a>`,
  ...(s && seccion !== 'inicio'
    ? ['    <span aria-hidden="true">/</span>', `    <a href="${pre}${s.href}">${s.txt}</a>`]
    : []),
  '    <span aria-hidden="true">/</span>',
  `    <span>${titulo || tit.split('·')[0].trim()}</span>`,
  '  </nav>',
  '',
].join('\n');

body = body.replace('<div class="wrap">\n\n', '<div class="wrap">\n\n' + migas);

const salida = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tit}${/ICI$/.test(tit) ? '' : ' · ICI'}</title>
<meta name="author" content="Pablo Gutiérrez Sánchez">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${pre}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..600;1,8..60,400&family=JetBrains+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${pre}assets/css/ici.css">
<script src="${pre}assets/js/tema.js"></script>
</head>
<body data-page="${seccion}">

<a class="skip" href="#contenido">Saltar al contenido</a>

<!--ICI:NAV-->
<!--/ICI:NAV-->

${body}
  <!--ICI:FOOT-->
  <!--/ICI:FOOT-->
</div>

<script src="${pre}assets/js/ici.js" defer></script>
</body>
</html>
`;
writeFileSync(destino, salida);
console.log('escrito', destino);
console.log('ahora: node tools/build.mjs');
