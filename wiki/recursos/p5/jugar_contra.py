"""Jugar vosotros contra vuestro jugador, con el ratón: clic en la pieza y clic en la casilla
(en VS Code, "Jugar contra vuestro jugador" en Ejecutar y depurar). Los peones coronan siempre a dama."""
import chess

from ajedrez.ventana import Humano, ver
from grupoYY.mcts import MCTS
from grupoYY.minimax import Minimax

COLOR = chess.WHITE     # el vuestro
TIEMPO = 2.0            # lo que piensa el MCTS (Minimax mira su profundidad, tarde lo que tarde)
RIVAL = MCTS()          # o Minimax(profundidad=3)

if __name__ == "__main__":
    yo, bot = Humano("Vosotros"), RIVAL
    print(ver(yo, bot, TIEMPO, pausa=0) if COLOR == chess.WHITE else ver(bot, yo, TIEMPO, pausa=0))
