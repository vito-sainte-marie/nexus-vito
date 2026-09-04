-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821222502 · import_pipeline_fondations
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS Import — pipeline de fichier manuel (le "pont" d'aujourd'hui,
-- distinct de raw_products/normalized_products qui sont réservés au
-- futur connecteur API Decenium, accès service_role uniquement, 0 ligne
-- à ce jour). Voir NEXUS_Audit_Import_Donnees_UX_DataPipeline_Developpeur
-- du 21/08/2026 — refonte complète Sprints 1-3.
--
-- Convention RLS reprise telle quelle de inventaire_ventes_import /
-- products / stock_releves : site = current_employee_site_id() AND
-- current_employee_role() = ANY(['manager','gerant']).
-- ============================================================

-- 1. Un import = une exécution, de bout en bout, staging → publication.
create table public.import_batches (
  id                  uuid primary key default gen_random_uuid(),
  site                text not null references public.sites(site_id),
  intention           text not null check (intention in ('ventes_catalogue','stock_theorique','panier_moyen','campagne')),
  statut              text not null default 'draft' check (statut in ('draft','analyzing','review_required','ready','publishing','published','failed','superseded','cancelled')),
  fichier_nom         text,
  fichier_taille_octets integer,
  fichier_hash        text,
  fichier_feuille     text,
  periode_debut       date,
  periode_fin         date,
  date_releve         date,
  campagne_id         uuid references public.campagnes_nexus(id),
  phase               text check (phase in ('avant','pendant')),
  remplace_batch_id   uuid references public.import_batches(id),
  auteur_id           uuid references public.employees(id),
  cree_le             timestamptz not null default now(),
  analyse_le          timestamptz,
  pret_le             timestamptz,
  publie_le           timestamptz,
  echoue_le           timestamptz,
  motif               text
);
comment on table public.import_batches is 'Une exécution d''import de fichier (Excel/CSV), du dépôt à la publication. Fait aussi office de "data_versions" : le statut published/superseded + remplace_batch_id trace quelle version de données est active pour une période donnée — pas de table séparée, une seule vérité (Article 11).';
create index idx_import_batches_site_intention on public.import_batches(site, intention, cree_le desc);
create index idx_import_batches_statut on public.import_batches(statut);

-- 2. Staging brut, immuable — jamais modifié après réception.
create table public.import_rows_raw (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.import_batches(id) on delete cascade,
  numero_ligne  integer not null,
  donnees       jsonb not null,
  cree_le       timestamptz not null default now(),
  unique(batch_id, numero_ligne)
);
comment on table public.import_rows_raw is 'Ligne brute telle que lue dans le fichier, non modifiée. Insert-only.';

-- 3. Mapping colonnes -> champ canonique, versionné par batch (une ligne
-- = la résolution retenue pour CE batch), et consultable comme mémoire
-- pour proposer automatiquement le mapping du prochain fichier de la
-- même source (I07 : "mapping proposé puis mémorisé par source").
create table public.import_mappings (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references public.import_batches(id) on delete cascade,
  site              text not null,
  intention         text not null,
  champ_canonique   text not null,
  colonne_source    text not null,
  auto_detecte      boolean not null default true,
  confirme_par      uuid references public.employees(id),
  cree_le           timestamptz not null default now()
);
comment on table public.import_mappings is 'Mapping colonne source -> champ canonique retenu pour un batch. L''historique par (site,intention,champ_canonique) sert de mémoire pour l''auto-mapping du fichier suivant.';
create index idx_import_mappings_memoire on public.import_mappings(site, intention, champ_canonique, cree_le desc);

-- 4. Résultat par ligne après qualité + anti-doublon — jamais un second
-- passage sur le fichier brut, toujours dérivé de import_rows_raw.
create table public.import_row_results (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.import_batches(id) on delete cascade,
  numero_ligne  integer not null,
  statut        text not null check (statut in ('nouvelle','connue_identique','connue_modifiee','doublon_fichier','rejetee')),
  cle_metier    text,
  raison        text,
  valeurs       jsonb,
  cree_le       timestamptz not null default now(),
  unique(batch_id, numero_ligne)
);
comment on table public.import_row_results is 'Verdict par ligne (nouvelle/déjà connue/modifiée/doublon dans le fichier/rejetée) + raison explicite. Jamais un rapprochement deviné.';
create index idx_import_row_results_batch_statut on public.import_row_results(batch_id, statut);

