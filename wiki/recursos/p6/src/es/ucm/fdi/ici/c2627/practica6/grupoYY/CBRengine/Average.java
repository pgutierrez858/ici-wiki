package es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine;

import java.lang.reflect.Field;

import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRCase;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CBRQuery;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CaseComponent;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.NNConfig;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.similarity.GlobalSimilarityFunction;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.similarity.InContextLocalSimilarityFunction;
import es.ucm.fdi.gaia.jcolibri.method.retrieve.NNretrieval.similarity.LocalSimilarityFunction;

public class Average implements GlobalSimilarityFunction {

	/**
	 * Returns the list of attributes of a class.
	 */
	public static Attribute[] getAttributes(Class<?> c)
	{
		Field[] fields = c.getDeclaredFields();
		Attribute[] res = new Attribute[fields.length];
		int i=0;
		for(Field f : fields)
			res[i++] = new Attribute(f.getName(),c);
		return res;
	}
	
	Attribute[] attributes = null;
	
	@Override
	public double compute(CaseComponent componentOfCase, CaseComponent componentOfQuery, CBRCase _case, CBRQuery _query,
			NNConfig numSimConfig) {
		GlobalSimilarityFunction gsf = null;
		LocalSimilarityFunction lsf = null;

		if(attributes == null)
			attributes = getAttributes(componentOfCase.getClass());

		double[] values = new double[attributes.length];
		double[] weights = new double[attributes.length];

		int ivalue = 0;

		for (int i = 0; i < attributes.length; i++) {
			Attribute at1 = attributes[i];
			//Attribute at2 = new Attribute(at1.getName(), componentOfQuery.getClass());

			try {
				if ((gsf = numSimConfig.getGlobalSimilFunction(at1)) != null) {
					values[ivalue] = gsf.compute((CaseComponent) at1.getValue(componentOfCase),
							(CaseComponent) at1.getValue(componentOfQuery), _case, _query, numSimConfig);
					weights[ivalue++] = numSimConfig.getWeight(at1);
				} else if ((lsf = numSimConfig.getLocalSimilFunction(at1)) != null) {
					if (lsf instanceof InContextLocalSimilarityFunction) {
						InContextLocalSimilarityFunction iclsf = (InContextLocalSimilarityFunction) lsf;
						iclsf.setContext(componentOfCase, componentOfQuery, _case, _query, at1.getName());
					}
					values[ivalue] = lsf.compute(at1.getValue(componentOfCase), at1.getValue(componentOfQuery));
					weights[ivalue++] = numSimConfig.getWeight(at1);
				}
			} catch (Exception e) {
				System.err.println(e.getMessage());
				e.printStackTrace();
			}
		}

		return computeSimilarity(values, weights, ivalue);

	}

	public double computeSimilarity(double[] values, double[] weigths, int ivalue) {
		double acum = 0;
		double weigthsAcum = 0;
		for (int i = 0; i < ivalue; i++) {
			acum += values[i] * weigths[i];
			weigthsAcum += weigths[i];
		}
		return acum / weigthsAcum;
	}

}
