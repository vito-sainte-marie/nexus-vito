-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260802144312 · nexus_inventaire_v1
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Inventaire — V1 (02/08/2026)
-- Registre numérique des comptages de quart. Architecture validée avec
-- Frédéric : comptages en événements immuables (jamais d'écrasement
-- silencieux), stock transmis calculé (jamais saisi librement), quart
-- multi-employés, journal d'audit générique, alertes séparées, table de
-- rapprochement Decenium préparée pour la V2/V3 sans refonte de schéma.

create table inventaire_categories (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  nom text not null,
  ordre_affichage int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site, nom)
);

create table inventaire_zones (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  code text not null check (code in ('piste', 'boutique')),
  nom text not null,
  created_at timestamptz not null default now(),
  unique (site, code)
);

create table inventaire_produits_internes (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  designation text not null,
  unite text not null default 'unité',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table inventaire_zone_produit (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  produit_id uuid references products(id),
  produit_interne_id uuid references inventaire_produits_internes(id),
  categorie_id uuid not null references inventaire_categories(id),
  zone_id uuid not null references inventaire_zones(id),
  sensible boolean not null default false,
  ordre_affichage int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  constraint un_seul_type_produit check (
    (produit_id is not null and produit_interne_id is null) or
    (produit_id is null and produit_interne_id is not null)
  )
);
create unique index uq_zone_produit_catalogue on inventaire_zone_produit(produit_id) where produit_id is not null;
create unique index uq_zone_produit_interne on inventaire_zone_produit(produit_interne_id) where produit_interne_id is not null;

create table inventaire_quarts (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  date date not null,
  quart text not null,
  statut text not null default 'brouillon' check (statut in (
    'brouillon', 'ouverture_en_cours', 'ouvert', 'cloture_en_cours',
    'cloture', 'a_controler', 'valide_manager', 'verrouille'
  )),
  ouvert_le timestamptz,
  cloture_le timestamptz,
  created_at timestamptz not null default now(),
  unique (site, date, quart)
);

create table inventaire_quart_employes (
  id uuid primary key default gen_random_uuid(),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  employee_id uuid not null references employees(id),
  shift_id uuid references shifts(id),
  role text,
  zone_id uuid references inventaire_zones(id),
  heure_arrivee timestamptz,
  heure_depart timestamptz,
  responsable_comptage boolean not null default false,
  a_valide_ouverture boolean not null default false,
  a_valide_cloture boolean not null default false,
  created_at timestamptz not null default now(),
  unique (quart_id, employee_id)
);

create table inventaire_comptages (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  produit_id uuid references products(id),
  produit_interne_id uuid references inventaire_produits_internes(id),
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
  created_at timestamptz not null default now(),
  constraint un_seul_type_produit_comptage check (
    (produit_id is not null and produit_interne_id is null) or
    (produit_id is null and produit_interne_id is not null)
  )
);
create index idx_comptages_quart on inventaire_comptages(quart_id);
create index idx_comptages_produit on inventaire_comptages(produit_id);

create table inventaire_mouvements (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid not null references inventaire_quarts(id) on delete cascade,
  produit_id uuid references products(id),
  produit_interne_id uuid references inventaire_produits_internes(id),
  type_mouvement text not null check (type_mouvement in (
    'reassort', 'livraison', 'casse', 'retrait', 'retour', 'transfert', 'autre'
  )),
  quantite numeric not null,
  employee_id uuid references employees(id),
  justification text,
  cree_le timestamptz not null default now(),
  constraint un_seul_type_produit_mouvement check (
    (produit_id is not null and produit_interne_id is null) or
    (produit_id is null and produit_interne_id is not null)
  )
);
create index idx_mouvements_quart on inventaire_mouvements(quart_id);

create table inventaire_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid references inventaire_quarts(id) on delete cascade,
  produit_id uuid references products(id),
  produit_interne_id uuid references inventaire_produits_internes(id),
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
  produit_id uuid references products(id),
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

create table inventaire_audit_log (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  quart_id uuid references inventaire_quarts(id),
  entite_type text not null,
  entite_id uuid,
  action text not null,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  acteur_id uuid references employees(id),
  date_action timestamptz not null default now(),
  motif text,
  session_id text,
  metadata jsonb
);
create index idx_audit_log_quart on inventaire_audit_log(quart_id);
create index idx_audit_log_entite on inventaire_audit_log(entite_type, entite_id);

create table inventaire_modes_controle (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  employee_id uuid references employees(id),
  categorie_id uuid references inventaire_categories(id),
  produit_id uuid references products(id),
  date_debut date,
  date_fin date,
  mode text not null default 'aveugle' check (mode in ('aveugle', 'normal')),
  motif text,
  actif boolean not null default true,
  cree_par uuid references employees(id),
  cree_le timestamptz not null default now()
);

create table inventaire_seuils (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie' references sites(site_id),
  categorie_id uuid references inventaire_categories(id),
  cle text not null,
  valeur numeric not null,
  description text,
  created_at timestamptz not null default now()
);

alter table inventaire_categories enable row level security;
alter table inventaire_zones enable row level security;
alter table inventaire_produits_internes enable row level security;
alter table inventaire_zone_produit enable row level security;
alter table inventaire_quarts enable row level security;
alter table inventaire_quart_employes enable row level security;
alter table inventaire_comptages enable row level security;
alter table inventaire_mouvements enable row level security;
alter table inventaire_alertes enable row level security;
alter table inventaire_rapprochements enable row level security;
alter table inventaire_audit_log enable row level security;
alter table inventaire_modes_controle enable row level security;
alter table inventaire_seuils enable row level security;

create policy select_inventaire_categories on inventaire_categories for select using (site = (select current_employee_site_id()));
create policy ecriture_inventaire_categories on inventaire_categories for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_zones on inventaire_zones for select using (site = (select current_employee_site_id()));
create policy ecriture_inventaire_zones on inventaire_zones for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_produits_internes on inventaire_produits_internes for select using (site = (select current_employee_site_id()));
create policy ecriture_inventaire_produits_internes on inventaire_produits_internes for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_zone_produit on inventaire_zone_produit for select using (site = (select current_employee_site_id()));
create policy ecriture_inventaire_zone_produit on inventaire_zone_produit for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_quarts on inventaire_quarts for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_quarts on inventaire_quarts for insert with check (site = (select current_employee_site_id()));
create policy update_inventaire_quarts on inventaire_quarts for update using (site = (select current_employee_site_id()));

create policy select_inventaire_quart_employes on inventaire_quart_employes for select using (
  employee_id = (select auth.uid())
  or exists (select 1 from inventaire_quarts q where q.id = quart_id and q.site = (select current_employee_site_id()))
);
create policy insert_inventaire_quart_employes on inventaire_quart_employes for insert with check (
  exists (select 1 from inventaire_quarts q where q.id = quart_id and q.site = (select current_employee_site_id()))
);
create policy update_inventaire_quart_employes on inventaire_quart_employes for update using (
  employee_id = (select auth.uid())
  or (select current_employee_role()) = any(array['manager','gerant'])
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

create policy select_inventaire_audit_log on inventaire_audit_log for select using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
create policy insert_inventaire_audit_log on inventaire_audit_log for insert with check (site = (select current_employee_site_id()));

create policy select_inventaire_modes_controle on inventaire_modes_controle for select using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
create policy ecriture_inventaire_modes_controle on inventaire_modes_controle for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

create policy select_inventaire_seuils on inventaire_seuils for select using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);
create policy ecriture_inventaire_seuils on inventaire_seuils for all using (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
) with check (
  (select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id())
);

insert into inventaire_zones (site, code, nom) values
  ('vito-sainte-marie', 'piste', 'Piste'),
  ('vito-sainte-marie', 'boutique', 'Boutique');

insert into inventaire_categories (site, nom, ordre_affichage) values
  ('vito-sainte-marie', 'Jaugeage Carburant', 1),
  ('vito-sainte-marie', 'Gaz', 2),
  ('vito-sainte-marie', 'Glaçons', 3),
  ('vito-sainte-marie', 'Journaux', 4),
  ('vito-sainte-marie', 'Pains / Sandwichs', 5),
  ('vito-sainte-marie', 'Viennoiserie', 6),
  ('vito-sainte-marie', 'Cigarettes', 7),
  ('vito-sainte-marie', 'Boissons chaudes / Bières', 8),
  ('vito-sainte-marie', 'Huiles', 9),
  ('vito-sainte-marie', 'Lave-glace & Liquide de refroidissement', 10),
  ('vito-sainte-marie', 'CBD', 11);
