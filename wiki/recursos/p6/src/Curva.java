import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;

import es.ucm.fdi.ici.c2627.practica6.grupoYY.MsPacMan;
import pacman.controllers.GhostController;
import pacman.game.Game;
import pacman.game.util.Stats;

/**
 * La curva de aprendizaje: ¿mejora Ms. Pac-Man a medida que guarda casos?
 *
 *   Curva [rival] [partidas] [carpeta] [planB]      por defecto: Aggressive 50 curva, sin plan B
 *
 * Empieza con la base vacía (borra el .csv de ese rival en cbrdata/grupoYY/carpeta/),
 * juega las partidas seguidas aprendiendo, y por cada una escribe en curva-rival.csv
 * los puntos, los casos, los ms por decisión y los tics. Ese fichero se dibuja con
 * una hoja de cálculo: va con punto y coma y coma decimal, para que lo abra tal cual.
 * Juega como en el concurso, con el plan B apagado; con "planB" al final, encendido.
 */
public class Curva {

    static final long SEMILLA = Entrenar.SEMILLA;   // las de Entrenar, lejos de las de Comparar
    static final int VENTANA = 10;                  // las 10 primeras frente a las 10 últimas

    public static void main(String[] args) throws IOException {
        String rival = args.length > 0 ? args[0] : "Aggressive";
        int partidas = args.length > 1 ? Integer.parseInt(args[1]) : 50;
        String carpeta = args.length > 2 ? args[2] : "curva";
        boolean planB = args.length > 3 && args[3].equals("planB");

        Map<String, Supplier<GhostController>> rivales = Rivales.fantasmas();
        if (!rivales.containsKey(rival)) {
            System.out.println("No conozco el rival " + rival + ". Los de Rivales son: " + rivales.keySet());
            return;
        }
        if (carpeta.equals("mspacman")) {               // la que llena Entrenar: no se borra por accidente
            System.out.println("La carpeta mspacman es la base de Entrenar y del concurso: usad otra para la curva.");
            return;
        }

        MsPacMan pacman = new MsPacMan(carpeta, true, planB);
        GhostController fantasmas = rivales.get(rival).get();
        Path base = Paths.get("cbrdata/grupoYY/" + carpeta + "/" + fantasmas.getClass().getCanonicalName() + ".csv");
        if (Files.deleteIfExists(base))
            System.out.println("Borrada la base anterior, para empezar sin casos: " + base);

        int v = Math.min(VENTANA, partidas);          // con menos de 20 partidas, las dos ventanas se solapan
        Stats primeras = new Stats("primeras"), ultimas = new Stats("últimas");
        String fichero = "curva-" + rival + ".csv";
        try (PrintWriter csv = new PrintWriter(fichero, "UTF-8")) {
            csv.println("partida;puntos;casos;ms por decisión;tics");
            System.out.printf("%8s %8s %8s %16s %6s%n", "partida", "puntos", "casos", "ms por decisión", "tics");
            for (int i = 0; i < partidas; i++) {
                Game game = jugar(pacman, fantasmas, SEMILLA + i);
                String fila = String.format(Locale.forLanguageTag("es"), "%d;%d;%d;%.3f;%d",
                        i + 1, game.getScore(), pacman.getCaseBaseSize(), pacman.msPorDecision(), game.getTotalTime());
                csv.println(fila);
                System.out.printf("%8s %8s %8s %16s %6s%n", (Object[]) fila.split(";"));
                if (i < v) primeras.add(game.getScore());
                if (i >= partidas - v) ultimas.add(game.getScore());
            }
        }

        System.out.printf("%nPuntos contra %s, las %d primeras partidas frente a las %d últimas:%n", rival, v, v);
        System.out.printf("%-14s %16s %16s %9s %8s%n", "", "primeras", "últimas", "D", "2·ET_D");
        Comparar.fila(rival, primeras.getAverage(), primeras.getStandardError(),
                ultimas.getAverage(), ultimas.getStandardError(), true, 0);
        System.out.println("Cada partida, en " + fichero + ".");
    }

    /** Una partida aprendiendo, como la juega el Executor: lee la base antes y la guarda al acabar. */
    static Game jugar(MsPacMan pacman, GhostController fantasmas, long semilla) {
        Game game = new Game(semilla);
        pacman.preCompute(fantasmas.getClass().getCanonicalName());
        fantasmas.preCompute(pacman.getClass().getCanonicalName());
        while (!game.gameOver() && game.getTotalTime() <= Comparar.LIMITE_TURNOS) {
            long limite = System.currentTimeMillis() + 40;
            game.advanceGame(pacman.getMove(game.copy(), limite), fantasmas.getMove(game.copy(), limite));
        }
        pacman.postCompute();
        fantasmas.postCompute();
        return game;
    }
}
