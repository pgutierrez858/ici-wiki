package es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.ListIterator;
import java.util.StringTokenizer;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.apache.logging.log4j.LogManager;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CaseBaseFilter;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CaseComponent;
import es.ucm.fdi.gaia.jcolibri.cbrcore.Connector;
import es.ucm.fdi.gaia.jcolibri.connector.TypeAdaptor;
import es.ucm.fdi.gaia.jcolibri.connector.plaintextutils.PlainTextTypeConverter;
import es.ucm.fdi.gaia.jcolibri.exception.AttributeAccessException;
import es.ucm.fdi.gaia.jcolibri.exception.InitializingException;
import es.ucm.fdi.gaia.jcolibri.util.FileIO;

/**
 * <p>
 * Implements a generic PlainText Connector.
 * </p>
 * It manages the persistence of the cases automatically into textual files. Features:
 * <ul>
 * <li>By default it only can manage a few data types, although developers can add
 * their own ones implementing the TypeAdaptor interface.<br>
 * Supported types and the type extension mechanism is explained in PlainTextTypeConverter.
 * <li>Only works with one file.
 * </ul>
 * <p>
 * This connector uses the property in the initFromXMLfile() parameter to obtain the
 * configuration file. This file is a xml that follows the Schema defined in
 * <a href="PlainTextConnector.xsd">/doc/configfilesSchemas/PlainTextConnector.xsd</a>:<p>
 * <img src="PlainTextConnectorSchema.jpg">
 * <p>
 * This class does not implement any cache mechanims, so cases are read and
 * written directly. This can be very inefficient in some operations (mainly in
 * reading)
 * <p>
 * Some methods will fail when executing the connector with a case base file inside a jar file.
 * The retrieve() methods will work properly but the methods that write in the file will fail. 
 * Extract the file to the file system and run the connector with that location to solve these problems.
 * <p>
 * For an example see Test6.
 * 
 * @author Juan Antonio Recio García
 * @version 2.0
 * @see PlainTextTypeConverter
 * @see TypeAdaptor
 */
public class CustomPlainTextConnector implements Connector {

	/* Text file path. */
	protected String PROP_FILEPATH = "";

	/* Columns separator. */
	protected String PROP_DELIM = "";
    
	private Class<? extends CaseComponent> descriptionClass;
	private Class<? extends CaseComponent> solutionClass;
	private Class<? extends CaseComponent> justOfSolutionClass;
	private Class<? extends CaseComponent> resultClass;
	
	List<Attribute> descriptionMaps;
	List<Attribute> solutionMaps;
	List<Attribute> justOfSolutionMaps;
	List<Attribute> resultMaps;
	

	public void initFromXMLfile(URL file) throws InitializingException {
		try {
			DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
			DocumentBuilder db = dbf.newDocumentBuilder();
			Document doc = db.parse(file.openStream());
			
			/** File containing cases */
			
			this.PROP_FILEPATH = doc.getElementsByTagName("FilePath").item(0).getTextContent();
			
			/** Text separator */
			
			this.PROP_DELIM    = doc.getElementsByTagName("Delimiters").item(0).getTextContent();
			
			/** classes that compose the case*/
			
			this.descriptionClass = Class.forName(doc.getElementsByTagName("DescriptionClassName").item(0).getTextContent()).asSubclass(CaseComponent.class);
			
			try{
				this.solutionClass =  Class.forName(doc.getElementsByTagName("SolutionClassName").item(0).getTextContent()).asSubclass(CaseComponent.class);
			}catch(Exception e) {}
			
			try{
				this.justOfSolutionClass =  Class.forName(doc.getElementsByTagName("JustificationOfSolutionClassName").item(0).getTextContent()).asSubclass(CaseComponent.class);
			}catch(Exception e) {}
			
			try{
				this.resultClass =  Class.forName(doc.getElementsByTagName("ResultClassName").item(0).getTextContent()).asSubclass(CaseComponent.class);
			}catch(Exception e) {}
			
			
			/** Mappings */
			
			this.descriptionMaps = findMaps(doc.getElementsByTagName("DescriptionMappings").item(0), this.descriptionClass);
			
			if(this.solutionClass != null)
				this.solutionMaps =  findMaps(doc.getElementsByTagName("SolutionMappings").item(0), this.solutionClass);
			
			if(this.justOfSolutionClass != null)
				this.justOfSolutionMaps = findMaps(doc.getElementsByTagName("JustificationOfSolutionMappings").item(0), this.justOfSolutionClass);
			
			if(this.resultClass != null)
				this.resultMaps = findMaps(doc.getElementsByTagName("ResultMappings").item(0), this.resultClass);
			
		}catch(Exception e){
			throw new InitializingException(e);
		}
		

	}

