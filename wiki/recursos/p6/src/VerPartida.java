import es.ucm.fdi.ici.c2627.practica6.grupoYY.MsPacMan;
import pacman.Executor;

/** Una partida en pantalla contra los fantasmas agresivos. Aprende: al acabar, la base tiene los casos de esta partida. */
public class VerPartida {

    public static void main(String[] args) {
        Executor executor = new Executor.Builder()
                .setTickLimit(4000)
                .setVisual(true)
                .setScaleFactor(3.0)
                .build();

        executor.runGame(new MsPacMan(), new GhostsAggressive(), 40);   // 40 ms por turno: más, para verlo despacio
    }
}
