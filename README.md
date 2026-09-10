# ICI · wiki de la asignatura

Ingeniería de Comportamientos Inteligentes , Facultad de Informática, UCM.
Curso 2026 – 2027. Pablo Gutiérrez Sánchez · pabgut02@ucm.es

## Qué hay aquí

```
wiki/                     ← ESTO es el sitio: lo que publica GitHub Pages
  index.html                presentación de la asignatura (portada)
  presentacion.html         diapositivas de la primera clase
  calendario.html           el calendario de prácticas, semana a semana
  practicas/index.html      índice de bloques + reglas de entrega
  practicas/practica-0.html enunciado de la Práctica 0
  teoria/index.html         temario y conceptos de cada tema
  guias/index.html          índice de guías
  guias/eclipse.html        instalación del entorno paso a paso
  guias/clase-game.html     referencia de la clase Game
  assets/css/ici.css        TODO el estilo del sitio, en un solo archivo
  assets/js/ici.js          tema claro/oscuro y fechas vivas
  assets/js/deck.js         las diapositivas: teclado, notas y pantalla completa
  assets/aux/*.json         las notas de presentador, cifradas
  assets/js/tema.js         se carga en <head> para evitar el destello
  assets/img/               capturas y favicon
  404.html  robots.txt  .nojekyll
  eclipse/  game/  practica0/ …       atajos de URL, generados

.github/workflows/        ← el despliegue en Pages
  pages.yml                 sube wiki/ en cada empujón a main

tools/                    ← no se despliega
  curso.mjs                 datos del curso: bloques, fechas, entregas
  build.mjs                 genera calendario, cabecera, pie y atajos de URL
  notas.mjs                 cifra las notas de presentador
  laberintos.py             compone las capturas de los cuatro laberintos
  recursos.sh               monta los zips del Campus Virtual

recursos-campus-virtual/  ← NO se versiona: zips del motor y soluciones

notas/                    ← NO se despliega: aquí está el texto en claro
  presentacion.json         las notas, editables
  presentacion-local.html   copia legible para preparar la clase
  clave.txt                 la clave con la que se cifran
```

## Desplegar

El sitio se publica en **GitHub Pages** desde este repositorio: cada empujón a
`main` dispara `.github/workflows/pages.yml`, que sube la carpeta `wiki/` tal
cual. No hay build ni dependencias.

Una sola cosa hay que dejar puesta a mano, y sólo la primera vez:
**Settings → Pages → Build and deployment → Source: GitHub Actions**. El token
del flujo no tiene permiso para crear el sitio, así que hasta que se marque eso
el despliegue falla en el paso «Preparar Pages».

Queda en `https://pgutierrez858.github.io/ici-wiki/`.

Todos los enlaces son relativos y llevan `.html`, así que el sitio también
funciona abriendo `wiki/index.html` con doble clic, sin servidor. La única
excepción es `wiki/404.html`, que se sirve para rutas que no existen y por eso
lleva las rutas absolutas con el prefijo del sitio: si se renombra el
repositorio, hay que cambiar ahí `/ici-wiki/` por el nombre nuevo.

### Atajos de URL

GitHub Pages no tiene redirecciones, así que `node tools/build.mjs` escribe una
carpeta con un `index.html` de reenvío por cada atajo. La lista está en la
constante `ATAJOS` de `tools/build.mjs`:

| Atajo | Lleva a |
|---|---|
| `…/ici-wiki/practica0` | el enunciado de la Práctica 0 |
| `…/ici-wiki/eclipse` | la guía de instalación |
| `…/ici-wiki/game` · `…/clase-game` | la referencia de la clase `Game` |
| `…/ici-wiki/slides` | esa referencia en diapositivas |
| `…/ici-wiki/practicas` · `teoria` · `guias` · `calendario` | los índices |

## Cambiar fechas, bloques o entregas

Todo lo que depende del calendario está en un solo sitio: **`tools/curso.mjs`**.
Edita ahí los bloques (nombre, tema, descripción, entorno, fechas, enlace) y
ejecuta:

```sh
node tools/build.mjs
```

El script reescribe *en su sitio* las regiones marcadas de cada HTML:

| Marcador | Qué genera |
|---|---|
| `<!--ICI:CAL-->` | el calendario de prácticas (rejilla de meses y semanas) |
| `<!--ICI:LEGEND-->` | la leyenda de bloques con sus fechas |
| `<!--ICI:BLOCKS-->` | la lista de bloques con estado y enlaces |
| `<!--ICI:NAV-->` | la cabecera y la navegación del sitio |
| `<!--ICI:FOOT-->` | el pie |