	private List<Attribute> findMaps(Node n, Class<?> _class)
	{
		List<Attribute> res = new ArrayList<Attribute>();
		NodeList childs = n.getChildNodes();
		for(int i=0; i<childs.getLength(); i++)
		{
			Node c = childs.item(i);
			if(c.getNodeName().equals("Map")){
				String attributeName = c.getTextContent();
				res.add(new Attribute(attributeName, _class));
			}
		}
		return res;
	}
	
	/**
	 * Simple extension to allow custom case base files. It also creates a new empty file if it does not exist.
	 */
	public void setCaseBaseFile(String path, String casebaseFile) {
		this.PROP_FILEPATH = path+casebaseFile;
		try {
			 Files.createDirectories(Paths.get(path));
	         File file = new File(this.PROP_FILEPATH);
	         //System.out.println(file.getAbsolutePath());
	         if(!file.exists())
	        	 file.createNewFile();
	      } catch(Exception e) {
	         e.printStackTrace();
	      }
	}

	public void close() {
		//does nothing
	}

	/**
	 * Stores the cases in the data base. Note that this method does not control
	 * that the case name (== primary key) is repeated, so developers must be
	 * careful with this.
	 * 
	 * @param cases Cases to store.
	 * @throws Exception
	 */
	public void storeCases(Collection<CBRCase> cases)
	{
		try {
			BufferedWriter br = null;
			br = new BufferedWriter(new FileWriter(FileIO.findFile(this.PROP_FILEPATH).getFile(), true));
			//if (br == null) throw new Exception("Error opening file for writing: "+ this.PROP_FILEPATH);

			char separator = this.PROP_DELIM.charAt(0);
			
			for (CBRCase _case : cases) {
				br.newLine();
				StringBuffer line = new StringBuffer();
				
				CaseComponent description = _case.getDescription();
				writeComponent(description, this.descriptionMaps, line, separator, true);
				
				CaseComponent solution = _case.getSolution();
				if(solution!=null)
				{
					writeComponent(solution, this.solutionMaps,  line, separator, false);
				}
				
				CaseComponent justOfSolution = _case.getJustificationOfSolution();
				if(justOfSolution!=null)
				{
					writeComponent(justOfSolution, this.justOfSolutionMaps,  line, separator, false);
				}
				
				CaseComponent result = _case.getResult();
				if(result!=null)
				{
					writeComponent(result, this.resultMaps, line, separator, false);
				}

				br.write(line.toString());
			}
			br.close();
		} catch (Exception e) {
			LogManager.getLogger(this.getClass()).error(e);
		}
	}
	
	// Cada atributo va precedido del separador, así que entre partes del caso no hace falta otro
	private void writeComponent(CaseComponent comp, List<Attribute> maps, StringBuffer line, char separator, boolean includeId)
	{
		try {
			if(includeId)
				line.append(comp.getIdAttribute().getValue(comp));
			for(Attribute a: maps)
			{
				line.append(separator);
				line.append(a.getValue(comp));
			}
		} catch (AttributeAccessException e) {
			LogManager.getLogger(this.getClass()).error(e);
		}
	}

