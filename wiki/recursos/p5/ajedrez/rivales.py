"""Los rivales de referencia. Los mismos para todos los grupos.

    Aleatorio()         una jugada legal cualquiera
    Voraz()             da mate si puede; si no, la captura más valiosa; si no hay, al azar
    AlfaBeta(p)         minimax con poda alfa-beta a p medias jugadas, contando sólo material

AlfaBeta no mira el reloj: busca siempre a la misma profundidad. Con p=2 tarda
centésimas por jugada y con p=3, décimas. Entre jugadas igual de buenas elige al azar,
para que dos partidas no sean idénticas.
"""
import random

import chess

from .partida import VALOR, material

MATE = 1000
INF = 10**6


class Aleatorio:
    def __init__(self, nombre="Aleatorio"):
        self.nombre = nombre

    def elegir(self, tablero, tiempo):
        return random.choice(list(tablero.legal_moves))


class Voraz:
    def __init__(self, nombre="Voraz"):
        self.nombre = nombre

    def elegir(self, tablero, tiempo):
        jugadas = list(tablero.legal_moves)
        random.shuffle(jugadas)
        mejor, mejor_valor = jugadas[0], -1
        for j in jugadas:
            tablero.push(j)
            mate = tablero.is_checkmate()
            tablero.pop()
            if mate:
                return j
            v = _capturado(tablero, j)
            if v > mejor_valor:
                mejor, mejor_valor = j, v
        return mejor


class AlfaBeta:
    usa_reloj = False

    def __init__(self, profundidad=2, nombre=None):
        self.profundidad = profundidad
        self.nombre = nombre or f"AlfaBeta{profundidad}"

    def elegir(self, tablero, tiempo):
        jugadas = _ordenar(tablero, list(tablero.legal_moves))
        mejores, alfa = [], -INF
        for j in jugadas:
            tablero.push(j)
            v = -self._negamax(tablero, self.profundidad - 1, -INF, -alfa + 1)
            tablero.pop()
            if v > alfa:
                mejores, alfa = [j], v
            elif v == alfa:
                mejores.append(j)
        return random.choice(mejores)

    def _negamax(self, tablero, prof, alfa, beta):
        """Valor de la posición para el que mueve, en puntos de material."""
        if tablero.is_checkmate():
            return -MATE - prof           # mejor un mate rápido que uno lento
        if tablero.is_stalemate() or tablero.is_insufficient_material() or tablero.can_claim_draw():
            return 0
        if prof == 0:
            return material(tablero, tablero.turn)
        for j in _ordenar(tablero, list(tablero.legal_moves)):
            tablero.push(j)
            v = -self._negamax(tablero, prof - 1, -beta, -alfa)
            tablero.pop()
            if v >= beta:
                return v
            alfa = max(alfa, v)
        return alfa


def _capturado(tablero, jugada):
    """Valor de la pieza que captura `jugada` (0 si no captura)."""
    if tablero.is_en_passant(jugada):
        return 1
    pieza = tablero.piece_at(jugada.to_square)
    return VALOR[pieza.piece_type] if pieza else 0


def _ordenar(tablero, jugadas):
    """Capturas valiosas primero: la poda corta mucho más."""
    return sorted(jugadas, key=lambda j: -_capturado(tablero, j))
