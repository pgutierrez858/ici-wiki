package es.ucm.fdi.ici.c2627.practica4.grupoYY;

import java.util.HashMap;

import es.ucm.fdi.ici.Action;
import es.ucm.fdi.ici.fuzzy.ActionSelector;

/**
 * Una variable de salida por acción, con el mismo nombre que su getActionId(),
 * y gana la que valga más. Si empatan, la que va antes en el array.
 */
public class MaxActionSelector implements ActionSelector {

    private final Action[] acciones;

    public MaxActionSelector(Action[] acciones) {
        this.acciones = acciones;
    }

    @Override
    public Action selectAction(HashMap<String, Double> salidas) {
        Action mejor = null;
        double max = Double.NEGATIVE_INFINITY;
        for (Action a : acciones) {             // en el orden del array, no en el del HashMap
            Double v = salidas.get(a.getActionId());
            if (v != null && v > max) { max = v; mejor = a; }
        }
        return mejor;
    }
}
