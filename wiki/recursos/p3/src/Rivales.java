import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

import pacman.controllers.GhostController;
import pacman.controllers.PacmanController;

/**
 * Los rivales de referencia de la Práctica 3: cinco fantasmas y tres Ms. Pac-Man.
 * Son los mismos para todos los grupos y para las cifras de la wiki, así que no
 * los quitéis ni los cambiéis: si queréis más rivales, añadidlos en Comparar.
 */
public final class Rivales {

    private Rivales() { }

    public static Map<String, Supplier<GhostController>> fantasmas() {
        Map<String, Supplier<GhostController>> m = new LinkedHashMap<>();
        // los de la Práctica 0, en el propio proyecto
        m.put("Random",      GhostsRandom::new);
        m.put("Aggressive",  GhostsAggressive::new);
        // los rivales de la Práctica 1: rival-basico.jar, rival-intermedio.jar, rival-avanzado.jar
        m.put("Basico",      es.ucm.fdi.ici.rivales.GhostsBasico::new);
        m.put("Intermedio",  es.ucm.fdi.ici.rivales.GhostsIntermedio::new);
        m.put("Avanzado",    es.ucm.fdi.ici.rivales.GhostsAvanzado::new);
        return m;
    }

    public static Map<String, Supplier<PacmanController>> pacmans() {
        Map<String, Supplier<PacmanController>> m = new LinkedHashMap<>();
        // los rivales de la Práctica 1
        m.put("Basico",      es.ucm.fdi.ici.rivales.MsPacManBasico::new);
        m.put("Intermedio",  es.ucm.fdi.ici.rivales.MsPacManIntermedio::new);
        m.put("Avanzado",    es.ucm.fdi.ici.rivales.MsPacManAvanzado::new);
        return m;
    }
}
