-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260815114849 · carburant_receptions_visite_v2
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS Carburants — Réceptions v2 : modèle "visite camion" (15/08/2026)
--
-- Remplace le modèle P1 (14/08/2026, 1 ligne carburant_receptions par
-- carburant, aucune visite ne les reliait) par un modèle "visite" : une
-- livraison camion peut porter plusieurs carburants (SP95+GO+GNR dans des
-- compartiments différents du MÊME camion), et le contrôle central demandé
-- par Frédéric (compartiments vs BL, blocage si écart) ne peut exister que
-- si les compartiments sont une vraie entité, rattachée à la visite entière
-- et non à un carburant isolé. Aucune ligne n'existe encore dans l'ancien
-- schéma (vérifié : 0 ligne carburant_receptions) — recréation propre,
-- aucune donnée à migrer.
--
-- Principe NEXUS respecté : "Le document annonce (visite_lignes.quantite_bl_l).
-- Le pompiste constate (compartiments, jaugeages). NEXUS rapproche (calculé
-- côté moteur, jamais stocké comme une 4e vérité). Une anomalie est
-- signalée (carburant_reception_anomalies). Le manager décide (déverrouillage
-- tracé). L'historique permet d'apprendre (requêtes futures sur cette
-- table)."
-- ============================================================

drop table if exists carburant_reception_mesures;
drop table if exists carburant_receptions;

-- 1 ligne par visite camion (l'en-tête commun à tous les carburants livrés
-- dans cette visite).
create table carburant_reception_visites (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date_visite date not null,
  heure_debut timestamptz,
  heure_fin timestamptz,
  transporteur text,
  chauffeur text,
  immatriculation text,
  bon_livraison_reference text,
  employe_id uuid,
  nombre_compartiments int not null,
  -- 'en_cours' n'existe pas en base : la visite n'est écrite qu'une fois
  -- terminée (soumission atomique, même principe que le modèle P1) — sauf
  -- si une anomalie bloquante a été déverrouillée par un manager en cours
  -- de route, auquel cas 'terminee_avec_derogation' le trace explicitement.
  statut text not null default 'terminee' check (statut in ('terminee', 'terminee_avec_derogation')),
  created_at timestamptz not null default now()
);

-- Quantité documentaire attendue par carburant pour cette visite (ce que le
-- BL annonce) — jamais remplacée par le jaugeage terrain, uniquement
-- comparée à lui (Article 5, cf. nexus-reception-moteur.js v1).
create table carburant_reception_visite_lignes (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references carburant_reception_visites(id) on delete cascade,
  site text not null,
  carburant text not null check (carburant in ('go', 'sp95', 'gnr')),
  quantite_bl_l numeric not null,
  -- Rapprochement final, calculé au moment de la soumission (jamais
  -- recalculé ailleurs — voir NexusReceptionMoteur.calculerReceptionCarburant) :
  -- conservé pour que Carburants Pilotage n'ait jamais à relire les
  -- compartiments/mesures pour reconstruire ce qui a déjà été calculé une
  -- fois (Article 11), tout en restant un CONSTAT figé au moment de la
  -- réception, pas une valeur recalculée en direct.
  quantite_compartiments_l numeric,
  quantite_mesuree_l numeric,
  delta_l numeric,
  delta_ratio numeric,
  statut text not null default 'a_completer' check (statut in ('a_completer', 'coherente', 'a_rapprocher')),
  created_at timestamptz not null default now()
);

-- Compartiments du camion pour cette visite — nombre configurable par site
-- (station_config.reception_carburant_config), jamais codé en dur. 1 ligne
-- par compartiment, créée à la soumission finale (le parcours employé les
-- construit en mémoire pendant la saisie, comme le modèle P1 pour les
-- mesures de cuve).
create table carburant_reception_compartiments (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references carburant_reception_visites(id) on delete cascade,
  site text not null,
  numero int not null,
  carburant text check (carburant in ('go', 'sp95', 'gnr')),
  quantite_declaree_l numeric,
  cuve_destination_id text,
  statut text not null default 'a_receptionner' check (statut in ('a_receptionner', 'receptionne', 'non_receptionne')),
  motif_non_receptionne text check (motif_non_receptionne in ('oubli_validation', 'compartiment_non_livre', 'probleme_technique', 'erreur_transporteur', 'produit_refuse', 'autre')),
  receptionne_le timestamptz,
  created_at timestamptz not null default now()
);

