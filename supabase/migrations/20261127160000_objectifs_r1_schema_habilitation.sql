-- Objectifs de station, lot R1 (#394) : schéma, habilitation, lecture.
--
-- PORTÉE. Tables, trigger d'immuabilité, fonction d'habilitation, RLS et vue
-- de lecture. AUCUN compte n'est désigné (objectif_habilitation reste vide) :
-- la première habilitation est la migration R2b, séparée, avec son propre GO.
-- Aucune RPC d'écriture ici (R2). Test seulement tant qu'aucun GO Production.
--
-- ÉCRITURE. Aucune politique insert/update/delete, aucun privilège d'écriture
-- pour authenticated ni anon : seules les RPC security definer de R2 écriront.
-- TRUNCATE est retiré explicitement (ouvert par défaut aux deux rôles).
--
-- HABILITATION. Le rôle (gerant, manager…) ne compte pas : seule une ligne non
-- révoquée de objectif_habilitation ouvre un droit, sur UNE station, pour un
-- compte actif de cette station. valider implique proposer et lire ; proposer
-- implique lire.
--
-- LECTURE. so_lecture : station de l'appelant ET droit lire. La vue
-- objectif_officiel (security_invoker) n'expose que l'objectif officiel, jamais
-- un brouillon ni une proposition.
--
-- CATALOGUE. Écrit par migration seulement ; lisible par authenticated. Les
-- trois indicateurs « non retenus » (CARB-PROD-H, COM-CA-H, MAR-H) n'y figurent
-- pas. nature, autorite et premier_mois sont à confirmer par le gérant.
--
-- ROLLBACK : supabase/retours/20261127160000_retour_objectifs_r1_schema_habilitation.sql

-- ---------------------------------------------------------------- catalogue
create table public.objectif_catalogue (
  indicateur_id text primary key,
  libelle       text not null,
  nature        text not null check (nature in ('performance','maitrise','potentiel')),
  classe        text not null check (classe in ('disponible','a_fiabiliser','non_disponible')),
  unite         text not null,
  agregation    text check (agregation in ('somme','moyenne_jour_complet','ratio','moyenne_par_quart')),
  sens          text not null default 'hausse' check (sens in ('hausse','baisse')),
  cible_zero_ok boolean not null default false,
  autorite      text not null default 'station',
  premier_mois  date,
  cible_externe text check (cible_externe in ('tarif_seuils')),
  objectivable  boolean not null,
  constraint objectif_catalogue_agregation_si_objectivable
    check (objectivable = false or agregation is not null)
);

-- ------------------------------------------------------------ station_objectifs
create table public.station_objectifs (
  id            uuid primary key default gen_random_uuid(),
  site          text not null references public.sites(site_id),
  indicateur_id text not null references public.objectif_catalogue(indicateur_id),
  horizon       text not null check (horizon in ('mois','trimestre','annee')),
  periode_debut date not null,
  periode_fin   date not null,
  version       integer not null check (version >= 1),
  cible         numeric not null,
  statut        text not null check (statut in ('brouillon','propose','officiel','remplace','retire')),
  origine       text not null check (origine in ('gerant','proposition_nexus','reprise_historique')),
  propose_par   uuid references public.employees(id),
  valide_par    uuid references public.employees(id),
  propose_le    timestamptz,
  valide_le     timestamptz,
  motif         text,
  remplace_id   uuid references public.station_objectifs(id),
  parent_id     uuid references public.station_objectifs(id),
  created_at    timestamptz not null default now(),
  constraint station_objectifs_version_unique
    unique (site, indicateur_id, horizon, periode_debut, version),
  constraint station_objectifs_periode_ordre check (periode_fin > periode_debut),
  constraint station_objectifs_alignement check (
    (horizon = 'mois'
       and extract(day from periode_debut) = 1
       and periode_fin = (periode_debut + interval '1 month')::date)
    or (horizon = 'trimestre'
       and extract(day from periode_debut) = 1
       and extract(month from periode_debut) in (1,4,7,10)
       and periode_fin = (periode_debut + interval '3 months')::date)
    or (horizon = 'annee'
       and extract(day from periode_debut) = 1
       and extract(month from periode_debut) = 1
       and periode_fin = (periode_debut + interval '1 year')::date)
  ),
  constraint station_objectifs_officiel_valide
    check (statut <> 'officiel' or (valide_par is not null and valide_le is not null)),
  constraint station_objectifs_motif_si_revision
    check (version = 1 or motif is not null)
);

-- Un seul objectif officiel par clé.
create unique index station_objectifs_un_officiel
  on public.station_objectifs (site, indicateur_id, horizon, periode_debut)
  where statut = 'officiel';

-- Une seule proposition ouverte par clé (garde de proposer_objectif en R2).
create unique index station_objectifs_une_proposition
  on public.station_objectifs (site, indicateur_id, horizon, periode_debut)
  where statut = 'propose';

create index station_objectifs_site_indicateur
  on public.station_objectifs (site, indicateur_id, horizon, periode_debut);

-- --------------------------------------------------------- objectif_habilitation
create table public.objectif_habilitation (
  site        text not null references public.sites(site_id),
  employe_id  uuid not null references public.employees(id),
  droit       text not null check (droit in ('lire','proposer','valider')),
  accorde_par uuid references public.employees(id),
  accorde_le  timestamptz not null default now(),
  revoque_le  timestamptz,
  primary key (site, employe_id, droit)
);

-- ------------------------------------------------------- immuabilité (R7, D8)
-- Un objectif officiel, remplacé ou retiré ne change plus de cible, de période,
-- de version ni de clé. Seul le statut peut passer de officiel à remplace (à la
-- création de la version suivante) ou à retire. Aucune suppression. Le trigger
-- se déclenche aussi en cascade : toute suppression passe par lui.
create function public.station_objectifs_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.statut in ('officiel','remplace','retire') then
      raise exception 'objectif_immuable : un objectif % ne se supprime pas', old.statut
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.statut in ('officiel','remplace','retire') then
    if new.cible is distinct from old.cible
       or new.periode_debut is distinct from old.periode_debut
       or new.periode_fin is distinct from old.periode_fin
       or new.version is distinct from old.version
       or new.site is distinct from old.site
       or new.indicateur_id is distinct from old.indicateur_id
       or new.horizon is distinct from old.horizon then
      raise exception 'objectif_immuable : cible, période, version et clé d''un objectif % ne changent pas', old.statut
        using errcode = 'P0001';
    end if;
    if new.statut is distinct from old.statut
       and not (old.statut = 'officiel' and new.statut in ('remplace','retire')) then
      raise exception 'objectif_immuable : le statut % ne passe pas à %', old.statut, new.statut
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger station_objectifs_immuable
  before update or delete on public.station_objectifs
  for each row execute function public.station_objectifs_immuable();

-- ------------------------------------------------------------- habilitation
create function public.objectif_habilite(p_site text, p_droit text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.objectif_habilitation h
    join public.employees e on e.id = h.employe_id
    where h.employe_id = auth.uid()
      and h.site = p_site
      and e.site_id = p_site
      and e.actif = true
      and h.revoque_le is null
      and case p_droit
            when 'lire'     then h.droit in ('lire','proposer','valider')
            when 'proposer' then h.droit in ('proposer','valider')
            when 'valider'  then h.droit = 'valider'
            else false
          end
  );
$$;

-- ---------------------------------------------------------------- privilèges
revoke all on function public.objectif_habilite(text, text) from public, anon;
grant execute on function public.objectif_habilite(text, text) to authenticated;
revoke all on function public.station_objectifs_immuable() from public, anon, authenticated;

revoke all on public.objectif_catalogue    from public, anon, authenticated;
revoke all on public.station_objectifs     from public, anon, authenticated;
revoke all on public.objectif_habilitation from public, anon, authenticated;
grant select on public.objectif_catalogue    to authenticated;
grant select on public.station_objectifs     to authenticated;
grant select on public.objectif_habilitation to authenticated;

-- ---------------------------------------------------------------------- RLS
alter table public.objectif_catalogue    enable row level security;
alter table public.station_objectifs     enable row level security;
alter table public.objectif_habilitation enable row level security;

create policy oc_lecture on public.objectif_catalogue
  for select to authenticated using (true);

create policy so_lecture on public.station_objectifs
  for select to authenticated
  using (site = public.current_employee_site_id()
         and public.objectif_habilite(site, 'lire'));

create policy oh_lecture on public.objectif_habilitation
  for select to authenticated
  using (site = public.current_employee_site_id()
         and (employe_id = auth.uid()
              or public.objectif_habilite(site, 'valider')));

-- ----------------------------------------------------------------------- vue
create view public.objectif_officiel
with (security_invoker = true) as
select id, site, indicateur_id, horizon, periode_debut, periode_fin,
       version, cible, valide_le
from public.station_objectifs
where statut = 'officiel';

revoke all on public.objectif_officiel from public, anon, authenticated;
grant select on public.objectif_officiel to authenticated;

-- ----------------------------------------------------------- catalogue (seed)
insert into public.objectif_catalogue
  (indicateur_id, libelle, nature, classe, unite, agregation, sens, cible_zero_ok,
   premier_mois, cible_externe, objectivable)
values
  -- disponibles
  ('CARB-VOL-TOT',  'Volume carburants total',            'performance','disponible','L',       'somme',               'hausse',false,'2026-07-15', null,          true),
  ('CARB-VOL-PROD', 'Volume carburants par produit',      'performance','disponible','L',       'somme',               'hausse',false,'2026-07-15', null,          true),
  ('CARB-LIT-JOUR', 'Litres par jour complet',            'performance','disponible','L/jour',  'moyenne_jour_complet','hausse',false,'2026-07-15', null,          true),
  ('COM-CA',        'Chiffre d''affaires boutique',       'performance','disponible','EUR',     'somme',               'hausse',false,'2026-07-15', null,          true),
  ('COM-CA-JOUR',   'Chiffre d''affaires par jour complet','performance','disponible','EUR/jour','moyenne_jour_complet','hausse',false,'2026-07-15', null,          true),
  ('COM-PANIER',    'Panier moyen',                       'performance','disponible','EUR',     'ratio',               'hausse',false,'2026-01-01', null,          true),
  ('COM-TICKETS',   'Nombre de tickets',                  'performance','disponible','tickets', 'somme',               'hausse',false,'2026-01-01', null,          true),
  ('FDJ-VOLUME',    'Volume FDJ',                         'performance','disponible','EUR',     'somme',               'hausse',false,'2026-01-01', null,          true),
  ('OPS-ECART-CAISSE','Écart de caisse moyen par quart', 'maitrise',   'disponible','EUR',     'moyenne_par_quart',   'baisse',true, '2026-07-15', null,          true),
  -- dérivés : pas de cible propre
  ('CARB-PROGRES',  'Progression carburants',             'potentiel',  'disponible','%',       null,                  'hausse',false,'2026-07-15', null,          false),
  ('COM-PROGRES',   'Progression boutique',               'potentiel',  'disponible','%',       null,                  'hausse',false,'2026-07-15', null,          false),
  ('FDJ-EVOL',      'Évolution FDJ',                      'potentiel',  'disponible','%',       null,                  'hausse',false,'2026-01-01', null,          false),
  -- à fiabiliser : objectivables sous arbitrage consigné à la validation
  ('MAR-BRUTE',     'Marge brute',                        'performance','a_fiabiliser','EUR',   'somme',               'hausse',false,'2026-07-15', null,          true),
  ('MAR-TAUX',      'Taux de marge',                      'performance','a_fiabiliser','%',     'ratio',               'hausse',false,'2026-07-15', 'tarif_seuils',true),
  ('MAR-PROGRES',   'Progression de la marge',            'potentiel',  'a_fiabiliser','%',     null,                  'hausse',false,'2026-07-15', null,          false),
  ('CARB-ECART-NE', 'Écart carburants non expliqué',      'maitrise',   'a_fiabiliser','L',     'somme',               'baisse',true, null,         null,          true),
  ('FDJ-ECART-COMP','Écart de comptage FDJ',              'maitrise',   'a_fiabiliser','EUR',   'somme',               'baisse',true, '2026-01-01', null,          true),
  ('FDJ-CONTROLES', 'Contrôles FDJ réalisés',             'maitrise',   'a_fiabiliser','nb',    'somme',               'hausse',false,'2026-01-01', null,          true),
  ('OPS-CTRL',      'Contrôles réalisés',                 'maitrise',   'a_fiabiliser','nb',    'somme',               'hausse',false,null,         null,          true),
  ('OPS-CLOT',      'Clôtures réalisées',                 'maitrise',   'a_fiabiliser','nb',    'somme',               'hausse',false,null,         null,          true),
  ('OPS-INV',       'Inventaires réalisés',               'maitrise',   'a_fiabiliser','nb',    'somme',               'hausse',false,null,         null,          true),
  ('OPS-ANO-DELAI', 'Délai de traitement des anomalies',  'maitrise',   'a_fiabiliser','jours', 'moyenne_par_quart',   'baisse',false,null,         null,          true),
  ('OPS-DELAI-RES', 'Délai de résolution',                'maitrise',   'a_fiabiliser','jours', 'moyenne_par_quart',   'baisse',false,null,         null,          true),
  ('MAR-ANO-TARIF', 'Anomalies tarifaires ouvertes',      'maitrise',   'a_fiabiliser','nb',    'somme',               'baisse',true, null,         null,          true),
  ('MAR-DEMARQUE',  'Démarque',                           'maitrise',   'a_fiabiliser','EUR',   'somme',               'baisse',true, null,         null,          true),
  ('FDJ-ANO-NR',    'Anomalies FDJ non résolues',         'maitrise',   'a_fiabiliser','nb',    'somme',               'baisse',true, '2026-01-01', null,          true),
  ('COM-DISPO-REF', 'Disponibilité des références',       'potentiel',  'a_fiabiliser','%',     'ratio',               'hausse',false,null,         null,          true),
  -- non disponibles : aucune cible possible
  ('CARB-RUPTURE',  'Ruptures carburants',                'potentiel',  'non_disponible','nb',  null,                  'baisse',true, null,         null,          false),
  ('CARB-MARGE',    'Marge carburants',                   'performance','non_disponible','EUR', null,                  'hausse',false,null,         null,          false),
  ('FDJ-COMMISSION','Commission FDJ',                     'performance','non_disponible','EUR', null,                  'hausse',false,null,         null,          false),
  ('MAR-PERTE-DC',  'Pertes dates courtes',               'maitrise',   'non_disponible','EUR', null,                  'baisse',true, null,         null,          false),
  ('MAR-EVITE',     'Pertes évitées',                     'potentiel',  'non_disponible','EUR', null,                  'hausse',false,null,         null,          false),
  ('OPS-TOURNEES',  'Tournées réalisées',                 'maitrise',   'non_disponible','nb',  null,                  'hausse',false,null,         null,          false),
  ('OPS-EQUIP',     'Équipements contrôlés',              'maitrise',   'non_disponible','nb',  null,                  'hausse',false,null,         null,          false);
