"""Comparar versiones: cada versión (de MCTS, de alfa-beta o vuestra) juega contra los mismos rivales, desde las mismas
aperturas y con los dos colores, y sale una tabla con los puntos.

Cambiad lo de MAYÚSCULAS y ejecutad (en VS Code, "Comparar versiones" en Ejecutar y depurar).
Las partidas se reparten entre varios procesos, así que el ordenador irá a tope un rato.
"""
import os
import time
from concurrent.futures import ProcessPoolExecutor

import chess

from ajedrez import AlfaBeta, Aleatorio, Voraz, jugar, puntos
from grupoYY.mcts import MCTS
from grupoYY.minimax import Minimax

# Cada versión, con un nombre corto. Una función que crea el jugador (por eso el lambda).
# Para probar un parámetro, la misma clase con otro valor; para probar una heurística, la vuestra:
#     "mcts-c07": lambda: MCTS(c=0.7),
#     "ab3": lambda: Minimax(profundidad=3),
#     "ab2-centro": lambda: Minimax(evaluar=evaluar_centro),
VERSIONES = {
    "mcts": lambda: MCTS(),
    "ab2": lambda: Minimax(profundidad=2),
}

RIVALES = {
    "Aleatorio": lambda: Aleatorio(),
    "Voraz": lambda: Voraz(),
    "AlfaBeta2": lambda: AlfaBeta(2),
}

# Cada apertura se juega dos veces contra cada rival: una con blancas y otra con negras.
APERTURAS = {
    "Italiana": "e4 e5 Nf3 Nc6 Bc4 Bc5",
    "Española": "e4 e5 Nf3 Nc6 Bb5 a6",
    "Siciliana": "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6",
    "Francesa": "e4 e6 d4 d5",
    "Caro-Kann": "e4 c6 d4 d5",
    "Gambito de dama": "d4 d5 c4 e6",
    "India de rey": "d4 Nf6 c4 g6 Nc3 Bg7",
    "Inglesa": "c4 e5 Nc3 Nf6",
}

TIEMPO = 0.3          # segundos por jugada
MAX_MEDIAS = 120      # medias jugadas desde la apertura; después decide el material
PROCESOS = max(1, (os.cpu_count() or 2) // 2)


def fen_de(sans):
    tablero = chess.Board()
    for san in sans.split():
        tablero.push_san(san)
    return tablero.fen()


def una_partida(version, rival, apertura, color):
    """Juega una partida y devuelve los puntos de la versión (1, 0.5 o 0) y cómo acabó."""
    yo, otro = VERSIONES[version](), RIVALES[rival]()
    blancas, negras = (yo, otro) if color == chess.WHITE else (otro, yo)
    resultado, motivo, _ = jugar(blancas, negras, TIEMPO, MAX_MEDIAS, fen_de(APERTURAS[apertura]))
    return version, rival, puntos(resultado, color), motivo


def main():
    trabajos = [(v, r, a, c) for v in VERSIONES for r in RIVALES for a in APERTURAS
                for c in (chess.WHITE, chess.BLACK)]
    total = len(trabajos)
    medias = sum(MAX_MEDIAS // 2 for _ in trabajos) * TIEMPO / PROCESOS / 60
    print(f"{total} partidas, {PROCESOS} procesos, {TIEMPO} s por jugada: hasta {medias:.0f} minutos.\n")

    tabla = {}
    t0 = time.time()
    with ProcessPoolExecutor(PROCESOS) as pool:
        for i, (v, r, p, motivo) in enumerate(pool.map(una_partida, *zip(*trabajos)), 1):
            tabla.setdefault((v, r), []).append(p)
            print(f"\r{i}/{total} partidas", end="", flush=True)
    print(f"  ({(time.time() - t0) / 60:.1f} min)\n")

    ancho = max(len(v) for v in VERSIONES) + 2
    print("Puntos (victoria 1, tablas ½) y, entre paréntesis, ganadas-tablas-perdidas.")
    print("±: dos errores típicos. Si los intervalos de dos versiones se solapan mucho, no hay diferencia clara.\n")
    print(" " * ancho + "".join(f"{r:>22}" for r in RIVALES) + f"{'TOTAL':>14}")
    for v in VERSIONES:
        fila, todos = f"{v:<{ancho}}", []
        for r in RIVALES:
            ps = tabla[(v, r)]
            todos += ps
            g, e = ps.count(1.0), ps.count(0.5)
            fila += f"{_porcentaje(ps):>12} ({g}-{e}-{len(ps) - g - e})".rjust(22)
        fila += f"{_porcentaje(todos):>14}"
        print(fila)


def _porcentaje(ps):
    n = len(ps)
    m = sum(ps) / n
    var = sum((p - m) ** 2 for p in ps) / (n - 1) if n > 1 else 0
    return f"{100 * m:.0f}% ±{200 * (var / n) ** 0.5:.0f}"


if __name__ == "__main__":
    main()
