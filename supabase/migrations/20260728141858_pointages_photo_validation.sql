-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728141858 · pointages_photo_validation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Photo de validation pour l'arrivée et le départ (28/07/2026, demande de
-- Frédéric) : mêmes principes que photo_par_action sur les missions —
-- la photo valide l'action, pas de contrainte SQL bloquante (une ligne
-- historique existante n'a pas de photo), l'exigence vit côté interface.
alter table public.pointages add column if not exists photo_url text;
comment on column public.pointages.photo_url is 'Photo prise au moment du pointage (arrivée/départ) — valide l''action. Stockée dans le bucket privé preuves-missions, sous le dossier de l''employé.';
