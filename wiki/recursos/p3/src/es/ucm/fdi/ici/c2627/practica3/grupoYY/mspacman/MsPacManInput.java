package es.ucm.fdi.ici.c2627.practica3.grupoYY.mspacman;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import es.ucm.fdi.ici.rules.RulesInput;
import pacman.game.Constants.GHOST;
import pacman.game.Game;

public class MsPacManInput extends RulesInput {

    private static final int LEJOS = 1000;        // "no hay": ningún fantasma, ninguna píldora

    private int distFantasma;                     // al fantasma peligroso más cercano
    private int distPPill;                        // a la píldora de poder más cercana
    private List<String> fantasmas;               // un hecho FANTASMA por cada uno fuera de la cárcel
    private final String ultima;                  // la acción que ganó en el turno anterior

    public MsPacManInput(Game game, String ultima) {
        super(game);                              // llama a parseInput()
        this.ultima = ultima;
    }

    @Override
    public void parseInput() {
        int pacman = game.getPacmanCurrentNodeIndex();
        distFantasma = LEJOS;
        fantasmas = new ArrayList<>();
        for (GHOST g : GHOST.values()) {
            if (game.getGhostLairTime(g) > 0) continue;      // en la cárcel no cuenta
            int nodo = game.getGhostCurrentNodeIndex(g);
            boolean comestible = game.isGhostEdible(g);
            // peligroso: lo que tarda él en llegar a mí, que no puede dar la vuelta
            // comestible: lo que tardo yo en llegar a él
            int d = comestible
                    ? game.getShortestPathDistance(pacman, nodo)
                    : game.getShortestPathDistance(nodo, pacman, game.getGhostLastMoveMade(g));
            if (!comestible) distFantasma = Math.min(distFantasma, d);
            fantasmas.add(String.format("(FANTASMA (nombre %s) (comestible %s) (distancia %d) (tiempo %d))",
                    g, comestible, d, game.getGhostEdibleTime(g)));
        }
        distPPill = LEJOS;
        for (int ppill : game.getActivePowerPillsIndices())
            distPPill = Math.min(distPPill, game.getShortestPathDistance(pacman, ppill));
    }

    @Override
    public Collection<String> getFacts() {
        List<String> facts = new ArrayList<>(fantasmas);
        facts.add(String.format("(MSPACMAN (distFantasma %d) (distPPill %d) (ultima %s))",
                distFantasma, distPPill, ultima));
        return facts;
    }
}
