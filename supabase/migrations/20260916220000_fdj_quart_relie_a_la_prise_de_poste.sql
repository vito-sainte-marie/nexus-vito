-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Relier le quart FDJ à l'événement de prise de poste qui l'a ouvert.
-- =============================================================================
--
-- POURQUOI
-- --------
-- Aujourd'hui un quart FDJ est créé par le navigateur, au simple chargement de
-- l'écran FDJ (NEXUS-FDJ-v1.html, bootstrap -> obtenirOuCreerShift()). Trois
-- conséquences mesurées :
--   1. ouvrir un écran crée un quart — or « ouvrir un écran FDJ ne constitue pas
--      une prise de poste » ;
--   2. le visiteur devient responsable du quart, y compris un manager qui ne fait
--      que consulter ;
--   3. rien ne relie le quart FDJ à la prise de poste opérationnelle réelle
--      (table `shifts`, écrite par NEXUS-Prise-De-Poste-v1.html).
--
-- Cette migration n'enlève rien et ne corrige aucune donnée. Elle ajoute les
-- colonnes qui permettront à une commande serveur (migration 20260916220500)
-- d'ouvrir le quart FDJ à partir d'une prise de poste explicite, de façon
-- idempotente, et de tracer une reprise managériale au lieu d'une réattribution
-- silencieuse.
--
-- CE QU'ELLE NE FAIT PAS
-- ---------------------
--   * elle n'invente aucun fait historique : les 85 quarts existants gardent
--     `prise_de_poste_id IS NULL` et `created_by IS NULL`, qui se lisent
--     « ouverture historique, événement source inconnu » ;
--   * elle ne supprime ni ne restreint aucun accès existant — le front servi
--     continue de fonctionner exactement comme avant (Phase A) ;
--   * elle ne crée aucune contrainte d'unicité nouvelle sur (site, date, quart) :
--     l'index unique `fdj_shifts_site_date_quart_key` existe déjà.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. L'événement de prise de poste source
-- -----------------------------------------------------------------------------
-- `shifts` est la table de la prise de poste opérationnelle : une ligne y est
-- insérée quand un employé confirme « Confirmer ma prise de poste ». C'est le
-- seul fait qui, dans NEXUS, signifie « je prends mon poste maintenant ».
alter table public.fdj_shifts
  add column if not exists prise_de_poste_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fdj_shifts_prise_de_poste_fk'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_prise_de_poste_fk
      foreign key (prise_de_poste_id) references public.shifts(id)
      on delete set null
      not valid;
  end if;
end $$;

comment on column public.fdj_shifts.prise_de_poste_id is
  'Prise de poste opérationnelle (public.shifts.id) qui a ouvert ce quart FDJ. '
  'NULL = quart historique ouvert avant la refonte, événement source inconnu. '
  'Ne jamais renseigner rétroactivement par déduction.';

-- Idempotence forte : un même événement de prise de poste n'ouvre jamais deux
-- quarts FDJ. Index partiel, donc les lignes historiques (NULL) n'y participent
-- pas et aucune donnée existante n'est mise en défaut.
create unique index if not exists fdj_shifts_prise_de_poste_unique
  on public.fdj_shifts (prise_de_poste_id)
  where prise_de_poste_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Auteur technique de la création, distinct du responsable opérationnel
-- -----------------------------------------------------------------------------
-- « L'identité de la personne qui saisit une information et celle de l'employé
--   opérationnel concerné doivent être deux notions distinctes. »
-- `employee_id` = employé responsable du quart.
-- `created_by`  = qui a techniquement provoqué l'enregistrement (peut être le
--                 même employé ; peut être un manager lors d'une reprise).
alter table public.fdj_shifts
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fdj_shifts_created_by_fk'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_created_by_fk
      foreign key (created_by) references public.employees(id)
      on delete set null
      not valid;
  end if;
end $$;

comment on column public.fdj_shifts.created_by is
  'Auteur technique de la création de la ligne, distinct de employee_id '
  '(responsable opérationnel). NULL = auteur historique inconnu.';

-- -----------------------------------------------------------------------------
-- 3. Comment ce quart a-t-il été ouvert
-- -----------------------------------------------------------------------------
alter table public.fdj_shifts
  add column if not exists ouverture_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fdj_shifts_ouverture_source_check'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_ouverture_source_check
      check (
        ouverture_source is null
        or ouverture_source in (
          'prise_de_poste',      -- ouverture naturelle, depuis public.shifts
          'reprise_manager',     -- reprise explicite, justifiée et journalisée
          'creation_manager',    -- création manuelle par un manager habilité
          'historique',          -- ligne antérieure à la refonte, qualifiée après coup
          'test'                 -- jeux de recette
        )
      )
      not valid;  -- les 85 lignes existantes restent NULL et ne sont pas jugées
  end if;
end $$;

comment on column public.fdj_shifts.ouverture_source is
  'Origine de l''ouverture du quart FDJ. NULL = ouverture historique non qualifiée. '
  'Contrainte NOT VALID : aucune ligne existante n''est corrigée ni invalidée.';

