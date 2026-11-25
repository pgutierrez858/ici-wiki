package es.ucm.fdi.ici.c2627.practica6.grupoYY.mspacman;

import es.ucm.fdi.gaia.jcolibri.cbrcore.Attribute;
import es.ucm.fdi.gaia.jcolibri.cbrcore.CaseComponent;

public class MsPacManDescription implements CaseComponent {

	Integer id;
	
	Integer score;
	Integer time;
	Integer nearestPPill;
	Integer nearestGhost;
	Boolean edibleGhost;
	
	




	public Integer getId() {
		return id;
	}

	public void setId(Integer id) {
		this.id = id;
	}

	public Integer getScore() {
		return score;
	}

	public void setScore(Integer score) {
		this.score = score;
	}

	public Integer getTime() {
		return time;
	}

	public void setTime(Integer time) {
		this.time = time;
	}

	public Integer getNearestPPill() {
		return nearestPPill;
	}

	public void setNearestPPill(Integer nearestPPill) {
		this.nearestPPill = nearestPPill;
	}

	public Integer getNearestGhost() {
		return nearestGhost;
	}

	public void setNearestGhost(Integer nearestGhost) {
		this.nearestGhost = nearestGhost;
	}

	public Boolean getEdibleGhost() {
		return edibleGhost;
	}

	public void setEdibleGhost(Boolean edibleGhost) {
		this.edibleGhost = edibleGhost;
	}

	@Override
	public Attribute getIdAttribute() {
		return new Attribute("id", MsPacManDescription.class);
	}

	@Override
	public String toString() {
		return "MsPacManDescription [id=" + id + ", score=" + score + ", time=" + time + ", nearestPPill="
				+ nearestPPill + ", nearestGhost=" + nearestGhost + ", edibleGhost=" + edibleGhost + "]";
	}


	
	

}
