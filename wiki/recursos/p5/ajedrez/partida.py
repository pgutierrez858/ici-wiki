"""Jugar una partida entre dos jugadores, sin ventana.

Un jugador es cualquier objeto con
    nombre                      un texto
    elegir(tablero, tiempo)     devuelve un chess.Move legal en `tablero`
y, si quiere, los atributos
    estadisticas                lista de (jugada, visitas, valor) de su última decisión,
                                que la ventana pinta al lado del tablero
    usa_reloj = False           para los rivales de profundidad fija, que no miran el reloj

`tablero` es una copia: el jugador puede hacer push/pop en él sin miedo.
`tiempo` son los segundos que tiene para pensar esa jugada.
"""
import time

import chess

VALOR = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}

# Por encima de esto (veces el tiempo por jugada), una jugada va fuera de tiempo.
MARGEN = 1.5


def material(tablero, color=chess.WHITE):
    """Puntos de material de `color` menos los del rival (peón 1, caballo y alfil 3, torre 5, dama 9)."""
    total = 0
    for pieza, valor in VALOR.items():
        total += valor * (len(tablero.pieces(pieza, color)) - len(tablero.pieces(pieza, not color)))
    return total


def jugar(blancas, negras, tiempo=1.0, max_medias=200, fen=chess.STARTING_FEN,
          estricto=False, al_mover=None):
    """Juega una partida y devuelve (resultado, motivo, tablero).

    resultado   "1-0", "0-1" o "1/2-1/2"
    motivo      por qué terminó, en una frase
    max_medias  límite de medias jugadas (una de blancas o una de negras). Al llegar,
                gana quien tenga 3 o más puntos de material de ventaja; si no, tablas.
    estricto    con True, una excepción, una jugada ilegal o pasarse de
                MARGEN veces el tiempo pierde la partida. Con False, las excepciones
                saltan (para que veáis dónde) y el tiempo sólo avisa.
    al_mover    función (tablero, jugada, jugador, segundos) que se llama tras cada jugada
    """
    tablero = chess.Board(fen)
    jugadores = {chess.WHITE: blancas, chess.BLACK: negras}
    while True:
        fin = tablero.outcome(claim_draw=True)
        if fin is not None:
            return fin.result(), _motivo(fin), tablero
        if tablero.ply() - chess.Board(fen).ply() >= max_medias:
            m = material(tablero)
            if m >= 3:
                return "1-0", f"límite de jugadas, blancas con {m} de material más", tablero
            if m <= -3:
                return "0-1", f"límite de jugadas, negras con {-m} de material más", tablero
            return "1/2-1/2", "límite de jugadas, material igualado", tablero

        turno = tablero.turn
        jugador = jugadores[turno]
        pierde = "0-1" if turno == chess.WHITE else "1-0"
        t0 = time.perf_counter()
        try:
            jugada = jugador.elegir(tablero.copy(), tiempo)
        except Exception as e:
            if not estricto:
                raise
            return pierde, f"{jugador.nombre} lanza {type(e).__name__}: {e}", tablero
        segundos = time.perf_counter() - t0

        if jugada not in tablero.legal_moves:
            if not estricto:
                raise ValueError(f"{jugador.nombre} devuelve {jugada!r}, que no es legal en\n{tablero.fen()}")
            return pierde, f"{jugador.nombre} hace una jugada ilegal: {jugada}", tablero
        if segundos > tiempo * MARGEN + 0.05 and getattr(jugador, "usa_reloj", True):
            if estricto:
                return pierde, f"{jugador.nombre} tarda {segundos:.2f} s con {tiempo} s", tablero
            print(f"OJO: {jugador.nombre} ha tardado {segundos:.2f} s y tenía {tiempo} s")

        tablero.push(jugada)
        if al_mover:
            al_mover(tablero, jugada, jugador, segundos)


def _motivo(fin):
    return {
        chess.Termination.CHECKMATE: "jaque mate",
        chess.Termination.STALEMATE: "rey ahogado",
        chess.Termination.INSUFFICIENT_MATERIAL: "material insuficiente",
        chess.Termination.SEVENTYFIVE_MOVES: "75 jugadas sin capturas ni peones",
        chess.Termination.FIVEFOLD_REPETITION: "quíntuple repetición",
        chess.Termination.FIFTY_MOVES: "50 jugadas sin capturas ni peones",
        chess.Termination.THREEFOLD_REPETITION: "triple repetición",
    }.get(fin.termination, str(fin.termination))


def puntos(resultado, color):
    """1, 0.5 o 0 para `color` según el resultado de la partida."""
    if resultado == "1/2-1/2":
        return 0.5
    return 1.0 if (resultado == "1-0") == (color == chess.WHITE) else 0.0
