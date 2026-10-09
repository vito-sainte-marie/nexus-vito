-- Idempotence garantie EN BASE, pas seulement en JavaScript.
-- ============================================================================
-- La file locale génère un identifiant avant la première tentative. Tant qu'il
-- ne vit que dans le navigateur, il ne protège rien : deux appareils, deux
-- onglets, ou une reprise après réinstallation peuvent encore produire deux
-- lignes pour un même geste.
--
-- `client_event_id` porte cet identifiant jusqu'en base, et l'index unique en
-- fait une garantie. NULLABLE et unicité PARTIELLE : les 92 pointages
-- historiques n'en ont pas, et on ne leur en invente pas.
-- ============================================================================

alter table public.pointages
  add column if not exists client_event_id uuid;

comment on column public.pointages.client_event_id is
  'Identifiant idempotent genere par l''appareil AVANT la premiere tentative d''envoi. Permet de rejouer une file hors ligne sans creer de doublon. NULL pour les pointages anterieurs au 11/09/2026 : aucun identifiant ne leur est invente.';

create unique index if not exists pointages_client_event_id_unique
  on public.pointages (client_event_id)
  where client_event_id is not null;
