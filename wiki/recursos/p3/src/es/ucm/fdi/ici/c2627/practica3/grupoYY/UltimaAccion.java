package es.ucm.fdi.ici.c2627.practica3.grupoYY;

import java.util.Collection;

import es.ucm.fdi.ici.rules.RuleEngineObserver;

/** Se apunta el id del ACTION que gana en cada turno, para dárselo al Input del siguiente. */
public class UltimaAccion implements RuleEngineObserver {

    private String id = "nada";

    public String get() { return id; }

    public void olvidar() { id = "nada"; }      // al empezar cada partida

    @Override
    public void actionFired(String action, Collection<String> facts) {
        // action es el hecho ganador como texto: (MAIN::ACTION (id huir) (info "...") ...)
        int i = action.indexOf("(id ") + 4;
        id = action.substring(i, action.indexOf(')', i));
    }

    @Override
    public void ruleEngineReset() { }
}
