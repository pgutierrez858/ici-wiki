package es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman;

import java.util.Vector;

import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCaseBase;
import es.ucm.fdi.gaia.jcolibri.method.retain.StoreCasesMethod;
import pacman.game.Game;

/**
 * Revisar y retener. Lo bueno o malo de una decisión no se sabe en el momento:
 * cada caso espera en un búfer TIME_WINDOW cruces, y entonces se puntúa con los
 * puntos ganados desde que se tomó y se guarda.
 */
public class MsPacManStorageManager {

    private final static int TIME_WINDOW = 3;

    Game game;
    CBRCaseBase caseBase;
    Vector<CBRCase> buffer;

    public MsPacManStorageManager() {
        this.buffer = new Vector<CBRCase>();
    }

    public void setGame(Game game) {
        this.game = game;
    }

    public void setCaseBase(CBRCaseBase caseBase) {
        this.caseBase = caseBase;
    }

    public void reviseAndRetain(CBRCase newCase) {
        buffer.add(newCase);

        if (buffer.size() < TIME_WINDOW)        // todavía es pronto para puntuar el más viejo
            return;

        CBRCase bCase = buffer.remove(0);
        reviseCase(bCase);
        retainCase(bCase);
    }

    /** El resultado del caso: los puntos ganados desde que se decidió hasta ahora. */
    private void reviseCase(CBRCase bCase) {
        MsPacManDescription description = (MsPacManDescription) bCase.getDescription();
        int oldScore = description.getScore();
        int currentScore = game.getScore();
        int resultValue = currentScore - oldScore;

        MsPacManResult result = (MsPacManResult) bCase.getResult();
        result.setScore(resultValue);
    }

    /** Se guardan todos. Aquí es donde se decidiría no guardar los repetidos o los que no aportan. */
    private void retainCase(CBRCase bCase) {
        // Va a la base en memoria; CachedLinearCaseBase lo escribe en el .csv al acabar la partida
        StoreCasesMethod.storeCase(caseBase, bCase);
    }

    /** Al acabar la partida, los que quedan en el búfer se puntúan con lo que hayan llegado a ganar. */
    public void close() {
        for (CBRCase oldCase : buffer) {
            reviseCase(oldCase);
            retainCase(oldCase);
        }
        buffer.removeAllElements();
    }

    public int getPendingCases() {
        return buffer.size();
    }
}
