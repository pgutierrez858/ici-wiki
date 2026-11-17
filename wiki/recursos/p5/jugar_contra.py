"""Jugar vosotros contra vuestro MCTS, con el ratón: clic en la pieza y clic en la casilla
(en VS Code, "Jugar contra el MCTS" en Ejecutar y depurar). Los peones coronan siempre a dama."""
import chess

from ajedrez.ventana import Humano, ver
from grupoYY.mcts import MCTS

COLOR = chess.WHITE     # el vuestro
TIEMPO = 2.0            # lo que piensa el MCTS

if __name__ == "__main__":
    yo, bot = Humano("Vosotros"), MCTS()
    print(ver(yo, bot, TIEMPO, pausa=0) if COLOR == chess.WHITE else ver(bot, yo, TIEMPO, pausa=0))
