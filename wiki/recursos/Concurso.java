// Concurso.java  ·  va en la raiz de src/, al lado de config.properties.

import java.io.IOException;
import java.io.PrintWriter;
import java.util.Vector;

import es.ucm.fdi.ici.PacManParallelEvaluator;
import es.ucm.fdi.ici.Scores;
import pacman.game.GameView;
import pacman.game.util.Stats;

/**
 * El concurso: cada Ms. Pac-Man contra los fantasmas de toda la clase, y al reves.
 *
 * Quien juega y cuantas partidas se juegan esta en src/config.properties. Este
 * programa solo lanza el evaluador y hace las cuentas de las que habla la guia
 * "Probar los controladores y la competicion":
 *
 *   1. la media de cada controlador es la media de su fila (o de su columna);
 *   2. el error tipico dice cuanto puede bailar esa media;
 *   3. el punto extra se reparte entre el mejor y el peor de cada ranking.
 *
 * Deja ademas un CSV con la tabla entera para abrirlo en una hoja de calculo.
 *
 * Ingeniería de Comportamientos Inteligentes
 * Facultad de Informática, Universidad Complutense de Madrid
 * Curso 2026 – 2027
 *
 * @author Pablo Gutiérrez Sánchez
 */
public class Concurso {

    /** Lo que reparte cada uno de los dos rankings: medio punto cada uno. */
    private static final double PUNTOS_POR_RANKING = 0.5;

    private static final String CSV = "concurso-practica0.csv";

    public static void main(String[] args) throws IOException {

        long empezado = System.currentTimeMillis();

        vaciarLoQuePintanLosControladores();

        // Todos contra todos. Esto es lo unico que hace falta para jugar el concurso:
        // el evaluador lee config.properties, carga las clases y reparte los
        // emparejamientos entre todos los nucleos de la maquina menos uno.
        PacManParallelEvaluator evaluador = new PacManParallelEvaluator();
        Scores scores = evaluador.evaluate();

        Vector<String> pacmans = scores.getList_pacMan();
        Vector<String> fantasmas = scores.getList_ghosts();
        Stats[][] tabla = scores.getStats();

        // La media de un controlador es la media de todas sus partidas. Como todas
        // las casillas tienen el mismo numero de partidas, da igual promediar las
        // medias o juntar todas las partidas: aqui se juntan, porque asi sale
        // tambien la desviacion tipica y con ella el error tipico.
        Stats[] deCadaPacMan = new Stats[pacmans.size()];
        for (int p = 0; p < pacmans.size(); p++) {
            deCadaPacMan[p] = new Stats(pacmans.get(p));
            for (int g = 0; g < fantasmas.size(); g++) {
                deCadaPacMan[p].add(tabla[p][g]);
            }
        }

        Stats[] deCadaFantasmas = new Stats[fantasmas.size()];
        for (int g = 0; g < fantasmas.size(); g++) {
            deCadaFantasmas[g] = new Stats(fantasmas.get(g));
            for (int p = 0; p < pacmans.size(); p++) {
                deCadaFantasmas[g].add(tabla[p][g]);
            }
        }

        escribirCsv(pacmans, fantasmas, tabla, deCadaPacMan, deCadaFantasmas);

        System.out.println();
        System.out.println("=======================================================================");
        System.out.println("  CONCURSO DE LA PRACTICA 0");
        System.out.println("=======================================================================");

        // En Ms. Pac-Man gana la media MAS ALTA; en fantasmas, la MAS BAJA: es el
        // mismo numero leido al reves, porque lo que hacen los fantasmas es que la
        // gente no puntue.
        ranking("RANKING DE Ms. PAC-MAN   (gana quien mas puntua)", deCadaPacMan, true);
        ranking("RANKING DE FANTASMAS     (gana quien menos deja puntuar)", deCadaFantasmas, false);
        totales(pacmans, deCadaPacMan, fantasmas, deCadaFantasmas);

        long segundos = (System.currentTimeMillis() - empezado) / 1000;
        int partidas = deCadaPacMan[0].getN() * pacmans.size();
        System.out.println();
        System.out.printf("Partidas jugadas: %d   |   Tiempo: %d min %02d s   |   %.1f ms por partida%n",
                partidas, segundos / 60, segundos % 60, (segundos * 1000.0) / partidas);
        System.out.println("Tabla completa en " + CSV);
    }

    /**
     * Sin esto, 44.100 partidas se quedan sin memoria. El motivo:
     *
     * GameView guarda en dos listas ESTATICAS todo lo que los controladores pintan
     * con addPoints() y addLines(), y solo las vacia cuando repinta la ventana. En
     * un experimento sin ventana no repinta nunca, asi que las listas crecen sin
     * parar. Y no sirve de nada que no haya ventana: el interruptor que deberia
     * apagarlo, GameView.isVisible, esta puesto a true y no lo pone a false nadie.
     *
     * Como el simulador no se toca, las vaciamos desde fuera cada decima de segundo.
     * Son listas de dibujo: vaciarlas no cambia ni una partida.
     *
     * La leccion para vuestros controladores: las llamadas a GameView tienen que ir
     * detras de un interruptor que se apague al entregar. No son gratis.
     */
    private static void vaciarLoQuePintanLosControladores() {
        Thread limpiador = new Thread(new Runnable() {
            public void run() {
                while (true) {
                    GameView.debugPointers.clear();
                    GameView.debugLines.clear();
                    try {
                        Thread.sleep(100);
                    } catch (InterruptedException e) {
                        return;
                    }
                }
            }
        });
        limpiador.setName("vaciar-GameView");
        limpiador.setDaemon(true);
        limpiador.start();
    }

