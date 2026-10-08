-- Accepte une correction de datation vide de sens. Rougit : CHRONOLOGIE, RECEPTEUR.
select pg_temp.muter('public.enregistrer_versement_regularisation', $m$coalesce(p_correction_datation, ''))) < 5$m$, $m$coalesce(p_correction_datation, ''))) < 0$m$);
