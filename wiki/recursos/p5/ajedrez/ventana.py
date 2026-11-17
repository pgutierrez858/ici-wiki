"""La ventana: una partida pintada, con lo que pensó cada jugador al lado.

    ver(blancas, negras, tiempo=1.0)

La partida se juega en un hilo aparte con partida.jugar(), y la ventana sólo la
pinta, así que lo que veis es exactamente lo que pasa en Comparar. Las flechas
son las tres jugadas más visitadas por el último que movió: la gruesa es la elegida.

Teclas: espacio, pausa; flecha derecha, una jugada (en pausa); Esc, salir.
"""
import io
import queue
import threading
import time
import traceback

import chess
import chess.svg
import pygame

from .partida import jugar

CASILLA = 72
PANEL = 380
ALTO = 8 * CASILLA
CLARA, OSCURA = (231, 236, 246), (125, 140, 196)
TINTA, TINTA2 = (20, 25, 43), (95, 104, 131)
PILDORA = (245, 192, 68)
FLECHA = (201, 58, 42)
FONDO = (241, 244, 250)


class Humano:
    """Un jugador que mueve con el ratón. Sólo sirve dentro de ver()."""
    usa_reloj = False

    def __init__(self, nombre="Humano"):
        self.nombre = nombre
        self.cola = queue.Queue()

    def elegir(self, tablero, tiempo):
        return self.cola.get()


def ver(blancas, negras, tiempo=1.0, fen=chess.STARTING_FEN, pausa=0.4, max_medias=400):
    """Abre la ventana y juega la partida. `pausa`: segundos de espera tras cada jugada."""
    pygame.init()
    pantalla = pygame.display.set_mode((8 * CASILLA + PANEL, ALTO))
    pygame.display.set_caption(f"{blancas.nombre} contra {negras.nombre}")
    letra = pygame.font.SysFont("arial,helvetica,dejavusans", 17)
    negrita = pygame.font.SysFont("arial,helvetica,dejavusans", 19, bold=True)
    piezas = {s: _pieza(s) for s in "PNBRQKpnbrqk"}

    estado = {
        "tablero": chess.Board(fen), "ultima": None, "stats": [], "quien": None,
        "texto": "", "fin": None, "pausa": False, "paso": False, "jugadas": [],
    }
    candado = threading.Lock()

    def al_mover(tablero, jugada, jugador, segundos):
        with candado:
            estado["tablero"] = tablero.copy()
            estado["ultima"] = jugada
            estado["quien"] = jugador.nombre
            estado["stats"] = list(getattr(jugador, "estadisticas", []) or [])[:8] if not isinstance(jugador, Humano) else []
            n = getattr(jugador, "iteraciones_hechas", None)
            estado["texto"] = f"{segundos:.2f} s" + (f" · {n} iteraciones" if n else "")
            estado["jugadas"].append(_san(tablero, jugada))
        time.sleep(pausa)
        while estado["pausa"] and not estado["paso"]:
            time.sleep(0.05)
        estado["paso"] = False

    def partida():
        try:
            resultado, motivo, _ = jugar(blancas, negras, tiempo, max_medias, fen, al_mover=al_mover)
            estado["fin"] = f"{resultado} · {motivo}"
        except Exception as e:
            traceback.print_exc()
            estado["fin"] = f"Error: {type(e).__name__}. Mirad la consola."

    threading.Thread(target=partida, daemon=True).start()

    origen = None
    reloj = pygame.time.Clock()
    while True:
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT or (ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE):
                pygame.quit()
                return estado["fin"]
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_SPACE:
                estado["pausa"] = not estado["pausa"]
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_RIGHT:
                estado["paso"] = True
            if ev.type == pygame.MOUSEBUTTONDOWN and ev.pos[0] < 8 * CASILLA:
                origen = _clic(estado, blancas, negras, origen, ev.pos)

        with candado:
            t = estado["tablero"]
            pantalla.fill(FONDO)
            _tablero(pantalla, t, piezas, estado["ultima"], origen)
            _flechas(pantalla, estado["stats"])
            _panel(pantalla, letra, negrita, estado, blancas, negras)
        pygame.display.flip()
        reloj.tick(30)


