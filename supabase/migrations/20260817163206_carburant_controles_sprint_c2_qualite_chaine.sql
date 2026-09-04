-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817163206 · carburant_controles_sprint_c2_qualite_chaine
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Migration : carburant_controles (17/08/2026)
-- Sprint C2 "Contrôle" de l'audit Carburants (NEXUS_Audit_Carburants_
-- Chaine_Preuve_Developpeur.pdf, §5.3 "Contrôle carburant" + §6 "Etats et
-- qualité : éviter les faux écarts") : "Le contrôle est la synthèse de
-- preuve entre deux points de mesure fiables. Il ne doit pas être confondu
-- avec le relevé physique lui-même." Critère de sortie du sprint (roadmap
-- audit §16) : "Aucun faux écart définitif."
--
-- Contrairement à carburant_releve_versions (Sprint C1), il n'existe pas
-- encore de "vue courante" séparée à alimenter ici : aucun écran ne relit
-- ces contrôles pour l'instant (ça viendra au Sprint C6 Pilotage). Cette
-- table EST directement la preuve versionnée — un pointeur "courant"
-- séparé serait une table redondante sans consommateur, ajoutée
-- prématurément (Article 5).
--
-- Un contrôle est posé par carburant (go/sp95/gnr), pas par relevé entier
-- : la qualité de chaîne peut légitimement différer d'un carburant à
-- l'autre le même jour (ex. GO fiable, SP95 provisoire si son mouvement
-- exceptionnel n'est pas documenté).
create table carburant_controles (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  carburant text not null check (carburant in ('go', 'sp95', 'gnr')),
  version_num int not null,
  reference_date date,
  reference_type text check (reference_type in ('releve', 'point_zero')),
  theorique numeric,
  physique numeric,
  ecart numeric,
  ventes numeric,
  livraison numeric not null default 0,
  mouvement numeric not null default 0,
  qualite text not null check (qualite in ('fiable', 'provisoire', 'non_comparable')),
  cause text,
  cree_le timestamptz not null default now(),
  constraint carburant_controles_site_date_carburant_version_key unique (site, date, carburant, version_num),
  constraint carburant_controles_cause_check check (qualite = 'fiable' or cause is not null)
);

comment on table carburant_controles is
  'Contrôle versionné entre deux points de mesure carburant, par carburant — qualité fiable/provisoire/non_comparable avec cause explicite. Un écart n''est jamais affiché comme réel si qualite <> ''fiable''. Sprint C2, audit Carburants (17/08/2026).';

alter table carburant_controles enable row level security;

create policy select_carburant_controles on carburant_controles
  for select using (
    site = ( select current_employee_site_id() )
    or ( ( select je_suis_createur() ) and exists (
      select 1 from sites s where s.site_id = carburant_controles.site and s.acces_createur_autorise = true
    ) )
  );

create policy ecriture_manager_meme_site on carburant_controles
  for insert with check (
    ( select current_employee_role() ) = any (array['manager'::text, 'gerant'::text])
    and site = ( select current_employee_site_id() )
  );
-- Volontairement aucune politique UPDATE/DELETE : append-only garanti par
-- l'absence de policy (même discipline que carburant_releve_versions et
-- fdj_releves_cloture).;
