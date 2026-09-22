-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Le cycle de vie d'une caisse FDJ, inscrit dans la table.
-- =============================================================================
--
-- CYCLE CANONIQUE
-- ---------------
--   brouillon
--     -> confirmée / transmise par l'employé
--        -> éventuellement corrigée par l'employé, avant contrôle
--           -> validée par le manager
--              -> éventuellement rouverte ou régularisée (procédure distincte)
--
-- CE QUE LA TABLE NE SAIT PAS DIRE AUJOURD'HUI
-- -------------------------------------------
--   * qui a saisi, par opposition à qui est responsable ;
--   * si la caisse a été confirmée par l'employé, et quand ;
--   * qui a ouvert le contrôle manager, et quand ;
--   * combien de fois elle a été corrigée, et dans quelle version elle est.
-- Les états `brouillon` et `confirmee` n'existent même pas : la valeur par
-- défaut est `provisoire`, qui sert aujourd'hui à la fois de « pas encore
-- contrôlée » et de « remise en cause après correction ».
--
-- COMPATIBILITÉ HISTORIQUE
-- ------------------------
-- Les huit valeurs de statut existantes sont toutes conservées. `provisoire`
-- reste valide et reste le synonyme historique de « confirmée, en attente du
-- contrôle manager » : aucune ligne n'est renommée, aucune n'est reclassée.
-- Les 82 contrôles existants gardent `confirme_par IS NULL`, qui se lit
-- « auteur historique inconnu » et non « jamais confirmée ».
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Qui fait quoi — trois rôles distincts sur une même caisse
-- -----------------------------------------------------------------------------
alter table public.fdj_cash_controls
  add column if not exists saisi_par     uuid,       -- auteur technique de la saisie
  add column if not exists confirme_par  uuid,       -- employé qui a transmis au manager
  add column if not exists confirme_le   timestamptz,-- première confirmation, immuable
  add column if not exists controle_par  uuid,       -- manager qui a OUVERT le contrôle
  add column if not exists controle_le   timestamptz;
