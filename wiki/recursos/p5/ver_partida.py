"""Ver una partida en una ventana. Cambiad los jugadores y ejecutad
(en VS Code, "Ver partida" en Ejecutar y depurar)."""
from ajedrez import AlfaBeta, Aleatorio, Voraz
from ajedrez.ventana import ver
from grupoYY.mcts import MCTS

BLANCAS = MCTS()
NEGRAS = Voraz()
TIEMPO = 1.0        # segundos por jugada

if __name__ == "__main__":
    print(ver(BLANCAS, NEGRAS, TIEMPO))
