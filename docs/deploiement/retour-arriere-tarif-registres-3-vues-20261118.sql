-- Retour arrière de 20261117020851_tarif_registres_vues.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- Ne perd aucune donnée (vues seulement). À jouer après le retrait de la 4 (qui recrée l'une des vues).
begin;
drop view if exists v_tarif_incoherences;
drop view if exists v_tarif_exceptions_effectives;
drop view if exists v_tarif_prix_application_actifs;
commit;
