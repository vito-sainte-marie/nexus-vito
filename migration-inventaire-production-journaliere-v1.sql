-- Inventaire — Production journalière, mouvements & réceptions
-- (cahier "NEXUS_Audit_Inventaire_Mouvements_Production_Receptions_Developpeur.pdf",
-- 18/08/2026, M1-M8). Adapte Inventaire 2.0 aux viennoiseries (profil
-- "Production journalière" : recommandation -> préparation réelle -> fournées
-- -> reste) et généralise le composant "+ Ajouter un mouvement" (réception,
-- casse, retour, retrait, transfert, production).
--
-- Article 11 du projet : cette migration réutilise au maximum l'existant --
-- inventaire_mouvements (déjà utilisé pour livraison/casse/retrait/retour/
-- transfert/reassort), le mécanisme type_comptage='transmis' (déjà en place
-- pour faire hériter Q2 du reste de Q1 sans ressaisie), inventaire_corrections
-- et inventaire_audit_log (déjà en place pour tracer les corrections
-- manager). Rien de tout cela n'est dupliqué ici.
--
-- Appliquée le 18/08/2026 sur le projet Supabase uzhjpqpctpvxytxpxoqz via
-- apply_migration (nom : inventaire_production_journaliere_v1). Ce fichier
-- est une copie de traçabilité locale.

-- ============================================================
-- 1. Profil "Production journalière" (M1)
-- ============================================================
-- Ajout d'UNE nouvelle valeur au CHECK existant, jamais un renommage de
-- 'cycle_journalier' : ce profil existe déjà et sert à 8 produits réels
-- (Baguette, presse FDJ...) dont le comportement actuel ne doit pas changer.
-- 'production_journaliere' est un profil distinct, réservé aux produits pour
-- lesquels NEXUS recommande une quantité à préparer (viennoiseries).
alter table public.inventaire_regles_produit drop constraint inventaire_regles_produit_profil_check;
alter table public.inventaire_regles_produit add constraint inventaire_regles_produit_profil_check
  check (profil = any (array['continu','cycle_journalier','lot_glissant','presse','consommable','production_journaliere']));

comment on column public.inventaire_regles_produit.profil is 'Profil métier du produit. production_journaliere (18/08/2026) : le comptage aveugle d''ouverture est remplacé par une préparation recommandée + réellement mise au four (voir inventaire_production_regles), le reste physique est compté en clôture comme les autres profils.';

-- ============================================================
-- 2. Mouvements : nouveaux types + idempotence (M3, M6)
-- ============================================================
-- 'reception' du cahier = 'livraison' existant (même fait, pas de second
-- type). 'retour_fournisseur' = 'retour' existant. 'retrait_interne' =
-- 'retrait' existant. 'transfert_zones' = 'transfert' existant (porte déjà
-- zone_source_id/zone_destination_id). Seuls production_initiale et
-- production_additionnelle sont réellement nouveaux : aucun type existant ne
-- couvre "quantité mise au four".
alter table public.inventaire_mouvements drop constraint inventaire_mouvements_type_mouvement_check;
alter table public.inventaire_mouvements add constraint inventaire_mouvements_type_mouvement_check
  check (type_mouvement = any (array['reassort','livraison','casse','retrait','retour','transfert','autre','production_initiale','production_additionnelle']));

-- Idempotence (MOV-11, "un double tap ne crée jamais deux mouvements
-- identiques") : même mécanisme que inventaire_comptages.idempotency_key,
-- posé côté client à la création du geste (avant tout appel réseau) pour
-- survivre à un double tap OU un retry réseau.
alter table public.inventaire_mouvements add column if not exists idempotency_key uuid;
create unique index if not exists inventaire_mouvements_idempotency_key_uniq
  on public.inventaire_mouvements (idempotency_key) where (idempotency_key is not null);

comment on column public.inventaire_mouvements.idempotency_key is 'Clé posée côté client avant l''écriture (Sprint Production journalière, 18/08/2026) -- un double tap ou un retry réseau réutilise la même clé et échoue silencieusement sur la contrainte unique au lieu de créer un doublon (MOV-11).';

-- ============================================================
-- 3. Recommandation de préparation (M2, M4.2, §12) — configuration manager
-- ============================================================
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

-- Valeurs spéciales datées (§12 "Valeur spéciale : 14 le 24/12") : override
-- ponctuel prioritaire sur toutes les autres règles (priorité 1, §4.1).
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

-- Calendrier site (§12.1) : jours de vacances/fériés définis par le manager,
-- partagés par tous les produits du site (contrairement aux valeurs
-- spéciales ci-dessus qui sont par produit). Un jour hors calendrier = jour
-- de semaine normal (priorité 4) ou week-end (priorité 3, calculable sans
-- configuration à partir de la date).
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

-- ============================================================
-- 4. Historique des recommandations affichées (M8, §4.3, §13)
-- ============================================================
-- Trace ce qui a réellement été affiché à l'employé à l'instant T -- jamais
-- recalculé rétroactivement après coup (une règle modifiée demain ne doit
-- pas réécrire ce qui a été montré aujourd'hui). Sert de base à l'analyse
-- future "conseillé vs préparé vs écoulé" sans recalcul fragile.
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

-- ============================================================
-- 5. RLS -- même modèle que inventaire_regles_produit / inventaire_mouvements
-- ============================================================
alter table public.inventaire_production_regles enable row level security;
alter table public.inventaire_production_valeurs_speciales enable row level security;
alter table public.inventaire_calendrier_site enable row level security;
alter table public.inventaire_production_recommendations enable row level security;

-- Lecture : tout employé du site (l'employé doit voir la recommandation
-- pour préparer), plus les comptes clients NEXUS déjà habilités en lecture.
create policy select_inventaire_production_regles on public.inventaire_production_regles
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_production_valeurs_speciales on public.inventaire_production_valeurs_speciales
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_calendrier_site on public.inventaire_calendrier_site
  for select using (nexus_clients_lecture_ok(site) or site = current_employee_site_id());
create policy select_inventaire_production_recommendations on public.inventaire_production_recommendations
  for select using (site = current_employee_site_id());

-- Écriture : configuration manager (nexus_clients_ecriture_ok, même garde
-- que inventaire_regles_produit) pour les 3 tables de paramétrage.
create policy ecriture_inventaire_production_regles on public.inventaire_production_regles
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));
create policy ecriture_inventaire_production_valeurs_speciales on public.inventaire_production_valeurs_speciales
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));
create policy ecriture_inventaire_calendrier_site on public.inventaire_calendrier_site
  for all using (nexus_clients_ecriture_ok(site)) with check (nexus_clients_ecriture_ok(site));

-- Écriture : la photo de recommandation est posée par l'employé au moment où
-- NEXUS la lui affiche (comme inventaire_mouvements.insert_inventaire_mouvements).
create policy insert_inventaire_production_recommendations on public.inventaire_production_recommendations
  for insert with check (site = current_employee_site_id());
