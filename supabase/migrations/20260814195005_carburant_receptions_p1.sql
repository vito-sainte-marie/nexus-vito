-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260814195005 · carburant_receptions_p1
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 14/08/2026, demande de Frédéric (Audit_NEXUS_Carburants_Receptions_Effet_Prix_Stock.pdf,
-- P1) : parcours Employé "Réception carburant" + sous-bloc "Qualité des
-- réceptions" dans Carburants Pilotage. Purement additif : ne touche pas à
-- carburant_releves ni carburant_stock_references. Une réception = une
-- ligne par carburant livré (un camion multi-compartiments peut livrer
-- GO+SP95+GNR en une même visite -> plusieurs lignes carburant_receptions
-- partageant le même transporteur/chauffeur/immatriculation, exactement
-- le modèle proposé par l'audit section 10). Les mesures de jaugeage
-- avant/après vivent dans une table séparée, une ligne par cuve
-- concernée (le GO peut être réparti sur 2 cuves à Vito Sainte-Marie
-- Usine) : quantité documentaire (BL), mesure terrain et mesure système
-- restent 3 valeurs distinctes, jamais fusionnées ni l'une n'écrasant
-- l'autre (Article 5 + principe explicite de l'audit section 10).

create table if not exists carburant_receptions (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  carburant text not null check (carburant in ('go', 'sp95', 'gnr')),
  date_livraison date not null,
  heure_debut timestamptz,
  heure_fin timestamptz,
  transporteur text,
  chauffeur text,
  immatriculation text,
  quantite_bl_l numeric not null,
  bon_livraison_reference text,
  cout_fournisseur_par_litre numeric,
  employe_id uuid references employees(id),
  -- Mesure système (Insite360 ou autre), reportée par le manager tant que
  -- l'intégration automatique n'existe pas (audit section 12, étape 3) --
  -- jamais confondue avec la mesure terrain ni la quantité du BL.
  quantite_systeme_l numeric,
  quantite_systeme_source text check (quantite_systeme_source in ('insite360', 'manual_manager', 'api') or quantite_systeme_source is null),
  quantite_systeme_saisie_par uuid references employees(id),
  quantite_systeme_saisie_le timestamptz,
  -- Statuts de réception, exactement les 4 de l'audit section 4.3 --
  -- "À compléter" tant qu'une donnée nécessaire manque, jamais une
  -- perte qualifiée par défaut (Article 5, règle de conception explicite
  -- de l'audit : "L'employé saisit les faits. NEXUS calcule. Le manager
  -- qualifie uniquement lorsque les éléments sont suffisants.").
  statut text not null default 'a_completer' check (statut in ('a_completer', 'coherente', 'a_rapprocher', 'anomalie_confirmee')),
  commentaire_rapprochement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists carburant_reception_mesures (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references carburant_receptions(id) on delete cascade,
  site text not null,
  cuve_id text not null,
  jaugeage_avant_l numeric not null,
  jaugeage_avant_le timestamptz not null,
  jaugeage_apres_l numeric,
  jaugeage_apres_le timestamptz,
  -- Champs "réception corrigée" (audit section 3.3) : delta_mesure_l =
  -- jaugeage_apres - jaugeage_avant (variation de cuve brute) ;
  -- ventes_pendant_livraison_l reste nul tant que le rapprochement horaire
  -- avec audits_caisse n'est pas construit (hors P1, cf. audit "dès que la
  -- donnée est disponible") ; reception_corrigee_l = delta_mesure_l +
  -- ventes_pendant_livraison_l quand cette dernière est connue, sinon
  -- égale à delta_mesure_l. Toujours recalculée par le moteur, jamais
  -- une vérité stockée qui pourrait diverger du calcul.
  delta_mesure_l numeric,
  ventes_pendant_livraison_l numeric,
  reception_corrigee_l numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_carburant_receptions_site_date on carburant_receptions (site, date_livraison desc);
create index if not exists idx_carburant_receptions_site_carburant on carburant_receptions (site, carburant, date_livraison desc);
create index if not exists idx_carburant_reception_mesures_reception on carburant_reception_mesures (reception_id);
create index if not exists idx_carburant_reception_mesures_site on carburant_reception_mesures (site);

alter table carburant_receptions enable row level security;
alter table carburant_reception_mesures enable row level security;

-- SELECT : ouvert à tout employé du même site (l'employé qui a saisi la
-- réception doit pouvoir la relire, le manager doit pouvoir l'afficher
-- dans "Qualité des réceptions") -- même principe que fdj_shifts, PAS le
-- même principe que carburant_releves (qui, lui, est manager-only en
-- écriture ET lecture élargie créateur).
create policy select_carburant_receptions on carburant_receptions
  for select using (site = (select current_employee_site_id()));

-- INSERT : tout employé du même site -- c'est le coeur de la demande de
-- l'audit ("NEXUS Employé - Réception carburant"), à la différence de
-- carburant_releves qui reste manager-only.
create policy insert_carburant_receptions on carburant_receptions
  for insert with check (site = (select current_employee_site_id()));

-- UPDATE : réservé manager/gérant -- c'est la ligne qui porte le statut de
-- qualification (coherente/a_rapprocher/anomalie_confirmee) et la valeur
-- Insite360 reportée manuellement ; "le manager qualifie uniquement
-- lorsque les éléments sont suffisants" (règle de conception explicite de
-- l'audit, section 3.2).
create policy update_carburant_receptions on carburant_receptions
  for update using (
    (select current_employee_role()) = any (array['manager', 'gerant'])
    and site = (select current_employee_site_id())
  );

create policy select_carburant_reception_mesures on carburant_reception_mesures
  for select using (site = (select current_employee_site_id()));

create policy insert_carburant_reception_mesures on carburant_reception_mesures
  for insert with check (site = (select current_employee_site_id()));

create policy update_carburant_reception_mesures on carburant_reception_mesures
  for update using (
    (select current_employee_role()) = any (array['manager', 'gerant'])
    and site = (select current_employee_site_id())
  );
