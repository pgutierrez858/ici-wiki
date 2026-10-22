import java.util.EnumMap;
import java.util.Random;

import pacman.controllers.GhostController;
import pacman.game.Constants.GHOST;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** El rival más tonto: cada fantasma, en cada cruce, por donde caiga. */
public final class GhostsRandom extends GhostController {

    private final EnumMap<GHOST, MOVE> moves = new EnumMap<>(GHOST.class);
    private final MOVE[] allMoves = MOVE.values();
    private final Random rnd = new Random();

    @Override
    public EnumMap<GHOST, MOVE> getMove(Game game, long timeDue) {
        moves.clear();
        for (GHOST g : GHOST.values())
            if (game.doesGhostRequireAction(g))
                moves.put(g, allMoves[rnd.nextInt(allMoves.length)]);
        return moves;
    }
}
