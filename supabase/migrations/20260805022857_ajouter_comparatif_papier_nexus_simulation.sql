-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805022857 · ajouter_comparatif_papier_nexus_simulation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Comparatif Papier/NEXUS (audit §29-30) : champs saisis par le manager sur
-- une session de simulation, pour permettre l'agrégation du tableau de
-- validation (nombre de simulations, temps moyen papier vs NEXUS, taux de
-- concordance) sans jamais inventer une donnée papier que NEXUS ne peut pas
-- connaître par lui-même.
alter table inventaire_quarts
  add column if not exists papier_produits_comptes integer,
  add column if not exists papier_temps_minutes numeric,
  add column if not exists papier_corrections integer,
  add column if not exists nexus_temps_minutes numeric;

comment on column inventaire_quarts.papier_temps_minutes is
  'Temps observé par le manager pour le comptage papier équivalent (audit §29) — donnée déclarative, jamais mesurée automatiquement par NEXUS.';
comment on column inventaire_quarts.nexus_temps_minutes is
  'Temps réellement chronométré côté NEXUS pendant la saisie de simulation (Date.now() à l''ouverture de la section jusqu''à l''enregistrement) — une vraie mesure, jamais une estimation.';
