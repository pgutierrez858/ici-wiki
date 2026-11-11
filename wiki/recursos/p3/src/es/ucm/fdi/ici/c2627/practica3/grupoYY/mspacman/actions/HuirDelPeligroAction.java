package es.ucm.fdi.ici.c2627.practica3.grupoYY.mspacman.actions;

import es.ucm.fdi.ici.c2627.practica3.grupoYY.mspacman.MsPacManInput;
import es.ucm.fdi.ici.rules.RulesAction;
import jess.Fact;
import pacman.game.Constants.DM;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Lejos del mismo fantasma que han visto las reglas: lo lee del Input, no lo recalcula. */
public class HuirDelPeligroAction implements RulesAction {

    private MsPacManInput input;

    /** El controlador se lo da en cada turno, antes de lanzar el motor. */
    public void setInput(MsPacManInput input) { this.input = input; }

    @Override
    public MOVE execute(Game game) {
        int peligro = input.getNodoPeligro();
        if (peligro == -1) return MOVE.NEUTRAL;
        return game.getNextMoveAwayFromTarget(game.getPacmanCurrentNodeIndex(), peligro, DM.PATH);
    }

    @Override
    public void parseFact(Fact actionFact) { }

    @Override
    public String getActionId() { return "huirDelPeligro"; }
}
