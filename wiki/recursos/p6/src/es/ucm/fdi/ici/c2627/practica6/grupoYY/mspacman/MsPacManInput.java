package es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman;

import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRQuery;
import es.ucm.fdi.ici.cbr.CBRInput;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Game;

/** Lo que Ms. Pac-Man mira del juego para buscar casos parecidos: la descripción de la consulta. */
public class MsPacManInput extends CBRInput {

    // Tope de las distancias: Interval(650) da similitud negativa a partir de 650 de diferencia,
    // y sin tope un fantasma en la cárcel (distancia infinita) hundiría la media de todo el caso.
    static final int DISTANCIA_MAX = 650;

    Integer nearestGhost;
    Boolean edible;
    Integer nearestPPill;
    Integer score;
    Integer time;

    public MsPacManInput(Game game) {
        super(game);
    }

    @Override
    public void parseInput() {
        computeNearestGhost(game);
        computeNearestPPill(game);
        time = game.getTotalTime();
        score = game.getScore();
    }

    @Override
    public CBRQuery getQuery() {
        MsPacManDescription description = new MsPacManDescription();
        description.setEdibleGhost(edible);
        description.setNearestGhost(nearestGhost);
        description.setNearestPPill(nearestPPill);
        description.setScore(score);
        description.setTime(time);

        CBRQuery query = new CBRQuery();
        query.setDescription(description);
        return query;
    }

    private void computeNearestGhost(Game game) {
        nearestGhost = DISTANCIA_MAX;
        edible = false;
        GHOST nearest = null;
        for (GHOST g : GHOST.values()) {
            int pos = game.getGhostCurrentNodeIndex(g);
            if (pos == -1 || game.getGhostLairTime(g) > 0)   // en la cárcel no cuenta
                continue;
            int distance = (int) game.getDistance(game.getPacmanCurrentNodeIndex(), pos, DM.PATH);
            if (distance < nearestGhost) {
                nearestGhost = distance;
                nearest = g;
            }
        }
        if (nearest != null)
            edible = game.isGhostEdible(nearest);
    }

    private void computeNearestPPill(Game game) {
        nearestPPill = DISTANCIA_MAX;
        for (int pos : game.getActivePowerPillsIndices()) {
            int distance = (int) game.getDistance(game.getPacmanCurrentNodeIndex(), pos, DM.PATH);
            if (distance < nearestPPill)
                nearestPPill = distance;
        }
    }
}