-- -----------------------------------------------------------------------------
-- 4. Reprise / transfert explicite de responsabilité
-- -----------------------------------------------------------------------------
-- Si un quart existe déjà pour (site, date métier, numéro de quart) et qu'une
-- autre personne prend son poste, la responsabilité n'est JAMAIS réattribuée
-- silencieusement : il faut une reprise managériale explicite, motivée, tracée.
alter table public.fdj_shifts
  add column if not exists responsable_precedent_id uuid,
  add column if not exists responsable_transfere_par uuid,
  add column if not exists responsable_transfere_le timestamptz,
  add column if not exists motif_transfert text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fdj_shifts_responsable_precedent_fk'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_responsable_precedent_fk
      foreign key (responsable_precedent_id) references public.employees(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fdj_shifts_transfere_par_fk'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_transfere_par_fk
      foreign key (responsable_transfere_par) references public.employees(id)
      on delete set null
      not valid;
  end if;

  -- Un transfert est un tout : auteur, date et motif vont ensemble.
  if not exists (
    select 1 from pg_constraint where conname = 'fdj_shifts_transfert_complet_check'
  ) then
    alter table public.fdj_shifts
      add constraint fdj_shifts_transfert_complet_check
      check (
        (responsable_transfere_par is null
         and responsable_transfere_le is null
         and motif_transfert is null)
        or
        (responsable_transfere_par is not null
         and responsable_transfere_le is not null
         and motif_transfert is not null
         and length(btrim(motif_transfert)) >= 5)
      )
      not valid;
  end if;
end $$;

comment on column public.fdj_shifts.responsable_precedent_id is
  'Responsable du quart avant une reprise explicite. NULL si aucun transfert.';
comment on column public.fdj_shifts.responsable_transfere_par is
  'Manager ayant autorisé la reprise. Une reprise sans auteur est interdite.';
comment on column public.fdj_shifts.motif_transfert is
  'Motif obligatoire de la reprise, saisi par le manager (>= 5 caractères).';

-- -----------------------------------------------------------------------------
-- 5. Lecture du quart FDJ à partir d'un quart de prise de poste
-- -----------------------------------------------------------------------------
-- `shifts.quart` vaut 'matin' | 'soir' | 'renfort'.
-- `fdj_shifts.quart` vaut '1' | '2' (contrainte fdj_shifts_quart_check).
-- La correspondance matin->1 / soir->2 a été vérifiée sur les données réelles
-- (51 concordances contre 3 discordances, toutes antérieures à la refonte).
-- 'renfort' ne désigne aucun numéro de quart FDJ : il n'ouvre rien, et c'est un
-- arbitrage documenté, pas un oubli.
create or replace function public.fdj_numero_quart_depuis_prise_de_poste(p_quart text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_quart
           when 'matin' then '1'
           when 'soir'  then '2'
           else null          -- 'renfort', NULL, ou toute valeur non mappable
         end;
$$;

comment on function public.fdj_numero_quart_depuis_prise_de_poste(text) is
  'Traduit le quart d''une prise de poste (matin|soir|renfort) en numéro de quart '
  'FDJ (1|2). Renvoie NULL quand aucun quart FDJ ne correspond — notamment pour '
  '« renfort », qui ne désigne pas un quart FDJ identifiable.';

revoke all on function public.fdj_numero_quart_depuis_prise_de_poste(text) from public;
revoke all on function public.fdj_numero_quart_depuis_prise_de_poste(text) from anon;
grant execute on function public.fdj_numero_quart_depuis_prise_de_poste(text) to authenticated;
grant execute on function public.fdj_numero_quart_depuis_prise_de_poste(text) to service_role;

-- -----------------------------------------------------------------------------
-- 6. Date métier d'un site
-- -----------------------------------------------------------------------------
-- La date d'un quart FDJ ne doit jamais venir de l'horloge de l'appareil
-- (le front actuel utilise dateISO(), qui est la date du navigateur). Elle se
-- déduit d'un instant serveur et du fuseau déclaré pour le site.
create or replace function public.fdj_date_metier(p_site text, p_instant timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_instant at time zone coalesce(
            (select sc.fuseau_horaire from public.station_config sc where sc.site = p_site),
            (select s.timezone        from public.sites s          where s.site_id = p_site),
            'UTC'
          ))::date;
$$;

comment on function public.fdj_date_metier(text, timestamptz) is
  'Date métier d''un site pour un instant donné, selon le fuseau déclaré '
  '(station_config.fuseau_horaire, puis sites.timezone, puis UTC). Ne jamais '
  'utiliser la date du navigateur pour dater un quart.';

revoke all on function public.fdj_date_metier(text, timestamptz) from public;
revoke all on function public.fdj_date_metier(text, timestamptz) from anon;
grant execute on function public.fdj_date_metier(text, timestamptz) to authenticated;
grant execute on function public.fdj_date_metier(text, timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- 7. Index de service
-- -----------------------------------------------------------------------------
create index if not exists fdj_shifts_created_by_idx
  on public.fdj_shifts (created_by)
  where created_by is not null;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop index if exists public.fdj_shifts_prise_de_poste_unique;
--   drop index if exists public.fdj_shifts_created_by_idx;
--   alter table public.fdj_shifts
--     drop constraint if exists fdj_shifts_transfert_complet_check,
--     drop constraint if exists fdj_shifts_transfere_par_fk,
--     drop constraint if exists fdj_shifts_responsable_precedent_fk,
--     drop constraint if exists fdj_shifts_ouverture_source_check,
--     drop constraint if exists fdj_shifts_created_by_fk,
--     drop constraint if exists fdj_shifts_prise_de_poste_fk,
--     drop column if exists motif_transfert,
--     drop column if exists responsable_transfere_le,
--     drop column if exists responsable_transfere_par,
--     drop column if exists responsable_precedent_id,
--     drop column if exists ouverture_source,
--     drop column if exists created_by,
--     drop column if exists prise_de_poste_id;
--   drop function if exists public.fdj_date_metier(text, timestamptz);
--   drop function if exists public.fdj_numero_quart_depuis_prise_de_poste(text);
-- Aucune donnée n'est perdue par ce retour arrière : les colonnes supprimées
-- n'existaient pas avant cette migration.
-- =============================================================================
