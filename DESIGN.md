# DESIGN · ICI wiki

Documentado desde lo construido, no desde la intención. Fuente única:
`wiki/assets/css/ici.css` (sin build, sin dependencias). El sistema es
heredado de los enunciados de prácticas ya existentes del profesor; esta wiki
lo continúa y lo amplía con la navegación del sitio y el tablero del curso.

## Mundo
Cuaderno de laboratorio con la paleta del laberinto. Lectura en serif,
etiquetas y datos en monoespaciada, filetes de 1px, franjas de celdas con
separadores de un píxel, cero tarjetas decorativas. El toque de videojuego no
viene de la tipografía ,nunca hay letra de píxeles, sino del **color usado como
estructura**: cada bloque del curso posee un color de Ms. Pac-Man y lo conserva
en todas las páginas.

Estrategia de color: **restringida**. Papel y azul de laberinto sostienen la
página; los cuatro fantasmas y el amarillo de píldora sólo codifican bloques,
entregas y avisos. El color no lleva texto encima nunca: tiñe fondos y filos, y
el texto se queda en `--ink`.

## Tokens

| Rol | Claro | Oscuro |
|---|---|---|
| `--ink` / `--ink-2` / `--ink-3` | `#14192B` `#3A4361` `#5F6883` | `#E7EBF6` `#AFB8D1` `#8B95B2` |
| `--ground` / `--surface` / `--surface-2` | `#F1F4FA` `#FFFFFF` `#E7ECF6` | `#0C1020` `#141A2C` `#1C2337` |
| `--line` / `--line-soft` | `#D2D9E9` `#E3E8F3` | `#2A3350` `#212942` |
| `--maze` / `--maze-soft` | `#2E3FA8` `#E3E8FB` | `#8496F5` `#1A2245` |
| `--pill` / `--pill-ink` / `--pill-soft` | `#E8A400` `#8A5B00` `#FBF0D6` | `#F5C044` `#F0B93F` `#262039` |
| `--blinky` `--pinky` `--inky` `--clyde` | `#C93A2A` `#B84E82` `#12707C` `#A55708` | `#FF7A6B` `#F49FC4` `#55CBD8` `#F2A44A` |
| `--ok` / `--bad` / `--warn` | `#16794A` `#B3311F` `#A5540B` | `#5BD69A` `#FF8B78` `#E8B368` |
| Tramo a oscuras | `--mx-ground #131829` `--mx-ink #9AA3BE` | `#070A14` `#A3ADC8` |
| `--focus` (anillo de foco) | `#8A5B00` | `#F5C044` |
| `--due-ring` (filo de la píldora) | `#14192B` | `#0C1020` |

`--ink-3` se aclaró respecto al sistema original (`#6B7391` → `#5F6883`) para
que las etiquetas monoespaciadas pequeñas pasen 4.5:1 sobre `--ground`.

El amarillo de píldora puro se queda en 1.96:1 sobre papel, así que no puede
sostener por sí solo nada que tenga que verse: el anillo de foco usa `--focus`
(oro oscuro en claro, amarillo en oscuro) y la píldora de entrega del calendario
lleva un filo de 1px en `--due-ring`. El amarillo sigue siendo el color de la
marca; lo que cambia es que nunca va solo cuando informa.

Los tintes de bloque son `color-mix` sobre `--surface`: 20 % en claro y 24 % en
oscuro. Por debajo de eso los seis bloques caen en la misma banda de luminosidad
y el color deja de identificar.

Tema: claro por defecto, oscuro por `prefers-color-scheme`, y un conmutador de
tres estados (auto / claro / oscuro) que escribe `data-theme` en `<html>` y lo
recuerda en `localStorage`. `assets/js/tema.js` se carga en `<head>` para que no
haya destello.

## Tipografía
- Titulares: **Archivo** 500–800, `letter-spacing` negativo (−0.025em en h1),
  `text-wrap: balance`. h1 `clamp(2rem, 6vw, 3.7rem)`.
- Cuerpo: **Source Serif 4**, 17px, interlineado 1.65, medida `68ch`.
- Etiquetas, datos, código y migas de pan: **JetBrains Mono**, versalitas
  falsas con `text-transform: uppercase` + `letter-spacing: .12–.16em`.
  Monoespaciada sólo para código, datos, medidas y etiquetas de sistema.
- Cifras tabulares en calendario y fechas (`font-variant-numeric`).

## Retícula y escala
`.wrap` 1140px máx. `.cols` es una rejilla de una columna que a ≥1020px pasa a
`1fr + 15rem` con índice lateral pegajoso; `.cols.solo` para páginas sin
índice. Ritmo vertical con `--gap`/`--step` (`clamp`), más aire encima de un
encabezado que debajo. Las secciones se separan con un filete superior de 1px,
no con cajas.

