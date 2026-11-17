"""El paquete de vuestro grupo. Cambiad YY por vuestra letra en el nombre de la carpeta."""
from .mcts import MCTS


def jugador():
    """La versión que va al concurso: sin argumentos, y con el nombre de vuestro grupo."""
    return MCTS(nombre="grupoYY")
