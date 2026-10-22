package es.ucm.fdi.ici.c2627.practica3.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.rules.RulesAction;
import jess.Fact;
import jess.JessException;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Hacia el fantasma que diga la regla, en el slot "fantasma" del ACTION. */
public class PerseguirAction implements RulesAction {

    private GHOST presa;

    @Override
    public void parseFact(Fact actionFact) {
        try {
            presa = GHOST.valueOf(actionFact.getSlotValue("fantasma").stringValue(null));
        } catch (JessException | IllegalArgumentException e) {
            presa = null;                          // la regla no dijo a quién
        }
    }

    @Override
    public MOVE execute(Game game) {
        if (presa == null) return MOVE.NEUTRAL;
        return game.getNextMoveTowardsTarget(game.getPacmanCurrentNodeIndex(),
                game.getGhostCurrentNodeIndex(presa), DM.PATH);
    }

    @Override
    public String getActionId() { return "perseguir"; }
}
