-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260813211812 · fdj_employee_shift_locks
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 13/08/2026 — Règle d'accès aux quarts FDJ V1 (demande de Frédéric) :
-- une fois qu'un employé s'engage réellement dans un quart (validation du
-- stock de départ), ce quart est verrouillé pour lui pour le reste de la
-- journée — l'autre quart devient inaccessible sans dérogation manager
-- tracée. Le verrou doit être garanti côté serveur, pas seulement par
-- l'interface : la contrainte UNIQUE (employee_id, date_service) ci-dessous
-- EST le verrou réel — un employé ne peut tout simplement pas insérer une
-- deuxième ligne pour un autre quart le même jour, quoi que fasse l'écran.
create table fdj_employee_shift_locks (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  employee_id uuid not null references employees(id),
  date_service date not null,
  quart text not null check (quart in ('1','2')),
  locked_at timestamptz not null default now(),
  -- 'validation_stock_depart' : verrou normal, posé par l'employé lui-même
  -- à son premier engagement réel dans le quart.
  -- 'override_manager' : le manager a changé le quart verrouillé pour cet
  -- employé/ce jour — toujours tracé (override_manager_id + motif).
  source_lock text not null check (source_lock in ('validation_stock_depart', 'override_manager')),
  override_manager_id uuid references employees(id),
  override_motif text,
  created_at timestamptz not null default now(),
  -- Le cœur de la règle : un seul quart verrouillé par employé et par jour.
  unique (employee_id, date_service)
);

create index idx_fdj_employee_shift_locks_site_date on fdj_employee_shift_locks (site, date_service);

alter table fdj_employee_shift_locks enable row level security;

-- Lecture : l'employé voit son propre verrou, tout employé du site voit les
-- verrous du site (même convention que les autres tables FDJ — utile au
-- manager pour l'écran de dérogation).
create policy select_fdj_employee_shift_locks on fdj_employee_shift_locks
  for select
  using (site = current_employee_site_id());

-- Premier engagement (employé) : uniquement pour soi-même, jamais avec des
-- champs de dérogation manager déjà remplis — c'est la contrainte UNIQUE qui
-- empêche ensuite un deuxième quart le même jour, pas cette policy.
create policy insert_fdj_employee_shift_locks_employe on fdj_employee_shift_locks
  for insert
  with check (
    employee_id = auth.uid()
    and site = current_employee_site_id()
    and source_lock = 'validation_stock_depart'
    and override_manager_id is null
  );

-- Dérogation (manager/gérant du site) : seule façon de créer ou modifier un
-- verrou avec source_lock='override_manager' — toujours avec
-- override_manager_id = l'auteur réel de la dérogation (jamais falsifiable
-- depuis le client). Un employé normal n'a AUCUNE policy UPDATE : il ne peut
-- donc jamais changer son propre verrou une fois posé, quoi que fasse
-- l'écran.
create policy ecriture_fdj_employee_shift_locks_manager on fdj_employee_shift_locks
  for all
  using (
    current_employee_role() = any(array['manager','gerant'])
    and site = current_employee_site_id()
  )
  with check (
    current_employee_role() = any(array['manager','gerant'])
    and site = current_employee_site_id()
    and source_lock = 'override_manager'
    and override_manager_id = auth.uid()
  );
