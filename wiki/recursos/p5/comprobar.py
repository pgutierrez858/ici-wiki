"""Comprueba cada paso de la guía.

    python comprobar.py 3       comprueba el paso 3
    python comprobar.py         comprueba todos los que estén hechos, en orden

Si algo falla, dice qué esperaba y qué ha salido.
"""
import math
import sys
import time

import chess

from ajedrez import Aleatorio, jugar, puntos
from grupoYY import mcts
from grupoYY.mcts import MCTS, Nodo

MATE_BLANCAS = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"   # mate del loco
AHOGADO = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
DAMA_DE_MAS = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"
INICIAL = chess.STARTING_FEN

# Posiciones con un mate en una que tiene que encontrar el paso 6.
MATES_EN_1 = {
    "pastor": "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 4",
    "pasillo": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    "con negras": "3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
}
# Y una dama regalada que tiene que comerse.
DAMA_GRATIS = "rnb1kbnr/pppp1ppp/8/4p3/4P3/5q2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"


class Fallo(Exception):
    pass


def espera(cond, msg):
    if not cond:
        raise Fallo(msg)


def cerca(a, b, tol=1e-6):
    return abs(a - b) < tol


def paso1():
    b = chess.Board(MATE_BLANCAS)
    espera(mcts.recompensa(b, chess.BLACK) == 1.0, "las negras han dado mate: recompensa(…, BLACK) tiene que ser 1")
    espera(mcts.recompensa(b, chess.WHITE) == 0.0, "las blancas están mateadas: recompensa(…, WHITE) tiene que ser 0")
    espera(mcts.recompensa(chess.Board(AHOGADO), chess.WHITE) == 0.5, "rey ahogado: tiene que ser 0,5")
    espera(cerca(mcts.recompensa(chess.Board(INICIAL), chess.WHITE), 0.5), "en la posición inicial el material está igualado: 0,5")
    d = mcts.recompensa(chess.Board(DAMA_DE_MAS), chess.WHITE)
    espera(cerca(d, 1 / (1 + math.exp(-3))), f"con una dama de más (m = 9) esperaba 1/(1+e^-3) = 0,953 y sale {d:.3f}")
    espera(cerca(mcts.recompensa(chess.Board(DAMA_DE_MAS), chess.BLACK), 1 - d), "para las negras tiene que ser 1 menos lo de las blancas")


def _arbol():
    """Una raíz con 20 visitas y dos hijos: 10 visitas con 6 de valor, y 5 con 4."""
    raiz = Nodo(chess.Board())
    raiz.visitas = 20
    a, b = Nodo(chess.Board(), raiz, chess.Move.from_uci("e2e4")), Nodo(chess.Board(), raiz, chess.Move.from_uci("d2d4"))
    a.visitas, a.valor = 10, 6.0
    b.visitas, b.valor = 5, 4.0
    raiz.hijos = [a, b]
    return raiz, a, b


def paso2():
    raiz, a, b = _arbol()
    ua = mcts.ucb1(a, 1.4)
    esperado = 0.6 + 1.4 * math.sqrt(math.log(20) / 10)
    espera(cerca(ua, esperado), f"ucb1 del hijo con 6/10 y c=1,4: esperaba {esperado:.4f} y sale {ua:.4f}")
    espera(cerca(mcts.ucb1(a, 0), 0.6), "con c = 0, ucb1 es sólo la media (valor / visitas)")
    espera(mcts.seleccionar(raiz, 1.4) is b, "con c = 1,4 tiene que ganar el hijo con 4/5: media más alta y menos visitas")
    b.valor = 1.0
    espera(mcts.seleccionar(raiz, 0) is a, "con c = 0 y medias 0,6 contra 0,2, tiene que ganar el de 0,6")


