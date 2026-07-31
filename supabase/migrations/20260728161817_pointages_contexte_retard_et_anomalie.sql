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
