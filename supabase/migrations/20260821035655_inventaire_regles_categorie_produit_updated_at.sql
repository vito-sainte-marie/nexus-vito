-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821035655 · inventaire_regles_categorie_produit_updated_at
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 20/08/2026, Sprint 3 "Fiche produit : paramétrage hérité/exception"
-- (demande de Frédéric : "Dernière modification : 20/08/2026" sur la fiche
-- produit). Sans ce champ, cette information ne serait qu'inventée
-- (Article 5) — ajout additif, mis à jour explicitement par l'application à
-- chaque écriture (pas de trigger : même convention "écriture explicite en
-- JS" que le reste du module Inventaire, jamais un mécanisme caché côté
-- base qui pourrait diverger silencieusement de ce que l'écran affiche).
alter table inventaire_categories add column updated_at timestamptz not null default now();
alter table inventaire_regles_produit add column updated_at timestamptz not null default now();
