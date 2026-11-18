"""Comprueba cada paso de la guía.

    python comprobar.py a2      comprueba el paso A2 (alfa-beta)
    python comprobar.py m3      comprueba el paso M3 (MCTS)
    python comprobar.py a       todos los de alfa-beta;  python comprobar.py m, todos los de MCTS
    python comprobar.py         todos, en orden

Si algo falla, dice qué esperaba y qué ha salido.
"""
import math
import sys
import time

import chess

from ajedrez import Aleatorio, jugar, puntos
from grupoYY import mcts, minimax
from grupoYY.mcts import MCTS, Nodo
from grupoYY.minimax import MATE, Minimax

MATE_BLANCAS = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"   # mate del loco
AHOGADO = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
DAMA_DE_MAS = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"
INICIAL = chess.STARTING_FEN

# Posiciones con un mate en una.
MATES_EN_1 = {
    "pastor": "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 4",
    "pasillo": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    "con negras": "3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
}
# Una dama regalada que hay que comerse.
DAMA_GRATIS = "rnb1kbnr/pppp1ppp/8/4p3/4P3/5q2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"
# Un medio juego cualquiera, para medir tiempos.
MEDIO_JUEGO = "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9"
# Un peón envenenado: la dama blanca puede comerse el de d5, pero lo defiende el de e6.
ENVENENADO = "6k1/8/4p3/3p4/8/8/8/3Q2K1 w - - 0 1"


class Fallo(Exception):
    pass


def espera(cond, msg):
    if not cond:
        raise Fallo(msg)


def cerca(a, b, tol=1e-6):
    return abs(a - b) < tol


# ================================================================ alfa-beta

def a1():
    b = chess.Board(MATE_BLANCAS)
    espera(minimax.evaluar(b, chess.BLACK) == MATE, "las negras han dado mate: evaluar(…, BLACK) tiene que ser MATE")
    espera(minimax.evaluar(b, chess.WHITE) == -MATE, "las blancas están mateadas: evaluar(…, WHITE) tiene que ser -MATE")
    espera(minimax.evaluar(chess.Board(AHOGADO), chess.BLACK) == 0, "rey ahogado: son tablas, 0")
    espera(minimax.evaluar(chess.Board(INICIAL), chess.WHITE) == 0, "en la posición inicial el material está igualado: 0")
    espera(minimax.evaluar(chess.Board(DAMA_DE_MAS), chess.WHITE) == 9, "con una dama de más, las blancas tienen 9")
    espera(minimax.evaluar(chess.Board(DAMA_DE_MAS), chess.BLACK) == -9, "y las negras, -9")


def a2():
    b = chess.Board(ENVENENADO)
    espera(minimax.minimax(b, 0, chess.WHITE) == minimax.evaluar(b, chess.WHITE), "con profundidad 0 tiene que valer lo que diga evaluar")
    v1, v2 = minimax.minimax(b, 1, chess.WHITE), minimax.minimax(b, 2, chess.WHITE)
    espera(v1 == 8, f"a profundidad 1 la dama se come el peón de d5 y las blancas quedan con +8; sale {v1}")
    espera(v2 == 7, f"a profundidad 2 se ve que el peón de e6 se come la dama: lo mejor es no comer y quedarse con +7; sale {v2}"
           + (" (¿estáis eligiendo el máximo también en los nodos del rival?)" if v2 == 8 else ""))
    espera(b.fen() == ENVENENADO, "el tablero tiene que quedar como estaba: cada push con su pop")
    for nombre, fen in MATES_EN_1.items():
        t = chess.Board(fen)
        espera(minimax.minimax(t, 1, t.turn) == MATE, f"mate en 1 ({nombre}): a profundidad 1 tiene que valer MATE")


def _hojas(tablero, prof):
    """Cuántas posiciones tiene que evaluar minimax: las de profundidad 0 y las de partidas terminadas antes."""
    if prof == 0 or tablero.is_game_over():
        return 1
    total = 0
    for j in tablero.legal_moves:
        tablero.push(j)
        total += _hojas(tablero, prof - 1)
        tablero.pop()
    return total


def a3():
    cuenta = [0]

    def contando(tablero, color):
        cuenta[0] += 1
        return minimax.evaluar(tablero, color)
    for fen, prof in ((ENVENENADO, 3), (DAMA_GRATIS, 2), (INICIAL, 3)):
        t = chess.Board(fen)
        cuenta[0] = 0
        sin = minimax.minimax(t, prof, t.turn, evaluar=contando)
        hojas_sin = cuenta[0]
        espera(hojas_sin == _hojas(t, prof), f"minimax tiene que evaluar {_hojas(t, prof)} posiciones a profundidad {prof} y evalúa "
               f"{hojas_sin}: ¿pasáis evaluar en la llamada recursiva?")
        cuenta[0] = 0
        con = minimax.alfabeta(t, prof, t.turn, evaluar=contando)
        hojas_con = cuenta[0]
        espera(con == sin, f"alfabeta tiene que dar lo mismo que minimax: {con} frente a {sin} (profundidad {prof})")
        espera(0 < hojas_con < hojas_sin, f"alfabeta no poda: evalúa {hojas_con} posiciones, y minimax {hojas_sin}"
               + (" (¿pasáis evaluar en la llamada recursiva?)" if hojas_con == 0 else ""))
        espera(t.fen() == fen, "el tablero tiene que quedar como estaba: cada push con su pop")
    print(f"      desde la posición inicial, a profundidad 3: minimax evalúa {hojas_sin} posiciones y alfabeta {hojas_con}")
    j = Minimax(profundidad=2).elegir(chess.Board(ENVENENADO), 1)
    espera(j != chess.Move.from_uci("d1d5"), "Minimax(2) se come el peón envenenado de d5")
    b = chess.Board(DAMA_GRATIS)
    j = Minimax(profundidad=2).elegir(b.copy(), 1)
    espera(b.piece_at(j.to_square) == chess.Piece(chess.QUEEN, chess.BLACK), f"la dama negra de f3 está colgada y no se la come: {j}")
    t0 = time.perf_counter()
    Minimax(profundidad=3).elegir(chess.Board(MEDIO_JUEGO), 1)
    print(f"      Minimax(3) tarda {time.perf_counter() - t0:.2f} s en un medio juego con 37 jugadas legales")


