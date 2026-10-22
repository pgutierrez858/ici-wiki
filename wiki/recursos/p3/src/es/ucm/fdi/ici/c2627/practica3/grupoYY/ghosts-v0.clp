;;; Los cuatro fantasmas con la misma base de reglas: la v0, con G1 y G2

;; ---- Los hechos que aserta GhostsInput, iguales para los cuatro ---------
(deftemplate FANTASMA
   (slot nombre     (type SYMBOL))
   (slot comestible (type SYMBOL))
   (slot enCarcel   (type SYMBOL))
   (slot distPacman (type NUMBER)))    ; lo que tarda en llegar a ella; 1000 en la cárcel

(deftemplate MSPACMAN
   (slot distPPill (type NUMBER)))     ; de Ms. Pac-Man a su PPill más cercana

;; ---- Y uno más, distinto en cada motor: quién soy yo --------------------
(deftemplate YO (slot nombre (type SYMBOL)))

(deftemplate ACTION
   (slot id) (slot info (default "")) (slot priority (type NUMBER)))

;; G1 · si no soy comestible, perseguir
(defrule perseguir
   (YO (nombre ?yo))
   (FANTASMA (nombre ?yo) (comestible false))
   =>
   (assert (ACTION (id perseguir) (info "G1: no soy comestible") (priority 10))))

;; G2 · si soy comestible, huir
(defrule huirComestible
   (YO (nombre ?yo))
   (FANTASMA (nombre ?yo) (comestible true))
   =>
   (assert (ACTION (id huir) (info "G2: soy comestible") (priority 50))))
