package es.ucm.fdi.ici.c2627.practica3.grupoYY;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;

import es.ucm.fdi.ici.c2627.practica3.grupoYY.ghosts.GhostsInput;
import es.ucm.fdi.ici.c2627.practica3.grupoYY.ghosts.actions.HuirAction;
import es.ucm.fdi.ici.c2627.practica3.grupoYY.ghosts.actions.PerseguirAction;
import es.ucm.fdi.ici.rules.RuleEngine;
import es.ucm.fdi.ici.rules.RulesAction;
import pacman.controllers.GhostController;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class Ghosts extends GhostController {

    private static final String RULES_PATH = "es/ucm/fdi/ici/c2627/practica3/grupoYY/";

    private final EnumMap<GHOST, RuleEngine> motores = new EnumMap<>(GHOST.class);

    public Ghosts() {
        this("ghosts-v1.clp");                    // la versión que va al concurso
    }

    public Ghosts(String ficheroReglas) {
        setName("Ghosts YY");
        setTeam("Grupo YY");
        for (GHOST g : GHOST.values()) {
            HashMap<String, RulesAction> acciones = new HashMap<>();   // las de ESTE fantasma
            for (RulesAction a : new RulesAction[] { new PerseguirAction(g), new HuirAction(g) })
                acciones.put(a.getActionId(), a);
            motores.put(g, new RuleEngine(g.name(), RULES_PATH + ficheroReglas, acciones));
        }
    }

    public RuleEngine getMotor(GHOST g) { return motores.get(g); }

    @Override
    public EnumMap<GHOST, MOVE> getMove(Game game, long timeDue) {
        GhostsInput input = new GhostsInput(game);               // una vez para los cuatro
        EnumMap<GHOST, MOVE> movimientos = new EnumMap<>(GHOST.class);
        for (GHOST g : GHOST.values()) {
            if (!game.doesGhostRequireAction(g)) continue;       // fuera de los cruces no hay nada que decidir
            RuleEngine motor = motores.get(g);
            motor.reset();
            motor.assertFacts(input.getFacts());
            motor.assertFacts(List.of("(YO (nombre " + g + "))"));
            movimientos.put(g, motor.run(game));
        }
        return movimientos;
    }
}
