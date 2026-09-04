-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817030220 · fdj_releves_cloture_idempotence_validation_employe
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create unique index if not exists fdj_releves_cloture_une_validation_employe_par_quart
  on fdj_releves_cloture (shift_id)
  where type_version = 'validation_employe';
