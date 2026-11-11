import java.util.EnumMap;

import pacman.controllers.GhostController;
import pacman.game.Constants.DM;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** Los cuatro, siempre a por Ms. Pac-Man por el camino más corto. */
public final class GhostsAggressive extends GhostController {

    private final EnumMap<GHOST, MOVE> moves = new EnumMap<>(GHOST.class);

    @Override
    public EnumMap<GHOST, MOVE> getMove(Game game, long timeDue) {
        moves.clear();
        int pacman = game.getPacmanCurrentNodeIndex();
        for (GHOST g : GHOST.values())
            if (game.doesGhostRequireAction(g))
                moves.put(g, game.getApproximateNextMoveTowardsTarget(game.getGhostCurrentNodeIndex(g),
                        pacman, game.getGhostLastMoveMade(g), DM.PATH));
        return moves;
    }
}