    // ------------------------------------------------------------------ rankings

    private static void ranking(String titulo, Stats[] resultados, boolean masEsMejor) {
        Stats[] orden = ordenar(resultados, masEsMejor);
        double mejor = media(orden[0]);
        double peor = media(orden[orden.length - 1]);

        System.out.println();
        System.out.println(titulo);
        System.out.println("-----------------------------------------------------------------------");
        System.out.println("  #  controlador                 media    error tipico     medio punto");

        for (int i = 0; i < orden.length; i++) {
            System.out.printf("%3d  %-24s %8.1f   +/- %6.1f %13.2f%n",
                    i + 1,
                    recorta(orden[i].getDescription()),
                    media(orden[i]),
                    orden[i].getStandardError(),
                    medioPunto(media(orden[i]), mejor, peor));
        }
    }

    /**
     * El medio punto del ranking, tal y como esta definido en la guia: el mejor se
     * lo lleva entero, el peor se queda a cero, y los de en medio en proporcion.
     *
     * La misma formula vale para los dos rankings sin tocar nada. En fantasmas
     * "mejor" es la media mas baja, asi que el numerador y el denominador cambian
     * de signo a la vez y el resultado sale igual de bien.
     */
    private static double medioPunto(double mia, double mejor, double peor) {
        if (mejor == peor) {
            return PUNTOS_POR_RANKING;   // todos empatados: todos se lo llevan
        }
        double punto = PUNTOS_POR_RANKING * (mia - peor) / (mejor - peor);
        // El peor de los fantasmas da 0 dividido por un numero negativo, que en
        // coma flotante es -0.0 y se imprime como "-0,00". Cero es cero.
        return punto == 0.0 ? 0.0 : punto;
    }

    private static void totales(Vector<String> pacmans, Stats[] deCadaPacMan,
                                Vector<String> fantasmas, Stats[] deCadaFantasmas) {

        Stats[] ordenPac = ordenar(deCadaPacMan, true);
        Stats[] ordenFan = ordenar(deCadaFantasmas, false);
        double mejorPac = media(ordenPac[0]), peorPac = media(ordenPac[ordenPac.length - 1]);
        double mejorFan = media(ordenFan[0]), peorFan = media(ordenFan[ordenFan.length - 1]);

        System.out.println();
        System.out.println("PUNTO EXTRA POR ALUMNO   (medio punto de cada ranking)");
        System.out.println("-----------------------------------------------------------------------");
        System.out.println("     alumno                   Ms. Pac-Man   fantasmas          total");

        for (int p = 0; p < pacmans.size(); p++) {
            String alumno = pacmans.get(p);
            int g = fantasmas.indexOf(alumno);
            if (g == -1) {
                continue;   // no tiene fantasmas con el mismo nombre: no hay total
            }
            double unPunto = medioPunto(media(deCadaPacMan[p]), mejorPac, peorPac);
            double otro = medioPunto(media(deCadaFantasmas[g]), mejorFan, peorFan);
            System.out.printf("     %-24s %8.2f %11.2f %14.2f%n",
                    recorta(alumno), unPunto, otro, unPunto + otro);
        }
    }

    // --------------------------------------------------------------------- csv

    private static void escribirCsv(Vector<String> pacmans, Vector<String> fantasmas,
                                    Stats[][] tabla, Stats[] deCadaPacMan,
                                    Stats[] deCadaFantasmas) throws IOException {

        PrintWriter out = new PrintWriter(CSV, "UTF-8");
        try {
            out.print("Ms. Pac-Man \\ Fantasmas");
            for (String f : fantasmas) {
                out.print(";" + f);
            }
            out.println(";MEDIA;error tipico");

            for (int p = 0; p < pacmans.size(); p++) {
                out.print(pacmans.get(p));
                for (int g = 0; g < fantasmas.size(); g++) {
                    out.printf(";%.1f", media(tabla[p][g]));
                }
                out.printf(";%.1f;%.1f%n", media(deCadaPacMan[p]), deCadaPacMan[p].getStandardError());
            }

            out.print("MEDIA");
            for (int g = 0; g < fantasmas.size(); g++) {
                out.printf(";%.1f", media(deCadaFantasmas[g]));
            }
            out.println();

            out.print("error tipico");
            for (int g = 0; g < fantasmas.size(); g++) {
                out.printf(";%.1f", deCadaFantasmas[g].getStandardError());
            }
            out.println();
        } finally {
            out.close();
        }
    }

    // ---------------------------------------------------------------- auxiliares

    /** Una casilla que no llego a jugarse tiene media NaN: cuenta como cero. */
    private static double media(Stats s) {
        double m = s.getAverage();
        return Double.isNaN(m) ? 0.0 : m;
    }

    private static Stats[] ordenar(Stats[] resultados, final boolean masEsMejor) {
        Stats[] copia = resultados.clone();
        for (int i = 1; i < copia.length; i++) {          // insercion: son 21, sobra
            Stats actual = copia[i];
            int j = i - 1;
            while (j >= 0 && peorQue(copia[j], actual, masEsMejor)) {
                copia[j + 1] = copia[j];
                j--;
            }
            copia[j + 1] = actual;
        }
        return copia;
    }

    private static boolean peorQue(Stats a, Stats b, boolean masEsMejor) {
        return masEsMejor ? media(a) < media(b) : media(a) > media(b);
    }

    private static String recorta(String nombre) {
        return nombre.length() <= 24 ? nombre : nombre.substring(0, 23) + ".";
    }
}
