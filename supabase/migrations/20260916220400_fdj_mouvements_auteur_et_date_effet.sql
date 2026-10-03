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
-- L'idempotence mordait déjà : ne pas la dédoubler.
-- -----------------------------------------------------------------------------
-- Cette migration a d'abord affirmé que `idempotency_key` « n'est unique nulle
-- part ». C'était faux, et la recette du 17/09 l'a montré à sa première
-- exécution réelle : Test et Production portent tous les deux, depuis avant
-- cette vague,
--
--   CREATE UNIQUE INDEX fdj_stock_movements_idempotency_key_uniq
--     ON public.fdj_stock_movements (idempotency_key)
--     WHERE (idempotency_key IS NOT NULL);
--
-- c'est-à-dire exactement l'index que cette migration voulait créer, au nom
-- près. Or `create unique index if not exists` compare le NOM, pas la
-- définition : sous un autre nom, le même index aurait bel et bien été créé une
-- seconde fois. Deux index uniques identiques sur une même colonne, ce n'est pas
-- une faute fonctionnelle, mais c'est un coût d'écriture payé deux fois et
-- surtout un retour arrière trompeur — supprimer le nôtre aurait laissé croire
-- que l'unicité était retirée, alors qu'elle serait restée.
--
-- On ne crée donc l'index que là où aucun index unique ne couvre déjà cette
-- colonne, et on teste la DÉFINITION, pas le nom. Sur Test comme sur Production
-- au 17/09, ce bloc ne fait rien : c'est le résultat attendu, et la recette le
-- vérifie (preuve P21.4b).
--
-- Mesure préalable en Production (lecture seule, 16/09) : 354 mouvements, 110
-- portent une clé, 110 clés distinctes. On sait maintenant pourquoi il ne
-- pouvait pas en être autrement.
do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.fdj_stock_movements'::regclass
      and i.indisunique
      and i.indnkeyatts = 1
      and i.indkey[0] = (select attnum from pg_attribute
                         where attrelid = 'public.fdj_stock_movements'::regclass
                           and attname = 'idempotency_key' and not attisdropped)
  ) then
    create unique index fdj_stock_movements_idempotency_unique
      on public.fdj_stock_movements (idempotency_key)
      where idempotency_key is not null;
    raise notice 'fdj_stock_movements : index unique d''idempotence créé.';
  else
    raise notice 'fdj_stock_movements : un index unique couvre déjà idempotency_key, rien à créer.';
  end if;
end $$;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop index if exists public.fdj_stock_movements_idempotency_unique;
--     ^ n'existe que sur une base qui ne portait pas déjà l'index. Ne JAMAIS
--       supprimer fdj_stock_movements_idempotency_key_uniq : il est antérieur
--       à cette vague et c'est lui qui porte réellement l'unicité.
--   drop index if exists public.fdj_stock_movements_created_by_idx;
--   drop index if exists public.fdj_stock_movements_effective_at_idx;
--   alter table public.fdj_stock_movements
--     drop constraint if exists fdj_stock_movements_effective_at_check,
--     drop constraint if exists fdj_stock_movements_created_by_fk,
--     drop column if exists effective_at,
--     drop column if exists created_by;
-- =============================================================================
