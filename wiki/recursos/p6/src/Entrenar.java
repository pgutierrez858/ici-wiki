import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.function.Supplier;

import es.ucm.fdi.ici.c2627.practica6.grupoYY.MsPacMan;
import pacman.controllers.GhostController;
import pacman.game.util.Stats;

/**
 * Llena la base de casos: PARTIDAS partidas contra cada fantasma de referencia,
 * sin pantalla, aprendiendo. Cada rival tiene su .csv en cbrdata/grupoYY/mspacman/,
 * y cada vez que lo lancéis la base sigue creciendo desde donde se quedó.
 */
public class Entrenar {

    static final int PARTIDAS = 20;            // por rival
    static final long SEMILLA = 100_000;       // lejos de las de Comparar (1 a 300): se mide con partidas no vistas
    static final String CARPETA = "cbrdata/grupoYY/mspacman/";

    public static void main(String[] args) {
        int partidas = args.length > 0 ? Integer.parseInt(args[0]) : PARTIDAS;
        System.out.printf("%-12s %8s %8s %12s%n", "rival", "antes", "después", "puntos");
        for (Map.Entry<String, Supplier<GhostController>> r : Rivales.fantasmas().entrySet()) {
            MsPacMan pacman = new MsPacMan();               // aprende: escribe en los .csv
            GhostController fantasmas = r.getValue().get();
            Path csv = Paths.get(CARPETA + fantasmas.getClass().getCanonicalName() + ".csv");
            int antes = casos(csv);
            Stats puntos = new Stats(r.getKey());
            for (int i = 0; i < partidas; i++)
                puntos.add(Comparar.jugar(pacman, fantasmas, SEMILLA + i)[0]);   // la métrica 0 son los puntos
            System.out.printf("%-12s %8d %8d %12s%n", r.getKey(), antes, casos(csv),
                    String.format("%.0f ± %.0f", puntos.getAverage(), puntos.getStandardError()));
        }
    }

    /** Los casos de un .csv: las líneas que no están vacías ni son comentarios. */
    static int casos(Path csv) {
        try {
            return (int) Files.lines(csv).filter(l -> !l.isBlank() && !l.startsWith("#")).count();
        } catch (IOException e) {
            return 0;                                       // todavía no existe
        }
    }
}
