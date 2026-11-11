package es.ucm.fdi.ici.c2627.practica4.grupoYY.depurar;

import net.sourceforge.jFuzzyLogic.FIS;
import net.sourceforge.jFuzzyLogic.FunctionBlock;
import net.sourceforge.jFuzzyLogic.rule.Rule;
import net.sourceforge.jFuzzyLogic.rule.Variable;

/**
 * Prueba el .fcl sin jugar: se escriben a mano los valores de las entradas y se
 * mira qué salida gana, como hace el MaxActionSelector. Cada caso es una
 * pregunta con su respuesta esperada.
 */
public class ProbarBorroso {

    static final String FCL = "bin/es/ucm/fdi/ici/c2627/practica4/grupoYY/mspacman-v1.fcl";
    static final String BLOQUE = "MsPacMan";
    static int fallos = 0;

    public static void main(String[] args) {
        FIS fis = FIS.load(FCL, true);         // true: si hay un error de sintaxis, lo dice
        if (fis == null) { System.out.println("No encuentro " + FCL); return; }
        FunctionBlock fb = fis.getFunctionBlock(BLOQUE);

        //   nombre del caso                         gana esperada   peligro comestible ppill
        caso(fb, "nada cerca: come",                     "comer",     150, 150, 150);
        caso(fb, "peligroso a 10: huye",                 "huir",       10, 150, 150);
        caso(fb, "peligroso a 45: todavía come",         "comer",      45, 150, 150);
        caso(fb, "comestible a 10, peligroso lejos",     "perseguir", 150,  10, 150);
        caso(fb, "comestible a 10, peligroso a 10",      "huir",       10,  10, 150);
        caso(fb, "peligroso a 20 y ppill a 5: a la ppill", "irAPPill", 20, 150,   5);

        // La curva de control: qué sale según se acerca el fantasma, con todo lo demás lejos
        System.out.println("\npeligro  salidas → gana");
        for (int d = 0; d <= 100; d += 5) {
            evaluar(fb, d, 150, 150);
            System.out.printf("%5d   %s → %s%n", d, salidas(fb), gana(fb));
        }

        System.out.println(fallos == 0 ? "\nTodos los casos bien." : "\n" + fallos + " casos MAL.");
    }

    static void caso(FunctionBlock fb, String nombre, String esperada,
                     double peligro, double comestible, double ppill) {
        evaluar(fb, peligro, comestible, ppill);
        String gana = gana(fb);
        StringBuilder activas = new StringBuilder();
        for (Rule r : fb.getRuleBlocks().values().iterator().next().getRules())
            if (r.getDegreeOfSupport() > 0) activas.append(String.format(" R%s:%.2f", r.getName(), r.getDegreeOfSupport()));

        boolean bien = gana.equals(esperada);
        if (!bien) fallos++;
        System.out.printf("%s  %-40s gana %-9s (esperaba %s)%n      salidas: %s%n      reglas: %s%n",
                bien ? "BIEN" : "MAL ", nombre, gana, esperada, salidas(fb), activas);
    }

    static void evaluar(FunctionBlock fb, double peligro, double comestible, double ppill) {
        fb.setVariable("peligro", peligro);   // a todas las entradas, cada vez: si no, se quedan con el valor anterior
        fb.setVariable("comestible", comestible);
        fb.setVariable("ppill", ppill);
        fb.evaluate();
    }

    /** La salida más alta, como el MaxActionSelector (en un empate, cualquiera de las dos). */
    static String gana(FunctionBlock fb) {
        String gana = "(ninguna)";
        double max = Double.NEGATIVE_INFINITY;
        for (Variable v : fb.getVariables().values())
            if (v.isOutput() && v.getLatestDefuzzifiedValue() > max) {
                max = v.getLatestDefuzzifiedValue();
                gana = v.getName();
            }
        return gana;
    }

    static String salidas(FunctionBlock fb) {
        StringBuilder sb = new StringBuilder();
        for (Variable v : new java.util.TreeMap<>(fb.getVariables()).values())
            if (v.isOutput()) sb.append(String.format("%s=%.1f ", v.getName(), v.getLatestDefuzzifiedValue()));
        return sb.toString().trim();
    }
}
