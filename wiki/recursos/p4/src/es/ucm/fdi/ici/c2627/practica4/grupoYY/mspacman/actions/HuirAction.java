package es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.Action;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Lejos del fantasma peligroso más cercano. */
public class HuirAction implements Action {

    @Override
    public MOVE execute(Game game) {
        int pacman = game.getPacmanCurrentNodeIndex();
        int masCercano = -1, mejor = Integer.MAX_VALUE;
        for (GHOST g : GHOST.values()) {
            if (game.isGhostEdible(g) || game.getGhostLairTime(g) > 0) continue;
            int d = game.getShortestPathDistance(pacman, game.getGhostCurrentNodeIndex(g));
            if (d < mejor) { mejor = d; masCercano = game.getGhostCurrentNodeIndex(g); }
        }
        if (masCercano == -1) return MOVE.NEUTRAL;
        return game.getNextMoveAwayFromTarget(pacman, masCercano, DM.PATH);
    }

    @Override
    public String getActionId() { return "huir"; }      // = el nombre de su VAR_OUTPUT

    @Override
    public String toString() { return getActionId(); }  // lo que escribe el observador
}
