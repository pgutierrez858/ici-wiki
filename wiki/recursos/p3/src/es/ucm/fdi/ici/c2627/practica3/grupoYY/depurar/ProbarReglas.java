package es.ucm.fdi.ici.c2627.practica3.grupoYY.depurar;

import java.util.Iterator;

import jess.Fact;
import jess.JessException;
import jess.Rete;

/**
 * Prueba las reglas sin jugar: se escribe una situación a mano, como hechos,
 * y se mira qué ACTION gana. Cada caso es una pregunta con su respuesta esperada.
 */
public class ProbarReglas {

    static final String REGLAS = "es/ucm/fdi/ici/c2627/practica3/grupoYY/mspacman-v1.clp";
    static int fallos = 0;

    public static void main(String[] args) throws JessException {
        Rete jess = new Rete();
        jess.batch(REGLAS);
        jess.eval("(watch rules)");           // Jess escribe cada regla que dispara

        caso(jess, "nada cerca: come", "comer",
                "(MSPACMAN (distFantasma 80) (distPPill 40) (ultima comer))");

        caso(jess, "fantasma a 15: huye", "huir",
                "(MSPACMAN (distFantasma 15) (distPPill 40) (ultima comer))");

        caso(jess, "a 25 sin venir huyendo: come", "comer",
                "(MSPACMAN (distFantasma 25) (distPPill 40) (ultima comer))");

        caso(jess, "a 25 viniendo de huir: sigue huyendo", "huir",
                "(MSPACMAN (distFantasma 25) (distPPill 40) (ultima huir))");

        caso(jess, "fantasma a 15 y PPill a 5: a la PPill", "irAPPill",
                "(MSPACMAN (distFantasma 15) (distPPill 5) (ultima huir))");

        caso(jess, "comestible a 30 pero un peligroso a 15: huye", "huir",
                "(FANTASMA (nombre PINKY) (comestible true) (distancia 30) (tiempo 100))",
                "(FANTASMA (nombre SUE) (comestible false) (distancia 15) (tiempo 0))",
                "(MSPACMAN (distFantasma 15) (distPPill 1000) (ultima comer))");

        caso(jess, "comestible a 30 con tiempo: lo caza", "perseguir",
                "(MSPACMAN (distFantasma 1000) (distPPill 1000) (ultima comer))",
                "(FANTASMA (nombre PINKY) (comestible true) (distancia 30) (tiempo 100))");

        caso(jess, "comestible a 5 y otro peligroso a 15: lo remata", "perseguir",
                "(MSPACMAN (distFantasma 15) (distPPill 1000) (ultima huir))",
                "(FANTASMA (nombre PINKY) (comestible true) (distancia 5) (tiempo 100))",
                "(FANTASMA (nombre SUE) (comestible false) (distancia 15) (tiempo 0))");

        System.out.println(fallos == 0 ? "\nTodos los casos bien." : "\n" + fallos + " casos MAL.");
    }

    static void caso(Rete jess, String nombre, String esperada, String... hechos) throws JessException {
        System.out.println("\n--- " + nombre);
        jess.reset();
        for (String h : hechos) jess.assertString(h);
        jess.run();

        Fact gana = null;                       // lo mismo que hace RuleEngine: la de más priority
        for (Iterator<?> it = jess.listFacts(); it.hasNext(); ) {
            Fact f = (Fact) it.next();
            if (f.getName().equals("MAIN::ACTION") && (gana == null
                    || f.getSlotValue("priority").intValue(null) > gana.getSlotValue("priority").intValue(null)))
                gana = f;
        }
        String id = gana == null ? "(ninguna)" : gana.getSlotValue("id").toString();
        boolean bien = id.equals(esperada);
        if (!bien) fallos++;
        System.out.printf("%s  gana %s, esperaba %s%n", bien ? "BIEN" : "MAL ", id, esperada);
    }
}
