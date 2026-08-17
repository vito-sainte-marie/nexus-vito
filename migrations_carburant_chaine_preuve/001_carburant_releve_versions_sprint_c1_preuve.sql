-- Migration : carburant_releve_versions (17/08/2026)
-- Sprint C1 "Preuve" de l'audit Carburants (NEXUS_Audit_Carburants_Chaine_
-- Preuve_Developpeur.pdf, 16/08/2026, cadrage développeur transmis par
-- Frédéric) : transposer à Carburants la discipline déjà appliquée à FDJ
-- (fdj_releves_cloture, v2.116) — chaque écriture sur carburant_releves
-- (saisie initiale OU correction manager) est en plus posée ici, jamais
-- réécrite ni supprimée. carburant_releves reste la vue "courante" (comme
-- fdj_cash_controls) ; cette table est la preuve append-only (comme
-- fdj_releves_cloture). Critère de sortie du sprint (roadmap audit §16) :
-- "Aucune correction silencieuse."
create table carburant_releve_versions (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  version_num int not null,
  type_version text not null check (type_version in ('saisie_initiale', 'correction_manager')),
  stock_reel_go_cuve1 numeric,
  stock_reel_go_cuve2 numeric,
  stock_reel_sp95 numeric,
  stock_reel_gnr numeric,
  livraison_go numeric not null default 0,
  livraison_sp95 numeric not null default 0,
  livraison_gnr numeric not null default 0,
  mouvement_go numeric not null default 0,
  mouvement_sp95 numeric not null default 0,
  mouvement_gnr numeric not null default 0,
  motif_mouvement text,
  commentaire text,
  motif_correction text,
  diff_vs_precedent jsonb,
  auteur uuid references employees(id),
  cree_le timestamptz not null default now(),
  constraint carburant_releve_versions_site_date_version_key unique (site, date, version_num),
  constraint carburant_releve_versions_motif_correction_check
    check (type_version = 'saisie_initiale' or motif_correction is not null)
);

comment on table carburant_releve_versions is
  'Preuve append-only de chaque écriture (initiale ou correction) sur carburant_releves — jamais réécrite ni supprimée. Sprint C1, audit Carburants (17/08/2026).';

alter table carburant_releve_versions enable row level security;

create policy select_carburant_releve_versions on carburant_releve_versions
  for select using (
    site = ( select current_employee_site_id() )
    or ( ( select je_suis_createur() ) and exists (
      select 1 from sites s where s.site_id = carburant_releve_versions.site and s.acces_createur_autorise = true
    ) )
  );

create policy ecriture_manager_meme_site on carburant_releve_versions
  for insert with check (
    ( select current_employee_role() ) = any (array['manager'::text, 'gerant'::text])
    and site = ( select current_employee_site_id() )
  );
-- Volontairement aucune politique UPDATE/DELETE sur cette table : l'absence
-- de policy garantit l'append-only au niveau base, pas seulement par
-- discipline applicative (même principe que fdj_releves_cloture, v2.116).

alter table carburant_releves add column if not exists version_num int not null default 1;
comment on column carburant_releves.version_num is
  'Numéro de la version courante de ce relevé — la preuve complète de chaque version (y compris celle-ci) est conservée dans carburant_releve_versions. Sprint C1 (17/08/2026).';

-- Backfill : chaque relevé déjà en base devient sa propre version 1
-- (saisie_initiale), à partir de ses propres saisi_par/created_at déjà
-- réels — aucune donnée fabriquée, seulement la preuve qui aurait existé
-- si cette table avait été là depuis le début. Idempotent (on conflict do
-- nothing) pour pouvoir être rejoué sans risque.
insert into carburant_releve_versions (
  site, date, version_num, type_version,
  stock_reel_go_cuve1, stock_reel_go_cuve2, stock_reel_sp95, stock_reel_gnr,
  livraison_go, livraison_sp95, livraison_gnr,
  mouvement_go, mouvement_sp95, mouvement_gnr,
  motif_mouvement, commentaire, auteur, cree_le
)
select site, date, 1, 'saisie_initiale',
  stock_reel_go_cuve1, stock_reel_go_cuve2, stock_reel_sp95, stock_reel_gnr,
  livraison_go, livraison_sp95, livraison_gnr,
  mouvement_go, mouvement_sp95, mouvement_gnr,
  motif_mouvement, commentaire, saisi_par, created_at
from carburant_releves
on conflict (site, date, version_num) do nothing;

-- Résultat appliqué le 17/08/2026 sur le site pilote (Vito Sainte-Marie
-- Usine) : 6 relevés existants, 6 versions 1 backfillées avec succès.