def _clic(estado, blancas, negras, origen, pos):
    t = estado["tablero"]
    humano = blancas if t.turn == chess.WHITE else negras
    if not isinstance(humano, Humano) or estado["fin"]:
        return None
    casilla = chess.square(pos[0] // CASILLA, 7 - pos[1] // CASILLA)
    if origen is None:
        p = t.piece_at(casilla)
        return casilla if p and p.color == t.turn else None
    jugada = chess.Move(origen, casilla)
    if t.piece_type_at(origen) == chess.PAWN and chess.square_rank(casilla) in (0, 7):
        jugada.promotion = chess.QUEEN          # siempre a dama
    if jugada in t.legal_moves:
        humano.cola.put(jugada)
        return None
    p = t.piece_at(casilla)
    return casilla if p and p.color == t.turn else None


def _pieza(simbolo):
    svg = chess.svg.piece(chess.Piece.from_symbol(simbolo), size=CASILLA)
    return pygame.image.load(io.BytesIO(svg.encode()), "pieza.svg")


def _xy(casilla):
    return chess.square_file(casilla) * CASILLA, (7 - chess.square_rank(casilla)) * CASILLA


def _tablero(pantalla, t, piezas, ultima, origen):
    for c in chess.SQUARES:
        x, y = _xy(c)
        clara = (chess.square_file(c) + chess.square_rank(c)) % 2 == 1
        pygame.draw.rect(pantalla, CLARA if clara else OSCURA, (x, y, CASILLA, CASILLA))
    marcar = [ultima.from_square, ultima.to_square] if ultima else []
    for c in marcar + ([origen] if origen is not None else []):
        capa = pygame.Surface((CASILLA, CASILLA), pygame.SRCALPHA)
        capa.fill((*PILDORA, 120))
        pantalla.blit(capa, _xy(c))
    if origen is not None:
        for j in t.legal_moves:
            if j.from_square == origen:
                x, y = _xy(j.to_square)
                pygame.draw.circle(pantalla, TINTA2, (x + CASILLA // 2, y + CASILLA // 2), 9)
    if t.is_check():
        x, y = _xy(t.king(t.turn))
        pygame.draw.rect(pantalla, FLECHA, (x, y, CASILLA, CASILLA), 4)
    for c, p in t.piece_map().items():
        pantalla.blit(piezas[p.symbol()], _xy(c))


def _flechas(pantalla, stats):
    if not stats:
        return
    maximo = stats[0][1] or 1
    capa = pygame.Surface((8 * CASILLA, ALTO), pygame.SRCALPHA)
    for i, (jugada, visitas, _) in enumerate(stats[:3]):
        a = pygame.Vector2(_xy(jugada.from_square)) + (CASILLA / 2, CASILLA / 2)
        b = pygame.Vector2(_xy(jugada.to_square)) + (CASILLA / 2, CASILLA / 2)
        if a == b:
            continue
        grosor = max(3, int(14 * visitas / maximo))
        color = (*FLECHA, 200 if i == 0 else 90)
        d = (b - a).normalize()
        punta = b - d * 6
        pygame.draw.line(capa, color, a, punta - d * 14, grosor)
        n = pygame.Vector2(-d.y, d.x)
        pygame.draw.polygon(capa, color, [punta, punta - d * 22 + n * (grosor + 6), punta - d * 22 - n * (grosor + 6)])
    pantalla.blit(capa, (0, 0))


def _panel(pantalla, letra, negrita, estado, blancas, negras):
    x, y = 8 * CASILLA + 20, 18
    t = estado["tablero"]

    def linea(texto, fuente=letra, color=TINTA, dy=24):
        nonlocal y
        pantalla.blit(fuente.render(texto, True, color), (x, y))
        y += dy

    linea(f"Blancas  {blancas.nombre}", negrita)
    linea(f"Negras   {negras.nombre}", negrita, dy=34)
    if estado["fin"]:
        linea(estado["fin"][:34], negrita, FLECHA)
        if len(estado["fin"]) > 34:
            linea(estado["fin"][34:68], letra, FLECHA)
    else:
        quien = blancas if t.turn == chess.WHITE else negras
        verbo = "mueve (con el ratón)" if isinstance(quien, Humano) else "piensa..."
        linea(f"{quien.nombre} {verbo}", letra, TINTA2)
    linea(f"Jugada {t.fullmove_number}" + ("   PAUSA" if estado["pausa"] else ""), letra, TINTA2, dy=34)

    if estado["stats"]:
        linea(f"Lo que pensó {estado['quien']}", negrita)
        linea(estado["texto"], letra, TINTA2, dy=28)
        antes = t.copy()
        if antes.move_stack:
            antes.pop()
        maximo = estado["stats"][0][1] or 1
        for jugada, visitas, media in estado["stats"]:
            san = antes.san(jugada) if jugada in antes.legal_moves else jugada.uci()
            pygame.draw.rect(pantalla, (227, 232, 251), (x + 70, y + 3, 150, 14))
            pygame.draw.rect(pantalla, (46, 63, 168), (x + 70, y + 3, int(150 * visitas / maximo), 14))
            pantalla.blit(letra.render(san, True, TINTA), (x, y))
            pantalla.blit(letra.render(f"{visitas}", True, TINTA2), (x + 232, y))
            pantalla.blit(letra.render(f"{100 * media:.0f}%", True, TINTA2), (x + 290, y))
            y += 22
        y += 6
        linea("barra: visitas · %: valor medio", letra, TINTA2, dy=30)

    ultimas = estado["jugadas"][-5:]
    if ultimas:
        linea("Últimas: " + " ".join(ultimas), letra, TINTA2)
    pantalla.blit(letra.render("Espacio: pausa   →: una jugada   Esc: salir", True, TINTA2), (x, ALTO - 30))


def _san(tablero, jugada):
    antes = tablero.copy()
    antes.pop()
    return antes.san(jugada)
