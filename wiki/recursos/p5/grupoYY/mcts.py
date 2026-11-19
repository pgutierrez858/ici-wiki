"""Monte Carlo Tree Search para ajedrez. Grupo YY.

Es la segunda parte de la guía. Cada función con
    raise NotImplementedError
es un hueco. Cuando rellenéis el del paso M1, M2…, comprobadlo con
    python comprobar.py m1
(o, en VS Code, "Comprobar paso…" en Ejecutar y depurar).
"""
import math
import random
import time

import chess

from ajedrez import material


class Nodo:
    """Un nodo del árbol: una posición a la que se llega con `jugada` desde `padre`."""

    def __init__(self, tablero, padre=None, jugada=None):
        self.padre = padre
        self.jugada = jugada                          # la jugada que lleva del padre aquí
        self.hijos = []                               # los nodos ya creados debajo
        self.sin_probar = list(tablero.legal_moves)   # las jugadas que todavía no tienen hijo
        random.shuffle(self.sin_probar)
        self.visitas = 0                              # N: cuántas simulaciones han pasado por aquí
        self.valor = 0.0                              # W: la suma de sus recompensas
        self.color = not tablero.turn                 # quien hizo `jugada` (os hará falta en el reto "El rival también elige")


# ---------------------------------------------------------------- paso M1
def recompensa(tablero, color):
    """Cuánto le gusta el tablero a `color`, entre 0 (perdido) y 1 (ganado).

    Mate: 0 o 1, según quién esté mateado. Ahogado o material insuficiente: 0,5.
    Si la partida sigue, una estimación con el material: 1 / (1 + e^(-m/3)),
    donde m = material(tablero, color).
    """
    raise NotImplementedError("M1: recompensa")


# ---------------------------------------------------------------- paso M2
def ucb1(hijo, c):
    """La puntuación UCB1 de `hijo`: su media más c por el término de exploración."""
    raise NotImplementedError("M2: ucb1")


def seleccionar(nodo, c):
    """El hijo de `nodo` con más UCB1."""
    raise NotImplementedError("M2: seleccionar")


# ---------------------------------------------------------------- paso M3
def expandir(nodo, tablero):
    """Saca una jugada de nodo.sin_probar, la juega en `tablero`, crea su hijo,
    lo cuelga de `nodo` y lo devuelve."""
    raise NotImplementedError("M3: expandir")


# ---------------------------------------------------------------- paso M4
def simular(tablero, profundidad, color, recompensa=recompensa):
    """Juega al azar como mucho `profundidad` medias jugadas (o hasta que no queden
    jugadas legales) y devuelve recompensa(tablero, color). `recompensa` es la heurística."""
    raise NotImplementedError("M4: simular")


# ---------------------------------------------------------------- paso M5
def retropropagar(nodo, r):
    """Sube desde `nodo` hasta la raíz sumando a cada nodo una visita y la recompensa `r`.

    Todo el árbol cuenta desde el mismo jugador, el que decide en la raíz. Es lo más sencillo,
    y tiene un fallo que podéis arreglar en el reto "El rival también elige"."""
    raise NotImplementedError("M5: retropropagar")


# ---------------------------------------------------------------- paso M6
class MCTS:
    """El jugador. `c` es la constante de exploración, `profundidad` el corte de la simulación,
    `recompensa` la heurística, e `iteraciones`, si no es None, sustituye al reloj (para las pruebas)."""

    def __init__(self, nombre="grupoYY", c=1.4, profundidad=10, iteraciones=None, recompensa=recompensa):
        self.nombre = nombre
        self.c = c
        self.profundidad = profundidad
        self.iteraciones = iteraciones
        self.recompensa = recompensa    # la heurística: otra función con la misma forma, para probar la vuestra
        self.estadisticas = []      # (jugada, visitas, valor medio) de la raíz: la ventana las pinta

    # Las cuatro fases, como métodos. Una versión nueva hereda de MCTS y redefine sólo la que cambia:
    #     class MCTSCapturas(MCTS):
    #         def simular(self, tablero): ...
    def seleccionar(self, nodo):
        return seleccionar(nodo, self.c)

    def expandir(self, nodo, tablero):
        return expandir(nodo, tablero)

    def simular(self, tablero):
        return simular(tablero, self.profundidad, self.yo, self.recompensa)

    def retropropagar(self, nodo, r):
        retropropagar(nodo, r)

    def elegir(self, tablero, tiempo):
        fin = time.perf_counter() + tiempo * 0.9    # un margen para no pasarse
        self.yo = tablero.turn                      # el que decide: el árbol entero cuenta desde él
        raiz = Nodo(tablero)
        n = 0
        while True:
            t = tablero.copy(stack=False)           # una copia para esta iteración
            nodo = raiz
            # 1. selección:      mientras el nodo no tenga jugadas sin probar y sí hijos,
            #                    bajad al hijo que diga self.seleccionar(nodo) y jugadlo en t
            # 2. expansión:      si quedan jugadas sin probar, self.expandir(nodo, t)
            # 3. simulación:     r = self.simular(t)
            # 4. retropropagación: self.retropropagar(...)
            raise NotImplementedError("M6: el bucle de elegir")
            n += 1
            if (self.iteraciones and n >= self.iteraciones) or \
               (not self.iteraciones and time.perf_counter() > fin):
                break
        self.estadisticas = sorted(((h.jugada, h.visitas, h.valor / h.visitas) for h in raiz.hijos),
                                   key=lambda e: -e[1])
        self.iteraciones_hechas = n
        return max(raiz.hijos, key=lambda h: h.visitas).jugada   # el más visitado
