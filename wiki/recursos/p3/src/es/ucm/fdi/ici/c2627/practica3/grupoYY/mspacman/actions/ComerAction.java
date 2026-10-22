package es.ucm.fdi.ici.c2627.practica3.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.rules.RulesAction;
import jess.Fact;
import pacman.game.Constants.DM;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Hacia la píldora normal más cercana; si ya no quedan, hacia la de poder. */
public class ComerAction implements RulesAction {

    @Override
    public MOVE execute(Game game) {
        int pacman = game.getPacmanCurrentNodeIndex();
        int[] pildoras = game.getActivePillsIndices();
        if (pildoras.length == 0) pildoras = game.getActivePowerPillsIndices();
        if (pildoras.length == 0) return MOVE.NEUTRAL;
        int objetivo = game.getClosestNodeIndexFromNodeIndex(pacman, pildoras, DM.PATH);
        return game.getNextMoveTowardsTarget(pacman, objetivo, DM.PATH);
    }

    @Override
    public void parseFact(Fact actionFact) { }   // no tiene parámetros

    @Override
    public String getActionId() { return "comer"; }
}
