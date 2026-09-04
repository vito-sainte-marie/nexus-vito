-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260819022828 · inventaire_production_journaliere_v1
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Inventaire — Production journalière, mouvements & réceptions
-- (cahier "NEXUS_Audit_Inventaire_Mouvements_Production_Receptions_Developpeur.pdf",
-- 18/08/2026, M1-M8).

-- 1. Profil "Production journalière" (M1)
alter table public.inventaire_regles_produit drop constraint inventaire_regles_produit_profil_check;
alter table public.inventaire_regles_produit add constraint inventaire_regles_produit_profil_check
  check (profil = any (array['continu','cycle_journalier','lot_glissant','presse','consommable','production_journaliere']));

comment on column public.inventaire_regles_produit.profil is 'Profil métier du produit. production_journaliere (18/08/2026) : le comptage aveugle d''ouverture est remplacé par une préparation recommandée + réellement mise au four (voir inventaire_production_regles), le reste physique est compté en clôture comme les autres profils.';

-- 2. Mouvements : nouveaux types + idempotence (M3, M6)
alter table public.inventaire_mouvements drop constraint inventaire_mouvements_type_mouvement_check;
alter table public.inventaire_mouvements add constraint inventaire_mouvements_type_mouvement_check
  check (type_mouvement = any (array['reassort','livraison','casse','retrait','retour','transfert','autre','production_initiale','production_additionnelle']));

alter table public.inventaire_mouvements add column if not exists idempotency_key uuid;
create unique index if not exists inventaire_mouvements_idempotency_key_uniq
  on public.inventaire_mouvements (idempotency_key) where (idempotency_key is not null);

comment on column public.inventaire_mouvements.idempotency_key is 'Clé posée côté client avant l''écriture (Sprint Production journalière, 18/08/2026) -- un double tap ou un retry réseau réutilise la même clé et échoue silencieusement sur la contrainte unique au lieu de créer un doublon (MOV-11).';

-- 3. Recommandation de préparation (M2, M4.2, §12) — configuration manager
create table if not exists public.inventaire_production_regles (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  produit_id uuid not null references public.inventaire_zone_produit(id),
  valeur_semaine numeric,
  valeur_samedi numeric,
  valeur_dimanche numeric,
  valeur_vacances numeric,
  autoriser_nouvelle_fournee boolean not null default true,
  seuil_reste_surveiller numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site, produit_id)
);

comment on table public.inventaire_production_regles is 'Configuration manager (Paramètres Inventaire) des quantités de préparation conseillées par produit "Production journalière" -- semaine/samedi/dimanche/vacances + seuil de reste à surveiller. Aucune valeur renseignée = pas de recommandation calculable pour ce produit (Article 5 : jamais un zéro fabriqué).';

create table if not exists public.inventaire_production_valeurs_speciales (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  produit_id uuid not null references public.inventaire_zone_produit(id),
  date date not null,
  valeur numeric not null,
  libelle text,
  created_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  unique (site, produit_id, date)
);

comment on table public.inventaire_production_valeurs_speciales is 'Override ponctuel de la recommandation pour un produit à une date précise (ex. 24/12), priorité 1 du moteur de recommandation (§4.1 du cahier Production journalière).';

create table if not exists public.inventaire_calendrier_site (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  date date not null,
  type text not null check (type = any (array['vacances','ferie'])),
  libelle text,
  created_at timestamptz not null default now(),
  created_by uuid references public.employees(id),
  unique (site, date)
);

comment on table public.inventaire_calendrier_site is 'Jours de vacances scolaires / fériés configurés par le manager pour ce site (§12.1) -- utilisés par le moteur de recommandation Production journalière, priorité 2.';

-- 4. Historique des recommandations affichées (M8, §4.3, §13)
create table if not exists public.inventaire_production_recommendations (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  produit_id uuid not null references public.inventaire_zone_produit(id),
  quart_id uuid references public.inventaire_quarts(id) on delete set null,
  date date not null,
  quart text not null,
  contexte text not null,
  quantite_conseillee numeric,
  regle_id uuid references public.inventaire_production_regles(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (site, produit_id, date, quart)
);

comment on table public.inventaire_production_recommendations is 'Photo de la recommandation affichée à l''employé pour (site, produit, date, quart) -- contexte = semaine/samedi/dimanche/vacances/special/aucune_regle. Base de l''analyse "conseillé vs préparé" (M8) : jamais recalculée après coup.';

-- 5. RLS -- même modèle que inventaire_regles_produit / inventaire_mouvements
alter table public.inventaire_production_regles enable row level security;
alter table public.inventaire_production_valeurs_speciales enable row level security;
alter table public.inventaire_calendrier_site enable row level security;
alter table public.inventaire_production_recommendations enable row level security;

create policy select_inventaire_production_regles on public.inventaire_production_regles
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_production_valeurs_speciales on public.inventaire_production_valeurs_speciales
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_calendrier_site on public.inventaire_calendrier_site
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_production_recommendations on public.inventaire_production_recommendations
  for select using (site = current_employee_site_id());

create policy ecriture_inventaire_production_regles on public.inventaire_production_regles
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));
create policy ecriture_inventaire_production_valeurs_speciales on public.inventaire_production_valeurs_speciales
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));
create policy ecriture_inventaire_calendrier_site on public.inventaire_calendrier_site
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));

create policy insert_inventaire_production_recommendations on public.inventaire_production_recommendations
  for insert with check (site = current_employee_site_id());
