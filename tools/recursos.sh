#!/usr/bin/env bash
# Genera los dos zips que se suben al Campus Virtual, a partir del workspace
# de referencia (ici-workspace/, que no se publica):
#
#   ICI-MsPacManEngine.zip   el simulador, común a las prácticas 0 a 4
#   ICI-Practica0.zip        el proyecto de la práctica 0
#
# Uso: bash tools/recursos.sh [curso]      (por defecto c2627)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
WS="$RAIZ/ici-workspace"
OUT="$RAIZ/recursos-campus-virtual"
CURSO="${1:-c2627}"
CURSO_ORIGEN="c2425"

[ -d "$WS/MsPacManEngine" ] || { echo "No encuentro $WS/MsPacManEngine"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

EXCLUIR=(--exclude 'target/' --exclude 'bin/' --exclude '.DS_Store' --exclude '.git/'
         --exclude '.metadata/' --exclude '*.class')

# ---------- 1. el motor ----------
rsync -a "${EXCLUIR[@]}" "$WS/MsPacManEngine" "$TMP/"
cat > "$TMP/MsPacManEngine/LEEME.txt" <<'TXT'
MsPacManEngine  ·  Ingeniería de Comportamientos Inteligentes

El simulador de Ms. Pac-Man. Es el mismo para las prácticas de la primera
mitad del curso, de la 0 a la 4, y NO se modifica: todo lo que escribas va
en el proyecto de la práctica.

Cómo se instala, paso a paso y con los errores típicos, en la wiki de la
asignatura (Guías > Ms. Pac-Man en Eclipse). El enlace está en el Campus
Virtual.

Resumen:
  1. Descomprime este zip en una carpeta estable, fuera del workspace.
  2. Eclipse > File > Import > General > Existing Projects into Workspace.
  3. Con el proyecto seleccionado, Maven > Update Project (Alt+F5) para que
     Maven descargue las dependencias. Sin ese paso no compila.
  4. El proyecto tiene que quedarse con el nombre MsPacManEngine: los
     proyectos de las prácticas lo referencian por ese nombre.

Qué hay dentro:
  src/main/java/pacman/...              el motor del juego
  src/main/java/es/ucm/fdi/ici/...      utilidades de la asignatura (FSM,
                                        reglas, borroso, CBR)
  src/main/resources/data/              laberintos, distancias precalculadas
                                        y sprites
  lib/                                  jess.jar, jFuzzyLogic.jar, jsr94.jar

Adaptación del motor de la competición Ms. Pac-Man vs Ghosts (Piers R.
Williams, University of Essex) hecha en el grupo GAIA de la UCM. GNU GPL v3.
TXT

# ---------- 2. la práctica 0 ----------
rsync -a "${EXCLUIR[@]}" "$WS/Practica0" "$TMP/"
# el paquete lleva el curso: es.ucm.fdi.ici.<curso>.practica0.grupoIndividual
if [ -d "$TMP/Practica0/src/es/ucm/fdi/ici/$CURSO_ORIGEN" ]; then
  mv "$TMP/Practica0/src/es/ucm/fdi/ici/$CURSO_ORIGEN" "$TMP/Practica0/src/es/ucm/fdi/ici/$CURSO"
fi
find "$TMP/Practica0/src" -name '*.java' -print0 |
  xargs -0 sed -i '' "s/ici\.$CURSO_ORIGEN\./ici.$CURSO./g"

cat > "$TMP/Practica0/LEEME.txt" <<TXT
Practica0  ·  Ingeniería de Comportamientos Inteligentes

Proyecto de partida de la práctica 0. Requiere tener ya importado el
proyecto MsPacManEngine (el otro zip): este lo referencia por su nombre,
así que impórtalo primero.

  1. Descomprime este zip junto a MsPacManEngine.
  2. Eclipse > File > Import > General > Existing Projects into Workspace.
  3. Ejecuta ExecutorTest como Java Application. Debería abrirse la ventana
     del laberinto con una Ms. Pac-Man que se mueve al azar.

Qué hay dentro:
  src/ExecutorTest.java      el main que configura el Executor y lanza la
                             partida
  src/es/ucm/fdi/ici/$CURSO/practica0/grupoIndividual/
                             MsPacManRandom.java y GhostsRandom.java, los
                             controladores del ejercicio 1

Lo que se entrega son dos clases nuevas en ese mismo paquete,
MsPacMan.java y Ghosts.java, comprimidas en un zip llamado practica0.zip
hecho desde la carpeta src (o sea, con la carpeta es en la raíz del zip).

El enunciado completo, con los ejercicios y los criterios de entrega, está
en la wiki de la asignatura (Prácticas > Práctica 0). El enlace está en el
Campus Virtual.
TXT

# ---------- zips ----------
rm -f "$OUT/ICI-MsPacManEngine.zip" "$OUT/ICI-Practica0.zip"
(cd "$TMP" && zip -q -r -X "$OUT/ICI-MsPacManEngine.zip" MsPacManEngine)
(cd "$TMP" && zip -q -r -X "$OUT/ICI-Practica0.zip" Practica0)

echo "Listo:"
ls -lh "$OUT"/*.zip | awk '{print "  " $9 "  " $5}'
echo
echo "Contenido de ICI-Practica0.zip:"
unzip -Z1 "$OUT/ICI-Practica0.zip" | sed 's/^/  /'
