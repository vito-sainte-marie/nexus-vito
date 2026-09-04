-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260828034038 · creer_journal_recommandation_carburant
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 27/08/2026, refonte qualitative Carburants (point 20, demande de
-- Frédéric) : "Ajouter un journal minimal : 27/08 10:10 — recommandation :
-- 11 000 L GO. 27/08 14:40 — recommandation recalculée : 9 000 L GO.
-- Motif : ventes inférieures aux prévisions." Une ligne par (site_id,
-- carburant) — jamais dupliquée — sur le modèle exact de
-- journal_fraicheur_secteurs (Article 11) : on veut savoir OÙ EN EST
-- chaque carburant maintenant et l'historique complet des transitions,
-- pas combien de fois le calcul a tourné.
create table if not exists public.carburant_recommandation_journal (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  carburant text not null,
  recommandation_l numeric not null default 0,
  etat text not null,
  ventes_prevues_l numeric,
  stock_ancre_l numeric,
  premiere_detection_le timestamptz not null default now(),
  derniere_maj_le timestamptz not null default now(),
  historique jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carburant_recommandation_journal_site_carburant_unique
  on public.carburant_recommandation_journal using btree (site_id, carburant);

alter table public.carburant_recommandation_journal enable row level security;

create policy select_carburant_recommandation_journal
  on public.carburant_recommandation_journal for select
  using (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));

create policy inserer_carburant_recommandation_journal
  on public.carburant_recommandation_journal for insert
  with check (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));

create policy modifier_carburant_recommandation_journal
  on public.carburant_recommandation_journal for update
  using (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));
