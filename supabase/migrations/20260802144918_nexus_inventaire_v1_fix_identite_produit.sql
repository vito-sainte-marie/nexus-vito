-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260802144918 · nexus_inventaire_v1_fix_identite_produit
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correction (02/08/2026) : products n'a PAS d'identité stable par ligne.
-- C'est une table d'imports périodiques (periode_debut/periode_fin) : un
-- même article physique (même code-barres, même nom) réapparaît avec un
-- NOUVEL id à chaque période importée (vérifié : "GAZ BLEU 12.5 Kg" a 3
-- id différents en base). Référencer products(id) depuis
-- inventaire_zone_produit aurait cassé la liaison dès le prochain import
-- trimestriel — exactement la classe de bug déjà rencontrée une fois sur
-- ce projet (correction #1 de l'audit API, "product identity keys").
--
-- Aucune donnée réelle n'existait encore dans les tables touchées (seules
-- les 11 catégories + 2 zones sont peuplées, elles ne bougent pas) donc on
-- peut recréer proprement plutôt que corriger en place.
--
-- Nouveau principe : inventaire_zone_produit devient la liste maîtresse
-- des articles suivis par NEXUS Inventaire, avec sa propre identité stable
-- (designation + code_barres en copie souple, sans contrainte FK vers
-- products). Toutes les tables filles référencent désormais UN SEUL id
-- (inventaire_zone_produit.id), plus de double colonne produit_id /
-- produit_interne_id ni de CHECK "un seul des deux".

drop table if exists inventaire_modes_controle cascade;
drop table if exists inventaire_rapprochements cascade;
drop table if exists inventaire_alertes cascade;
drop table if exists inventaire_mouvements cascade;
drop table if exists inventaire_comptages cascade;
drop table if exists inventaire_zone_produit cascade;
drop table if exists inventaire_produits_internes cascade;

-- Liste maîtresse des articles suivis (catalogue vendu ou consommable interne).
create table inventaire_zone_produit (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  designation text not null,
  code_barres text,
  source text not null default 'catalogue' check (source in ('catalogue', 'interne')),
  categorie_id uuid not null references inventaire_categories(id),
  zone_id uuid not null references inventaire_zones(id),
  unite text not null default 'unité',
  sensible boolean not null default false,
  ordre_affichage int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site, designation)
);
create index idx_zone_produit_categorie on inventaire_zone_produit(categorie_id);
create index idx_zone_produit_code_barres on inventaire_zone_produit(code_barres);

create table inventaire_comptages (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  produit_id uuid not null references inventaire_zone_produit(id),
  type_comptage text not null check (type_comptage in (
    'transmis', 'ouverture', 'intermediaire', 'cloture', 'recomptage_manager'
  )),
  quantite numeric not null,
  comptage_source_id uuid references inventaire_comptages(id),
  quantite_transmise numeric,
  employee_id uuid references employees(id),
  compte_le timestamptz not null default now(),
  source text not null default 'manuel' check (source in ('manuel', 'auto', 'import')),
  commentaire text,
  statut text not null default 'valide' check (statut in ('brouillon', 'valide', 'annule')),
  created_at timestamptz not null default now()
);
create index idx_comptages_quart on inventaire_comptages(quart_id);
create index idx_comptages_produit on inventaire_comptages(produit_id);

create table inventaire_mouvements (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  produit_id uuid not null references inventaire_zone_produit(id),
  type_mouvement text not null check (type_mouvement in (
    'reassort', 'livraison', 'casse', 'retrait', 'retour', 'transfert', 'autre'
  )),
  quantite numeric not null,
  employee_id uuid references employees(id),
  justification text,
  cree_le timestamptz not null default now()
);
create index idx_mouvements_quart on inventaire_mouvements(quart_id);

create table inventaire_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid references inventaire_quarts(id) on delete cascade,
  produit_id uuid references inventaire_zone_produit(id),
  type_alerte text not null,
  gravite text not null default 'attention' check (gravite in ('info', 'attention', 'critique')),
  valeur_attendue numeric,
  valeur_constatee numeric,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'en_cours', 'resolue', 'ignoree')),
  assignee_a uuid references employees(id),
  resolution text,
  commentaire_manager text,
  cree_le timestamptz not null default now(),
  resolue_le timestamptz
);
create index idx_alertes_quart on inventaire_alertes(quart_id);
create index idx_alertes_statut on inventaire_alertes(statut);

create table inventaire_rapprochements (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid references inventaire_quarts(id) on delete cascade,
  produit_id uuid references inventaire_zone_produit(id),
  reference_decenium text,
  stock_ouverture_valide numeric,
  reassorts numeric,
  ventes_importees numeric,
  stock_attendu numeric,
  stock_cloture_physique numeric,
  ecart numeric,
  source_import text,
  importe_le timestamptz,
  statut_validation text not null default 'en_attente' check (statut_validation in ('en_attente', 'valide', 'a_verifier')),
  created_at timestamptz not null default now()
);

create table inventaire_modes_controle (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  employee_id uuid references employees(id),
  categorie_id uuid references inventaire_categories(id),
  produit_id uuid references inventaire_zone_produit(id),
  date_debut date,
  date_fin date,
  mode text not null default 'aveugle' check (mode in ('aveugle', 'normal')),
  motif text,
  actif boolean not null default true,
  cree_par uuid references employees(id),
  cree_le timestamptz not null default now()
);

alter table inventaire_zone_produit enable row level security;
alter table inventaire_comptages enable row level security;
alter table inventaire_mouvements enable row level security;
alter table inventaire_alertes enable row level security;
alter table inventaire_rapprochements enable row level security;
alter table inventaire_modes_controle enable row level security;

create policy select_inventaire_zone_produit on inventaire_zone_produit for select using (site = (select current_employee_site_id()));
create policy ecriture_inventaire_zone_produit on inventaire_zone_produit for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_comptages on inventaire_comptages for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_comptages on inventaire_comptages for insert with check (site = (select current_employee_site_id()));

create policy select_inventaire_mouvements on inventaire_mouvements for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_mouvements on inventaire_mouvements for insert with check (site = (select current_employee_site_id()));

create policy select_inventaire_alertes on inventaire_alertes for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_alertes on inventaire_alertes for insert with check (site = (select current_employee_site_id()));
create policy update_inventaire_alertes on inventaire_alertes for update using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_rapprochements on inventaire_rapprochements for select using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
create policy ecriture_inventaire_rapprochements on inventaire_rapprochements for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_modes_controle on inventaire_modes_controle for select using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
create policy ecriture_inventaire_modes_controle on inventaire_modes_controle for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
