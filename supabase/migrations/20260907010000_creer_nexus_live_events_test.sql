-- NEXUS LIVE DÉVELOPPEMENT — journal d'événements d'exécution (07/09/2026).
--
-- Lot NEXUS-LIVE-CONTROL-CENTER-1-20260906 (decision-1.md). Migration
-- rédigée pour l'environnement Test uniquement — NON appliquée en
-- Production par ce lot, aucune promotion implicite.
--
-- Persistance minimale du contrat `nexus-execution-event/1`
-- (nexus-live-evenement.js valide chaque ligne avant écriture ; cette
-- table ne recalcule rien, elle stocke la vérité d'exécution déjà validée
-- — cohérent avec le principe Bible "un moteur produit sa vérité, le
-- consommateur ne la recrée pas").
--
-- Deux frontières distinctes, comme l'exige spec-1.md §7 :
--   1) qui peut lire ce journal -> capacité Créateur uniquement
--      (je_suis_createur(), déjà la capacité canonique de ce dépôt,
--      cf. nexus-live-acces.js) ;
--   2) quelles données il contient -> uniquement des métadonnées
--      d'exécution minimisées (nexus-live-evenement.js refuse déjà tout
--      contenu ressemblant à un secret avant l'écriture applicative).
--
-- Append-only : aucune politique UPDATE/DELETE n'est créée. Un événement
-- mal formé n'est jamais corrigé en place, il est simplement rejeté par
-- nexus-live-evenement.js avant d'atteindre cette table.

create table if not exists public.nexus_live_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  occurred_at timestamptz not null,
  lot_id text not null,
  run_id text not null,
  actor_id text not null,
  actor_role text not null check (actor_role in ('execution', 'orchestrator', 'guardian', 'ci')),
  phase text not null check (phase in ('ANALYSE', 'EXECUTION', 'TEST', 'GUARDIAN_REVIEW', 'CI', 'GATE', 'DONE')),
  status text not null check (status in ('STARTED', 'PROGRESS', 'PASSED', 'FAILED', 'BLOCKED', 'WAITING')),
  summary text not null,
  evidence jsonb,
  next_step text,
  human_gate jsonb,
  source jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nexus_live_events_lot_id_occurred_at_idx
  on public.nexus_live_events (lot_id, occurred_at desc);

alter table public.nexus_live_events enable row level security;

revoke all on public.nexus_live_events from anon;
revoke all on public.nexus_live_events from public;

drop policy if exists select_nexus_live_events on public.nexus_live_events;
create policy select_nexus_live_events on public.nexus_live_events for select to authenticated
  using ((select je_suis_createur()));

-- Écriture Créateur uniquement dans ce lot (pas de service_role introduit
-- ici, conformément à l'invariant "aucun secret/service_role"). Le
-- branchement d'une ingestion automatisée (Orchestrator/CI) reste un point
-- d'intégration explicite du lot event-driven, pas de ce lot.
drop policy if exists insert_nexus_live_events on public.nexus_live_events;
create policy insert_nexus_live_events on public.nexus_live_events for insert to authenticated
  with check ((select je_suis_createur()));
