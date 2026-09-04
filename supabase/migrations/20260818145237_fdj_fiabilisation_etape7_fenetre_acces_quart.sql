-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818145237 · fdj_fiabilisation_etape7_fenetre_acces_quart
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- FDJ Fiabilisation Étape 7 (18/08/2026, cahier NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf,
-- §13 "Verrouillage des employés sur leur quart") : "Les horaires de quart et
-- la fenêtre de 30 minutes sont configurables par station" (§18 recap). Le
-- verrou horaire lui-même (NexusFdjMoteur.evaluerAccesQuart, table
-- fdj_employee_shift_locks, RLS serveur) était déjà entièrement construit le
-- 13/08/2026 (tâche "FDJ — Règle d'accès aux quarts V1") — seule la fenêtre
-- des 30 minutes restait une constante JS codée en dur au lieu d'être un
-- paramètre par site, contrairement à horaire_bascule_quart2_repli et aux
-- seuils Coach déjà migrés.
alter table public.fdj_site_settings
  add column if not exists fenetre_acces_quart_min integer not null default 30;

comment on column public.fdj_site_settings.fenetre_acces_quart_min is
  'FDJ Fiabilisation Étape 7 : nombre de minutes avant l''heure officielle
  d''un quart à partir duquel un employé peut y accéder (NexusFdjMoteur.
  evaluerAccesQuart, 4e paramètre). Défaut 30 = comportement historique
  inchangé pour tout site n''ayant jamais configuré cette valeur.';
