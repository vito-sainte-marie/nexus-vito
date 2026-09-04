-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809134116 · creer_table_fdj_alertes
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- fdj_alertes (09/08/2026, demande de Frédéric) : "si modification envoie
-- au manager une alerte [...] car ça aura des conséquences sur le quart
-- précédent car le stock de fin a peut-être été mal enregistrée."
--
-- Le stock initial d'un quart FDJ est prérempli avec le stock final du
-- quart précédent validé (chaîne continue, comme Inventaire) — l'employé
-- reste libre de le corriger si le chiffre hérité ne correspond pas à ce
-- qu'il constate. Mais cette correction remet en cause, avec effet
-- rétroactif, le stock final du quart précédent : NEXUS ne la traite
-- jamais en silence, elle génère une alerte que le manager doit examiner
-- (point rouge clignotant sur "Contrôle FDJ" en vue bureau).
-- ============================================================
create table public.fdj_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  type text not null default 'stock_initial_modifie' check (type in ('stock_initial_modifie')),
  shift_id uuid not null references public.fdj_shifts(id),           -- le quart où la modification a eu lieu
  shift_precedent_id uuid references public.fdj_shifts(id),          -- le quart dont le stock final est remis en cause
  game_id uuid not null references public.fdj_games(id),
  valeur_quart_precedent numeric,   -- stock_final hérité, tel qu'enregistré au quart précédent
  valeur_saisie numeric,            -- stock initial réellement saisi par l'employé
  employee_id uuid references public.employees(id),
  vue boolean not null default false,
  vue_par uuid references public.employees(id),
  vue_le timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.fdj_alertes is 'Alerte générée quand un employé modifie le stock initial hérité du quart précédent — jamais un simple écrasement, le manager est prévenu car le stock final du quart précédent est potentiellement faux.';

alter table public.fdj_alertes enable row level security;
create policy select_fdj_alertes on public.fdj_alertes for select using (site = (select current_employee_site_id()));
create policy insert_fdj_alertes on public.fdj_alertes for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_alertes on public.fdj_alertes for update using (site = (select current_employee_site_id()));
