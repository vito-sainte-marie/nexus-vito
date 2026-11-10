-- Calendrier du site (Guardian 6769932054, GO de Frédéric le 10/11/2026) : un même jour peut être
-- à la fois férié et en vacances scolaires. L'unicité passe de (site, date) à (site, date, type).
-- Les lecteurs ne peuvent plus supposer une ligne par jour : ils lisent toutes les lignes du jour.
-- Idempotente : rejouable sans effet.

alter table public.inventaire_calendrier_site drop constraint if exists inventaire_calendrier_site_site_date_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventaire_calendrier_site'::regclass
      and conname = 'inventaire_calendrier_site_site_date_type_key'
  ) then
    alter table public.inventaire_calendrier_site
      add constraint inventaire_calendrier_site_site_date_type_key unique (site, date, type);
  end if;
end $$;

comment on table public.inventaire_calendrier_site is 'Jours de vacances scolaires / fériés du site, une ligne par (site, date, type) : un jour férié pendant les vacances a donc deux lignes. Alimentée par le manager (Paramètres Inventaire) et par les workflows de calendrier (fériés au 1er janvier, vacances chaque mois). Utilisée par le moteur de recommandation Production journalière (priorité 2), par la commande carburant (fériés) et par Tempo (vacances).';
