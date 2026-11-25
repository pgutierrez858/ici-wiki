package es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;

import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCaseBase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CaseBaseFilter;
import es.ucm.fdi.gaia.jcolibri.cbrcore.Connector;
import es.ucm.fdi.gaia.jcolibri.exception.InitializingException;

/**
 * Cached case base that only persists cases when closing.
 * learn() and forget() are not synchronized with the persistence until close() is invoked.
 * <p>
 * This class presents better performance that LinelCaseBase as only access to the persistence once.
 * This case base is used for evaluation.
 * 
 * @author Juan A. Recio-García
 */
public class CachedLinearCaseBase implements CBRCaseBase {

	private Connector connector;
	private Collection<CBRCase> originalCases;
	private java.util.ArrayList<CBRCase> workingCases;
	private Collection<CBRCase> casesToRemove;
	
	private Integer nextId;
	
	/**
	 * Closes the case base saving or deleting the cases of the persistence media
	 */
	public void close() {
		workingCases.removeAll(casesToRemove);
		
		Collection<CBRCase> casesToStore = new ArrayList<>(workingCases);
		// con un HashSet: removeAll pregunta contains() por cada caso, y en una lista eso es cuadrático
		casesToStore.removeAll(new HashSet<>(originalCases));

		connector.storeCases(casesToStore);
		connector.deleteCases(casesToRemove);
		connector.close();
	}

	/**
	 * Forgets cases. It only removes the cases from the storage media when closing.
	 */
	public void forgetCases(Collection<CBRCase> cases) {
		workingCases.removeAll(cases);
		casesToRemove.addAll(cases);
	}

	/**
	 * Returns working cases.
	 */
	public Collection<CBRCase> getCases() {
		return workingCases;
	}

	/**
	 * TODO.
	 */
	public Collection<CBRCase> getCases(CaseBaseFilter filter) {
		// TODO
		return null;
	}

	/**
	 * Initializes the Case Base with the cases read from the given connector.
	 */
	public void init(Connector connector) throws InitializingException {
		this.connector = connector;
		originalCases = this.connector.retrieveAllCases();	
		workingCases = new java.util.ArrayList<CBRCase>(originalCases);
		casesToRemove = new ArrayList<>();
		// el siguiente al mayor id: con la base vacía (el primer partido contra un rival) es el 1
		nextId = 1;
		for (CBRCase c : workingCases)
			nextId = Math.max(nextId, 1 + (Integer) c.getID());
	}
	

	public Integer getNextId()
	{
		return nextId;
	}
	
	/**
	 * Learns cases that are only saved when closing the Case Base.
	 */
	public void learnCases(Collection<CBRCase> cases) {
		workingCases.addAll(cases);
		nextId += cases.size();
	}

}