# ================================================================ MCTS

def m1():
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


def m2():
    raiz, a, b = _arbol()
    ua = mcts.ucb1(a, 1.4)
    esperado = 0.6 + 1.4 * math.sqrt(math.log(20) / 10)
    espera(cerca(ua, esperado), f"ucb1 del hijo con 6/10 y c=1,4: esperaba {esperado:.4f} y sale {ua:.4f}")
    espera(cerca(mcts.ucb1(a, 0), 0.6), "con c = 0, ucb1 es sólo la media (valor / visitas)")
    espera(mcts.seleccionar(raiz, 1.4) is b, "con c = 1,4 tiene que ganar el hijo con 4/5: media más alta y menos visitas")
    b.valor = 1.0
    espera(mcts.seleccionar(raiz, 0) is a, "con c = 0 y medias 0,6 contra 0,2, tiene que ganar el de 0,6")


def m3():
    t = chess.Board()
    raiz = Nodo(t)
    hijo = mcts.expandir(raiz, t)
    espera(isinstance(hijo, Nodo), "expandir tiene que devolver el Nodo nuevo")
    espera(raiz.hijos == [hijo], "el hijo nuevo tiene que estar en raiz.hijos")
    espera(hijo.padre is raiz, "el padre del hijo tiene que ser la raíz")
    espera(len(raiz.sin_probar) == 19, f"la jugada tiene que salir de sin_probar: quedan {len(raiz.sin_probar)} y esperaba 19")
    espera(hijo.jugada not in raiz.sin_probar, "la jugada del hijo sigue en sin_probar")
    espera(t.move_stack and t.move_stack[-1] == hijo.jugada, "la jugada tiene que quedar hecha en el tablero (tablero.push)")


def m4():
    for _ in range(20):
        t = chess.Board()
        r = mcts.simular(t, 10, chess.WHITE)
        espera(0 <= r <= 1, f"simular tiene que devolver un número entre 0 y 1, y sale {r}")
        espera(len(t.move_stack) <= 10, f"con profundidad 10 se han jugado {len(t.move_stack)} medias jugadas")
    t = chess.Board()
    espera(cerca(mcts.simular(t, 0, chess.WHITE), 0.5) and not t.move_stack, "con profundidad 0 no se juega nada y vale la recompensa de ahora (0,5)")
    espera(mcts.simular(chess.Board(MATE_BLANCAS), 10, chess.WHITE) == 0.0, "si ya hay mate no se puede jugar nada, y las blancas tienen 0")
    espera(mcts.simular(chess.Board(MATE_BLANCAS), 10, chess.BLACK) == 1.0, "y las negras, 1: la recompensa es para el color que se pide")
    espera(mcts.simular(chess.Board(DAMA_DE_MAS), 0, chess.WHITE) > 0.9, "con una dama de más, para las blancas tiene que pasar de 0,9")


def m5():
    t = chess.Board()
    raiz = Nodo(t)
    t.push_uci("e2e4")
    h1 = Nodo(t, raiz, chess.Move.from_uci("e2e4"))
    t.push_uci("e7e5")
    h2 = Nodo(t, h1, chess.Move.from_uci("e7e5"))
    mcts.retropropagar(h2, 0.8)
    espera((raiz.visitas, h1.visitas, h2.visitas) == (1, 1, 1), "cada nodo del camino tiene que sumar una visita")
    espera(cerca(raiz.valor, 0.8) and cerca(h1.valor, 0.8) and cerca(h2.valor, 0.8),
           f"todos los nodos suman la misma recompensa, 0,8; suman {raiz.valor}, {h1.valor} y {h2.valor}")


def m6():
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


PASOS = {"a1": a1, "a2": a2, "a3": a3, "m1": m1, "m2": m2, "m3": m3, "m4": m4, "m5": m5, "m6": m6}


def main():
    pedidos = [a.lower() for a in sys.argv[1:]] or ["a", "m"]
    nombres = [n for p in pedidos for n in PASOS if n == p or (len(p) == 1 and n.startswith(p))]
    if not nombres:
        sys.exit(f"No conozco ese paso. Los pasos son: {', '.join(PASOS)}")
    mal = False
    for n in nombres:
        try:
            PASOS[n]()
            print(f"{n.upper()}: BIEN")
        except NotImplementedError as e:
            print(f"{n.upper()}: sin hacer ({e})")
        except Fallo as e:
            print(f"{n.upper()}: MAL. {e}")
            mal = True
    sys.exit(1 if mal else 0)


if __name__ == "__main__":
    main()