def paso3():
    t = chess.Board()
    raiz = Nodo(t)
    hijo = mcts.expandir(raiz, t)
    espera(isinstance(hijo, Nodo), "expandir tiene que devolver el Nodo nuevo")
    espera(raiz.hijos == [hijo], "el hijo nuevo tiene que estar en raiz.hijos")
    espera(hijo.padre is raiz, "el padre del hijo tiene que ser la raíz")
    espera(len(raiz.sin_probar) == 19, f"la jugada tiene que salir de sin_probar: quedan {len(raiz.sin_probar)} y esperaba 19")
    espera(hijo.jugada not in raiz.sin_probar, "la jugada del hijo sigue en sin_probar")
    espera(t.move_stack and t.move_stack[-1] == hijo.jugada, "la jugada tiene que quedar hecha en el tablero (tablero.push)")
    espera(hijo.color == chess.WHITE, "el hijo lo ha creado una jugada de blancas: su color es WHITE")


def paso4():
    for _ in range(20):
        t = chess.Board()
        r = mcts.simular(t, 10)
        espera(0 <= r <= 1, f"simular tiene que devolver un número entre 0 y 1, y sale {r}")
        espera(len(t.move_stack) <= 10, f"con profundidad 10 se han jugado {len(t.move_stack)} medias jugadas")
    t = chess.Board()
    espera(cerca(mcts.simular(t, 0), 0.5) and not t.move_stack, "con profundidad 0 no se juega nada y vale la recompensa de ahora (0,5)")
    t = chess.Board(MATE_BLANCAS)
    espera(mcts.simular(t, 10) == 0.0, "si ya hay mate no se puede jugar nada, y las blancas tienen 0")
    t = chess.Board(DAMA_DE_MAS)
    espera(mcts.simular(t, 0) > 0.9, "la recompensa es para las BLANCAS: con dama de más tiene que pasar de 0,9")


def paso5():
    t = chess.Board()
    raiz = Nodo(t)
    t.push_uci("e2e4")
    h1 = Nodo(t, raiz, chess.Move.from_uci("e2e4"))
    t.push_uci("e7e5")
    h2 = Nodo(t, h1, chess.Move.from_uci("e7e5"))
    mcts.retropropagar(h2, 0.8)
    espera((raiz.visitas, h1.visitas, h2.visitas) == (1, 1, 1), "cada nodo del camino tiene que sumar una visita")
    espera(cerca(h1.valor, 0.8), f"h1 lo creó una jugada de blancas: tiene que sumar 0,8 y suma {h1.valor}")
    espera(cerca(h2.valor, 0.2), f"h2 lo creó una jugada de negras: tiene que sumar 1 - 0,8 = 0,2 y suma {h2.valor}")


def paso6():
    for nombre, fen in MATES_EN_1.items():
        b = chess.Board(fen)
        j = MCTS(iteraciones=2000).elegir(b.copy(), 10)
        b.push(j)
        espera(b.is_checkmate(), f"mate en 1 ({nombre}): había mate y ha jugado {j}")
    b = chess.Board(DAMA_GRATIS)
    j = MCTS(iteraciones=3000).elegir(b.copy(), 10)
    espera(b.piece_at(j.to_square) == chess.Piece(chess.QUEEN, chess.BLACK),
           f"la dama negra de f3 está colgada y no se la come: ha jugado {j}")
    m = MCTS()
    t0 = time.perf_counter()
    m.elegir(chess.Board(), 1.0)
    dt = time.perf_counter() - t0
    espera(dt < 1.2, f"con 1 segundo ha tardado {dt:.2f}")
    print(f"      {m.iteraciones_hechas} iteraciones en 1 s desde la posición inicial")
    print("      y ahora dos partidas contra Aleatorio (unos 20 s)...")
    total = sum(puntos(jugar(MCTS(), Aleatorio(), 0.2, 120)[0], chess.WHITE) for _ in range(2))
    espera(total >= 1.5, f"contra Aleatorio, en dos partidas, sólo {total} puntos de 2")


PASOS = [paso1, paso2, paso3, paso4, paso5, paso6]


def main():
    pasos = [int(a) for a in sys.argv[1:]] or range(1, len(PASOS) + 1)
    for n in pasos:
        try:
            PASOS[n - 1]()
            print(f"Paso {n}: BIEN")
        except NotImplementedError as e:
            print(f"Paso {n}: sin hacer ({e})")
            if len(sys.argv) > 1:
                sys.exit(1)
            break
        except Fallo as e:
            print(f"Paso {n}: MAL. {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
