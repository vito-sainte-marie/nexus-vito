-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818020537 · inventaire_2_0_plan_comptage_p0
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Inventaire 2.0 P0 (17/08/2026, cahier "Inventaire 2.0 - Audit & implémentation")
-- Sprint 2 "Plan tournant" : NEXUS décide ce qui mérite d'être compté (doctrine §2).
-- Un plan par (site, date, quart), généré une seule fois puis persisté — jamais
-- recalculé au rechargement (INV2-04). La sélection elle-même (moteur pur JS) ne
-- fait QUE lire l'historique déjà en base (view ci-dessous) ; ce fichier ne pose
-- que le schéma et la résolution "dernier contrôle physique par produit", jamais
-- une deuxième vérité parallèle à inventaire_comptages (Article 11).

create table if not exists inventaire_plans_comptage (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  quart text not null check (quart in ('matin','soir')),
  statut text not null default 'genere' check (statut in ('genere','complete')),
  socle_cible integer not null default 0,
  surprises_cible integer not null default 0,
  genere_le timestamptz not null default now(),
  unique (site, date, quart)
);

create table if not exists inventaire_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references inventaire_plans_comptage(id) on delete cascade,
  site text not null default 'vito-sainte-marie',
  produit_id uuid not null references inventaire_zone_produit(id),
  raison_selection text not null check (raison_selection in ('critique','coverage_gap','anomalie_recente','quota_tournant','surprise')),
  obligatoire boolean not null default true,
  ordre integer not null default 0,
  statut text not null default 'a_faire' check (statut in ('a_faire','fait','manquant')),
  comptage_id uuid references inventaire_comptages(id),
  compte_le timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, produit_id)
);

create index if not exists idx_inventaire_plan_items_plan on inventaire_plan_items(plan_id);
create index if not exists idx_inventaire_plan_items_produit on inventaire_plan_items(produit_id);
create index if not exists idx_inventaire_plans_comptage_lookup on inventaire_plans_comptage(site, date, quart);

-- Fréquence de contrôle par famille (doctrine §5 du cahier : critique / standard /
-- faible rotation). `sensible` (badge visuel déjà existant) n'est jamais réutilisé
-- comme signal de fréquence — deux concepts distincts, jamais mélangés (Article 11).
-- `delai_max_jours_sans_controle` : override explicite par produit ; NULL = valeur
-- par défaut de la famille appliquée côté moteur (critique=0 = dû chaque quart,
-- standard=7, faible_rotation=21).
alter table inventaire_regles_produit
  add column if not exists frequence_controle text not null default 'standard'
    check (frequence_controle in ('critique','standard','faible_rotation')),
  add column if not exists delai_max_jours_sans_controle integer;

-- Dernier contrôle physique RÉEL par produit — jamais un stock théorique, unique-
-- ment un horodatage. Alimente le calcul "coverage_gap" (délai max dépassé) sans
-- dupliquer inventaire_comptages : lecture seule, Article 11.
create or replace view view_inventaire_dernier_controle_produit as
select site, produit_id, max(compte_le) as dernier_controle_le
from inventaire_comptages
where type_comptage in ('ouverture','cloture')
group by site, produit_id;

alter table inventaire_plans_comptage enable row level security;
alter table inventaire_plan_items enable row level security;

-- Même patron que inventaire_quarts : tout employé du site peut lire/générer/mettre
-- à jour le plan de son site (auto-génération au premier accès du quart, comme
-- obtenirOuCreerQuart existant) — aucune restriction de rôle, ce n'est pas une
-- donnée sensible côté manager.
create policy select_inventaire_plans_comptage on inventaire_plans_comptage
  for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_plans_comptage on inventaire_plans_comptage
  for insert with check (site = (select current_employee_site_id()));
create policy update_inventaire_plans_comptage on inventaire_plans_comptage
  for update using (site = (select current_employee_site_id()));

create policy select_inventaire_plan_items on inventaire_plan_items
  for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_plan_items on inventaire_plan_items
  for insert with check (site = (select current_employee_site_id()));
create policy update_inventaire_plan_items on inventaire_plan_items
  for update using (site = (select current_employee_site_id()));
