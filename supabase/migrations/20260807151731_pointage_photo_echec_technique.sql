-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807151731 · pointage_photo_echec_technique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Photo non bloquante en cas d'échec technique (07/08/2026, demande de
-- Frédéric, suite au 2e cas de Samantha) : un problème technique (réseau,
-- navigateur qui décharge la page pendant la prise) ne doit jamais mettre
-- en doute la bonne foi de l'employé ni le bloquer. Si la photo échoue
-- malgré la relance automatique côté interface, le pointage est accepté
-- sans photo — ce champ trace explicitement qu'il s'agit d'un échec
-- technique reconnu, et non d'une photo simplement absente ou refusée.
alter table public.pointages add column if not exists photo_echec_technique boolean not null default false;
comment on column public.pointages.photo_echec_technique is 'Vrai si la photo de validation (arrivée/départ) a échoué pour une raison technique malgré une relance automatique — le pointage est alors accepté sans photo, sans mettre en cause l''employé. Distinct d''un photo_url simplement absent (pause, données antérieures à la fonctionnalité).';
