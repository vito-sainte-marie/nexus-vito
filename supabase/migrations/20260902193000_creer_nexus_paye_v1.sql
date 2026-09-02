-- NEXUS PAYE v1 — préparation et fiabilisation des variables mensuelles.
-- PAYE ne produit pas de bulletin et ne déduit jamais un écart automatiquement.

alter table public.station_config
  add column if not exists paye_config jsonb not null default '{"actif":false,"jours_heure_supp":[4,5,6],"minutes_heure_supp":60,"activites_heure_supp":["piste","boutique"],"quart_exclu_heure_supp":"renfort","retard_max_coherent_min":180,"jours_feries":[]}'::jsonb;

update public.station_config
set paye_config = jsonb_build_object(
  'actif', true,
  'jours_heure_supp', jsonb_build_array(4,5,6),
  'minutes_heure_supp', 60,
  'activites_heure_supp', jsonb_build_array('piste','boutique'),
  'quart_exclu_heure_supp', 'renfort',
  'retard_max_coherent_min', 180,
  'jours_feries', coalesce(paye_config->'jours_feries', '[]'::jsonb)
)
where site = 'vito-sainte-marie';

create table if not exists public.nexus_paye_employee_settings (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  site_id text not null,
  inclus_paye boolean not null default true,
  mode_presence text not null default 'automatique'
    check (mode_presence in ('automatique','manuel','exclu')),
  commentaire text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id)
);

create index if not exists idx_nexus_paye_employee_settings_site
  on public.nexus_paye_employee_settings(site_id);

create table if not exists public.nexus_paye_items (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  periode date not null check (periode = date_trunc('month', periode)::date),
  date_evenement date,
  type_item text not null check (type_item in (
    'presence_exceptionnelle','absence_a_verifier','conge_paye','arret_maladie',
    'retard','retard_incoherent','heure_supplementaire','jour_ferie',
    'acompte','dette','ecart_caisse','autre'
  )),
  origine text not null default 'manuel'
    check (origine in ('manuel','planning','pointage','verify','fdj','indisponibilite')),
  source_cle text not null,
  libelle text not null,
  quantite_minutes integer check (quantite_minutes is null or quantite_minutes >= 0),
  montant_centimes integer,
  statut text not null default 'a_verifier'
    check (statut in ('a_verifier','valide','exclu')),
  impact_paye boolean not null default false,
  note text,
  cree_par uuid references public.employees(id),
  cree_le timestamptz not null default now(),
  modifie_par uuid references public.employees(id),
  modifie_le timestamptz not null default now(),
  unique (site_id, periode, employee_id, source_cle)
);

create index if not exists idx_nexus_paye_items_site_periode
  on public.nexus_paye_items(site_id, periode, employee_id);

create table if not exists public.nexus_paye_periodes (
  site_id text not null,
  periode date not null check (periode = date_trunc('month', periode)::date),
  statut text not null default 'brouillon'
    check (statut in ('brouillon','verifie','transmis')),
  snapshot jsonb,
  verifie_par uuid references public.employees(id),
  verifie_le timestamptz,
  transmis_par uuid references public.employees(id),
  transmis_le timestamptz,
  updated_at timestamptz not null default now(),
  primary key (site_id, periode)
);

alter table public.nexus_paye_employee_settings enable row level security;
alter table public.nexus_paye_items enable row level security;
alter table public.nexus_paye_periodes enable row level security;

grant select, insert, update, delete on public.nexus_paye_employee_settings to authenticated;
grant select, insert, update, delete on public.nexus_paye_items to authenticated;
grant select, insert, update, delete on public.nexus_paye_periodes to authenticated;

drop policy if exists paye_settings_manager_site on public.nexus_paye_employee_settings;
create policy paye_settings_manager_site on public.nexus_paye_employee_settings
  for all to authenticated
  using (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  )
  with check (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  );

drop policy if exists paye_items_manager_site on public.nexus_paye_items;
create policy paye_items_manager_site on public.nexus_paye_items
  for all to authenticated
  using (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  )
  with check (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  );

drop policy if exists paye_periodes_manager_site on public.nexus_paye_periodes;
create policy paye_periodes_manager_site on public.nexus_paye_periodes
  for all to authenticated
  using (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  )
  with check (
    site_id = (select public.current_employee_site_id())
    and (select public.current_employee_role()) = any(array['manager','gerant'])
  );

-- Décisions déjà actées : Fred et Lydie ne sont pas rattachés à la paie
-- de cette station ; Audrey reste incluse mais ses heures sont arbitrées.
insert into public.nexus_paye_employee_settings
  (employee_id, site_id, inclus_paye, mode_presence, commentaire)
select id, site_id, false, 'exclu',
  case when lower(username) = 'fred' then 'Indépendant — hors paie salarié NEXUS.'
       else 'Rattachée à un autre employeur — présence utile au planning seulement.' end
from public.employees
where site_id = 'vito-sainte-marie' and lower(username) in ('fred','lydie')
on conflict (employee_id) do nothing;

insert into public.nexus_paye_employee_settings
  (employee_id, site_id, inclus_paye, mode_presence, commentaire)
select id, site_id, true, 'manuel', 'Heures à confirmer par le manager.'
from public.employees
where site_id = 'vito-sainte-marie' and lower(username) = 'audrey'
on conflict (employee_id) do nothing;

