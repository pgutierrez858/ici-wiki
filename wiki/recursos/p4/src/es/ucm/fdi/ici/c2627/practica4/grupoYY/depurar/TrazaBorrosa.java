package es.ucm.fdi.ici.c2627.practica4.grupoYY.depurar;

import java.lang.reflect.Field;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import es.ucm.fdi.ici.fuzzy.FuzzyEngine;
import es.ucm.fdi.ici.fuzzy.FuzzyEngineObserver;
import net.sourceforge.jFuzzyLogic.FIS;
import net.sourceforge.jFuzzyLogic.rule.Rule;

/**
 * En cada turno: las entradas, cuánto vale cada salida, qué acción gana y con
 * qué grado se ha activado cada regla. Al final, cuántos turnos se ha activado
 * cada regla. Sólo para depurar: no la entreguéis enganchada, que imprime mucho.
 */
public class TrazaBorrosa implements FuzzyEngineObserver {

    private final String nombre;
    private final boolean soloCambios;      // true: sólo imprime cuando cambia la acción ganadora
    private final List<Rule> reglas;

    private final Map<String, Integer> turnosRegla = new LinkedHashMap<>();
    private final Map<String, Integer> vecesGana = new TreeMap<>();
    private String ganadora = "";
    private int turno = 0;

    public TrazaBorrosa(String nombre, FuzzyEngine motor, boolean soloCambios) {
        this.nombre = nombre;
        this.soloCambios = soloCambios;
        this.reglas = reglasDe(motor);
        for (Rule r : reglas) turnosRegla.put(r.getName(), 0);    // todas, para ver las que no salen
        motor.addObserver(this);
    }

    /** El FuzzyEngine avisa después de cada turno, con lo que ha entrado y lo que ha salido. */
    @Override
    public void actionFired(String accion, HashMap<String, Double> entradas, HashMap<String, Double> salidas,
            Collection<String> nada) {
        turno++;
        StringBuilder activas = new StringBuilder();
        for (Rule r : reglas) {
            double grado = r.getDegreeOfSupport();
            if (grado <= 0) continue;
            turnosRegla.merge(r.getName(), 1, Integer::sum);
            activas.append(String.format(" R%s:%.2f", r.getName(), grado));
        }
        vecesGana.merge(accion, 1, Integer::sum);
        if (!soloCambios || !accion.equals(ganadora))
            System.out.printf("[%s] t=%d  %s → %s → gana %s.  Reglas:%s%n",
                    nombre, turno, redondeado(entradas), redondeado(salidas), accion, activas);
        ganadora = accion;
    }

    @Override
    public String getObservedRules() { return null; }     // los grados los leemos directamente de las reglas

    /** Llamadlo al final: una regla que no se activa nunca no hace nada. */
    public void resumen() {
        System.out.printf("[%s] %d turnos. Turnos en que se activa cada regla:%n", nombre, turno);
        for (Rule r : reglas) {
            int n = turnosRegla.get(r.getName());
            System.out.printf("   %6d  RULE %s%s%n", n, r.getName(), n == 0 ? "   <-- NUNCA" : "");
        }
        System.out.printf("[%s] Veces que gana cada acción:%n", nombre);
        vecesGana.forEach((a, n) -> System.out.printf("   %6d  %s%n", n, a));
    }

    // ---- utilidades -------------------------------------------------------

    private static String redondeado(Map<String, Double> m) {
        StringBuilder sb = new StringBuilder("{");
        new TreeMap<>(m).forEach((k, v) -> sb.append(sb.length() > 1 ? " " : "").append(k).append('=')
                .append(String.format("%.1f", v)));
        return sb.append('}').toString();
    }

    /** El FuzzyEngine no deja ver su FIS: se lo pedimos por reflexión. Las reglas del primer RULEBLOCK. */
    private static List<Rule> reglasDe(FuzzyEngine motor) {
        try {
            Field f = FuzzyEngine.class.getDeclaredField("fis");
            Field b = FuzzyEngine.class.getDeclaredField("fuzzyBlock");
            f.setAccessible(true);
            b.setAccessible(true);
            FIS fis = (FIS) f.get(motor);
            if (fis == null) throw new IllegalStateException("El FuzzyEngine no ha cargado el .fcl: mirad la ruta");
            return fis.getFunctionBlock((String) b.get(motor)).getRuleBlocks().values().iterator().next().getRules();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("No puedo llegar al FIS del FuzzyEngine", e);
        }
    }
}
