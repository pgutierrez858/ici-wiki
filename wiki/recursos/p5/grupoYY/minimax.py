"""Minimax con poda alfa-beta para ajedrez. Grupo YY.

Es la primera parte de la guía. Cada función con
    raise NotImplementedError
es un hueco. Cuando rellenéis el del paso A1, A2 o A3, comprobadlo con
    python comprobar.py a1
(o, en VS Code, "Comprobar paso…" en Ejecutar y depurar).
"""
import math
import random

import chess

from ajedrez import VALOR, material

MATE = 1000     # más que todo el material junto: un mate vale más que cualquier ventaja


# ---------------------------------------------------------------- paso A1
def evaluar(tablero, color):
    """Cuánto le gusta el tablero a `color`, en puntos de material.

    Mate: -MATE si `color` está mateado y +MATE si lo está el rival.
    Ahogado o material insuficiente: 0, son tablas.
    Si la partida sigue: material(tablero, color).

    Es la heurística más sencilla posible: sólo cuenta piezas. Mejorarla es parte de la práctica.
    """
    raise NotImplementedError("A1: evaluar")


# ---------------------------------------------------------------- paso A2
def minimax(tablero, profundidad, color, evaluar=evaluar):
    """El valor de la posición para `color`, mirando `profundidad` medias jugadas más.

    Si la partida ha terminado o la profundidad es 0: evaluar(tablero, color).
    Si mueve `color` (tablero.turn == color), es un nodo de MAX: el mayor valor de sus hijos.
    Si mueve el rival, es de MIN: el menor.
    Para mirar un hijo: tablero.push(jugada), la llamada con profundidad - 1, y tablero.pop().
    `evaluar` es la heurística: pasadla tal cual en la llamada recursiva.
    """
    raise NotImplementedError("A2: minimax")


# ---------------------------------------------------------------- paso A3
def alfabeta(tablero, profundidad, color, alfa=-math.inf, beta=math.inf, evaluar=evaluar):
    """Lo mismo que minimax, con la poda: devuelve el mismo valor mirando menos posiciones.

    alfa: lo que MAX ya tiene asegurado por otra rama. beta: lo que MIN ya tiene asegurado.
    En un nodo de MAX, cada hijo sube alfa; en uno de MIN, baja beta.
    En cuanto alfa >= beta, el resto de hijos sobra.
    """
    raise NotImplementedError("A3: alfabeta")


# ---------------------------------------------------------------- hecho: el orden y el jugador
def ordenar(tablero, jugadas):
    """Las capturas primero, y entre ellas las de la pieza más valiosa: así la poda corta antes."""
    def valor_capturado(j):
        pieza = tablero.piece_at(j.to_square)
        return VALOR[pieza.piece_type] if pieza else (1 if tablero.is_en_passant(j) else 0)
    return sorted(jugadas, key=valor_capturado, reverse=True)


class Minimax:
    """El jugador. `profundidad` son las medias jugadas que mira, contando la suya; con
    `poda=False` usa minimax a secas (para comparar lo que tardan); `evaluar` es la heurística."""

    def __init__(self, nombre="grupoYY-ab", profundidad=2, poda=True, evaluar=evaluar):
        self.nombre = nombre
        self.profundidad = profundidad
        self.poda = poda
        self.evaluar = evaluar      # la heurística: otra función con la misma forma, para probar la vuestra

    def valor(self, tablero, color):
        """El valor de la posición después de una jugada: lo que diga la búsqueda que toque."""
        if self.poda:
            return alfabeta(tablero, self.profundidad - 1, color, evaluar=self.evaluar)
        return minimax(tablero, self.profundidad - 1, color, evaluar=self.evaluar)

    def elegir(self, tablero, tiempo):
        color = tablero.turn
        mejor, mejores = -math.inf, []
        for jugada in ordenar(tablero, list(tablero.legal_moves)):
            tablero.push(jugada)
            v = self.valor(tablero, color)
            tablero.pop()
            if v > mejor:
                mejor, mejores = v, [jugada]
            elif v == mejor:
                mejores.append(jugada)
        self.mejor_valor = mejor
        return random.choice(mejores)       # entre las que empatan, una al azar: así no juega siempre igual
