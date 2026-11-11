package es.ucm.fdi.ici.c2627.practica4.grupoYY.ghosts;

import java.util.HashMap;

import es.ucm.fdi.ici.fuzzy.FuzzyInput;
import pacman.game.Constants.GHOST;
import pacman.game.Game;

/** Lo que ve un fantasma: a qué distancia está Ms. Pac-Man, y ella de su píldora de poder. */
public class GhostsInput extends FuzzyInput {

    public static final double LEJOS = 150;

    private final GHOST yo;
    private double pacman, ppill, comestible;

    public GhostsInput(Game game, GHOST yo) {
        super(game);
        this.yo = yo;
        parseInput();          // el constructor de FuzzyInput lo llama antes de saber quién soy: otra vez
    }

    @Override
    public void parseInput() {
        if (yo == null) return;
        int ella = game.getPacmanCurrentNodeIndex();
        pacman = game.getGhostLairTime(yo) > 0 ? LEJOS
                : Math.min(LEJOS, game.getShortestPathDistance(game.getGhostCurrentNodeIndex(yo), ella));
        ppill = LEJOS;
        for (int p : game.getActivePowerPillsIndices())
            ppill = Math.min(ppill, game.getShortestPathDistance(ella, p));
        comestible = game.getGhostEdibleTime(yo);    // turnos que me quedan de comestible; 0 si no lo soy
    }

    @Override
    public HashMap<String, Double> getFuzzyValues() {
        HashMap<String, Double> vars = new HashMap<>();
        vars.put("pacman", pacman);
        vars.put("ppill", ppill);
        vars.put("comestible", comestible);
        return vars;
    }
}
