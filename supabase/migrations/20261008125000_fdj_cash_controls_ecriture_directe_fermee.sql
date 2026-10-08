-- FDJ : la caisse d'un quart ne s'écrit plus que par ses commandes.
--
-- Défaut (mandat consolidé §1, §9) : anon et authenticated détenaient INSERT,
-- UPDATE, DELETE et TRUNCATE sur fdj_cash_controls. La politique d'UPDATE ne
-- filtre que le site : un employé pouvait, par un simple appel REST, poser
-- lui-même valide_par / valide_le / resultat_controle sur sa caisse — la
-- « validation réservée au manager » ne tenait que dans l'écran — ou réécrire
-- caisse_reelle et ecart d'une caisse déjà validée.
--
-- Correctif : retirer l'écriture directe. Les neuf écrivains
-- (fdj_enregistrer_brouillon_caisse, fdj_confirmer_caisse,
-- fdj_corriger_caisse_confirmee, fdj_corriger_caisse_employe,
-- fdj_corriger_caisse_manager, fdj_ouvrir_controle_caisse, fdj_rouvrir_caisse,
-- fdj_saisir_caisse_manager, fdj_valider_caisse) sont SECURITY DEFINER,
-- propriété de postgres : ils ne dépendent pas de ces droits. Aucun écran
-- n'écrit la table directement (lectures seules). La lecture reste ouverte à
-- authenticated sous RLS ; anon perd aussi la lecture, dont il n'a pas l'usage.
--
-- Épreuve : outils/epreuve-fdj-ecriture-directe-20261008/executer.sh
-- Retour arrière : grant insert, update, delete, truncate, references, trigger
--   on public.fdj_cash_controls to anon, authenticated; grant select … to anon;

revoke insert, update, delete, truncate, references, trigger
  on public.fdj_cash_controls from public, anon, authenticated;
revoke select on public.fdj_cash_controls from public, anon;