No se toca nada fuera de esos marcadores, y es idempotente: se puede ejecutar
tantas veces como quieras. Los días no lectivos están en la constante
`FESTIVOS` de `tools/build.mjs`.

## Añadir una página nueva

1. Copia la más parecida (por ejemplo `practicas/practica-0.html`).
2. Ajusta `<title>`, la descripción, las migas de pan y `data-page`
   (`inicio`, `calendario`, `practicas`, `teoria`, `guias`) , de eso depende
   qué pestaña se marca como activa.
3. Deja los marcadores `<!--ICI:NAV-->` y `<!--ICI:FOOT-->` vacíos y ejecuta
   `node tools/build.mjs`: se rellenan solos, con las rutas relativas
   correctas según la profundidad de la carpeta.
4. Si es el enunciado de una práctica, apunta su `href` en `tools/curso.mjs`
   para que aparezca enlazada en el calendario y en los índices.

## Lo que se sube al Campus Virtual

En `recursos-campus-virtual/` están los dos zips que se entregan a los
estudiantes por ahí, separados a propósito: `ICI-MsPacManEngine.zip` con el
simulador de las prácticas 0 a 4, que se descarga una sola vez, y
`ICI-Practica0.zip` con el proyecto de la práctica. Se generan con
`bash tools/recursos.sh` a partir de `ici-workspace/`, que no se publica, y el
detalle de qué lleva cada uno está en el README de esa carpeta.

## Las imágenes

Las capturas de `assets/img/` salen de la presentación original de la
asignatura (`PresentacionAsignatura.pdf`, material de Juan A. Recio-García) y
están reescaladas para la web:

| Archivo | Dónde se usa |
|---|---|
| `simulador.jpg` | portada, y paso 7 de la guía de Eclipse |
| `maquina-estados.jpg` | teoría, tema 2 |
| `reglas-jess.jpg` | teoría, tema 3 |
| `logica-borrosa.jpg` | teoría, tema 4 |
| `competicion.jpg` | portada, sección de evaluación |
| `robopacman.jpg`, `robopacman-laberinto.jpg` | portada, «Más allá de la asignatura» |
| `java-not-found.png` | guía de Eclipse |

Los cuatro laberintos y las dos vistas anotadas se generan a partir de los datos
del propio motor (`data/mazes/*.txt` y `data/images/maze-*.png`), componiéndolos
igual que lo hace `GameView`, con `tools/laberintos.py`:

| Archivo | Qué es |
|---|---|
| `laberinto-a.png` … `laberinto-d.png` | los cuatro laberintos con sus píldoras |
| `laberinto-a-anotado.png` | el primero con los cruces, los túneles, la cárcel y su puerta |
| `nodos-esquina.png` | la esquina de arriba a la izquierda con los números de nodo |

Al venir del simulador, se distribuyen bajo su misma licencia (GNU GPL v3).

Se descartaron a propósito las fotos con estudiantes reconocibles y el gráfico
de encuestas de cursos anteriores, porque una de sus preguntas contradice el
planteamiento de cambiar de entorno a mitad de curso.

### Imágenes de terceros y sus créditos

Las diapositivas usan además material de fuera, siempre con la fuente en el pie
de la figura:

| Archivo | Origen y licencia |
|---|---|
| `codenames-partida.jpg` | Foto de JIP, CC BY-SA 3.0, Wikimedia Commons |
| `terraforming-mars.jpg` | Foto de BiblioteKarin, CC BY-SA 4.0, Wikimedia Commons |
| `halo.jpg` | Captura de *Halo: Combat Evolved* (Bungie / Microsoft), vía Wikipedia |
| `fire-emblem.jpg` | Captura de *Fire Emblem: Three Houses* (Intelligent Systems / Nintendo), vía Wikipedia |

Las dos primeras tienen licencia libre y basta con mantener la atribución. Las
dos capturas de juego son material con derechos, usado como cita con fines
docentes y a baja resolución, con el autor y la fuente en el pie. Si en algún
momento hay que retirarlas, se sustituyen por los diagramas dibujados, que
siguen en el repositorio.

### Diagramas dibujados

Trece diagramas en SVG escritos a mano dentro del propio HTML, con clase
`diag`: minimax con poda, las cuatro fases de MCTS, un árbol de comportamiento,
funciones de pertenencia borrosas, el bucle de aprendizaje por refuerzo, el
recorrido de un bot de pruebas, un tablero de ajedrez, la cuadrícula de
Código Secreto, la tarjeta del jefe de espías, el espacio de embeddings y la
búsqueda de una pista por zonas. Cada uno lleva además una clase `dgN` y todas
sus reglas CSS van prefijadas con ella: el `<style>` de un SVG afecta a todo el
documento, así que sin ese prefijo las clases genéricas de un diagrama pisan las
del siguiente.

