-- =============================================================================
-- FDJ — VAGUE 1 — PHASE A (« ÉTENDRE »)
-- Signaler une erreur APRÈS validation, sans rien modifier de ce qui est validé.
-- =============================================================================
--
-- LA RÈGLE
-- --------
-- Une fois la caisse validée par le manager, l'employé ne corrige plus. Mais il
-- n'est pas muet pour autant : il dispose d'une action
--   « Signaler une erreur après validation »
-- qui NE MODIFIE AUCUNE VALEUR VALIDÉE. Elle crée une demande horodatée,
-- conserve le message de l'employé, et informe le manager.
--
-- Le manager, seul, décide de la suite : refuser, rouvrir explicitement,
-- corriger lui-même, ou orienter vers une régularisation. Toute réouverture
-- est justifiée et journalisée (voir 20260916220200, événement `reouverture`).
--
-- Cette table est donc un canal de signalement, pas un canal d'écriture.
-- =============================================================================

create table if not exists public.fdj_demandes_correction (
  id uuid primary key default gen_random_uuid(),
  site text not null,

  cash_control_id uuid not null references public.fdj_cash_controls(id) on delete cascade,
  shift_id uuid not null references public.fdj_shifts(id) on delete cascade,

  -- Qui signale, et pour quel employé opérationnel
  demandeur_id uuid references public.employees(id) on delete set null,
  employe_responsable_id uuid references public.employees(id) on delete set null,

  -- Le message est conservé tel quel, y compris si la demande est refusée.
  message text not null,
  cree_le timestamptz not null default now(),

  -- Photographie de la caisse au moment du signalement, pour que le manager
  -- sache sur quoi portait la demande même si la caisse évolue ensuite.
  version_caisse_au_signalement int,
  ecart_au_signalement numeric,
  valide_le_au_signalement timestamptz,

  -- Suite donnée
  statut text not null default 'ouverte',
  traite_par uuid references public.employees(id) on delete set null,
  traite_le timestamptz,
  reponse_manager text,

  constraint fdj_demandes_correction_message_check
    check (length(btrim(message)) >= 5),

  constraint fdj_demandes_correction_statut_check check (statut in (
    'ouverte',                   -- reçue, pas encore arbitrée
    'refusee',                   -- le manager refuse, avec réponse
    'acceptee_reouverture',      -- le manager rouvre la caisse
    'corrigee_par_manager',      -- correction managériale directe
    'orientee_regularisation'    -- relève d'une régularisation d'écart antérieur
  )),

  -- Une demande traitée porte son auteur, sa date et sa réponse.
  constraint fdj_demandes_correction_traitement_check check (
    (statut = 'ouverte' and traite_par is null and traite_le is null)
    or (statut <> 'ouverte'
        and traite_par is not null
        and traite_le is not null
        and reponse_manager is not null
        and length(btrim(reponse_manager)) >= 3)
  )
);

comment on table public.fdj_demandes_correction is
  'Signalements d''erreur formulés APRÈS la validation managériale. Une demande '
  'ne modifie jamais une valeur validée : elle ouvre un arbitrage manager.';
comment on column public.fdj_demandes_correction.message is
  'Message de l''employé, conservé intégralement quelle que soit la suite donnée.';
comment on column public.fdj_demandes_correction.reponse_manager is
  'Réponse rendue à l''employé. À distinguer d''un motif interne manager, qui '
  'n''est jamais renvoyé à l''employé.';

create index if not exists fdj_demandes_correction_caisse_idx
  on public.fdj_demandes_correction (cash_control_id, cree_le desc);
create index if not exists fdj_demandes_correction_ouvertes_idx
  on public.fdj_demandes_correction (site, cree_le desc)
  where statut = 'ouverte';
create index if not exists fdj_demandes_correction_demandeur_idx
  on public.fdj_demandes_correction (demandeur_id, cree_le desc);

-- -----------------------------------------------------------------------------
-- Accès
-- -----------------------------------------------------------------------------
-- Fermée par défaut, comme le journal : on y écrit par commande serveur, on la
-- lit par projection. `reponse_manager` doit pouvoir revenir à l'employé, mais
-- c'est la projection qui choisit ce qu'elle renvoie — pas le client.
alter table public.fdj_demandes_correction enable row level security;

revoke all on table public.fdj_demandes_correction from anon;
revoke all on table public.fdj_demandes_correction from authenticated;
grant select, insert, update on table public.fdj_demandes_correction to service_role;

-- Aucune policy : RLS activée sans policy = fermeture complète pour `anon` et
-- `authenticated`. Volontaire.

-- =============================================================================
-- RETOUR ARRIÈRE
-- -----------------------------------------------------------------------------
--   drop table if exists public.fdj_demandes_correction;
-- Sans effet sur les données existantes : la table est créée vide et n'est
-- alimentée que par les commandes serveur de la Vague 1.
-- =============================================================================
