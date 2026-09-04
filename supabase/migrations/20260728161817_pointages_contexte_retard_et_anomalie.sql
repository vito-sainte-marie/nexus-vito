-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728161817 · pointages_contexte_retard_et_anomalie
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Contexte du retard + signalement d'anomalie (28/07/2026, demande de
-- Frédéric) : l'employé voyait un simple "+84 min" sans savoir d'où ça
-- sortait, ce qui pouvait passer pour un bug. On enregistre maintenant
-- l'horaire de quart prévu AU MOMENT du pointage (fait réel, jamais
-- recalculé après coup) pour pouvoir toujours expliquer le retard, et on
-- permet à l'employé de signaler une anomalie horodatée — utile pour lui
-- comme preuve, et pour le manager en cas de contestation tardive.
alter table public.pointages add column if not exists heure_debut_quart timestamptz;
alter table public.pointages add column if not exists anomalie_signalee text;
alter table public.pointages add column if not exists anomalie_signalee_le timestamptz;
comment on column public.pointages.heure_debut_quart is 'Heure de début du quart actif au moment du pointage (copiée depuis shifts.heure_debut) — permet d''expliquer un retard sans avoir à recalculer plus tard.';
comment on column public.pointages.anomalie_signalee is 'Texte libre saisi par l''employé pour signaler un désaccord ou une explication sur ce pointage (ex: retard constaté à tort).';
