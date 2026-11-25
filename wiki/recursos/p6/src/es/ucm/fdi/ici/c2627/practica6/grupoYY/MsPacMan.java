package es.ucm.fdi.ici.c2627.practica6.grupoYY;

import es.ucm.fdi.gaia.jcolibri.exception.ExecutionException;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman.MsPacManCBRengine;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman.MsPacManInput;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman.MsPacManStorageManager;
import pacman.controllers.PacmanController;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class MsPacMan extends PacmanController {

    private final MsPacManCBRengine cbrEngine;
    private final MsPacManStorageManager storageManager;

    // Para Curva: cuánto tarda en decidir en los cruces, partida a partida
    private long nanosDecidiendo;
    private int decisiones;

    public MsPacMan() {
        this("mspacman", true);                  // la versión que va al concurso: aprende mientras juega
    }

    /**
     * baseDeCasos: la carpeta, dentro de cbrdata/grupoYY/, con un .csv por rival.
     * aprender: false para jugar sin escribir casos nuevos (Comparar, que juega en paralelo).
     */
    public MsPacMan(String baseDeCasos, boolean aprender) {
        this(baseDeCasos, aprender, true);
    }

    /**
     * planB: false para que, cuando ningún caso sirve, juegue al azar en vez de con vuestro plan B.
     * El concurso entrena con (base, true, false) y evalúa con (base, false, false), así que este
     * constructor tiene que seguir funcionando con la versión que entreguéis.
     */
    public MsPacMan(String baseDeCasos, boolean aprender, boolean planB) {
        setName("MsPacMan YY");
        setTeam("Grupo YY");
        storageManager = new MsPacManStorageManager();
        cbrEngine = new MsPacManCBRengine(storageManager, baseDeCasos, aprender, planB);
    }

    /** Antes de cada partida: lee la base de casos de este rival (el nombre de su clase). */
    @Override
    public void preCompute(String opponent) {
        nanosDecidiendo = 0;
        decisiones = 0;
        cbrEngine.setOpponent(opponent);
        try {
            cbrEngine.configure();
            cbrEngine.preCycle();
        } catch (ExecutionException e) {
            e.printStackTrace();
        }
    }

    /** Al acabar la partida: revisa los casos pendientes y escribe los nuevos en el .csv. */
    @Override
    public void postCompute() {
        try {
            cbrEngine.postCycle();
        } catch (ExecutionException e) {
            e.printStackTrace();
        }
    }

    @Override
    public MOVE getMove(Game game, long timeDue) {
        // Sólo se decide en los cruces: entre cruce y cruce NEUTRAL hace que siga recto.
        // Por eso cada caso es una decisión en un cruce, y la base no se llena de pasillos.
        if (!game.isJunction(game.getPacmanCurrentNodeIndex()))
            return MOVE.NEUTRAL;

        long inicio = System.nanoTime();
        try {
            MsPacManInput input = new MsPacManInput(game);
            input.parseInput();
            storageManager.setGame(game);
            cbrEngine.setGame(game);
            cbrEngine.cycle(input.getQuery());
            return cbrEngine.getSolution();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            nanosDecidiendo += System.nanoTime() - inicio;
            decisiones++;
        }
        return MOVE.NEUTRAL;
    }

    /** Casos en la base. Después de postCompute ya incluye los de la partida que acaba de terminar. */
    public int getCaseBaseSize() {
        return cbrEngine.getCaseBaseSize();
    }

    /** Milisegundos de media por decisión (sólo en los cruces) en la última partida. */
    public double msPorDecision() {
        return decisiones == 0 ? 0 : nanosDecidiendo / 1e6 / decisiones;
    }
}