-- `valide_par` / `valide_le` existent déjà : c'est le manager qui VALIDE.
-- Ouvrir le contrôle et valider sont deux gestes distincts : on peut contrôler
-- puis rouvrir, ou contrôler puis demander une correction, sans valider.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fdj_cash_controls_saisi_par_fk') then
    alter table public.fdj_cash_controls
      add constraint fdj_cash_controls_saisi_par_fk
      foreign key (saisi_par) references public.employees(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fdj_cash_controls_confirme_par_fk') then
    alter table public.fdj_cash_controls
      add constraint fdj_cash_controls_confirme_par_fk
      foreign key (confirme_par) references public.employees(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fdj_cash_controls_controle_par_fk') then
    alter table public.fdj_cash_controls
      add constraint fdj_cash_controls_controle_par_fk
      foreign key (controle_par) references public.employees(id) on delete set null not valid;
  end if;
end $$;

comment on column public.fdj_cash_controls.saisi_par is
  'Auteur technique de la saisie. Distinct de l''employé responsable du quart. '
  'NULL = auteur historique inconnu.';
comment on column public.fdj_cash_controls.confirme_par is
  'Employé ayant confirmé et transmis sa caisse au manager. L''employé ne valide '
  'jamais : il confirme. NULL = confirmation historique non tracée.';
comment on column public.fdj_cash_controls.confirme_le is
  'Date et heure de la PREMIÈRE confirmation. Une correction ultérieure ne doit '
  'jamais écraser cette valeur : elle est la preuve de la transmission initiale.';
comment on column public.fdj_cash_controls.controle_par is
  'Manager ayant ouvert le contrôle. Ouvrir le contrôle n''est pas valider.';

-- -----------------------------------------------------------------------------
-- 2. Versions et corrections
-- -----------------------------------------------------------------------------
alter table public.fdj_cash_controls
  add column if not exists version int not null default 1,
  add column if not exists nb_corrections int not null default 0,
  add column if not exists derniere_correction_le timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fdj_cash_controls_version_check') then
    alter table public.fdj_cash_controls
      add constraint fdj_cash_controls_version_check
      check (version >= 1 and nb_corrections >= 0 and version = nb_corrections + 1)
      not valid;
  end if;
end $$;

comment on column public.fdj_cash_controls.version is
  'Numéro de version de la caisse. 1 = valeurs de la première confirmation. '
  'Chaque correction incrémente version et nb_corrections ensemble.';
comment on column public.fdj_cash_controls.nb_corrections is
  'Nombre total de corrections apportées après la première confirmation.';

-- -----------------------------------------------------------------------------
-- 3. Les deux états manquants du cycle
-- -----------------------------------------------------------------------------
-- La nouvelle contrainte est strictement plus large que l'ancienne : toute ligne
-- qui satisfaisait l'ancienne satisfait la nouvelle. Elle peut donc être validée
-- immédiatement sans risque d'invalider une donnée historique.
alter table public.fdj_cash_controls
  drop constraint if exists fdj_cash_controls_statut_check;

alter table public.fdj_cash_controls
  add constraint fdj_cash_controls_statut_check
  check (statut in (
    -- nouveaux états explicites du cycle
    'brouillon',          -- saisie en cours, jamais transmise
    'confirmee',          -- transmise au manager, en attente de contrôle
    -- états historiques, tous conservés
    'provisoire',         -- synonyme historique de « confirmee »
    'a_controler',
    'en_attente',
    'expliquee',
    'regularise',
    'valide_avec_ecart',
    'conforme',
    'a_regulariser'
  ));

-- -----------------------------------------------------------------------------
-- 4. Une caisse validée l'est par quelqu'un, à une date
-- -----------------------------------------------------------------------------
-- Garde de cohérence, posée NOT VALID : elle protège les écritures futures sans
-- porter de jugement sur les lignes historiques (dont 24 présentent un
-- `valide_le` antérieur à `created_at`, effet d'horloge navigateur déjà
-- inventorié — ces lignes ne sont pas corrigées ici).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fdj_cash_controls_validation_complete_check') then
    alter table public.fdj_cash_controls
      add constraint fdj_cash_controls_validation_complete_check
      check (
        (valide_par is null and valide_le is null)
        or (valide_par is not null and valide_le is not null)
      )
      not valid;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Index de service pour la chronologie manager
-- -----------------------------------------------------------------------------
create index if not exists fdj_cash_controls_confirme_le_idx
  on public.fdj_cash_controls (site, confirme_le desc)
  where confirme_le is not null;

create index if not exists fdj_cash_controls_a_controler_idx
  on public.fdj_cash_controls (site, statut)
  where valide_le is null;

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop index if exists public.fdj_cash_controls_a_controler_idx;
--   drop index if exists public.fdj_cash_controls_confirme_le_idx;
--   alter table public.fdj_cash_controls
--     drop constraint if exists fdj_cash_controls_validation_complete_check,
--     drop constraint if exists fdj_cash_controls_version_check,
--     drop constraint if exists fdj_cash_controls_controle_par_fk,
--     drop constraint if exists fdj_cash_controls_confirme_par_fk,
--     drop constraint if exists fdj_cash_controls_saisi_par_fk,
--     drop column if exists derniere_correction_le,
--     drop column if exists nb_corrections,
--     drop column if exists version,
--     drop column if exists controle_le,
--     drop column if exists controle_par,
--     drop column if exists confirme_le,
--     drop column if exists confirme_par,
--     drop column if exists saisi_par;
--   alter table public.fdj_cash_controls drop constraint if exists fdj_cash_controls_statut_check;
--   alter table public.fdj_cash_controls add constraint fdj_cash_controls_statut_check
--     check (statut in ('provisoire','a_controler','en_attente','expliquee',
--                       'regularise','valide_avec_ecart','conforme','a_regulariser'));
-- ATTENTION : ce dernier retour arrière échoue si une caisse a été écrite avec
-- le statut `brouillon` ou `confirmee`. C'est volontaire : il vaut mieux un
-- retour arrière qui refuse qu'un statut silencieusement perdu.
-- =============================================================================
