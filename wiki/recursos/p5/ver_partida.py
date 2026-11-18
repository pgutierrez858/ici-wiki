"""Ver una partida en una ventana. Cambiad los jugadores y ejecutad
(en VS Code, "Ver partida" en Ejecutar y depurar)."""
from ajedrez import AlfaBeta, Aleatorio, Voraz
from ajedrez.ventana import ver
from grupoYY.mcts import MCTS
from grupoYY.minimax import Minimax

# Con el proyecto recién descargado, dos rivales de referencia. Cuando tengáis los pasos hechos,
# poned los vuestros: MCTS(), Minimax(profundidad=2), u otra versión.
BLANCAS = Voraz()
NEGRAS = AlfaBeta(2)
TIEMPO = 1.0        # segundos por jugada

if __name__ == "__main__":
    print(ver(BLANCAS, NEGRAS, TIEMPO))
