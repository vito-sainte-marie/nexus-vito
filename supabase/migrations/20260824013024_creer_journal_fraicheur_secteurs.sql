-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824013024 · creer_journal_fraicheur_secteurs
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Traçabilité minimale du fallback temporel "dernier état fiable"
-- (23/08/2026, audit "Anti-dégradation temporelle" §9.2/§10).
--
-- Une ligne par (site_id, secteur_id) — même principe que nexus_risk_signals
-- (mise à jour à chaque nouvelle observation plutôt que dupliquée, avec un
-- historique des transitions conservé en jsonb) : ce qu'on veut savoir, ce
-- n'est pas "combien de fois le calcul a tourné" mais "où en est chaque
-- secteur en ce moment, et depuis quand" — l'audit demande fallback_used,
-- fallback_source_version, fallback_age_days, replaced_at, exactement les
-- champs qu'un état courant par secteur permet de répondre sans avoir à
-- rejouer un historique complet.
create table if not exists public.journal_fraicheur_secteurs (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  secteur_id text not null,

  -- Reflet de l'objet `fraicheur` calculé par NexusCarburantMoteur.fraicheurCarburant()
  -- (réutilisée telle quelle par Carburants et FDJ, Article 11).
  fallback_used boolean not null default false,
  fallback_mode text not null default 'jour',
  fallback_source_version date,
  fallback_age_days integer,

  -- Signal critique confirmé (audit §3.2, règle de précédence #5) — vrai si
  -- le mode 'jour' a été forcé malgré une journée incomplète, parce qu'un
  -- écart déjà réel a été détecté aujourd'hui (voir signalCritiqueCarburantAujourdhui
  -- / signalCritiqueFdjAujourdhui).
  signal_critique boolean not null default false,

  -- Posé UNIQUEMENT au moment précis où un fallback en cours (fallback_used
  -- = true) est remplacé par un état à nouveau courant (audit §9.2 : "À
  -- l'arrivée de nouvelles données fiables -> ... replaced_at").
  replaced_at timestamptz,

  premiere_detection_le timestamptz not null default now(),
  derniere_detection_le timestamptz not null default now(),
  historique_transitions jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint journal_fraicheur_secteurs_site_secteur_unique unique (site_id, secteur_id)
);

comment on table public.journal_fraicheur_secteurs is 'Traçabilité minimale du mécanisme de fallback temporel "dernier état fiable" (audit Anti-dégradation temporelle, §9.2/§10, 23/08/2026) — une ligne par (site_id, secteur_id), mise à jour à chaque calcul de fraîcheur plutôt que dupliquée, sur le même principe que nexus_risk_signals. Alimentée depuis nexus-brief-donnees.js (enregistrerFraicheurSecteur), best-effort — une erreur d''écriture ici ne doit jamais bloquer ni dégrader le Brief.';

alter table public.journal_fraicheur_secteurs enable row level security;

create policy select_journal_fraicheur_secteurs on public.journal_fraicheur_secteurs
  for select to authenticated
  using (site_id in (select e.site_id from public.employees e where e.id = (select auth.uid())));

create policy inserer_journal_fraicheur_secteurs on public.journal_fraicheur_secteurs
  for insert to authenticated
  with check (site_id in (select e.site_id from public.employees e where e.id = (select auth.uid())));

create policy modifier_journal_fraicheur_secteurs on public.journal_fraicheur_secteurs
  for update to authenticated
  using (site_id in (select e.site_id from public.employees e where e.id = (select auth.uid())));