-- 5. Synthèse qualité d'un batch — un seul par batch.
create table public.import_quality_reports (
  id                      uuid primary key default gen_random_uuid(),
  batch_id                uuid not null references public.import_batches(id) on delete cascade unique,
  lignes_total            integer not null default 0,
  lignes_nouvelles        integer not null default 0,
  lignes_connues          integer not null default 0,
  lignes_modifiees        integer not null default 0,
  lignes_doublons_fichier integer not null default 0,
  lignes_rejetees         integer not null default 0,
  references_inconnues    jsonb not null default '[]',
  jours_manquants         jsonb not null default '[]',
  score_qualite           numeric not null,
  decision_recommandee    text not null check (decision_recommandee in ('publication_conseillee','publication_deconseillee','bloque')),
  causes                  jsonb not null default '[]',
  cree_le                 timestamptz not null default now()
);
comment on table public.import_quality_reports is 'Synthèse qualité d''un batch (section 8 de l''audit) : lignes, produits, causes, score, décision recommandée — jamais un simple "import réussi".';

-- 6. Alias manuel, versionné et réutilisable (remplace le principe de
-- ALIAS_VENTES_SANS_CODE_BARRES, jusque-là un objet JS codé en dur dans
-- NEXUS-Inventaire-Manager-v1.html) — ici à l'usage du pipeline Import
-- général (Ventes/Catalogue, Stock), pas du rapprochement Inventaire
-- (inventaire_zone_produit), qui reste un domaine séparé et inchangé.
create table public.import_product_aliases (
  id                          uuid primary key default gen_random_uuid(),
  site                        text not null references public.sites(site_id),
  intention                   text not null,
  designation_brute_normalisee text not null,
  designation_canonique       text not null,
  cree_par                    uuid references public.employees(id),
  cree_le                     timestamptz not null default now(),
  unique(site, intention, designation_brute_normalisee)
);
comment on table public.import_product_aliases is 'Alias manuel désignation brute -> désignation canonique, par site/intention. Jamais de fuzzy matching automatique (même doctrine que ALIAS_VENTES_SANS_CODE_BARRES) : correspondance exacte par code-barres, sinon alias exact confirmé par un manager.';

-- 7. Journal d'audit — actions, jamais purgé.
create table public.import_audit_log (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid references public.import_batches(id) on delete cascade,
  site        text not null,
  action      text not null,
  employe_id  uuid references public.employees(id),
  details     jsonb,
  cree_le     timestamptz not null default now()
);
comment on table public.import_audit_log is 'Historique complet des actions sur un import (dépôt, mapping confirmé, publication, annulation) — jamais purgé.';
create index idx_import_audit_log_batch on public.import_audit_log(batch_id, cree_le);

-- ------------------------------------------------------------
-- RLS — même convention que products/stock_releves/inventaire_ventes_import
-- ------------------------------------------------------------
alter table public.import_batches enable row level security;
alter table public.import_rows_raw enable row level security;
alter table public.import_mappings enable row level security;
alter table public.import_row_results enable row level security;
alter table public.import_quality_reports enable row level security;
alter table public.import_product_aliases enable row level security;
alter table public.import_audit_log enable row level security;

create policy select_import_batches on public.import_batches for select
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy ecriture_import_batches on public.import_batches for insert
  with check (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy modification_import_batches on public.import_batches for update
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']))
  with check (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));

create policy select_import_rows_raw on public.import_rows_raw for select
  using (exists (select 1 from public.import_batches b where b.id = import_rows_raw.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));
create policy ecriture_import_rows_raw on public.import_rows_raw for insert
  with check (exists (select 1 from public.import_batches b where b.id = import_rows_raw.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));

create policy select_import_mappings on public.import_mappings for select
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy ecriture_import_mappings on public.import_mappings for insert
  with check (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));

create policy select_import_row_results on public.import_row_results for select
  using (exists (select 1 from public.import_batches b where b.id = import_row_results.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));
create policy ecriture_import_row_results on public.import_row_results for insert
  with check (exists (select 1 from public.import_batches b where b.id = import_row_results.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));

create policy select_import_quality_reports on public.import_quality_reports for select
  using (exists (select 1 from public.import_batches b where b.id = import_quality_reports.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));
create policy ecriture_import_quality_reports on public.import_quality_reports for insert
  with check (exists (select 1 from public.import_batches b where b.id = import_quality_reports.batch_id
    and b.site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant'])));

create policy select_import_product_aliases on public.import_product_aliases for select
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy ecriture_import_product_aliases on public.import_product_aliases for insert
  with check (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy suppression_import_product_aliases on public.import_product_aliases for delete
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));

create policy select_import_audit_log on public.import_audit_log for select
  using (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
create policy ecriture_import_audit_log on public.import_audit_log for insert
  with check (site = current_employee_site_id() and current_employee_role() = any(array['manager','gerant']));
