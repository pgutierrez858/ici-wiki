package es.ucm.fdi.ici.c2627.practica3.grupoYY.ghosts;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import es.ucm.fdi.ici.rules.RulesInput;
import pacman.game.Constants.GHOST;
import pacman.game.Game;

public class GhostsInput extends RulesInput {

    private List<String> facts;

    public GhostsInput(Game game) { super(game); }

    @Override
    public void parseInput() {
        facts = new ArrayList<>();
        int pacman = game.getPacmanCurrentNodeIndex();
        for (GHOST g : GHOST.values()) {
            boolean enCarcel = game.getGhostLairTime(g) > 0;
            int d = enCarcel ? 1000 : game.getShortestPathDistance(game.getGhostCurrentNodeIndex(g), pacman,
                    game.getGhostLastMoveMade(g));
            facts.add(String.format("(FANTASMA (nombre %s) (comestible %s) (enCarcel %s) (distPacman %d))",
                    g, game.isGhostEdible(g), enCarcel, d));
        }
        int distPPill = 1000;
        for (int ppill : game.getActivePowerPillsIndices())
            distPPill = Math.min(distPPill, game.getShortestPathDistance(pacman, ppill));
        facts.add(String.format("(MSPACMAN (distPPill %d))", distPPill));
    }

    @Override
    public Collection<String> getFacts() { return facts; }
}
