package es.ucm.fdi.ici.c2627.practica3.grupoYY.depurar;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import es.ucm.fdi.ici.rules.RuleEngine;
import es.ucm.fdi.ici.rules.RuleEngineObserver;
import jess.Activation;
import jess.Defrule;
import jess.JessEvent;
import jess.JessException;
import jess.JessListener;
import jess.Rete;

/**
 * Cuenta qué reglas se disparan en cada turno, qué ACTION gana, y al final
 * cuántas veces se ha disparado cada regla. Sólo para depurar: no la entreguéis
 * enganchada, que imprime mucho y va más lento.
 */
public class TrazaReglas implements JessListener, RuleEngineObserver {

    private final String nombre;
    private final boolean soloCambios;      // true: sólo imprime cuando cambia la acción ganadora
    private final Rete jess;

    private final List<String> esteTurno = new ArrayList<>();
    private final Map<String, Integer> vecesRegla = new TreeMap<>();
    private final Map<String, Integer> vecesGana = new TreeMap<>();
    private String ganadora = "";
    private boolean huboAction = true;
    private int turno = 0;

    public TrazaReglas(String nombre, RuleEngine motor, boolean soloCambios) {
        this.nombre = nombre;
        this.soloCambios = soloCambios;
        this.jess = reteDe(motor);
        motor.addObserver(this);                                  // avisa del ACTION ganador
        jess.addJessListener(this);                               // avisa de cada regla
        jess.setEventMask(jess.getEventMask() | JessEvent.DEFRULE_FIRED | JessEvent.RESET);
        for (Iterator<?> it = jess.listDefrules(); it.hasNext(); ) // todas, para ver las que no salen
            vecesRegla.put(sinModulo(((Defrule) it.next()).getName()), 0);
    }

    /** Jess avisa de cada regla que se dispara y de cada reset (uno por turno). */
    @Override
    public void eventHappened(JessEvent e) throws JessException {
        if (e.getType() == JessEvent.RESET) {
            if (!huboAction)
                System.out.printf("[%s] t=%d  NINGÚN ACTION: devuelve NEUTRAL. Reglas: %s%n",
                        nombre, turno, esteTurno);
            esteTurno.clear();
            huboAction = false;
            turno++;
        } else if (e.getType() == JessEvent.DEFRULE_FIRED) {
            String regla = sinModulo(((Activation) e.getObject()).getRule().getName());
            esteTurno.add(regla);
            vecesRegla.merge(regla, 1, Integer::sum);
        }
    }

    /** El RuleEngine avisa del ACTION ganador, después de run(). */
    @Override
    public void actionFired(String action, Collection<String> facts) {
        huboAction = true;
        String id = slot(action, "id");
        vecesGana.merge(id, 1, Integer::sum);
        if (!soloCambios || !id.equals(ganadora)) {
            System.out.printf("[%s] t=%d  %s → gana %s %s%n", nombre, turno, esteTurno, id, slot(action, "info"));
            for (String f : facts)                                // los candidatos que perdieron
                if (f.startsWith("(MAIN::ACTION") && !f.equals(action))
                    System.out.printf("           pierde %s (%s) %s%n",
                            slot(f, "id"), slot(f, "priority"), slot(f, "info"));
        }
        ganadora = id;
    }

    @Override
    public void ruleEngineReset() { }

    /** Llamadlo al final (por ejemplo en postCompute): las reglas a 0 no existen. */
    public void resumen() {
        System.out.printf("[%s] %d turnos. Veces que se dispara cada regla:%n", nombre, turno);
        vecesRegla.forEach((r, n) -> System.out.printf("   %6d  %s%s%n", n, r, n == 0 ? "   <-- NUNCA" : ""));
        System.out.printf("[%s] Veces que gana cada acción:%n", nombre);
        vecesGana.forEach((a, n) -> System.out.printf("   %6d  %s%n", n, a));
    }

    // ---- utilidades -------------------------------------------------------

    /** El RuleEngine del motor no deja ver su Rete: se lo pedimos por reflexión. */
    private static Rete reteDe(RuleEngine motor) {
        try {
            Field f = RuleEngine.class.getDeclaredField("jess");
            f.setAccessible(true);
            return (Rete) f.get(motor);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("No puedo llegar al Rete del RuleEngine", e);
        }
    }

    private static String sinModulo(String regla) {
        return regla.startsWith("MAIN::") ? regla.substring(6) : regla;
    }

    /** El valor de un slot en un hecho escrito como texto: (MAIN::ACTION (id huir) ...). */
    private static String slot(String hecho, String slot) {
        int i = hecho.indexOf("(" + slot + " ");
        if (i < 0) return "";
        i += slot.length() + 2;
        return hecho.substring(i, hecho.indexOf(')', i));
    }
}
