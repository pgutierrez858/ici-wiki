;;; Ms. Pac-Man con seis reglas: la v0 del ejemplo de la Práctica 3

;; ---- Los hechos que aserta MsPacManInput en cada turno ----------------
(deftemplate MSPACMAN
   (slot distFantasma (type NUMBER))   ; al peligroso más cercano; 1000 si no hay
   (slot distPPill    (type NUMBER))   ; a la PPill más cercana; 1000 si no quedan
   (slot ultima       (type SYMBOL)))  ; la acción que ganó el turno anterior

(deftemplate FANTASMA
   (slot nombre     (type SYMBOL))     ; BLINKY, INKY, PINKY, SUE
   (slot comestible (type SYMBOL))     ; true o false, en minúsculas, como Java
   (slot distancia  (type NUMBER))
   (slot tiempo     (type NUMBER)))    ; turnos que le quedan de comestible

;; ---- Un hecho intermedio: lo asertan unas reglas y lo leen otras ------
(deftemplate PELIGRO)

;; ---- El hecho de salida ------------------------------------------------
(deftemplate ACTION
   (slot id) (slot info (default "")) (slot priority (type NUMBER))
   (slot fantasma (type SYMBOL)))      ; el parámetro de "perseguir"

;; R1 · si no pasa nada más, comer
(defrule comer
   (MSPACMAN)
   =>
   (assert (ACTION (id comer) (info "R1: no pasa nada") (priority 10))))

;; R2 · un fantasma peligroso a menos de 20 es peligro
(defrule peligro
   (declare (salience 10))             ; antes que las que preguntan por PELIGRO
   (MSPACMAN (distFantasma ?d&:(< ?d 20)))
   =>
   (assert (PELIGRO)))

;; R3 · si ya venía huyendo, sigue siendo peligro hasta los 30
(defrule sigueElPeligro
   (declare (salience 10))
   (MSPACMAN (ultima huir) (distFantasma ?d&:(< ?d 30)))
   =>
   (assert (PELIGRO)))

;; R4 · con peligro, huir
(defrule huir
   (PELIGRO)
   =>
   (assert (ACTION (id huir) (info "R4: hay peligro") (priority 80))))

;; R5 · con peligro, si la píldora de poder está más cerca que el fantasma, a por ella
(defrule aLaPPill
   (PELIGRO)
   (MSPACMAN (distFantasma ?f) (distPPill ?p&:(< ?p ?f)))
   =>
   (assert (ACTION (id irAPPill) (priority 90)
                   (info "R5: la PPill está más cerca que él"))))

;; R6 · sin peligro, a por el comestible más cercano, si llego antes de que se le pase
(defrule cazar
   (not (PELIGRO))
   (FANTASMA (nombre ?g) (comestible true)
             (distancia ?d) (tiempo ?t&:(> ?t ?d)))
   (not (FANTASMA (comestible true) (distancia ?d2&:(< ?d2 ?d))))
   =>
   (assert (ACTION (id perseguir) (fantasma ?g) (priority 60)
                   (info (str-cat "R6: cazar a " ?g)))))

