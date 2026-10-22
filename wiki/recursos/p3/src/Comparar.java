import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import es.ucm.fdi.ici.c2627.practica3.grupoYY.Ghosts;
import es.ucm.fdi.ici.c2627.practica3.grupoYY.MsPacMan;
import pacman.controllers.GhostController;
import pacman.controllers.PacmanController;
import pacman.game.Game;
import pacman.game.util.Stats;

/**
 * ¿Es mejor una versión que otra, contra los mismos rivales?
 *
 * Juega cada versión contra cada rival las mismas PARTIDAS, con las mismas
 * semillas, mide cada partida con las METRICAS y compara cada versión con la
 * anterior: rival a rival, y en media sobre todos los rivales.
 */
public class Comparar {

    static final boolean COMPARO_FANTASMAS = false;  // false: vuestras Ms. Pac-Man contra RIVALES_FANTASMAS
                                                     // true:  vuestros fantasmas contra RIVALES_PACMANS

    // ---- 1. Vuestras versiones, en orden: cada una contra la anterior -------
    static final Map<String, Supplier<PacmanController>> MIS_PACMANS = new LinkedHashMap<>();
    static final Map<String, Supplier<GhostController>> MIS_FANTASMAS = new LinkedHashMap<>();

    // ---- 2. Los rivales: los de referencia (Rivales.java), y los que añadáis
    static final Map<String, Supplier<GhostController>> RIVALES_FANTASMAS = Rivales.fantasmas();
    static final Map<String, Supplier<PacmanController>> RIVALES_PACMANS = Rivales.pacmans();

    static {
        MIS_PACMANS.put("v0", () -> new MsPacMan("mspacman-v0.clp"));     // las seis primeras reglas
        MIS_PACMANS.put("v1", () -> new MsPacMan("mspacman-v1.clp"));     // con rematar

        MIS_FANTASMAS.put("v0", () -> new Ghosts("ghosts-v0.clp"));       // G1 y G2
        MIS_FANTASMAS.put("v1", () -> new Ghosts("ghosts-v1.clp"));       // con G3

        // Si queréis más rivales, aquí, y desde el principio: los mismos para todas las versiones.
        // RIVALES_FANTASMAS.put("P2 nuestros", es.ucm.fdi.ici.c2627.practica2.grupoYY.Ghosts::new);
        // RIVALES_PACMANS.put("P2 nuestra", es.ucm.fdi.ici.c2627.practica2.grupoYY.MsPacMan::new);
    }

    // ---- 3. Cómo se mide ----------------------------------------------------
    static final List<Supplier<Metrica>> METRICAS = List.of(
            Metrica::puntos, Metrica::turnosPorVida, Metrica::fantasmasComidos);

    static final int PARTIDAS = 300;          // por versión y rival; no lo cambiéis entre versiones
    static final long SEMILLA = 1;            // la partida i usa la semilla SEMILLA + i
    static final int LIMITE_TURNOS = 4000;    // el mismo que el Executor
    static final int HILOS = Runtime.getRuntime().availableProcessors();

    static final AtomicInteger hechas = new AtomicInteger();   // para ir viendo el progreso

    public static void main(String[] args) throws Exception {
        // El paquete fsm del motor saluda por la consola de errores cada vez que se crea una
        // máquina, y los rivales de la P2 crean varias por partida: esas líneas, fuera.
        System.setErr(new PrintStream(new FileOutputStream(FileDescriptor.err), true) {
            @Override
            public void println(String x) {
                if (x == null || !x.startsWith("Finite State Machine Implementation")) super.println(x);
            }
        });

        List<String> versiones = new ArrayList<>(COMPARO_FANTASMAS ? MIS_FANTASMAS.keySet() : MIS_PACMANS.keySet());
        List<String> rivales = new ArrayList<>(COMPARO_FANTASMAS ? RIVALES_PACMANS.keySet() : RIVALES_FANTASMAS.keySet());

        // Se reparte el trabajo en bloques de 25 partidas, cada bloque con sus propios controladores
        ExecutorService hilos = Executors.newFixedThreadPool(HILOS);
        Map<String, List<Future<double[][]>>> bloques = new LinkedHashMap<>();
        Map<String, Stats[]> stats = new LinkedHashMap<>();
        try {
            for (String v : versiones)
                for (String r : rivales) {
                    List<Future<double[][]>> lista = new ArrayList<>();
                    for (int desde = 0; desde < PARTIDAS; desde += 25) {
                        int d = desde, hasta = Math.min(PARTIDAS, desde + 25);
                        lista.add(hilos.submit(() -> jugarBloque(v, r, d, hasta)));
                    }
                    bloques.put(v + "|" + r, lista);
                }

            // Un Stats por versión, rival y métrica. Las partidas con excepción no cuentan, pero se avisa
            for (Map.Entry<String, List<Future<double[][]>>> e : bloques.entrySet()) {
                Stats[] s = new Stats[METRICAS.size()];
                for (int m = 0; m < s.length; m++) s[m] = new Stats(e.getKey());
                int fallidas = 0;
                for (Future<double[][]> f : e.getValue())
                    for (double[] partida : f.get()) {
                        if (partida == null) { fallidas++; continue; }
                        for (int m = 0; m < s.length; m++) s[m].add(partida[m]);
                    }
                if (fallidas > 0)
                    System.out.printf("OJO: %s, %d partidas con excepción que no cuentan.%n",
                            e.getKey().replace("|", " contra "), fallidas);
                stats.put(e.getKey(), s);
            }
        } finally {
            hilos.shutdownNow();               // si algo revienta, que no se quede colgado
        }

        System.out.printf("%n%d partidas por versión y rival, semillas %d a %d, comparando %s.%n",
                PARTIDAS, SEMILLA, SEMILLA + PARTIDAS - 1, COMPARO_FANTASMAS ? "fantasmas" : "Ms. Pac-Man");
        for (int m = 0; m < METRICAS.size(); m++)
            for (int i = 1; i < versiones.size(); i++)
                tabla(m, versiones.get(i - 1), versiones.get(i), rivales, stats);
    }