## Componentes
- `.site` cabecera pegajosa: logotipo dibujado (cuña de Pac-Man en SVG),
  navegación que a ≤780px baja a una tira desplazable con máscara de
  desvanecido, y conmutador de tema en texto.
- `.crumbs` migas de pan enlazadas en monoespaciada.
- `.masthead` h1 + `.thin` + `.standfirst` + `.byline`, cerrado con filete de
  3px sobre `--ink`.
- `.facts` franja de datos clave: rejilla `auto-fit minmax(11rem, 1fr)` con
  separadores de 1px.
- `.blocks` / `.blk` lista de bloques del curso: casilla de nivel con el color
  del bloque como filete inferior, título con estado, descripción, metadatos a
  la derecha y fila de enlaces.
- `.cal` calendario de prácticas: mes en columna izquierda a ≥720px y como banda de título por
  debajo; semanas de lunes a domingo en siete columnas que aguantan 390px.
  La píldora amarilla marca la entrega, la cursiva el día no lectivo y el recuadro azul el día de hoy.
- `.legend` leyenda de bloques, enlazada cuando la página existe.
- `.temario`, `.gloss` listas de dos columnas para temario y conceptos.
- `.links` índices de la wiki: título + etiqueta + descripción, con flecha que
  avanza en hover.
- `h3.label`: encabezado de tercer nivel con la voz monoespaciada del `h4`.
  Existe para no saltar de h2 a h4 en los enunciados largos sin cambiar el
  aspecto heredado.
- `.note` (tip / trap / mine), `pre`, `.pseudo`, `.step`, `.check`, `.ex`,
  `.formula`, `.chip`, `.swatch`: heredados de los enunciados, sin cambios.
- Filete izquierdo de 3px en `pre`, `.pseudo` y `.note`: **es el dispositivo de
  acento del sistema heredado**. Se conserva a propósito aunque el detector de
  patrones lo marque, porque los enunciados ya publicados lo usan.

## Imágenes
Capturas del propio entorno, no ilustraciones: el simulador, la máquina de
estados corriendo, la consola de Jess disparando reglas, el motor borroso con
sus grados de activación, la herramienta de competición y RoboPacMan. Van
siempre dentro de un `<figure>` con `figcaption` en monoespaciada por encima de
la imagen, y con `.shot`: filete de 1px, radio 4px y la sombra del sistema.
`.shot.crop` recorta por CSS lo que en el original es aire muerto.

## Diapositivas
El mismo mundo, a tamaño de proyector. Escenario de 16:9 con `container-type:
inline-size` y todo el interior dimensionado en `em` sobre una base de
`2.3cqw`, de forma que la tipografía escala con el ancho y no hace falta
recalcular nada al ir a pantalla completa. Portada y separadores invierten a
`#14192B` con la píldora amarilla y una fila de píldoras sin comer en el borde
inferior, que es el único adorno que se permite el sistema. Barra de control en
monoespaciada bajo el escenario, y flotante y semitransparente cuando la
presentación ocupa la pantalla. Las notas de presentador viajan cifradas, se
descifran en el navegador con la clave que llega por la URL y se pintan en un
panel fuera de `.deck`, así que nunca entran en lo que se proyecta.

## Movimiento
Un solo momento autorizado: el **tramo del calendario cuyo entorno no está
anunciado**, con fondo de píldoras sin comer y un barrido de luz de 11s. Fuera de eso, sólo
transiciones de 0.15–0.18s en hover de navegación y enlaces, y el logotipo que
mastica al pasar por encima. Todo dentro de
`@media (prefers-reduced-motion: no-preference)`.

## Superficies del navegador
Selección en amarillo píldora sobre tinta, `caret-color` y `accent-color` en
azul de laberinto, barras de desplazamiento tematizadas, `:focus-visible` con
anillo amarillo de 2px y desplazamiento de 2px, `text-underline-offset` .18em.

## Impresión
`@media print` al final de la hoja: sin cabecera pegajosa, sin raíl, sin
conmutador, el tramo a oscuras pasa a gris claro, se evitan cortes dentro de
secciones, bloques, tablas y `pre`, y los enlaces externos imprimen su URL. Los
enunciados se imprimen, así que tienen que sobrevivir al papel.

## Estado
Los estados de bloque (`En curso` / `Entregada` / `Por abrir`) y la próxima
entrega se escriben en el HTML en tiempo de generación y `assets/js/ici.js` los
recalcula en el navegador con la fecha real. Sin JavaScript la página sigue
siendo correcta: sólo se congela en la fecha de la última publicación.
