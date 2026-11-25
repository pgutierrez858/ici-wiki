package es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman;

import java.io.File;
import java.util.Collection;

import es.ucm.fdi.gaia.jcolibri.cbraplications.StandardCBRApplication;
import es.ucm.fdi.gaia.jcolibri.cbrcore.Attribute;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCaseBase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRQuery;
import es.ucm.fdi.gaia.jcolibri.exception.ExecutionException;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.RetrievalResult;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.NNConfig;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.NNScoringMethod;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.similarity.local.Equal;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.similarity.local.Interval;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.selection.SelectCases;
import es.ucm.fdi.gaia.jcolibri.util.FileIO;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine.Average;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine.CachedLinearCaseBase;
import es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine.CustomPlainTextConnector;
import pacman.game.Constants.MOVE;
import pacman.game.Game;

/** El ciclo CBR de Ms. Pac-Man: recuperar, reutilizar, y revisar y retener (en MsPacManStorageManager). */
public class MsPacManCBRengine implements StandardCBRApplication {

    final static String TEAM = "grupoYY";  // cambiad YY por vuestra letra, aquí y en plaintextconfig.xml

    // El .xml se busca en el classpath (Eclipse lo copia a bin/); los .csv, en el disco, desde la carpeta del proyecto
    final static String CONNECTOR_FILE_PATH = "es/ucm/fdi/ici/c2627/practica6/" + TEAM + "/mspacman/plaintextconfig.xml";

    private final MsPacManStorageManager storageManager;
    private final String caseBasePath;
    private final boolean aprender;
    private final boolean usarPlanB;

    private String opponent;
    private Game game;
    private MOVE action;

    CustomPlainTextConnector connector;
    CachedLinearCaseBase caseBase;
    NNConfig simConfig;

    public MsPacManCBRengine(MsPacManStorageManager storageManager, String baseDeCasos, boolean aprender, boolean usarPlanB) {
        this.storageManager = storageManager;
        this.caseBasePath = "cbrdata" + File.separator + TEAM + File.separator + baseDeCasos + File.separator;
        this.aprender = aprender;
        this.usarPlanB = usarPlanB;
    }

    public void setOpponent(String opponent) {
        this.opponent = opponent;
    }

    /** La partida de ahora, por si vuestro plan B necesita mirarla. */
    public void setGame(Game game) {
        this.game = game;
    }

    @Override
    public void configure() throws ExecutionException {
        connector = new CustomPlainTextConnector();
        caseBase = new CachedLinearCaseBase();

        connector.initFromXMLfile(FileIO.findFile(CONNECTOR_FILE_PATH));

        // Un .csv por rival, con el nombre de su clase: lo que se aprende contra uno no se mezcla con otro.
        // La ruta del .xml no se usa.
        connector.setCaseBaseFile(caseBasePath, opponent + ".csv");

        storageManager.setCaseBase(caseBase);

        // Similitud: la media ponderada de una similitud por atributo (todas pesan 1)
        simConfig = new NNConfig();
        simConfig.setDescriptionSimFunction(new Average());
        simConfig.addMapping(new Attribute("score", MsPacManDescription.class), new Interval(15000));
        simConfig.addMapping(new Attribute("time", MsPacManDescription.class), new Interval(4000));
        simConfig.addMapping(new Attribute("nearestPPill", MsPacManDescription.class), new Interval(650));
        simConfig.addMapping(new Attribute("nearestGhost", MsPacManDescription.class), new Interval(650));
        simConfig.addMapping(new Attribute("edibleGhost", MsPacManDescription.class), new Equal());
    }

    @Override
    public CBRCaseBase preCycle() throws ExecutionException {
        caseBase.init(connector);
        return caseBase;
    }

    @Override
    public void cycle(CBRQuery query) throws ExecutionException {
        if (caseBase.getCases().isEmpty()) {
            action = planB(null);          // base vacía: ningún caso sirve
        } else {
            // Recuperar: la similitud de la consulta con todos los casos
            Collection<RetrievalResult> eval = NNScoringMethod.evaluateSimilarity(caseBase.getCases(), query, simConfig);
            // Reutilizar
            action = reuse(eval);
        }

        // Revisar y retener: el caso se guarda ahora y se puntúa unos cruces después
        if (aprender)
            storageManager.reviseAndRetain(createNewCase(query));
    }

    private MOVE reuse(Collection<RetrievalResult> eval) {
        // Sólo el más parecido (1-NN). Con k vecinos y votación se decide mejor.
        RetrievalResult first = SelectCases.selectTopKRR(eval, 1).iterator().next();
        CBRCase mostSimilarCase = first.get_case();
        double similarity = first.getEval();

        MsPacManResult result = (MsPacManResult) mostSimilarCase.getResult();
        MsPacManSolution solution = (MsPacManSolution) mostSimilarCase.getSolution();

        // Se copia la acción del caso más parecido...
        MOVE action = solution.getAction();

        // ...salvo que no se parezca lo bastante o le fuera mal: entonces el plan B.
        if (similarity < 0.7 || result.getScore() < 100)
            action = planB(action);
        return action;
    }

    /**
     * Lo que se hace cuando ningún caso sirve: la base está vacía, nada se parece lo bastante
     * o lo parecido salió mal. Aquí puede ir vuestro plan B (unas reglas, por ejemplo, mirando game).
     * En el concurso está apagado (usarPlanB = false) y se juega al azar, para que los puntos midan
     * lo que ha aprendido la base. Al azar, además, la base prueba acciones que todavía no conoce.
     */
    private MOVE planB(MOVE evitar) {
        if (!usarPlanB)
            return alAzar(evitar);
        return alAzar(evitar);         // la plantilla no tiene plan B: también al azar
    }

    /** Una de las cuatro direcciones, al azar, que no sea la que se quiere evitar. */
    private MOVE alAzar(MOVE evitar) {
        int index = (int) Math.floor(Math.random() * 4);   // UP, RIGHT, DOWN, LEFT: las cuatro primeras
        if (MOVE.values()[index] == evitar)
            index = (index + 1) % 4;
        return MOVE.values()[index];
    }

    /** Un caso nuevo: la consulta como descripción, la acción elegida como solución y el resultado aún vacío. */
    private CBRCase createNewCase(CBRQuery query) {
        CBRCase newCase = new CBRCase();
        MsPacManDescription newDescription = (MsPacManDescription) query.getDescription();
        MsPacManResult newResult = new MsPacManResult();
        MsPacManSolution newSolution = new MsPacManSolution();
        // los casos que esperan en el búfer ya tienen su id, aunque aún no estén en la base
        int newId = caseBase.getNextId() + storageManager.getPendingCases();
        newDescription.setId(newId);
        newResult.setId(newId);
        newSolution.setId(newId);
        newSolution.setAction(action);
        newCase.setDescription(newDescription);
        newCase.setResult(newResult);
        newCase.setSolution(newSolution);
        return newCase;
    }

    public MOVE getSolution() {
        return action;
    }

    /** Los casos en memoria: los leídos del .csv más los aprendidos en esta partida. */
    public int getCaseBaseSize() {
        return caseBase.getCases().size();
    }

    @Override
    public void postCycle() throws ExecutionException {
        if (!aprender)
            return;                    // nada que escribir
        storageManager.close();
        caseBase.close();
    }
}
