-- Retour arrière de 20261117020851_tarif_registres_vues.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- Retire les 11 vues v_tarif_% créées ou recréées par les migrations 3 et 4 : 2 vues dérivées d'abord, puis les 9 vues _actifs. Pas de cascade.
-- Ne perd aucune donnée (vues seulement). À jouer après le retrait de la 4 (qui recrée l'une des vues).
begin;
drop view if exists v_tarif_incoherences;
drop view if exists v_tarif_exceptions_effectives;
drop view if exists v_tarif_prix_application_actifs;
drop view if exists v_tarif_familles_actifs;
drop view if exists v_tarif_rattachements_actifs;
drop view if exists v_tarif_seuils_actifs;
drop view if exists v_tarif_reglages_actifs;
drop view if exists v_tarif_exceptions_actifs;
drop view if exists v_tarif_prix_decides_actifs;
drop view if exists v_tarif_regimes_prix_actifs;
drop view if exists v_tarif_controles_reglementaires_actifs;
commit;
