# Práctica 5 · MCTS en ajedrez

La guía completa está en la wiki de la asignatura: **Guías > MCTS paso a paso**.

## Arrancar (una vez)

1. Abrid esta carpeta en VS Code: `File > Open Folder…`.
2. Instalad la extensión **Python** de Microsoft si VS Code os la propone.
3. `Ctrl+Shift+P` (`Cmd+Shift+P` en Mac) > **Python: Create Environment** > **Venv**,
   elegid un Python 3.10 o más nuevo y marcad `requirements.txt`. Se crea `.venv/`
   con `chess` y `pygame-ce` dentro.
4. En **Ejecutar y depurar** (`Ctrl+Shift+D`), elegid **Ver partida** y pulsad F5.

Sin VS Code, desde una terminal en esta carpeta:

    python -m venv .venv
    .venv\Scripts\activate          (Windows)
    source .venv/bin/activate       (Mac y Linux)
    pip install -r requirements.txt
    python ver_partida.py

## Qué hay

| | |
|---|---|
| `grupoYY/mcts.py` | vuestro MCTS: lo que se rellena paso a paso |
| `grupoYY/__init__.py` | `jugador()`: la versión que va al concurso |
| `comprobar.py` | comprueba cada paso: `python comprobar.py 3` |
| `ver_partida.py` | una partida en una ventana, con lo que piensa cada jugador |
| `jugar_contra.py` | vosotros contra vuestro MCTS, con el ratón |
| `comparar.py` | versiones contra los rivales de referencia, con una tabla de puntos |
| `ajedrez/` | el entorno: partidas, rivales y ventana. No se modifica |