Al añadir una imagen nueva: reescálala a un ancho de unos 1500 px como mucho
(`sips -Z 1500 --setProperty formatOptions 70 origen.jpg --out destino.jpg`),
ponle `width`, `height`, `loading="lazy"` y un `alt` que describa lo que se ve,
y métela en un `<figure>` con su `<figcaption>`. `figure.narrow` la limita a
24 rem y `figure.wide` la deja ocupar toda la columna.

## El estilo

Un único `assets/css/ici.css`, sin dependencias ni compilación. Tres fuentes
de Google Fonts (Archivo para titulares, Source Serif 4 para el cuerpo,
JetBrains Mono para etiquetas y código) y una paleta con los colores del
laberinto: azul de pared, amarillo de píldora y los cuatro fantasmas, que aquí
sirven para identificar los bloques del curso. Claro y oscuro automáticos, con
un conmutador de tres estados en la cabecera.

Cada bloque del curso tiene su color, y lo conserva en todas las páginas:

| Bloque | Color |
|---|---|
| Práctica 0 · Tutorial | azul de laberinto |
| Práctica 1 · Algorítmica | Inky |
| Práctica 2 · Máquinas de estados | Clyde |
| Práctica 3 · Sistemas de reglas | Blinky |
| Práctica 4 · Razonamiento borroso | Pinky |
| Práctica 5 · Juegos por turnos | tramo a oscuras, entorno sin anunciar |

## Pendiente de confirmar


- Las entregas de diciembre están puestas como «por anunciar»: juegos por
  turnos del 16 al 29 de noviembre, razonamiento basado en casos del 30 de
  noviembre al 13 de diciembre y el bloque bonus de lenguaje la última semana,
  del 14 al 20. En cuanto haya fechas firmes, se ponen en `tools/curso.mjs`
  quitando el campo `dueTxt`.
- El entorno de la Práctica 6 (casos) está como «por anunciar»: si va a ser el
  mismo que salga de la encuesta para la Práctica 5, se pone en
  `tools/curso.mjs`.
- El entorno de la Práctica 5 sale de una encuesta a la clase, así que en el
  calendario se dibuja a oscuras hasta que se anuncie.
- Días no lectivos: están puestos el 12 de octubre, el 9 de noviembre y el 8
  de diciembre. Ninguno cae en miércoles o jueves.
- Condiciones concretas de cada práctica (tamaño de grupo, ranking, peso de la
  defensa): se publican en cada enunciado, no en la portada.

## Qué está publicado y qué no

`tools/curso.mjs` tiene un interruptor por sección:

```js
export const VISIBLE = {
  inicio: true, presentacion: true, calendario: true,
  practicas: false, teoria: false, guias: false,
};
```

Pon a `true` la sección y ejecuta `node tools/build.mjs`. Eso ajusta tres cosas
a la vez:

1. La navegación de la cabecera, que sólo muestra las secciones abiertas.
2. Los enlaces marcados con `data-gate` en el HTML, que se convierten en texto
   apagado con la etiqueta «por publicar» y vuelven a ser enlaces al abrir la
   sección. El destino no se pierde: se guarda en `data-href`.
3. El `<meta name="robots" content="noindex">` de las páginas de secciones
   cerradas, para que no acaben en los buscadores antes de tiempo.

Las páginas cerradas siguen en la carpeta y se despliegan, simplemente no están
enlazadas desde ninguna parte. Si necesitas que no lleguen ni por URL, sácalas
de `wiki/` antes de arrastrarla.

Para marcar un enlace nuevo como sujeto a ese interruptor, escríbelo con el
atributo en este orden exacto, que es lo que reconoce el generador:

```html
<a href="teoria/index.html#tema-2" data-gate="teoria">Conceptos</a>
```

## Las presentaciones

`presentacion.html` es el modelo. Una presentación es un `<div class="deck">`
con un `<div class="deck-stage">` dentro y una `<section class="slide">` por
diapositiva. `assets/js/deck.js` se encarga del resto: barra de control,
teclado (flechas, espacio, inicio, fin, `F` para pantalla completa, `N` para
notas), gestos en móvil, barra de progreso y enlaces a una diapositiva
concreta con `#d7`.

- **Sin JavaScript** las diapositivas se apilan y la página se lee como un
  documento. Por debajo de 560 px de ancho pasa lo mismo a propósito: a 16:9 el
  texto quedaría a ocho píxeles.
