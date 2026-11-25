package es.ucm.fdi.ici.c2627.practica6.grupoYY.CBRengine;

import java.lang.invoke.CallSite;
import java.lang.invoke.LambdaMetafactory;
import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.util.HashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;

import es.ucm.fdi.gaia.jcolibri.exception.AttributeAccessException;

@SuppressWarnings("rawtypes")
public class Attribute extends es.ucm.fdi.gaia.jcolibri.cbrcore.Attribute {

	Function getFunction = null;
	BiConsumer setFunction = null;

	private static HashMap<Class<?>, HashMap<String, Function>> getters = new HashMap<Class<?>, HashMap<String, Function>>();
	private static HashMap<Class<?>, HashMap<String, BiConsumer>> setters = new HashMap<Class<?>, HashMap<String, BiConsumer>>();
	
	
	private static Function findGetter(Class<?> _class, String getterName, Class<?> _type) throws Exception
	{
		HashMap<String, Function> gettersClass = getters.get(_class);
		if(gettersClass == null) {
			gettersClass = new HashMap<String, Function>();
			getters.put(_class, gettersClass);
		}
		Function f = gettersClass.get(getterName);
		if (f == null) {
			f = createGetter(_class, getterName, _type);
			gettersClass.put(getterName, f);
		}
		return f;
	}
	
	
	private static BiConsumer findSetter(Class<?> _class, String setterName, Class<?> _type) throws Exception
	{
		HashMap<String, BiConsumer> gettersClass = setters.get(_class);
		if(gettersClass == null) {
			gettersClass = new HashMap<String, BiConsumer>();
			setters.put(_class, gettersClass);
		}
		BiConsumer f = gettersClass.get(setterName);
		if (f == null) {
			f = createSetter(_class, setterName, _type);
			gettersClass.put(setterName, f);
		}
		return f;
	}
	
	
	
	public Attribute(String attributeName, Class<?> _class) {
		super(attributeName, _class);
		try {
			getFunction = findGetter(_class, fieldToGetter(attributeName), this.getType());
			setFunction = findSetter(_class, fieldToSetter(attributeName), this.getType());
		} catch (Exception e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	String fieldToGetter(String name)
	{
	    return "get" + name.substring(0, 1).toUpperCase() + name.substring(1);
	}
	String fieldToSetter(String name)
	{
	    return "set" + name.substring(0, 1).toUpperCase() + name.substring(1);
	}
	
	
	@SuppressWarnings("unchecked")
	@Override
	public Object getValue(Object obj) throws AttributeAccessException
	{
		return getFunction.apply(obj);
	}
	
	@SuppressWarnings("unchecked")
	@Override
	public void setValue(Object obj, Object value) throws AttributeAccessException
	{
		setFunction.accept(obj, value);
	}	

	public static BiConsumer createSetter(Class<?> _class, String setterName, Class<?> _type)
			throws Exception {
		
		MethodHandles.Lookup lookup = MethodHandles.lookup();
		MethodHandle setter = lookup.findVirtual(_class, setterName, MethodType.methodType(void.class, _type));
	
		final CallSite site = LambdaMetafactory.metafactory(lookup, 
				"accept", 
				MethodType.methodType(BiConsumer.class),
				MethodType.methodType(void.class, Object.class, Object.class), // signature of method BiConsumer.accept
																				// after type erasure
				setter, setter.type()); // actual signature of setter
		try {
			return (BiConsumer) site.getTarget().invokeExact();
		} catch (final Exception e) {
			throw e;
		} catch (final Throwable e) {
			throw new Error(e);
		}
	}
	
	
	
	public static Function createGetter(Class<?> _class, String getterName, Class<?> _type) throws Exception {
		
		MethodHandles.Lookup lookup = MethodHandles.lookup();
		MethodHandle getter = lookup.findVirtual(_class, getterName, MethodType.methodType(_type));
		final CallSite site = 
				LambdaMetafactory.metafactory(lookup, 
						"apply", 
						MethodType.methodType(Function.class),
						MethodType.methodType(Object.class, Object.class), // signature of method Function.apply after type
				getter, getter.type()); // actual signature of getter
		try {
			return (Function) site.getTarget().invokeExact();
		} catch (final Exception e) {
			throw e;
		} catch (final Throwable e) {
			throw new Error(e);
		}
	}
}
