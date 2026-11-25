import pacman.game.Game;

/**
 * Lo que se mide de una partida. Comparar crea una nueva para cada partida,
 * llama a turno() después de cada turno y a alFinal() cuando termina.
 */
public abstract class Metrica {

    public final String nombre;
    public final boolean subirEsBuenoParaPacman;   // puntos: sí; vidas perdidas: no

    protected Metrica(String nombre, boolean subirEsBuenoParaPacman) {
        this.nombre = nombre;
        this.subirEsBuenoParaPacman = subirEsBuenoParaPacman;
    }

    /** Después de cada turno, con el juego de verdad. Aquí se cuentan cosas. */
    public void turno(Game game) { }

    /** Cuando la partida ha terminado. Lo que devuelve es el valor de esta partida. */
    public abstract double alFinal(Game game);

    // ---- Unas cuantas ya hechas. Copiad una para hacer la vuestra. ----------

    public static Metrica puntos() {
        return new Metrica("puntos", true) {
            public double alFinal(Game game) { return game.getScore(); }
        };
    }

    public static Metrica nivel() {
        return new Metrica("nivel alcanzado", true) {
            public double alFinal(Game game) { return game.getCurrentLevel(); }
        };
    }

    public static Metrica fantasmasComidos() {
        return new Metrica("fantasmas comidos", true) {
            int n = 0;
            public void turno(Game game) { n += game.getNumGhostsEaten(); }
            public double alFinal(Game game) { return n; }
        };
    }

    public static Metrica vidasPerdidas() {
        return new Metrica("vidas perdidas", false) {
            int n = 0;
            public void turno(Game game) { if (game.wasPacManEaten()) n++; }
            public double alFinal(Game game) { return n; }
        };
    }

    /** Turnos que sobrevive Ms. Pac-Man por cada vida perdida. */
    public static Metrica turnosPorVida() {
        return new Metrica("turnos por vida", true) {
            int vidas = 0;
            public void turno(Game game) { if (game.wasPacManEaten()) vidas++; }
            public double alFinal(Game game) { return game.getTotalTime() / (double) Math.max(1, vidas); }
        };
    }
}
