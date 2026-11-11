package es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.Action;
import pacman.game.Constants.DM;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Hacia la píldora de poder más cercana. */
public class IrAPPillAction implements Action {

    @Override
    public MOVE execute(Game game) {
        int pacman = game.getPacmanCurrentNodeIndex();
        int[] ppills = game.getActivePowerPillsIndices();
        if (ppills.length == 0) return MOVE.NEUTRAL;
        int objetivo = game.getClosestNodeIndexFromNodeIndex(pacman, ppills, DM.PATH);
        return game.getNextMoveTowardsTarget(pacman, objetivo, DM.PATH);
    }

    @Override
    public String getActionId() { return "irAPPill"; }

    @Override
    public String toString() { return getActionId(); }
}
