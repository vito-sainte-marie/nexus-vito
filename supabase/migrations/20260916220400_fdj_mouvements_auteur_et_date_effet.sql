-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Livrets et mouvements : séparer l'auteur de la saisie de la date d'effet.
-- =============================================================================
--
-- CE QUI EXISTE DÉJÀ
-- ------------------
--   * `employee_id`     — présent
--   * `idempotency_key` — présent
--   * `source`          — présent
--   * `shift_id`        — présent
--   * `booklet_id`      — présent
--   * `created_at`      — présent
-- Il manque exactement deux notions, et ce sont les deux qui se confondent le
-- plus facilement à l'usage :
--   * QUI a saisi, par opposition à QUI est l'employé opérationnel concerné ;
--   * QUAND le mouvement a réellement pris effet, par opposition à quand il a
--     été enregistré dans NEXUS.
-- Un mouvement saisi le lendemain matin pour la veille au soir n'est pas un
-- mouvement du lendemain matin.
--
-- « Aucune activation ni aucun mouvement réel ne doit être créé pendant cette
--   mission. » Cette migration n'en crée aucun : elle ajoute deux colonnes.
-- =============================================================================

alter table public.fdj_stock_movements
  add column if not exists created_by uuid,
  add column if not exists effective_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fdj_stock_movements_created_by_fk') then
    alter table public.fdj_stock_movements
      add constraint fdj_stock_movements_created_by_fk
      foreign key (created_by) references public.employees(id) on delete set null
      not valid;
  end if;
end $$;

comment on column public.fdj_stock_movements.employee_id is
  'Employé opérationnel concerné par le mouvement (responsable du geste réel).';
comment on column public.fdj_stock_movements.created_by is
  'Auteur technique de la saisie, distinct de employee_id. '
  'NULL = auteur historique inconnu, jamais déduit rétroactivement.';
comment on column public.fdj_stock_movements.effective_at is
  'Date et heure réelles d''effet du mouvement. NULL sur les 354 lignes '
  'historiques : leur date d''effet n''a jamais été saisie et ne peut pas être '
  'inventée. Lire alors created_at en sachant que c''est une date '
  'd''enregistrement, pas une date d''effet.';

-- Un mouvement ne peut pas prendre effet dans le futur — garde posée NOT VALID
-- pour ne rien juger de l'existant.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fdj_stock_movements_effective_at_check') then
    alter table public.fdj_stock_movements
      add constraint fdj_stock_movements_effective_at_check
      check (effective_at is null or effective_at <= created_at + interval '1 day')
      not valid;
  end if;
end $$;

create index if not exists fdj_stock_movements_effective_at_idx
  on public.fdj_stock_movements (site, effective_at desc)
  where effective_at is not null;

create index if not exists fdj_stock_movements_created_by_idx
  on public.fdj_stock_movements (created_by)
  where created_by is not null;

-- -----------------------------------------------------------------------------
-- L'idempotence existe : il faut encore qu'elle morde.
-- -----------------------------------------------------------------------------
-- `idempotency_key` est présente mais n'est unique nulle part : deux appels
-- répétés avec la même clé créent aujourd'hui deux mouvements. Index partiel :
-- les lignes historiques sans clé n'y participent pas.
--
-- Mesure préalable en Production (lecture seule, 16/09) :
--   354 mouvements, 110 portent une clé, 110 clés distinctes.
-- L'index unique se crée donc sans mettre aucune ligne existante en défaut.
create unique index if not exists fdj_stock_movements_idempotency_unique
  on public.fdj_stock_movements (idempotency_key)
  where idempotency_key is not null;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop index if exists public.fdj_stock_movements_idempotency_unique;
--   drop index if exists public.fdj_stock_movements_created_by_idx;
--   drop index if exists public.fdj_stock_movements_effective_at_idx;
--   alter table public.fdj_stock_movements
--     drop constraint if exists fdj_stock_movements_effective_at_check,
--     drop constraint if exists fdj_stock_movements_created_by_fk,
--     drop column if exists effective_at,
--     drop column if exists created_by;
-- =============================================================================
