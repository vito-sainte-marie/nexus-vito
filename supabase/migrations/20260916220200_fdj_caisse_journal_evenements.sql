-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Journal immuable des événements d'une caisse FDJ.
-- =============================================================================
--
-- POURQUOI UNE TABLE DE PLUS
-- --------------------------
-- NEXUS possède déjà deux journaux FDJ, et ils restent utilisés :
--   * `fdj_corrections` : une correction de valeur, ancienne/nouvelle, motif ;
--   * `fdj_audit_log`   : un événement générique, ancienne/nouvelle valeur jsonb.
-- Aucun des deux ne porte ce que la doctrine exige de la caisse :
--   le numéro de version, l'écart AVANT et APRÈS, l'état de la caisse au moment
--   du geste, la date de la confirmation initiale, le nombre total de
--   corrections, et la distinction entre l'auteur de la saisie et l'employé
--   opérationnel concerné.
-- Ce journal-ci est donc spécifique à la caisse, et il est immuable.
--
-- « Une correction ultérieure ne doit jamais écraser la preuve de cette première
--   confirmation. » C'est le rôle exact de cette table : la ligne
--   `confirmation_initiale` y est écrite une fois et ne peut plus être ni
--   modifiée ni supprimée, même par une correction ultérieure.
-- =============================================================================

create table if not exists public.fdj_caisse_evenements (
  id uuid primary key default gen_random_uuid(),
  site text not null,

  -- Rattachements
  cash_control_id uuid not null references public.fdj_cash_controls(id) on delete cascade,
  shift_id uuid not null references public.fdj_shifts(id) on delete cascade,

  -- Nature du geste
  evenement text not null,

  -- Qui a agi, et pour qui
  -- « L'identité de la personne qui saisit une information et celle de l'employé
  --   opérationnel concerné doivent être deux notions distinctes. »
  auteur_id uuid references public.employees(id) on delete set null,
  auteur_role text,                       -- rôle LU EN BASE au moment du geste
  employe_responsable_id uuid references public.employees(id) on delete set null,

  -- Quand
  survenu_le timestamptz not null default now(),
  confirmation_initiale_le timestamptz,   -- rappelée sur chaque événement

  -- Versions
  version_avant int,
  version_apres int,
  nb_corrections_apres int,

  -- État de la caisse
  statut_avant text,
  statut_apres text,

  -- Valeurs et écart
  valeurs_avant jsonb,
  valeurs_apres jsonb,
  ecart_avant numeric,
  ecart_apres numeric,

  -- Justification
  motif text,
  commentaire text,

  metadata jsonb,

  constraint fdj_caisse_evenements_evenement_check check (evenement in (
    'confirmation_initiale',   -- l'employé confirme et transmet, une seule fois
    'correction_employe',      -- l'employé corrige sa caisse avant validation
    'ouverture_controle',      -- le manager ouvre le contrôle
    'correction_manager',      -- correction managériale
    'validation',              -- le manager valide
    'reouverture',             -- le manager rouvre une caisse validée
    'demande_correction'       -- l'employé signale une erreur après validation
  )),

  -- Un événement qui change une version doit dire d'où et vers où.
  constraint fdj_caisse_evenements_versions_check check (
    (version_avant is null and version_apres is null)
    or (version_avant is not null and version_apres is not null and version_apres >= version_avant)
  ),

  -- Une correction sans motif n'est pas une correction, c'est une réécriture.
  constraint fdj_caisse_evenements_motif_check check (
    evenement not in ('correction_employe', 'correction_manager', 'reouverture')
    or (motif is not null and length(btrim(motif)) >= 3)
  )
);

comment on table public.fdj_caisse_evenements is
  'Journal immuable des gestes portant sur une caisse FDJ : confirmation '
  'initiale, corrections, contrôle, validation, réouverture. Aucune ligne ne '
  'peut être modifiée ni supprimée après écriture.';
comment on column public.fdj_caisse_evenements.auteur_role is
  'Rôle de l''auteur tel qu''il était ENREGISTRÉ EN BASE au moment du geste. '
  'Jamais une métadonnée fournie par le client.';
comment on column public.fdj_caisse_evenements.confirmation_initiale_le is
  'Date de la première confirmation, recopiée sur chaque événement ultérieur '
  'pour qu''une correction ne fasse jamais disparaître la transmission initiale.';

-- Une seule confirmation initiale par caisse : c'est un fait, pas un état.
create unique index if not exists fdj_caisse_evenements_confirmation_unique
  on public.fdj_caisse_evenements (cash_control_id)
  where evenement = 'confirmation_initiale';

create index if not exists fdj_caisse_evenements_caisse_idx
  on public.fdj_caisse_evenements (cash_control_id, survenu_le);
create index if not exists fdj_caisse_evenements_shift_idx
  on public.fdj_caisse_evenements (shift_id, survenu_le);
create index if not exists fdj_caisse_evenements_site_idx
  on public.fdj_caisse_evenements (site, survenu_le desc);
create index if not exists fdj_caisse_evenements_responsable_idx
  on public.fdj_caisse_evenements (employe_responsable_id, survenu_le desc);

-- -----------------------------------------------------------------------------
-- Immuabilité — imposée par la base, pas par l'interface
-- -----------------------------------------------------------------------------
-- Une politique RLS absente suffirait à bloquer un client PostgREST, mais pas un
-- rôle qui contournerait la RLS. Le trigger, lui, s'applique à tout le monde
-- sauf au propriétaire en mode maintenance explicite.
create or replace function public.fdj_caisse_evenements_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('nexus.fdj_journal_maintenance', true) = 'true' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception
    'Le journal des événements de caisse est immuable : % refusé sur la ligne %',
    tg_op, coalesce(old.id::text, '?')
    using errcode = 'raise_exception';
end;
$$;

drop trigger if exists fdj_caisse_evenements_pas_de_modification on public.fdj_caisse_evenements;
create trigger fdj_caisse_evenements_pas_de_modification
  before update or delete on public.fdj_caisse_evenements
  for each row execute function public.fdj_caisse_evenements_immuable();

-- -----------------------------------------------------------------------------
-- Accès
-- -----------------------------------------------------------------------------
-- Phase A : la table est fermée par défaut. Personne n'y écrit directement —
-- seules les commandes serveur SECURITY DEFINER des migrations suivantes y
-- écrivent. La lecture passe par les projections dédiées (employé / manager),
-- jamais par un SELECT direct : le journal contient des motifs internes manager.
alter table public.fdj_caisse_evenements enable row level security;

revoke all on table public.fdj_caisse_evenements from anon;
revoke all on table public.fdj_caisse_evenements from authenticated;
grant select, insert on table public.fdj_caisse_evenements to service_role;

-- Aucune policy n'est créée volontairement : RLS activée sans policy = aucune
-- ligne visible et aucune écriture possible pour `anon` et `authenticated`.
-- Ce n'est pas un oubli, c'est la fermeture par défaut.

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop trigger if exists fdj_caisse_evenements_pas_de_modification
--     on public.fdj_caisse_evenements;
--   drop function if exists public.fdj_caisse_evenements_immuable();
--   drop table if exists public.fdj_caisse_evenements;
-- ATTENTION : supprimer cette table détruit des preuves de confirmation et de
-- correction. Ne l'exécuter que si aucune commande serveur de la Vague 1 n'a
-- encore écrit en Production.
-- =============================================================================
