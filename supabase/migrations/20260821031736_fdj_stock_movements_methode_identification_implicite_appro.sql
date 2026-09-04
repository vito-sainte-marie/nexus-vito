-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821031736 · fdj_stock_movements_methode_identification_implicite_appro
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Retour de Frédéric (20/08/2026) : "une quantité saisie en appro doit
-- toujours être rattachée à une activation existante ou provoquer la
-- création d'une activation manquante." Nouvelle valeur de
-- méthode_identification pour distinguer PROVENANCE : 'quantite' = clic
-- "Activer" en direct pendant le quart (existant), 'saisie_manuelle' =
-- reconstruction rétroactive par un manager (existant, ouvrirRapprochement),
-- 'implicite_appro' = déduite automatiquement d'un appro saisi sans
-- activation correspondante, APRÈS confirmation explicite de l'employé
-- (jamais une déduction silencieuse — Article 5). 'scan' déjà présente
-- dans la contrainte mais non utilisée par aucun écran à ce jour.
alter table fdj_stock_movements drop constraint fdj_stock_movements_methode_identification_check;
alter table fdj_stock_movements add constraint fdj_stock_movements_methode_identification_check
  check (methode_identification = any (array['quantite','scan','saisie_manuelle','implicite_appro']));
