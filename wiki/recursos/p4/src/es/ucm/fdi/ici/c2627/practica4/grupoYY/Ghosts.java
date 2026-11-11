package es.ucm.fdi.ici.c2627.practica4.grupoYY;

import java.util.EnumMap;

import es.ucm.fdi.ici.Action;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.ghosts.GhostsInput;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.ghosts.actions.HuirAction;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.ghosts.actions.PerseguirAction;
import es.ucm.fdi.ici.fuzzy.FuzzyEngine;
import pacman.controllers.GhostController;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class Ghosts extends GhostController {

    private final EnumMap<GHOST, FuzzyEngine> motores = new EnumMap<>(GHOST.class);

    public Ghosts() {
        this("ghosts-v0.fcl");                    // la versión que va al concurso
    }

    /** Un motor por fantasma, todos con el mismo .fcl: cada uno con sus acciones y sus valores. */
    public Ghosts(String ficheroFcl) {
        setName("Ghosts YY");
        setTeam("Grupo YY");
        for (GHOST g : GHOST.values()) {
            Action[] acciones = { new PerseguirAction(g), new HuirAction(g) };
            motores.put(g, new FuzzyEngine(g.name(), MsPacMan.FCL_PATH + ficheroFcl, "Ghost",
                    new MaxActionSelector(acciones)));
        }
    }

    public FuzzyEngine getMotor(GHOST g) { return motores.get(g); }

    @Override
    public EnumMap<GHOST, MOVE> getMove(Game game, long timeDue) {
        EnumMap<GHOST, MOVE> movimientos = new EnumMap<>(GHOST.class);
        for (GHOST g : GHOST.values()) {
            if (!game.doesGhostRequireAction(g)) continue;       // fuera de los cruces no hay nada que decidir
            movimientos.put(g, motores.get(g).run(new GhostsInput(game, g).getFuzzyValues(), game));
        }
        return movimientos;
    }
}
