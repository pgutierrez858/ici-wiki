package es.ucm.fdi.ici.c2627.practica4.grupoYY.ghosts.actions;

import es.ucm.fdi.ici.Action;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class HuirAction implements Action {

    private final GHOST yo;

    public HuirAction(GHOST yo) { this.yo = yo; }

    @Override
    public MOVE execute(Game game) {
        return game.getApproximateNextMoveAwayFromTarget(game.getGhostCurrentNodeIndex(yo),
                game.getPacmanCurrentNodeIndex(), game.getGhostLastMoveMade(yo), DM.PATH);
    }

    @Override
    public String getActionId() { return "huir"; }

    @Override
    public String toString() { return yo + " " + getActionId(); }
}
