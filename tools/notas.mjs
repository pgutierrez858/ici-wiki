// Cifra las notas de presentador para que se puedan publicar sin que nadie
// más las lea. El texto vive en notas/<pagina>.json, fuera de wiki/, y este
// script deja en la web sólo el resultado cifrado.
//
//   node tools/notas.mjs
//
// La clave se lee de la variable de entorno ICI_NOTAS_CLAVE o del archivo
// notas/clave.txt. Si no hay ninguna, se genera una y se guarda ahí.
// notas/ NO se despliega: en la web sólo entra wiki/assets/notas/*.json,
// que es AES-256-GCM con la clave derivada por PBKDF2.
//
// Para verlas en clase: https://…/presentacion.html?k=LA-CLAVE
// El navegador las descifra y la clave desaparece de la barra de direcciones.
// No hay botón ni atajo de teclado: sin ese parámetro nada indica que existan.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

const ORIGEN = 'notas';
const DESTINO = 'wiki/assets/aux';
const ITER = 200000;

function clave() {
  if (process.env.ICI_NOTAS_CLAVE) return process.env.ICI_NOTAS_CLAVE.trim();
  const f = join(ORIGEN, 'clave.txt');
  if (existsSync(f)) {
    const c = readFileSync(f, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#'));
    if (c) return c.trim();
  }
  // palabras cortas y legibles: hay que teclearla en una URL
  const silabas = ['ba', 'be', 'bo', 'da', 'de', 'do', 'fa', 'fe', 'gi', 'ka', 'ko', 'la', 'le',
                   'lu', 'ma', 'me', 'mi', 'na', 'ne', 'pa', 'pi', 'ra', 're', 'ri', 'sa', 'so',
                   'ta', 'te', 'to', 'va', 'vi', 'za'];
  const palabra = () => Array.from({ length: 3 }, () => silabas[randomBytes(1)[0] % silabas.length]).join('');
  const nueva = [palabra(), palabra(), randomBytes(2).toString('hex')].join('-');
  writeFileSync(f, `# Clave de las notas de presentador de la wiki de ICI.\n` +
    `# Este archivo NO se despliega. Para cambiarla, edita la línea de abajo\n` +
    `# y vuelve a ejecutar: node tools/notas.mjs\n${nueva}\n`);
  console.log(`\n  Clave nueva generada y guardada en ${f}:\n\n      ${nueva}\n`);
  return nueva;
}

const CLAVE = clave();
mkdirSync(DESTINO, { recursive: true });

let n = 0;
for (const f of readdirSync(ORIGEN)) {
  if (!f.endsWith('.json')) continue;
  const datos = JSON.parse(readFileSync(join(ORIGEN, f), 'utf8'));
  const nombre = basename(f, '.json');

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(CLAVE, salt, ITER, 32, 'sha256');
  const c = createCipheriv('aes-256-gcm', key, iv);
  const cifrado = Buffer.concat([c.update(JSON.stringify(datos.notas), 'utf8'), c.final(), c.getAuthTag()]);

  writeFileSync(join(DESTINO, `${nombre}.json`), JSON.stringify({
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: ITER, salt: salt.toString('base64') },
    iv: iv.toString('base64'),
    ct: cifrado.toString('base64'),
  }));

  // copia legible para el profesor, fuera de la carpeta que se publica
  const html = [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    `<title>Notas · ${datos.titulo || nombre}</title>`,
    '<style>body{font:16px/1.6 Georgia,serif;max-width:42em;margin:3rem auto;padding:0 1.2rem;color:#14192B}',
    'h1{font:600 1.5rem/1.2 system-ui,sans-serif}h2{font:600 .72rem/1 ui-monospace,monospace;letter-spacing:.14em;',
    'text-transform:uppercase;color:#5F6883;margin:2.2rem 0 .5rem;border-top:1px solid #D2D9E9;padding-top:.9rem}',
    'code{font-family:ui-monospace,monospace;font-size:.86em;background:#E7ECF6;padding:.1em .3em;border-radius:3px}</style>',
    '</head><body>',
    `<h1>Notas de ${datos.titulo || nombre}</h1>`,
    '<p><em>Copia local para preparar la clase. No se publica.</em></p>',
  ];
  for (const [id, texto] of Object.entries(datos.notas)) {
    html.push(`<h2>Diapositiva ${id.replace(/^d/, '')}</h2>`, texto);
  }
  html.push('</body></html>');
  writeFileSync(join(ORIGEN, `${nombre}-local.html`), html.join('\n'));

  console.log(`  · ${nombre}: ${Object.keys(datos.notas).length} notas cifradas → ${DESTINO}/${nombre}.json`);
  console.log(`    copia legible en ${ORIGEN}/${nombre}-local.html`);
  n++;
}
console.log(n ? '\nListo.' : 'No hay notas en notas/*.json');
