-- Retour arrière des registres T2 (PROJET, NON EXÉCUTÉ). Réservé au projet Test, sur GO, tant qu'aucune donnée réelle n'existe.
-- Supprime vues, déclencheurs, fonctions et tables T2. Ne touche à aucune table existante (produits_appel, products, etc.).
begin;
drop view if exists v_tarif_exceptions_effectives, v_tarif_prix_application_actifs,
  v_tarif_familles_actifs, v_tarif_rattachements_actifs, v_tarif_seuils_actifs, v_tarif_reglages_actifs, v_tarif_exceptions_actifs,
  v_tarif_prix_decides_actifs, v_tarif_regimes_prix_actifs, v_tarif_controles_reglementaires_actifs;
drop table if exists tarif_decisions, tarif_prix_application, tarif_controles_reglementaires, tarif_regimes_prix, tarif_prix_decides,
  tarif_exceptions, tarif_reglages, tarif_seuils, tarif_rattachements, tarif_familles;
drop function if exists tarif_controle_version(), tarif_controle_famille(), tarif_statut_exception(uuid), tarif_etat_controle(uuid), tarif_cle_reference(text, text);
commit;
