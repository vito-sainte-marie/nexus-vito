-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818120938 · fdj_shifts_last_replayed_at
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.fdj_shifts add column if not exists last_replayed_at timestamptz null;
comment on column public.fdj_shifts.needs_replay is 'FDJ Fiabilisation Étape 4 : posé à true quand une propagation automatique (Étape 2, propagationCorrectionStock) a modifié les données dérivées de ce quart (ventes, écart) sans qu''une nouvelle version de fdj_releves_cloture ait pu être posée avec succès — remis à false dès que le recalcul (rejouerReleveApresPropagation) réussit. Consommé par la Boîte d''exceptions manager (Étape 3, catégorie "replay requis") comme filet de sécurité.';
comment on column public.fdj_shifts.last_replayed_at is 'FDJ Fiabilisation Étape 4 : horodatage du dernier recalcul automatique réussi du relevé de clôture de ce quart suite à une propagation amont (voir needs_replay).';
