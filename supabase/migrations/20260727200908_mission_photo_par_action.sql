-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260727200908 · mission_photo_par_action
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 27/07/2026, demande de Frédéric : "intègre avec photo systématiquement
-- chacune des actions de la prise de poste" pour le rôle pompiste.
-- Jusqu'ici, mission_catalog.proof_required ne permettait qu'UNE seule
-- photo pour toute la mission, à la toute fin. photo_par_action introduit
-- un mode différent : chaque item de la checklist exige sa propre photo
-- avant de pouvoir être coché — la mission ne peut donc être validée que
-- si CHAQUE action a sa preuve, pas une preuve globale à la fin.
alter table mission_catalog add column if not exists photo_par_action boolean not null default false;
-- Stocke la photo individuelle de chaque étape cochée (mission_progress
-- existait déjà pour le simple booléen "checked" par item, on y ajoute la
-- preuve). Reste nullable : toutes les missions n'exigent pas ce niveau
-- de preuve, seul photo_par_action=true sur mission_catalog l'impose.
alter table mission_progress add column if not exists photo_url text;