-- Jaugeage avant/après par cuve concernée par la visite (toutes les cuves
-- des carburants livrés, pas seulement celles d'un carburant isolé — c'est
-- tout le sens du modèle "visite" par rapport au modèle P1).
create table carburant_reception_mesures (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references carburant_reception_visites(id) on delete cascade,
  site text not null,
  cuve_id text not null,
  carburant text not null check (carburant in ('go', 'sp95', 'gnr')),
  jaugeage_avant_l numeric not null,
  jaugeage_avant_le timestamptz not null,
  jaugeage_apres_l numeric,
  jaugeage_apres_le timestamptz,
  delta_mesure_l numeric,
  created_at timestamptz not null default now()
);

-- Trace d'audit de toute anomalie détectée pendant la visite (bloquante ou
-- non) et, le cas échéant, de sa levée. Écrite à la soumission finale
-- (anomalies bloquantes : uniquement si un déverrouillage manager a permis
-- de continuer — sinon la visite n'est jamais soumise, l'employé reste
-- bloqué). Déverrouillage P1 : déclaratif (nom du manager + motif), non
-- ré-authentifié cryptographiquement dans ce lot — limite documentée dans
-- le Data Dictionary, à durcir en P2 si le besoin se confirme à l'usage.
create table carburant_reception_anomalies (
  id uuid primary key default gen_random_uuid(),
  visite_id uuid not null references carburant_reception_visites(id) on delete cascade,
  site text not null,
  type text not null check (type in ('compartiments_vs_bl', 'compartiment_non_receptionne', 'jaugeage_vs_prevu')),
  carburant text check (carburant in ('go', 'sp95', 'gnr')),
  compartiment_numero int,
  details jsonb not null default '{}'::jsonb,
  statut text not null default 'bloquante' check (statut in ('bloquante', 'derogation_manager', 'informative')),
  derogation_manager_nom text,
  derogation_motif text,
  derogation_le timestamptz,
  created_at timestamptz not null default now()
);

create index idx_carburant_reception_visites_site_date on carburant_reception_visites(site, date_visite desc);
create index idx_carburant_reception_visite_lignes_visite on carburant_reception_visite_lignes(visite_id);
create index idx_carburant_reception_visite_lignes_site_carburant on carburant_reception_visite_lignes(site, carburant, created_at desc);
create index idx_carburant_reception_compartiments_visite on carburant_reception_compartiments(visite_id);
create index idx_carburant_reception_mesures_visite on carburant_reception_mesures(visite_id);
create index idx_carburant_reception_anomalies_visite on carburant_reception_anomalies(visite_id);

alter table carburant_reception_visites enable row level security;
alter table carburant_reception_visite_lignes enable row level security;
alter table carburant_reception_compartiments enable row level security;
alter table carburant_reception_mesures enable row level security;
alter table carburant_reception_anomalies enable row level security;

-- Même politique que le modèle P1 : SELECT+INSERT ouverts à tout employé du
-- site (soumission atomique unique, jamais d'UPDATE employé nécessaire),
-- UPDATE restreint à manager/gérant du même site (qualification a posteriori
-- côté Pilotage, si un jour nécessaire).
do $$
declare
  t text;
begin
  foreach t in array array['carburant_reception_visites', 'carburant_reception_visite_lignes', 'carburant_reception_compartiments', 'carburant_reception_mesures', 'carburant_reception_anomalies']
  loop
    execute format('create policy select_%1$s on %1$s for select using (site = (select current_employee_site_id()))', t);
    execute format('create policy insert_%1$s on %1$s for insert with check (site = (select current_employee_site_id()))', t);
    execute format('create policy update_%1$s on %1$s for update using ((select current_employee_role()) = any (array[''manager'', ''gerant'']) and site = (select current_employee_site_id()))', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- station_config — extensions moteur configurable (Article "rien de codé
-- en dur pour un site" de la demande de Frédéric).
-- ------------------------------------------------------------

alter table station_config
  add column if not exists consignes_securite_reception jsonb not null default '[]'::jsonb,
  add column if not exists contact_manager_reception jsonb not null default '{}'::jsonb,
  add column if not exists reception_carburant_config jsonb not null default '{"nombre_compartiments_defaut": 4, "seuil_ecart_compartiments_pct": 2, "seuil_ecart_mesure_pct": 2, "ordre_cuves": null}'::jsonb;

comment on column station_config.consignes_securite_reception is 'Array de {theme, texte} — rappel sécurité affiché par Coach NEXUS avant une réception carburant. Jamais codé en dur dans l''écran, configurable par site (Paramètres Station).';
comment on column station_config.contact_manager_reception is '{nom, telephone} — coordonnées affichées en cas d''anomalie bloquante pendant une réception.';
comment on column station_config.reception_carburant_config is '{nombre_compartiments_defaut, seuil_ecart_compartiments_pct, seuil_ecart_mesure_pct, ordre_cuves} — ordre_cuves: array de {carburant, cuve_id} dans l''ordre physique réel du Veeder-Root du site, ou null pour utiliser l''ordre dérivé de cuves_carburants (groupé par carburant).';
