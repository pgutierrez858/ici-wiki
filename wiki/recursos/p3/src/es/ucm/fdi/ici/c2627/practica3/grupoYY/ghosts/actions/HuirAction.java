package es.ucm.fdi.ici.c2627.practica3.grupoYY.ghosts.actions;

import es.ucm.fdi.ici.rules.RulesAction;
import jess.Fact;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class HuirAction implements RulesAction {

    private final GHOST yo;

    public HuirAction(GHOST yo) { this.yo = yo; }

    @Override
    public MOVE execute(Game game) {
        return game.getApproximateNextMoveAwayFromTarget(game.getGhostCurrentNodeIndex(yo),
                game.getPacmanCurrentNodeIndex(), game.getGhostLastMoveMade(yo), DM.PATH);
    }

    @Override
    public void parseFact(Fact actionFact) { }

    @Override
    public String getActionId() { return "huir"; }
}
