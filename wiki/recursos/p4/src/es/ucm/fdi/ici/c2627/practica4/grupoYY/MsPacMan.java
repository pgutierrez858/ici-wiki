package es.ucm.fdi.ici.c2627.practica4.grupoYY;

import es.ucm.fdi.ici.Action;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.MsPacManInput;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions.ComerAction;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions.HuirAction;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions.IrAPPillAction;
import es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman.actions.PerseguirAction;
import es.ucm.fdi.ici.fuzzy.FuzzyEngine;
import pacman.controllers.PacmanController;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

public class MsPacMan extends PacmanController {

    // Una ruta del disco, no del classpath: Eclipse copia el .fcl a bin/ y lanza desde la carpeta del proyecto
    static final String FCL_PATH = "bin/es/ucm/fdi/ici/c2627/practica4/grupoYY/";

    private final FuzzyEngine motor;

    public MsPacMan() {
        this("mspacman-v0.fcl");                 // la versión que va al concurso
    }

    /** Cada versión, un .fcl distinto, con el mismo Input y las mismas acciones. */
    public MsPacMan(String ficheroFcl) {
        setName("MsPacMan YY");
        setTeam("Grupo YY");
        Action[] acciones = { new ComerAction(), new HuirAction(), new IrAPPillAction(), new PerseguirAction() };
        motor = new FuzzyEngine("MSPACMAN", FCL_PATH + ficheroFcl, "MsPacMan", new MaxActionSelector(acciones));
    }

    /** Para engancharle un observador desde fuera. */
    public FuzzyEngine getMotor() { return motor; }

    @Override
    public MOVE getMove(Game game, long timeDue) {
        return motor.run(new MsPacManInput(game).getFuzzyValues(), game);
    }
}
