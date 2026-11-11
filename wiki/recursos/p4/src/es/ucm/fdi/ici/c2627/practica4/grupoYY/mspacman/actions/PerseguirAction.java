package es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.Action;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Hacia el fantasma comestible más cercano. */
public class PerseguirAction implements Action {

    @Override
    public MOVE execute(Game game) {
        int pacman = game.getPacmanCurrentNodeIndex();
        int presa = -1, mejor = Integer.MAX_VALUE;
        for (GHOST g : GHOST.values()) {
            if (!game.isGhostEdible(g)) continue;
            int d = game.getShortestPathDistance(pacman, game.getGhostCurrentNodeIndex(g));
            if (d < mejor) { mejor = d; presa = game.getGhostCurrentNodeIndex(g); }
        }
        if (presa == -1) return MOVE.NEUTRAL;
        return game.getNextMoveTowardsTarget(pacman, presa, DM.PATH);
    }

    @Override
    public String getActionId() { return "perseguir"; }

    @Override
    public String toString() { return getActionId(); }
}
