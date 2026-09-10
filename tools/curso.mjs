// Datos del curso. Única fuente de verdad para el calendario, la leyenda
// y la lista de bloques de la wiki.  Cambia esto y ejecuta `node tools/build.mjs`.

export const CURSO = '2026 – 2027';

// Qué secciones están abiertas al público. Pon a true la que quieras
// publicar y ejecuta `node tools/build.mjs`: la navegación, los enlaces
// marcados con data-gate y el noindex de cada página se ajustan solos.
export const VISIBLE = {
  inicio: true,
  presentacion: true,
  calendario: true,
  practicas: true,
  teoria: false,
  guias: true,
};

// Lunes de la primera semana y domingo de la última que se dibujan en el tablero.
export const TABLERO = { desde: '2026-09-07', hasta: '2026-12-20' };

// Cada bloque abarca semanas completas de lunes a domingo; la entrega es el
// domingo con el que termina.
export const BLOQUES = [
  {
    id: 'p0',
    num: '00',
    nombre: 'Práctica 0',
    tema: 'Tutorial',
    desc: 'El simulador, el ciclo de una partida y los primeros comportamientos, todavía a mano.',
    entorno: 'Ms. Pac-Man',
    grupo: 'Individual',
    start: '2026-09-07',
    due: '2026-09-20',
    href: 'practicas/practica-0.html',
    teoria: { txt: 'Tema 1 · Ingeniería del conocimiento', href: 'teoria/index.html#tema-1' },
  },
  {
    id: 'p1',
    num: '01',
    nombre: 'Práctica 1',
    tema: 'Algorítmica',
    desc: 'Movimiento y búsqueda de caminos en el laberinto: la solución directa, y por qué no escala.',
    entorno: 'Ms. Pac-Man',
    grupo: 'Grupos',
    start: '2026-09-21',
    due: '2026-10-04',
    href: null,
    teoria: { txt: 'Tema 2 · Búsqueda y movimiento', href: 'teoria/index.html#tema-2' },
  },
  {
    id: 'p2',
    num: '02',
    nombre: 'Práctica 2',
    tema: 'Máquinas de estados',
    desc: 'Comportamientos como estados y transiciones: diseño, jerarquía y depuración de una FSM.',
    entorno: 'Ms. Pac-Man',
    grupo: 'Grupos',
    start: '2026-10-05',
    due: '2026-10-18',
    href: null,
    teoria: { txt: 'Tema 2 · Máquinas de estados', href: 'teoria/index.html#tema-2' },
  },
  {
    id: 'p3',
    num: '03',
    nombre: 'Práctica 3',
    tema: 'Sistemas de reglas',
    desc: 'Conocimiento declarativo con Jess: hechos, reglas, motor de inferencia y encadenamiento.',
    entorno: 'Ms. Pac-Man',
    grupo: 'Grupos',
    start: '2026-10-19',
    due: '2026-11-01',
    href: null,
    teoria: { txt: 'Tema 3 · Sistemas de reglas', href: 'teoria/index.html#tema-3' },
  },
  {
    id: 'p4',
    num: '04',
    nombre: 'Práctica 4',
    tema: 'Razonamiento borroso',
    desc: 'Decisiones con magnitudes imprecisas: conjuntos borrosos, reglas lingüísticas e inferencia.',
    entorno: 'Ms. Pac-Man',
    grupo: 'Grupos',
    start: '2026-11-02',
    due: '2026-11-15',
    href: null,
    teoria: { txt: 'Tema 4 · Razonamiento borroso', href: 'teoria/index.html#tema-4' },
  },
  {
    id: 'mx',
    num: '05',
    nombre: 'Práctica 5',
    tema: 'Juegos por turnos',
    desc: 'Simular el futuro en vez de razonar sobre el presente: minimax, poda alfa-beta y Monte Carlo Tree Search.',
    entorno: '???',
    grupo: 'Grupos',
    start: '2026-11-16',
    due: '2026-11-29',
    dueTxt: 'Por anunciar',
    href: null,
    teoria: { txt: 'Tema 5 · Juegos por turnos', href: 'teoria/index.html#tema-5' },
    // el entorno sale de una encuesta a la clase: hasta entonces, a oscuras
    sinEntorno: true,
  },
  {
    id: 'cb',
    num: '06',
    nombre: 'Práctica 6',
    tema: 'Razonamiento basado en casos',
    desc: 'En vez de escribir reglas, guardar partidas: recuperar el caso más parecido, adaptar su solución y aprender del resultado.',
    entorno: 'Por anunciar',
    grupo: 'Grupos',
    start: '2026-11-30',
    due: '2026-12-13',
    dueTxt: 'Por anunciar',
    href: null,
    teoria: { txt: 'Tema 6 · Razonamiento basado en casos', href: 'teoria/index.html#tema-6' },
  },
  {
    id: 'bn',
    num: 'B',
    nombre: 'Bonus',
    tema: 'Juegos de lenguaje',
    desc: 'Código Secreto como entorno, y por una vez técnicas que no son simbólicas: embeddings y modelos de lenguaje.',
    entorno: 'Código Secreto',
    grupo: 'Grupos',
    start: '2026-12-14',
    due: '2026-12-20',
    dueTxt: 'Por anunciar',
    href: null,
    teoria: { txt: 'Bonus · Juegos de lenguaje', href: 'teoria/index.html#bonus' },
  },
];

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const d = (iso) => { const [y, m, dd] = iso.split('-').map(Number); return new Date(y, m - 1, dd); };
export const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
export const corto = (isoStr) => { const x = d(isoStr); return `${x.getDate()} ${MESES[x.getMonth()].slice(0, 3)}`; };
export const largo = (isoStr) => { const x = d(isoStr); return `${DIAS_C[x.getDay()]} ${x.getDate()} ${MESES[x.getMonth()]}`; };
