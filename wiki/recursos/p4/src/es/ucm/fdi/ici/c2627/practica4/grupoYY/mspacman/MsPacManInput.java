package es.ucm.fdi.ici.c2627.practica4.grupoYY.mspacman;

import java.util.HashMap;

import es.ucm.fdi.ici.fuzzy.FuzzyInput;
import pacman.game.Constants.GHOST;
import pacman.game.Game;

/**
 * Tres distancias, en pasos de camino, recortadas a LEJOS. Lo que no existe
 * (ningún fantasma comestible, ninguna píldora de poder) vale LEJOS, nunca -1:
 * un -1 caería fuera de los términos y valdría "cerca".
 */
public class MsPacManInput extends FuzzyInput {

    public static final double LEJOS = 150;

    private double peligro, comestible, ppill;

    public MsPacManInput(Game game) {
        super(game);                               // llama a parseInput()
    }

    @Override
    public void parseInput() {
        int yo = game.getPacmanCurrentNodeIndex();
        peligro = LEJOS;
        comestible = LEJOS;
        for (GHOST g : GHOST.values()) {
            if (game.getGhostLairTime(g) > 0) continue;
            double d = game.getShortestPathDistance(yo, game.getGhostCurrentNodeIndex(g));
            if (game.isGhostEdible(g)) comestible = Math.min(comestible, d);
            else peligro = Math.min(peligro, d);
        }
        ppill = LEJOS;
        for (int p : game.getActivePowerPillsIndices())
            ppill = Math.min(ppill, game.getShortestPathDistance(yo, p));
    }

    @Override
    public HashMap<String, Double> getFuzzyValues() {
        HashMap<String, Double> vars = new HashMap<>();   // la clave = el nombre en VAR_INPUT
        vars.put("peligro", peligro);
        vars.put("comestible", comestible);
        vars.put("ppill", ppill);
        return vars;
    }
}