    /** Juega las partidas [desde, hasta) de una versión contra un rival. Una fila por partida. */
    static double[][] jugarBloque(String version, String rival, int desde, int hasta) {
        PacmanController pacman;
        GhostController fantasmas;
        synchronized (Comparar.class) {    // Jess no sabe leer dos .clp a la vez: de uno en uno
            pacman = COMPARO_FANTASMAS ? RIVALES_PACMANS.get(rival).get() : MIS_PACMANS.get(version).get();
            fantasmas = COMPARO_FANTASMAS ? MIS_FANTASMAS.get(version).get() : RIVALES_FANTASMAS.get(rival).get();
        }
        double[][] filas = new double[hasta - desde][];
        for (int i = desde; i < hasta; i++) {
            try {
                filas[i - desde] = jugar(pacman, fantasmas, SEMILLA + i);
            } catch (Exception | Error e) {      // se queda a null: no cuenta, y se avisa al final
                System.err.printf("%s contra %s, partida %d: %s%n", version, rival, i, e);
            }
            int n = hechas.incrementAndGet();
            if (n % 500 == 0) System.err.printf("… %d partidas%n", n);
        }
        return filas;
    }

    /** Una partida, como la juega el Executor, midiendo con todas las métricas. */
    static double[] jugar(PacmanController pacman, GhostController fantasmas, long semilla) {
        List<Metrica> metricas = new ArrayList<>();
        for (Supplier<Metrica> s : METRICAS) metricas.add(s.get());

        Game game = new Game(semilla);
        pacman.preCompute(fantasmas.getClass().getCanonicalName());
        fantasmas.preCompute(pacman.getClass().getCanonicalName());
        while (!game.gameOver() && game.getTotalTime() <= LIMITE_TURNOS) {
            long limite = System.currentTimeMillis() + 40;
            game.advanceGame(pacman.getMove(game.copy(), limite), fantasmas.getMove(game.copy(), limite));
            for (Metrica m : metricas) m.turno(game);
        }
        pacman.postCompute();
        fantasmas.postCompute();

        double[] valores = new double[metricas.size()];
        for (int m = 0; m < valores.length; m++) valores[m] = metricas.get(m).alFinal(game);
        return valores;
    }

    /** La tabla de una métrica: la versión nueva contra la vieja, rival a rival y en media. */
    static void tabla(int m, String vieja, String nueva, List<String> rivales, Map<String, Stats[]> stats) {
        Metrica muestra = METRICAS.get(m).get();
        boolean subirEsBueno = muestra.subirEsBuenoParaPacman != COMPARO_FANTASMAS;
        System.out.printf("%n== %s: %s frente a %s (%s es mejor) ==%n",
                muestra.nombre, nueva, vieja, subirEsBueno ? "más" : "menos");
        System.out.printf("%-14s %16s %16s %9s %8s%n", "rival", vieja, nueva, "D", "2·ET_D");

        double etMax = 0;
        for (String r : rivales)
            for (String v : List.of(vieja, nueva))
                etMax = Math.max(etMax, stats.get(v + "|" + r)[m].getStandardError());
        int dec = etMax >= 10 ? 0 : etMax >= 1 ? 1 : etMax >= 0.1 ? 2 : 3;

        int mejor = 0, peor = 0;
        double sumaV = 0, sumaN = 0, varV = 0, varN = 0;
        for (String r : rivales) {
            Stats v = stats.get(vieja + "|" + r)[m], n = stats.get(nueva + "|" + r)[m];
            String veredicto = fila(r, v.getAverage(), v.getStandardError(),
                    n.getAverage(), n.getStandardError(), subirEsBueno, dec);
            if (veredicto.equals("mejor")) mejor++;
            if (veredicto.equals("peor")) peor++;
            sumaV += v.getAverage();
            sumaN += n.getAverage();
            varV += v.getStandardError() * v.getStandardError();
            varN += n.getStandardError() * n.getStandardError();
        }
        // la media de las medias, con todos los rivales pesando lo mismo
        int k = rivales.size();
        System.out.println("-".repeat(72));
        fila("MEDIA (" + k + ")", sumaV / k, Math.sqrt(varV) / k, sumaN / k, Math.sqrt(varN) / k, subirEsBueno, dec);
        System.out.printf("%s es mejor contra %d rivales, peor contra %d y no se distingue contra %d.%n",
                nueva, mejor, peor, k - mejor - peor);
    }

    /** Una fila: las dos medias, D, 2·ET_D y el veredicto. */
    static String fila(String rival, double mV, double etV, double mN, double etN, boolean subirEsBueno, int dec) {
        double d = mN - mV;
        double dosEtD = 2 * Math.sqrt(etV * etV + etN * etN);
        String veredicto = Math.abs(d) <= dosEtD ? "ruido" : (d > 0) == subirEsBueno ? "mejor" : "peor";
        String f = "%." + dec + "f";       // con los decimales que pide el error típico
        System.out.printf("%-14s %16s %16s %9s %8s  %s%n", rival,
                String.format(f + " ± " + f, mV, etV), String.format(f + " ± " + f, mN, etN),
                String.format("%+." + dec + "f", d), String.format(f, dosEtD), veredicto);
        return veredicto;
    }
}