- **Al imprimir** salen todas las diapositivas, para repartirlas.
- Tipos de diapositiva: `s-cover` (portada), `s-part` (separador de bloque),
  `s-split` (texto e imagen a dos columnas, con `wide-right` si la imagen manda),
  `s-figure` (imagen grande con pie) y sin clase para texto, listas o tablas.
  `img-stack` e `img-pair` reparten dos imágenes o diagramas en una diapositiva.
- **Los diagramas son SVG escritos a mano**, dentro del propio HTML y con clase
  `diag`: minimax con poda, las cuatro fases de MCTS, un árbol de
  comportamiento, funciones de pertenencia, el bucle de aprendizaje por
  refuerzo, el recorrido de un bot de pruebas, un tablero de ajedrez, uno de
  hexágonos, y los tres de Código Secreto (caja, cuadrícula y tarjeta del jefe
  de espías). Usan los tokens del sistema, así que cambian con el tema y se ven
  nítidos a cualquier tamaño. No son fotos: si prefieres imágenes reales del
  juego, déjalas en `assets/img/` y se cambian.
- **Pac-Man hace de barra de progreso**: una bolita por diapositiva en el borde
  inferior del escenario, y se las va comiendo al avanzar.
- El tamaño de letra va en `cqw`, así que todo escala con el ancho del
  escenario y no hay que tocar nada al proyectar.

Los temas de teoría van a usar este mismo componente, un archivo por tema.

## Las notas de presentador (privadas)

El texto de las notas **no está en el HTML**. Vive en `notas/presentacion.json`,
que no se despliega, y lo que llega a la web es sólo el resultado de cifrarlo
con AES-256-GCM y una clave derivada por PBKDF2 con 200.000 iteraciones. Sin la
clave, `wiki/assets/aux/presentacion.json` es ruido: no se puede leer ni
mirando el código fuente ni descargando el archivo.

**Para verlas en clase**, abre la presentación con la clave en el parámetro
`k`:

```
https://pgutierrez858.github.io/ici-wiki/presentacion.html?k=LA-CLAVE
```

Ese parámetro es la única forma de abrirlas. No hay botón, ni atajo de teclado,
ni ninguna otra pista en la página: sin la clave, nada indica que las notas
existan.

El navegador las descifra, aparecen en un panel debajo de la diapositiva (fuera
del área que se proyecta, así que no salen en pantalla completa) y **la clave
desaparece de la barra de direcciones** en cuanto se lee, para que no quede a
la vista si ya estás proyectando. Se guarda en el `sessionStorage` de esa
pestaña, así que puedes recargar o cambiar de diapositiva sin volver a
teclearla, y se olvida al cerrarla. Dentro del panel hay un *ocultar* discreto
que las cierra y borra la clave de la pestaña.

**Para editarlas**: cambia `notas/presentacion.json` y ejecuta

```sh
node tools/notas.mjs
```

Eso vuelve a cifrar y además regenera `notas/presentacion-local.html`, una
copia legible y sin cifrar para preparar la clase o imprimirla, que también se
queda fuera de `wiki/`.

**La clave** está en `notas/clave.txt`. Se generó sola la primera vez; para
cambiarla, edita ese archivo (o exporta `ICI_NOTAS_CLAVE`) y vuelve a ejecutar
el script. Si versionas el proyecto, añade `notas/` a `.gitignore`.

Dos avisos: el descifrado usa WebCrypto, que sólo funciona en un sitio servido
por **https** o en `localhost`, así que abriendo `wiki/presentacion.html` con
doble clic las notas no se abren (para eso está la copia local). Y cualquiera
con la clave puede leerlas, así que no la pongas en el Campus Virtual.

## Importar una página escrita fuera de la wiki

Los enunciados se pueden redactar como HTML suelto (con su propio `<style>`) y
meterlos después en el sitio:

```sh
node tools/importar.mjs practica1.html wiki/practicas/practica-1.html practicas "Práctica 1"
node tools/build.mjs
```

El script descarta el `<style>` del original ,el estilo vive en
`assets/css/ici.css`, y monta el documento completo con cabecera, migas de pan
y pie. Si el original traía componentes que no están en la hoja compartida, hay
que añadirlos allí.

## Ojo con los duplicados

`practica0.html` y `guia-eclipse-mspacman.html`, en la raíz del proyecto, son
los originales sueltos desde los que se importaron
`wiki/practicas/practica-0.html` y `wiki/guias/eclipse.html`. **Las versiones
de dentro de `wiki/` son las que se publican**, y la guía además se ha
reescrito ahí (instalación desde `eclipseide.org` en vez de un JDK aparte) y la
Práctica 0 tiene la entrega corregida al domingo 20. Si se editan los
originales de la raíz, los cambios no llegan solos al sitio.