	/**
	 * Deletes cases from the case base. It only uses the case name (primary
	 * key) to remove the row. Note that this method is very inefficient because
	 * it reads all the database, removes the rows in memory, and writes it
	 * again into the text file.
	 * 
	 * @param cases
	 *            Cases to delete
	 */
	public void deleteCases(Collection<CBRCase> cases){
		try {
			if(cases.isEmpty())
				return;
			BufferedReader br = null;
			//br = new BufferedReader( new InputStreamReader(FileIO.findFile(this.PROP_FILEPATH).openStream()));
			br = new BufferedReader( new InputStreamReader(FileIO.openFile(this.PROP_FILEPATH)));
			//if (br == null) throw new Exception("Error opening file for reading: " + this.PROP_FILEPATH);

			ArrayList<String> lines = new ArrayList<String>();
			String line = "";
			while ((line = br.readLine()) != null) {
				if (line.startsWith("#") || (line.length() == 0)) {
					lines.add(line);
					continue;
				}

				StringTokenizer st = new StringTokenizer(line, this.PROP_DELIM);
				String caseId = st.nextToken();
				boolean found = false;
				for (Iterator<CBRCase> cIter = cases.iterator(); cIter.hasNext();) {
					CBRCase _case = cIter.next();
					if (caseId.equals(_case.getID().toString()))
						found = true;
				}
				if(!found)
					lines.add(line);
			}
			br.close();

			BufferedWriter bw = null;
			//bw = new BufferedWriter(new FileWriter(FileIO.findFile(this.PROP_FILEPATH).getFile(), false));
			bw = new BufferedWriter(new FileWriter(FileIO.findFile(this.PROP_FILEPATH).getFile(), false));
			//if (bw == null) throw new Exception("Error opening file for writing: "+ this.PROP_FILEPATH);
			for (ListIterator<String> lIter = lines.listIterator(); lIter.hasNext();) {
				line = lIter.next();
				bw.write(line);
				bw.newLine();
			}
			bw.close();

		} catch (Exception e) {
			LogManager.getLogger(this.getClass()).error(
					"Error deleting cases " + e.getMessage());
		}
	}

	/**
	 * Retrieves all cases from the text file. It maps data types using the
	 * PlainTextTypeConverter class.
	 * 
	 * @return Retrieved cases.
	 */
	public List<CBRCase> retrieveAllCases() {
		LinkedList<CBRCase> cases = new LinkedList<CBRCase>();
		try {
			BufferedReader br = null;
			br = new BufferedReader( new InputStreamReader(FileIO.openFile(this.PROP_FILEPATH)));
			//if (br == null) throw new Exception("Error opening file: " + this.PROP_FILEPATH);

			String line = "";
			while ((line = br.readLine()) != null) {

				if (line.startsWith("#") || (line.length() == 0))
					continue;
				StringTokenizer st = new StringTokenizer(line, this.PROP_DELIM);
				
				CBRCase _case = new CBRCase();
				
				CaseComponent description = (CaseComponent)this.descriptionClass.newInstance();
				fillComponent(description, st, this.descriptionMaps, true);
				_case.setDescription(description);
				
				if(this.solutionClass != null)
				{
					CaseComponent solution = (CaseComponent)this.solutionClass.newInstance();
					fillComponent(solution, st, this.solutionMaps, false);
					copyId(description, solution);
					_case.setSolution(solution);
				}
				if(this.justOfSolutionClass != null)
				{
					CaseComponent justificationOfSolution = (CaseComponent)this.justOfSolutionClass.newInstance();
					fillComponent(justificationOfSolution, st, this.justOfSolutionMaps, false);
					copyId(description, justificationOfSolution);
					_case.setJustificationOfSolution(justificationOfSolution);
				}
				if(this.resultClass != null)
				{
					CaseComponent result = (CaseComponent)this.resultClass.newInstance();
					fillComponent(result, st, this.resultMaps, false);
					copyId(description, result);
					_case.setResult(result);
				}
				
				cases.add(_case);
			}
			br.close();
		} catch (Exception e) {
			LogManager.getLogger(this.getClass()).error(
					"Error retrieving cases " + e.getMessage());
		}
		return cases;
	}


	/** En el fichero el id va una sola vez, al principio: las demás partes del caso llevan el de la descripción. */
	private void copyId(CaseComponent from, CaseComponent to) throws AttributeAccessException
	{
		to.getIdAttribute().setValue(to, from.getIdAttribute().getValue(from));
	}

	private void fillComponent(CaseComponent component, StringTokenizer st, List<Attribute> maps, boolean includeId)
	{
		try {
			Class<?> type;
			Object value;
			
			if(includeId)
			{
				es.ucm.fdi.gaia.jcolibri.cbrcore.Attribute idAttribute = component.getIdAttribute();
				type = idAttribute.getType();
				value = PlainTextTypeConverter.convert(st.nextToken(), type);
				idAttribute.setValue(component, value);
			}
			
			for(Attribute at : maps)
			{
				type = at.getType();
				value = PlainTextTypeConverter.convert(st.nextToken(), type);
				at.setValue(component, value);
			}
			
		} catch (Exception e) {
			LogManager.getLogger(this.getClass()).error(
					"Error creating case: " + e.getMessage());
		}
	}
	
	
	public List<CBRCase> retrieveSomeCases(CaseBaseFilter filter) {
		return null;
	}
	
}
