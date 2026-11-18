-- NEXUS Scanner, politique tarifaire T2 : registres versionnés (PROJET, soumis à l'examen du gérant, NON EXÉCUTÉ).
-- Cible : projet Supabase Test uniquement, après GO écrit. Aucune donnée Production, aucune donnée Decenium modifiée.
-- Modèle repris de 20261117100000_produits_nature_tva_justifications.sql :
--   ajout seul ; correction = nouvelle ligne avec remplace_id ; annulation = UPDATE limité à trois colonnes ; aucun DELETE.
-- Nouveauté : une seule version active par clé, garantie par déclencheur et verrou consultatif.
-- Migration nouvelle : aucune migration précédente n'est modifiée.

-- Clé de référence commune : code-barres exact, sinon libellé normalisé (espaces réduits, minuscules), comme le moteur T1.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117020430 : objets absents : %', v_manque;
  end if;
end $prerequis$;

create or replace function tarif_cle_reference(p_code_barres text, p_article text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when nullif(btrim(p_code_barres), '') is not null then 'cb:' || btrim(p_code_barres)
    when nullif(btrim(p_article), '') is not null then 'lib:' || lower(regexp_replace(btrim(p_article), '\s+', ' ', 'g'))
    else null end;
$$;

-- 1. Familles commerciales (une famille peut regrouper des références de plusieurs rayons Decenium).
create table if not exists tarif_familles (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  famille_code text not null check (famille_code ~ '^[a-z0-9_]{2,60}$'),
  libelle text not null check (length(btrim(libelle)) > 0),
  description text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_familles(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (famille_code) stored,
  constraint tarif_familles_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 2. Rattachements : un rayon Decenium entier, ou une référence précise, vers une famille. Aucune expression régulière.
create table if not exists tarif_rattachements (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  portee text not null check (portee in ('rayon', 'reference')),
  rayon text, article text, code_barres text,
  famille_code text not null,
  motif text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_rattachements(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (case when portee = 'rayon' then 'rayon:' || btrim(rayon) else tarif_cle_reference(code_barres, article) end) stored,
  constraint tarif_rattachements_portee check ((portee = 'rayon' and length(btrim(coalesce(rayon, ''))) > 0 and article is null and code_barres is null)
    or (portee = 'reference' and tarif_cle_reference(code_barres, article) is not null)),
  constraint tarif_rattachements_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 3. Seuils : par famille, par rayon ou par défaut. Seul le statut « valide » est décisionnel.
create table if not exists tarif_seuils (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  niveau text not null check (niveau in ('famille', 'rayon', 'defaut')),
  cible_niveau text not null,                        -- famille_code, nom du rayon, ou 'defaut'
  minimum numeric check (minimum is null or (minimum >= 0 and minimum < 1)),
  statut_minimum text check (statut_minimum in ('valide', 'indicatif', 'a_l_etude', 'hypothese')),
  cible numeric check (cible is null or (cible >= 0 and cible < 1)),
  statut_cible text check (statut_cible in ('valide', 'indicatif', 'a_l_etude', 'hypothese')),
  commentaire text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_seuils(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (niveau || ':' || btrim(cible_niveau)) stored,
  constraint tarif_seuils_presence check (minimum is not null or cible is not null),
  constraint tarif_seuils_statuts check ((minimum is null) = (statut_minimum is null) and (cible is null) = (statut_cible is null)),
  constraint tarif_seuils_ordre check (minimum is null or cible is null or minimum <= cible),
  constraint tarif_seuils_defaut check (niveau <> 'defaut' or cible_niveau = 'defaut'),
  constraint tarif_seuils_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 4. Réglages du moteur par site. Une clé absente garde la valeur par défaut du moteur.
create table if not exists tarif_reglages (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  parametre text not null check (parametre in ('palier_ttc', 'tolerance_constat_ttc', 'variation_notable', 'variation_suspecte',
    'ecart_stock_confirmer', 'ecart_stock_insuffisant', 'quantite_minimale', 'prix_unitaire_bas', 'tolerance_cout_exception', 'jours_reference',
    'a6_baisse_points', 'a6_baisse_marge_unitaire_euros', 'a6_baisse_marge_unitaire_relative', 'a6_montant_minimal')),
  valeur numeric not null check (valeur >= 0),
  commentaire text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_reglages(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (parametre) stored,
  constraint tarif_reglages_bornes check (
    (parametre in ('palier_ttc', 'tolerance_constat_ttc') and valeur > 0 and valeur <= 1)
    or (parametre in ('variation_notable', 'variation_suspecte', 'ecart_stock_confirmer', 'ecart_stock_insuffisant', 'tolerance_cout_exception',
                      'a6_baisse_points', 'a6_baisse_marge_unitaire_relative') and valeur < 1)
    or (parametre in ('quantite_minimale', 'jours_reference') and valeur = trunc(valeur) and valeur between 1 and 366)
    or (parametre in ('prix_unitaire_bas', 'a6_baisse_marge_unitaire_euros', 'a6_montant_minimal') and valeur <= 1000)),
  constraint tarif_reglages_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 5. Exceptions commerciales. Un manager propose (candidate) ; seul le gérant valide, refuse ou lève.
create table if not exists tarif_exceptions (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  type text not null check (type in ('produit_appel', 'pack', 'concurrence_directe', 'autre')),
  statut text not null check (statut in ('candidate', 'validee', 'refusee', 'levee')),
  motif text not null check (length(btrim(motif)) > 0),
  cond_prix_ttc numeric check (cond_prix_ttc is null or cond_prix_ttc > 0),
  cond_tolerance_cout numeric check (cond_tolerance_cout is null or (cond_tolerance_cout > 0 and cond_tolerance_cout < 1)),
  cond_cout_reference numeric check (cond_cout_reference is null or cond_cout_reference > 0),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_exceptions(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_exceptions_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_exceptions_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 6. Prix TTC décidés par le gérant. Nature : changement à appliquer, prix déclaré en vigueur, ou prix maintenu sans valeur.
create table if not exists tarif_prix_decides (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  nature text not null check (nature in ('changement', 'en_vigueur', 'maintenu')),
  prix_ttc numeric check (prix_ttc is null or prix_ttc > 0),
  decide_le date not null default current_date,
  motif text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_prix_decides(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_prix_decides_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_prix_decides_valeur check ((nature = 'maintenu' and prix_ttc is null) or (nature <> 'maintenu' and prix_ttc is not null)),
  constraint tarif_prix_decides_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 7. Événements d'application d'un prix décidé : saisie déclarée dans Decenium, ou preuve datée. Jamais déduits du PV moyen.
create table if not exists tarif_prix_application (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  prix_decide_id uuid not null references tarif_prix_decides(id),
  evenement text not null check (evenement in ('saisie_declaree', 'preuve_application')),
  date_effet date not null,
  preuve_type text check (preuve_type in ('export_prix_decenium', 'ticket', 'releve_rayon', 'autre')),
  piece_chemin text,                                  -- chemin dans le stockage NEXUS, jamais un fichier Decenium modifié
  commentaire text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  constraint tarif_prix_application_preuve check ((evenement = 'preuve_application' and preuve_type is not null) or (evenement = 'saisie_declaree' and preuve_type is null)),
  constraint tarif_prix_application_autre check (preuve_type is distinct from 'autre' or length(btrim(coalesce(commentaire, ''))) > 0),
  constraint tarif_prix_application_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 8. Régimes de prix déclarés. Jamais déduits d'un libellé ni d'un taux de marge.
create table if not exists tarif_regimes_prix (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  regime text not null check (regime in ('libre', 'reglemente', 'contractuel', 'commissionne', 'a_qualifier')),
  raison text not null check (length(btrim(raison)) > 0),
  source text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_regimes_prix(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_regimes_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_regimes_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 9. Contrôles réglementaires : axe indépendant de la fiabilité comptable. Un manager ouvre ou complète ; seul le gérant qualifie.
create table if not exists tarif_controles_reglementaires (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  portee text not null check (portee in ('rayon', 'reference')),
  rayon text, article text, code_barres text,
  etat text not null check (etat in ('controle_ouvert', 'a_completer', 'conforme', 'non_conforme')),
  type_element text check (type_element in ('dispositif_complet', 'cartouche', 'batterie', 'reservoir', 'flacon', 'produit_tabac', 'autre')),
  raison text not null check (length(btrim(raison)) > 0),
  pieces jsonb not null default '[]'::jsonb check (jsonb_typeof(pieces) = 'array'),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  remplace_id uuid references tarif_controles_reglementaires(id),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (case when portee = 'rayon' then 'rayon:' || btrim(rayon) else tarif_cle_reference(code_barres, article) end) stored,
  constraint tarif_controles_portee check ((portee = 'rayon' and length(btrim(coalesce(rayon, ''))) > 0 and article is null and code_barres is null)
    or (portee = 'reference' and tarif_cle_reference(code_barres, article) is not null)),
  constraint tarif_controles_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- 10. Décisions tarifaires : journal ajout seul, avec la photo des chiffres vus au moment de décider. Jamais recalculée.
create table if not exists tarif_decisions (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  periode_debut date not null, periode_fin date not null,
  decision text not null check (decision in ('validee', 'refusee', 'autre_prix')),
  prix_ttc_retenu numeric check (prix_ttc_retenu is null or prix_ttc_retenu > 0),
  motif text,
  seuil_id uuid references tarif_seuils(id),
  moteur_version text not null,
  photo jsonb not null check (jsonb_typeof(photo) = 'object' and photo ? 'cout' and photo ? 'pv_ht' and photo ? 'quantite' and photo ? 'taux' and photo ? 'fiabilite'),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_decisions_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_decisions_periode check (periode_fin >= periode_debut),
  constraint tarif_decisions_prix check ((decision = 'refusee' and prix_ttc_retenu is null) or (decision <> 'refusee' and prix_ttc_retenu is not null)),
  constraint tarif_decisions_motif check (decision = 'validee' or length(btrim(coalesce(motif, ''))) > 0),
  constraint tarif_decisions_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0))
);

-- Index : lecture par site et par clé.
do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    execute format('create index if not exists %I on %I (site, cle)', t || '_site_cle_idx', t);
  end loop;
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('create index if not exists %I on %I (remplace_id) where remplace_id is not null', t || '_remplace_idx', t);
  end loop;
end $$;
create index if not exists tarif_prix_application_pd_idx on tarif_prix_application (prix_decide_id);

comment on table tarif_familles is 'Familles commerciales de la politique tarifaire, par site. Ajout seul, versionné.';
comment on table tarif_rattachements is 'Rattachement d un rayon Decenium ou d une référence à une famille. Aucune expression régulière. Ne modifie jamais Decenium.';
comment on table tarif_seuils is 'Seuils de taux de marque. Seul le statut valide est décisionnel ; indicatif, a_l_etude et hypothese sont affichés seulement.';
comment on table tarif_reglages is 'Réglages du moteur tarifaire par site (palier, tolérances, matérialité A6). Clé absente : valeur par défaut du moteur.';
comment on table tarif_exceptions is 'Exceptions commerciales. Une exception ne sort jamais des contrôles de coût, de marge négative, de TVA ni de conformité.';
comment on table tarif_prix_decides is 'Prix TTC décidés par le gérant. NEXUS n applique jamais un prix : la saisie est faite dans Decenium par une personne.';
comment on table tarif_prix_application is 'Saisie déclarée ou preuve datée d application d un prix décidé. Le PV moyen seul ne prouve jamais une application.';
comment on table tarif_regimes_prix is 'Régime de prix déclaré par référence. Jamais déduit d un libellé ni d un taux de marge.';
comment on table tarif_controles_reglementaires is 'Contrôles réglementaires, indépendants de la fiabilité comptable. Une batterie rechargeable n est jamais une preuve de conformité.';
comment on table tarif_decisions is 'Journal des décisions tarifaires avec la photo des chiffres vus au moment de décider. Ajout seul.';

-- Intégrité croisée indépendante des permissions (vaut aussi pour service_role, qui contourne la RLS) :
-- une version, une application ou une décision ne peut viser qu'une ligne du MÊME site.
do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_id_site_uq') then
      execute format('alter table %I add constraint %I unique (id, site)', t, t || '_id_site_uq');
    end if;
    if not exists (select 1 from pg_constraint where conname = t || '_remplace_meme_site_fk') then
      execute format('alter table %I add constraint %I foreign key (remplace_id, site) references %I (id, site)', t, t || '_remplace_meme_site_fk', t);
    end if;
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'tarif_prix_application_meme_site_fk') then
    alter table tarif_prix_application add constraint tarif_prix_application_meme_site_fk foreign key (prix_decide_id, site) references tarif_prix_decides (id, site);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tarif_decisions_seuil_meme_site_fk') then
    alter table tarif_decisions add constraint tarif_decisions_seuil_meme_site_fk foreign key (seuil_id, site) references tarif_seuils (id, site);
  end if;
end $$;
revoke all on function tarif_cle_reference(text, text) from public, anon;
grant execute on function tarif_cle_reference(text, text) to authenticated, service_role;
