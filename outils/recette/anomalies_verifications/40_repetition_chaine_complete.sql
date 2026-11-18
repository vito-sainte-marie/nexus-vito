-- NEXUS Scanner tarifaire : REPETITION COMPLETE de la chaine des six migrations (1 a 6) et de leurs retours arriere, en UNE transaction annulee. Cible : Test uniquement.
-- Aucun commit. Deroulement : etat initial, retraits 6 a 1, etat vide, application 1 a 6, etat plein, nouveaux retraits 6 a 1, etat vide, ROLLBACK (Test retrouve son etat initial).
-- Le contenu des migrations et des retours arriere est celui des fichiers du depot, sans changement (begin et commit des retours arriere retires pour tenir dans la transaction).
-- Les 33 cas fonctionnels de la 6 restent dans 10_repetition_rollback.sql. A jouer ensuite : 20_verifier_rien_ne_reste.sql n'est PAS attendu ici (les tables existent sur Test) ; relire plutot le controle 73.
-- Sortie : UN seul select final (JSON).
begin;
-- Garde de Test (recette uniquement, hors migrations) : ce script cree des comptes de recette et, pour le 40, supprime les 10 registres. Refuse hors Test.
do $garde_recette$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde_recette$;
create temp table ctl (n serial, nom text, detail jsonb) on commit drop;
create temp table c73_avant as select (select count(*) from tarif_familles) a, (select count(*) from tarif_rattachements) b, (select count(*) from tarif_seuils) c, (select count(*) from tarif_reglages) d, (select count(*) from tarif_exceptions) e, (select count(*) from tarif_prix_decides) f, (select count(*) from tarif_prix_application) g, (select count(*) from tarif_regimes_prix) h, (select count(*) from tarif_controles_reglementaires) i, (select count(*) from tarif_decisions) j;
insert into ctl(nom, detail) select 'etat_initial', to_jsonb(q) from (select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relkind='r') as tables_t2,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relrowsecurity and c.relforcerowsecurity) as tables_rls_forcee,
  (select count(*) from pg_policies where schemaname='public' and policyname='compte_actif_obligatoire') as policies_compte_actif,
  (select count(*) from pg_policies where schemaname='public' and policyname in ('lecture_meme_site','insertion_roles_meme_site','annulation_roles_meme_site')) as policies_site,
  (select count(*) from pg_views where schemaname='public' and viewname in ('v_tarif_prix_application_actifs','v_tarif_exceptions_effectives','v_tarif_incoherences')) as vues,
  (select count(*) from pg_trigger where tgname in ('tarif_rattachements_famille','tarif_seuils_famille','tarif_prix_application_controle','tarif_decisions_lien') and not tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('tarif_cle_reference','tarif_controle_version','tarif_controle_retrogradation','tarif_controle_famille','tarif_controle_application','tarif_controle_decision_lien','tarif_enregistrer_decisions','tarif_marquer_verifie','tarif_enregistrer_reevaluations')) as fonctions,
  (select count(*) from information_schema.table_privileges where table_schema='public' and table_name in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and grantee in ('anon','public')) as droits_anon_public) q;
-- ===== Retraits 6 a 1 =====
-- retour arriere 6
drop function if exists tarif_enregistrer_reevaluations(jsonb);
drop function if exists tarif_marquer_verifie(jsonb);
drop table if exists tarif_anomalies_reevaluations;
drop table if exists tarif_anomalies_verifications;
-- retour arriere 5
drop function if exists tarif_enregistrer_decisions(jsonb);
drop trigger if exists tarif_decisions_lien on tarif_decisions;
drop function if exists tarif_controle_decision_lien();
drop index if exists tarif_decisions_prix_decide_uq;
alter table tarif_decisions drop constraint if exists tarif_decisions_prix_meme_site_fk;
alter table tarif_decisions drop column if exists prix_decide_id;
-- retour arriere 4
drop policy if exists compte_actif_obligatoire on tarif_familles;
drop policy if exists compte_actif_obligatoire on tarif_rattachements;
drop policy if exists compte_actif_obligatoire on tarif_seuils;
drop policy if exists compte_actif_obligatoire on tarif_reglages;
drop policy if exists compte_actif_obligatoire on tarif_exceptions;
drop policy if exists compte_actif_obligatoire on tarif_prix_decides;
drop policy if exists compte_actif_obligatoire on tarif_prix_application;
drop policy if exists compte_actif_obligatoire on tarif_regimes_prix;
drop policy if exists compte_actif_obligatoire on tarif_controles_reglementaires;
drop policy if exists compte_actif_obligatoire on tarif_decisions;
drop view if exists v_tarif_exceptions_effectives;
create view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;
-- retour arriere 3
drop view if exists v_tarif_incoherences;
drop view if exists v_tarif_exceptions_effectives;
drop view if exists v_tarif_prix_application_actifs;
-- retour arriere 2
drop policy if exists lecture_meme_site on tarif_familles;
drop policy if exists insertion_roles_meme_site on tarif_familles;
drop policy if exists annulation_roles_meme_site on tarif_familles;
alter table tarif_familles no force row level security;
alter table tarif_familles disable row level security;
drop policy if exists lecture_meme_site on tarif_rattachements;
drop policy if exists insertion_roles_meme_site on tarif_rattachements;
drop policy if exists annulation_roles_meme_site on tarif_rattachements;
alter table tarif_rattachements no force row level security;
alter table tarif_rattachements disable row level security;
drop policy if exists lecture_meme_site on tarif_seuils;
drop policy if exists insertion_roles_meme_site on tarif_seuils;
drop policy if exists annulation_roles_meme_site on tarif_seuils;
alter table tarif_seuils no force row level security;
alter table tarif_seuils disable row level security;
drop policy if exists lecture_meme_site on tarif_reglages;
drop policy if exists insertion_roles_meme_site on tarif_reglages;
drop policy if exists annulation_roles_meme_site on tarif_reglages;
alter table tarif_reglages no force row level security;
alter table tarif_reglages disable row level security;
drop policy if exists lecture_meme_site on tarif_exceptions;
drop policy if exists insertion_roles_meme_site on tarif_exceptions;
drop policy if exists annulation_roles_meme_site on tarif_exceptions;
alter table tarif_exceptions no force row level security;
alter table tarif_exceptions disable row level security;
drop policy if exists lecture_meme_site on tarif_prix_decides;
drop policy if exists insertion_roles_meme_site on tarif_prix_decides;
drop policy if exists annulation_roles_meme_site on tarif_prix_decides;
alter table tarif_prix_decides no force row level security;
alter table tarif_prix_decides disable row level security;
drop policy if exists lecture_meme_site on tarif_prix_application;
drop policy if exists insertion_roles_meme_site on tarif_prix_application;
drop policy if exists annulation_roles_meme_site on tarif_prix_application;
alter table tarif_prix_application no force row level security;
alter table tarif_prix_application disable row level security;
drop policy if exists lecture_meme_site on tarif_regimes_prix;
drop policy if exists insertion_roles_meme_site on tarif_regimes_prix;
drop policy if exists annulation_roles_meme_site on tarif_regimes_prix;
alter table tarif_regimes_prix no force row level security;
alter table tarif_regimes_prix disable row level security;
drop policy if exists lecture_meme_site on tarif_controles_reglementaires;
drop policy if exists insertion_roles_meme_site on tarif_controles_reglementaires;
drop policy if exists annulation_roles_meme_site on tarif_controles_reglementaires;
alter table tarif_controles_reglementaires no force row level security;
alter table tarif_controles_reglementaires disable row level security;
drop policy if exists lecture_meme_site on tarif_decisions;
drop policy if exists insertion_roles_meme_site on tarif_decisions;
drop policy if exists annulation_roles_meme_site on tarif_decisions;
alter table tarif_decisions no force row level security;
alter table tarif_decisions disable row level security;
drop trigger if exists tarif_rattachements_famille on tarif_rattachements;
drop trigger if exists tarif_seuils_famille on tarif_seuils;
drop trigger if exists tarif_prix_application_controle on tarif_prix_application;
drop function if exists tarif_controle_version();
drop function if exists tarif_controle_retrogradation();
drop function if exists tarif_controle_famille();
drop function if exists tarif_controle_application();
-- retour arriere 1
drop table if exists tarif_decisions;
drop table if exists tarif_controles_reglementaires;
drop table if exists tarif_regimes_prix;
drop table if exists tarif_prix_application;
drop table if exists tarif_prix_decides;
drop table if exists tarif_exceptions;
drop table if exists tarif_reglages;
drop table if exists tarif_seuils;
drop table if exists tarif_rattachements;
drop table if exists tarif_familles;
drop function if exists tarif_cle_reference(text, text);
insert into ctl(nom, detail) select 'etat_apres_retraits', to_jsonb(q) from (select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relkind='r') as tables_t2,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relrowsecurity and c.relforcerowsecurity) as tables_rls_forcee,
  (select count(*) from pg_policies where schemaname='public' and policyname='compte_actif_obligatoire') as policies_compte_actif,
  (select count(*) from pg_policies where schemaname='public' and policyname in ('lecture_meme_site','insertion_roles_meme_site','annulation_roles_meme_site')) as policies_site,
  (select count(*) from pg_views where schemaname='public' and viewname in ('v_tarif_prix_application_actifs','v_tarif_exceptions_effectives','v_tarif_incoherences')) as vues,
  (select count(*) from pg_trigger where tgname in ('tarif_rattachements_famille','tarif_seuils_famille','tarif_prix_application_controle','tarif_decisions_lien') and not tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('tarif_cle_reference','tarif_controle_version','tarif_controle_retrogradation','tarif_controle_famille','tarif_controle_application','tarif_controle_decision_lien','tarif_enregistrer_decisions','tarif_marquer_verifie','tarif_enregistrer_reevaluations')) as fonctions,
  (select count(*) from information_schema.table_privileges where table_schema='public' and table_name in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and grantee in ('anon','public')) as droits_anon_public) q;
-- ===== Application 1 a 6 =====
-- migration 1
-- NEXUS Scanner, politique tarifaire T2 : registres versionnés (10 tables tarif_*), prérequis vérifiés par un bloc neutre, applicable sur tout projet portant les tables du socle.
-- Aucune donnée Production, aucune donnée Decenium modifiée.
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
-- migration 2
-- NEXUS Scanner, politique tarifaire T2 : déclencheurs d'intégrité, permissions et isolation par site, applicable après la migration 20261117020430.
-- Dépend de 20261118100000_tarif_registres.sql.
-- Version 2 (examen du 16/11/2026) : aucune fonction SECURITY DEFINER nouvelle. Les deux fonctions de lecture
-- de statut de la version 1 sont remplacées par un déclencheur ordinaire, qui lit la table sous les droits de la personne.

-- 1. Une seule version active par (site, clé). Active = non annulée et non remplacée par une version non annulée
--    (même règle que NexusProduitsMesure.actives). Contrôle APRÈS insertion : la colonne générée `cle` n'est calculée
--    qu'après les déclencheurs BEFORE. Le verrou consultatif sérialise deux saisies simultanées de la même clé ;
--    la fonction étant volatile, chaque requête voit les lignes validées par la transaction qui détenait le verrou.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117020652 (appliquer 20261117020430 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

create or replace function tarif_controle_version() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_autres int;
  v_cible record;
  v_freres int;
begin
  perform pg_advisory_xact_lock(hashtext(tg_table_name || '|' || new.site || '|' || new.cle));
  if new.remplace_id is null then
    execute format('select count(*) from %I t where t.site = $1 and t.cle = $2 and t.id <> $3 and t.annule_le is null
                      and not exists (select 1 from %I c where c.remplace_id = t.id and c.annule_le is null)', tg_table_name, tg_table_name)
      into v_autres using new.site, new.cle, new.id;
    if v_autres > 0 then
      raise exception 'tarif_version_active_existante : remplacer la version active ou l annuler d abord' using errcode = 'P0001';
    end if;
  else
    execute format('select site, cle, annule_le from %I where id = $1', tg_table_name) into v_cible using new.remplace_id;
    if v_cible is null or v_cible.site <> new.site or v_cible.cle <> new.cle then
      raise exception 'tarif_version_cible_invalide : la version remplacée doit être du même site et de la même clé' using errcode = 'P0001';
    end if;
    execute format('select count(*) from %I c where c.remplace_id = $1 and c.id <> $2 and c.annule_le is null', tg_table_name)
      into v_freres using new.remplace_id, new.id;
    if v_cible.annule_le is not null or v_freres > 0 then
      raise exception 'tarif_version_inactive : la version visée n est plus active' using errcode = 'P0001';
    end if;
  end if;
  return null;
end $$;

-- 2. Pas de rétrogradation : seul le gérant remplace une exception autre que candidate, ou un contrôle déjà qualifié.
--    Lecture de la ligne visée sous les droits de la personne (pas de SECURITY DEFINER, pas de récursion de politique).
--    service_role (rôle employé nul) est traité comme un non-gérant.
create or replace function tarif_controle_retrogradation() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_avant text;
begin
  if new.remplace_id is null or current_employee_role() is not distinct from 'gerant' then return null; end if;
  if tg_table_name = 'tarif_exceptions' then
    select statut into v_avant from tarif_exceptions where id = new.remplace_id;
    if v_avant is distinct from 'candidate' then
      raise exception 'tarif_retrogradation_refusee : seule une candidature peut être remplacée par un manager' using errcode = 'P0001';
    end if;
  else
    select etat into v_avant from tarif_controles_reglementaires where id = new.remplace_id;
    if v_avant is null or v_avant not in ('controle_ouvert', 'a_completer') then
      raise exception 'tarif_retrogradation_refusee : seul un contrôle ouvert ou à compléter peut être remplacé par un manager' using errcode = 'P0001';
    end if;
  end if;
  return null;
end $$;

-- 3. Une famille visée par un rattachement ou un seuil de famille doit être active sur le même site.
create or replace function tarif_controle_famille() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_code text;
begin
  if tg_table_name = 'tarif_rattachements' then v_code := new.famille_code;
  elsif new.niveau = 'famille' then v_code := new.cible_niveau;
  end if;
  if v_code is not null and not exists (
       select 1 from tarif_familles f where f.site = new.site and f.famille_code = v_code and f.annule_le is null
         and not exists (select 1 from tarif_familles c where c.remplace_id = f.id and c.annule_le is null)) then
    raise exception 'tarif_famille_inconnue : famille % absente ou inactive sur le site %', v_code, new.site using errcode = 'P0001';
  end if;
  return new;
end $$;

-- 4. Une application vise un prix décidé ACTIF du même site, dont la nature n'est pas « maintenu ».
create or replace function tarif_controle_application() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
       select 1 from tarif_prix_decides p where p.id = new.prix_decide_id and p.site = new.site and p.annule_le is null and p.nature <> 'maintenu'
         and not exists (select 1 from tarif_prix_decides c where c.remplace_id = p.id and c.annule_le is null)) then
    raise exception 'tarif_application_invalide : le prix décidé visé n est pas actif, pas du même site, ou est « maintenu »' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('drop trigger if exists %I on %I', t || '_version', t);
    execute format('create trigger %I after insert on %I for each row execute function tarif_controle_version()', t || '_version', t);
  end loop;
  foreach t in array array['tarif_exceptions','tarif_controles_reglementaires'] loop
    execute format('drop trigger if exists %I on %I', t || '_retrogradation', t);
    execute format('create trigger %I after insert on %I for each row execute function tarif_controle_retrogradation()', t || '_retrogradation', t);
  end loop;
end $$;
drop trigger if exists tarif_rattachements_famille on tarif_rattachements;
create trigger tarif_rattachements_famille before insert on tarif_rattachements for each row execute function tarif_controle_famille();
drop trigger if exists tarif_seuils_famille on tarif_seuils;
create trigger tarif_seuils_famille before insert on tarif_seuils for each row execute function tarif_controle_famille();
drop trigger if exists tarif_prix_application_controle on tarif_prix_application;
create trigger tarif_prix_application_controle before insert on tarif_prix_application for each row execute function tarif_controle_application();
-- Version 1 : fonctions SECURITY DEFINER retirées si elles avaient été créées.
drop function if exists tarif_statut_exception(uuid);
drop function if exists tarif_etat_controle(uuid);
-- Les fonctions de déclencheur ne s'appellent pas directement.
revoke all on function tarif_controle_version(), tarif_controle_retrogradation(), tarif_controle_famille(), tarif_controle_application() from public, anon, authenticated, service_role;

-- 5. Permissions. Lecture : manager et gérant du site ; créateur seulement si le site l'autorise. Aucun accès anon ni employé.
--    Écriture : gérant pour tout ce qui décide ; manager pour proposer (candidate), ouvrir un contrôle, déclarer une application.
--    Aucun DELETE ni TRUNCATE. UPDATE limité aux trois colonnes d'annulation, y compris pour service_role
--    (les privilèges par défaut de Supabase, qui accordent tout à anon, authenticated et service_role, sont retirés).
do $$
declare
  t text;
  lecture text := '(site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant''))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise))';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  ecriture text;
  annulation text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    ecriture := case t
      when 'tarif_exceptions' then format('(%s) or (%s and statut = ''candidate'')', gerant, manager)
      when 'tarif_controles_reglementaires' then format('(%s) or (%s and etat in (''controle_ouvert'',''a_completer''))', gerant, manager)
      when 'tarif_prix_application' then manager
      else gerant end;
    annulation := case t
      when 'tarif_exceptions' then format('(%s) or (%s and saisi_par = (select auth.uid()) and statut = ''candidate'')', gerant, manager)
      when 'tarif_controles_reglementaires' then format('(%s) or (%s and saisi_par = (select auth.uid()) and etat in (''controle_ouvert'',''a_completer''))', gerant, manager)
      when 'tarif_prix_application' then format('(%s) or (%s and saisi_par = (select auth.uid()))', gerant, manager)
      else gerant end;
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format('create policy lecture_meme_site on %I for select to authenticated using (%s)', t, format(lecture, t));
    execute format('drop policy if exists insertion_roles_meme_site on %I', t);
    execute format('create policy insertion_roles_meme_site on %I for insert to authenticated with check ((%s) and saisi_par = (select auth.uid()) and annule_le is null)', t, ecriture);
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using ((%s) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))', t, annulation);
    execute format('revoke all on %I from anon, public, authenticated, service_role', t);
    execute format('grant select, insert on %I to authenticated, service_role', t);
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated, service_role', t);
  end loop;
end $$;
-- migration 3
-- NEXUS Scanner, politique tarifaire T2 : vues de l'état courant (security_invoker), applicable après les migrations 20261117020430 et 20261117020652.
-- security_invoker : chaque vue applique les permissions de la personne connectée (RLS des tables sous-jacentes).
-- Version 2 (examen du 16/11/2026, 20 h 22) : exceptions effectives par priorité, vue des incohérences.

-- Ordre obligatoire : 100000, 100100, 100200, puis 100300 en dernier. Rejouer ce fichier après 100300 rétablirait
-- la vue des exceptions sans le filtre des comptes actifs : refusé.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117020851 (appliquer 20261117020430 et 20261117020652 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : 20261118100300 est déjà appliquée, 20261118100200 ne se rejoue pas après elle';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_regimes_prix','tarif_controles_reglementaires'] loop
    execute format('create or replace view %I with (security_invoker = true) as
      select t.* from %I t
      where t.annule_le is null
        and not exists (select 1 from %I c where c.remplace_id = t.id and c.annule_le is null)', 'v_' || t || '_actifs', t, t);
    execute format('revoke all on %I from anon, public, authenticated, service_role', 'v_' || t || '_actifs');
    execute format('grant select on %I to authenticated, service_role', 'v_' || t || '_actifs');
  end loop;
end $$;

create or replace view v_tarif_prix_application_actifs with (security_invoker = true) as
  select a.* from tarif_prix_application a where a.annule_le is null;
revoke all on v_tarif_prix_application_actifs from anon, public, authenticated, service_role;
grant select on v_tarif_prix_application_actifs to authenticated, service_role;

-- Exceptions effectives : UNE ligne par (site, référence), choisie par priorité.
--   1. Décision du gérant dans tarif_exceptions (validee ou levee) : elle fait foi, et neutralise produits_appel.
--   2. Sinon, produit d'appel déjà enregistré dans produits_appel : il reste VALIDÉ, même si une candidature ou un refus
--      existe pour la même référence. Ces derniers sont signalés à côté, sans effet.
--   3. Sinon, candidature ou refus du registre (sans effet sur le moteur, qui n'applique que « validee »).
-- Rapprochement d'une ligne produits_appel (libellé seul) : même libellé normalisé, ou même clé.
drop view if exists v_tarif_exceptions_effectives;
create view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;

-- Incohérences d'intégrité à surveiller (lecture seule) : références qui visent une famille ou un prix décidé devenu inactif.
create or replace view v_tarif_incoherences with (security_invoker = true) as
  select r.site, 'rattachement vers une famille inactive'::text as incoherence, r.id as ligne_id, r.cle, r.famille_code as cible
  from v_tarif_rattachements_actifs r
  where not exists (select 1 from v_tarif_familles_actifs f where f.site = r.site and f.famille_code = r.famille_code)
  union all
  select s.site, 'seuil d''une famille inactive', s.id, s.cle, s.cible_niveau
  from v_tarif_seuils_actifs s
  where s.niveau = 'famille' and not exists (select 1 from v_tarif_familles_actifs f where f.site = s.site and f.famille_code = s.cible_niveau)
  union all
  select a.site, 'application visant un prix décidé inactif', a.id, null, a.prix_decide_id::text
  from v_tarif_prix_application_actifs a
  where not exists (select 1 from v_tarif_prix_decides_actifs p where p.id = a.prix_decide_id);
revoke all on v_tarif_incoherences from anon, public, authenticated, service_role;
grant select on v_tarif_incoherences to authenticated, service_role;
-- migration 4
-- NEXUS Scanner, politique tarifaire T2 : blocage des comptes désactivés, applicable après les trois migrations précédentes.
-- Dépend de 20261118100000, 100100 et 100200.
--
-- Constat (catalogue de Test relu le 16/11/2026) : current_employee_role() et current_employee_site_id() ne lisent pas
-- employees.actif. Aucune politique, aucun déclencheur, aucun hook d'authentification et aucune fonction Edge ne le
-- lisent à leur place. Un compte désactivé dont la session reste valide garde donc son rôle sur les registres T2.
--
-- Correction isolée : une politique RESTRICTIVE par registre, combinée en ET avec les politiques existantes.
-- Elle ne peut que retirer un accès, jamais en ajouter. Aucune fonction nouvelle, aucun SECURITY DEFINER :
-- la personne lit sa propre ligne employees, ce que la politique select_employees lui permet déjà.
-- Les fonctions d'aide partagées par NEXUS ne sont pas modifiées (hors périmètre T2).
-- Ordre obligatoire : cette migration passe en DERNIER. Elle vérifie que les trois précédentes sont en place.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions', 'public.v_tarif_incoherences', 'public.v_tarif_exceptions_effectives']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117021059 (appliquer 20261117020430 à 20261117020851 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if (select count(*) from pg_tables where schemaname = 'public' and tablename like 'tarif\_%') <> 10
     or to_regprocedure('public.tarif_controle_retrogradation()') is null
     or to_regclass('public.v_tarif_incoherences') is null then
    raise exception 'ordre_migrations : appliquer 20261118100000, 100100 et 100200 avant 20261118100300';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides',
                           'tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions'] loop
    execute format('drop policy if exists compte_actif_obligatoire on %I', t);
    execute format('create policy compte_actif_obligatoire on %I as restrictive for all to authenticated
      using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))
      with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))', t);
  end loop;
end $$;

-- La vue des exceptions effectives reprend produits_appel, dont la politique de lecture ignore aussi employees.actif.
-- Même définition que 20261118100200, avec la seule condition de compte actif sur la branche produits_appel.
create or replace view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
  -- produits_appel est une table NEXUS existante, lisible par tout employé du site, actif ou non :
  -- la vue tarifaire ne la reprend que pour un compte actif (ou pour un rôle technique hors authenticated).
  where (select current_user) <> 'authenticated'
     or exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif)
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;
-- migration 5
-- NEXUS Scanner, T3 : enregistrement transactionnel d'une décision de prix et de sa ligne de journal, applicable après les quatre migrations T2.
-- Version 2 (contre-audit du 17/11/2026, 11 h 09) : règle du lien portée par le déclencheur d'insertion (plus de CHECK),
-- lien limité à un prix décidé actif, version de moteur présentée comme un contrôle de forme.
-- Dépend des quatre migrations T2 (20261118100000 à 100300).
--
-- Arbitrage du 17/11/2026, condition 1 : fonction SECURITY INVOKER ; RLS, atomicité et isolation multisite prouvées
-- sur base jetable avant toute migration.
--
-- Principe : un seul appel enregistre, pour chaque ligne d'un lot, le prix décidé (tarif_prix_decides) et sa ligne de
-- journal (tarif_decisions), ou rien du tout. La fonction s'exécute avec les droits de la personne connectée : la RLS
-- T2 (dont compte_actif_obligatoire) s'applique à chaque insertion, aucune élévation de droits.
-- Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Aucune donnée existante n'est modifiée. Aucune écriture Decenium.

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions', 'public.v_tarif_incoherences']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261117161325 (appliquer 20261117020430 à 20261117021059 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if to_regclass('public.tarif_decisions') is null or to_regclass('public.v_tarif_prix_decides_actifs') is null
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : appliquer les quatre migrations T2 (20261118100000 à 100300) avant 20261119100000';
  end if;
end $$;

-- 1. Lien journal vers prix décidé, du même site. Une décision « refusee » ne crée pas de prix ; les autres en créent un.
alter table tarif_decisions add column if not exists prix_decide_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tarif_decisions_prix_meme_site_fk') then
    alter table tarif_decisions add constraint tarif_decisions_prix_meme_site_fk
      foreign key (prix_decide_id, site) references tarif_prix_decides (id, site);
  end if;
end $$;
-- Version 2 (contre-audit du 17/11/2026) : la règle « refus sans lien, sinon lien obligatoire » n'est PAS une contrainte CHECK.
-- Une CHECK, même NOT VALID, est contrôlée à chaque UPDATE : l'annulation d'une décision historique sans lien serait refusée.
-- La règle est portée par le déclencheur d'insertion ci-dessous ; les lignes historiques restent annulables.
alter table tarif_decisions drop constraint if exists tarif_decisions_lien_prix;
create unique index if not exists tarif_decisions_prix_decide_uq on tarif_decisions (prix_decide_id) where prix_decide_id is not null;
comment on column tarif_decisions.prix_decide_id is 'Prix décidé créé par cette décision (même site). Nul pour un refus. Lignes antérieures à cette migration : nul, conservées telles quelles (décision historique sans lien).';

-- 2. Règles du lien, contrôlées à l'INSERTION seulement (jamais à l'annulation), y compris hors fonction et pour service_role :
--    refus sans lien ; validée ou autre prix avec un lien vers un prix décidé ACTIF, de nature « changement »,
--    même site, même référence, même prix, même auteur. Lecture sous les droits de la personne (pas de SECURITY DEFINER).
create or replace function tarif_controle_decision_lien() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v record;
begin
  if new.decision = 'refusee' then
    if new.prix_decide_id is not null then
      raise exception 'tarif_decision_lien_invalide : un refus ne crée pas de prix décidé' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.prix_decide_id is null then
    raise exception 'tarif_decision_lien_absent : une décision validée ou à un autre prix doit viser son prix décidé' using errcode = 'P0001';
  end if;
  select p.site, p.cle, p.prix_ttc, p.saisi_par, p.nature, p.annule_le,
         exists (select 1 from tarif_prix_decides c where c.remplace_id = p.id and c.annule_le is null) as remplace
    into v from tarif_prix_decides p where p.id = new.prix_decide_id;
  if v is null or v.site <> new.site or v.cle is distinct from tarif_cle_reference(new.code_barres, new.article)
     or v.prix_ttc is distinct from new.prix_ttc_retenu or v.saisi_par is distinct from new.saisi_par or v.nature <> 'changement'
     or v.annule_le is not null or v.remplace then
    raise exception 'tarif_decision_lien_invalide : le prix décidé lié n est pas celui de cette décision, ou n est plus actif' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists tarif_decisions_lien on tarif_decisions;
create trigger tarif_decisions_lien before insert on tarif_decisions for each row execute function tarif_controle_decision_lien();
revoke all on function tarif_controle_decision_lien() from public, anon, authenticated, service_role;

-- 3. La fonction transactionnelle. Un appel = une transaction : toute erreur annule le lot entier.
--    Entrée : tableau JSON de 1 à 200 décisions. Champs admis par ligne, et aucun autre (le site est refusé) :
--    article, code_barres, decision ('validee' | 'refusee' | 'autre_prix'), prix_ttc_retenu, motif, seuil_id,
--    periode_debut, periode_fin, moteur_version (doit venir du moteur T2), photo.
create or replace function tarif_enregistrer_decisions(p_lignes jsonb)
returns table (o_decision_id uuid, o_prix_decide_id uuid, o_cle text)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_cle text;
  v_cles text[] := '{}';
  v_remplace uuid;
  v_pd uuid;
  v_dec uuid;
begin
  if v_uid is null then
    raise exception 'tarif_decision_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  -- Vérification explicite du compte (arbitrage, condition 3) : on ne déduit rien d'une lecture vide.
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then
    raise exception 'tarif_decision_compte_illisible : fiche employé introuvable' using errcode = 'P0001';
  end if;
  if not v_emp.actif then
    raise exception 'tarif_decision_compte_inactif : compte désactivé' using errcode = 'P0001';
  end if;
  if v_emp.est_createur then
    raise exception 'tarif_decision_createur_lecture_seule : le créateur ne décide pas' using errcode = 'P0001';
  end if;
  if v_emp.role is distinct from 'gerant' then
    raise exception 'tarif_decision_reservee_gerant : seul le gérant décide d un prix' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_decision_lot_invalide : de 1 à 200 décisions par appel' using errcode = 'P0001';
  end if;

  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('article','code_barres','decision','prix_ttc_retenu','motif','seuil_id','periode_debut','periode_fin','moteur_version','photo')) then
      raise exception 'tarif_decision_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    -- Contrôle de forme seulement : la base vérifie que la version DÉCLARÉE est une version T2, pas que la photo vient
    -- réellement du moteur T2 (la photo est calculée dans le navigateur ; la base ne peut pas en prouver l'origine).
    if coalesce(l->>'moteur_version', '') !~ '^politique-tarifaire-t2(-[a-z0-9.]+)?$' then
      raise exception 'tarif_decision_version_moteur_refusee : version de moteur déclarée absente ou hors T2' using errcode = 'P0001';
    end if;
    v_cle := tarif_cle_reference(l->>'code_barres', l->>'article');
    if v_cle is null then
      raise exception 'tarif_decision_reference_absente : code-barres ou libellé obligatoire' using errcode = 'P0001';
    end if;
    if v_cle = any (v_cles) then
      raise exception 'tarif_decision_doublon_lot : la référence % figure deux fois dans le lot', v_cle using errcode = 'P0001';
    end if;
    v_cles := v_cles || v_cle;

    v_pd := null;
    v_remplace := null;
    if l->>'decision' in ('validee', 'autre_prix') then
      -- Version active éventuelle du même site et de la même clé, lue sous RLS ; le déclencheur T2 sérialise et contrôle.
      select p.id into v_remplace from v_tarif_prix_decides_actifs p where p.site = v_emp.site_id and p.cle = v_cle;
      insert into tarif_prix_decides (site, article, code_barres, nature, prix_ttc, motif, remplace_id)
      values (v_emp.site_id, l->>'article', l->>'code_barres', 'changement', (l->>'prix_ttc_retenu')::numeric, l->>'motif', v_remplace)
      returning id into v_pd;
    end if;

    insert into tarif_decisions (site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif,
                                 seuil_id, moteur_version, photo, prix_decide_id)
    values (v_emp.site_id, l->>'article', l->>'code_barres', (l->>'periode_debut')::date, (l->>'periode_fin')::date, l->>'decision',
            (l->>'prix_ttc_retenu')::numeric, l->>'motif', (l->>'seuil_id')::uuid, l->>'moteur_version', l->'photo', v_pd)
    returning id into v_dec;

    o_decision_id := v_dec; o_prix_decide_id := v_pd; o_cle := v_cle;
    return next;
  end loop;
end $$;
revoke all on function tarif_enregistrer_decisions(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_enregistrer_decisions(jsonb) to authenticated;
comment on function tarif_enregistrer_decisions(jsonb) is
  'T3 : enregistre ensemble prix décidé et journal, par lot, tout ou rien. SECURITY INVOKER : RLS T2 appliquée. Gérant actif, non créateur, site du compte.';
-- migration 6
-- NEXUS Scanner, anomalies tarifaires : vérifications et réévaluations, applicable après les migrations T2 et le journal des décisions.
-- Dépend des migrations T2 (20261117020430, 020652, 020851, 021059) et du journal 20261117161325.
-- Additive : deux tables d'ajout seul, deux fonctions SECURITY INVOKER. Aucune donnée existante modifiée.
-- Aucune écriture Decenium. Le site n'est jamais un paramètre : il est lu dans la ligne employees de la personne connectée.
-- Retour arrière : docs/deploiement/retour-arriere-tarif-anomalies-verifications-20261118.sql (ne retire que ces quatre objets).

-- Prérequis : la migration s'arrête avant toute écriture si un objet attendu manque (aucune identité de projet n'est supposée).
do $prerequis$
declare v_manque text;
begin
  select string_agg(o, ', ') into v_manque from unnest(array['public.sites', 'public.employees', 'public.import_batches', 'public.tarif_familles', 'public.tarif_rattachements', 'public.tarif_seuils', 'public.tarif_reglages', 'public.tarif_exceptions', 'public.tarif_prix_decides', 'public.tarif_prix_application', 'public.tarif_regimes_prix', 'public.tarif_controles_reglementaires', 'public.tarif_decisions']) as o where to_regclass(o) is null;
  if v_manque is not null then
    raise exception 'prerequis_migrations : 20261118120000 (appliquer 20261117020430 à 20261117161325 avant) : objets absents : %', v_manque;
  end if;
end $prerequis$;

do $$ begin
  if to_regclass('public.tarif_decisions') is null or to_regprocedure('public.tarif_enregistrer_decisions(jsonb)') is null
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'compte_actif_obligatoire') then
    raise exception 'ordre_migrations : appliquer les migrations T2 et le journal des décisions avant 20261118120000';
  end if;
end $$;

-- 1. Vérifications : « ✓ Marquer comme vérifié ». Ajout seul ; l'annulation est tracée (qui, quand, pourquoi).
create table if not exists tarif_anomalies_verifications (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  cause text not null check (cause in ('S1','S2','S3','S4','S5','S6','S7')),
  empreinte text not null check (length(btrim(empreinte)) > 0),
  fichier_hash text not null check (length(btrim(fichier_hash)) > 0),
  date_releve date,
  -- Traçabilité : ce que le moteur a constaté au moment de la vérification (gravité comprise : le cycle de vie la compare à la suivante).
  gravite numeric not null check (gravite >= 0),
  niveau text,
  valeurs jsonb not null check (jsonb_typeof(valeurs) = 'object'),
  periode_debut date, periode_fin date,
  import_batch_id uuid not null references import_batches(id),
  moteur_version text not null check (length(btrim(moteur_version)) > 0),
  commentaire text,
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_anom_verif_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_anom_verif_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint tarif_anom_verif_commentaire_long check (commentaire is null or char_length(commentaire) <= 500),
  constraint tarif_anom_verif_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500),
  constraint tarif_anom_verif_id_site unique (id, site)
);
-- Idempotence : une seule vérification active par site, référence, cause, empreinte et fichier importé. Une nouvelle vérification sur un nouvel import crée donc une nouvelle ligne (l'historique garde les deux).
create unique index if not exists tarif_anom_verif_active_uq on tarif_anomalies_verifications (site, cle, cause, empreinte, fichier_hash) where annule_le is null;
create index if not exists tarif_anom_verif_site_cle on tarif_anomalies_verifications (site, cle);

-- 2. Réévaluations : ce que le moteur constate à un nouvel import pour une anomalie déjà vérifiée. Ajout seul.
create table if not exists tarif_anomalies_reevaluations (
  id uuid primary key default gen_random_uuid(),
  site text not null references sites(site_id),
  article text, code_barres text,
  verification_id uuid not null,
  etat text not null check (etat in ('persistante','aggravee','resolue')),
  fichier_hash text not null check (length(btrim(fichier_hash)) > 0),
  date_releve date,
  empreinte text,
  gravite numeric check (gravite >= 0),
  valeurs jsonb check (valeurs is null or jsonb_typeof(valeurs) = 'object'),
  saisi_par uuid not null default auth.uid() references employees(id),
  saisi_le timestamptz not null default now(),
  annule_le timestamptz, annule_par uuid references employees(id), motif_annulation text,
  cle text generated always as (tarif_cle_reference(code_barres, article)) stored,
  constraint tarif_anom_reeval_cible check (tarif_cle_reference(code_barres, article) is not null),
  constraint tarif_anom_reeval_verif_fk foreign key (verification_id, site) references tarif_anomalies_verifications (id, site),
  constraint tarif_anom_reeval_annulation check ((annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) > 0)),
  constraint tarif_anom_reeval_motif_long check (motif_annulation is null or char_length(motif_annulation) <= 500)
);
create unique index if not exists tarif_anom_reeval_active_uq on tarif_anomalies_reevaluations (verification_id, fichier_hash) where annule_le is null;

comment on table tarif_anomalies_verifications is 'Anomalies tarifaires marquées vérifiées par un manager ou le gérant. Ajout seul, annulation tracée. Ne modifie aucun prix ni aucune donnée Decenium.';
comment on table tarif_anomalies_reevaluations is 'Résultat d une réévaluation à un nouvel import pour une vérification existante. Ajout seul, annulation tracée.';

-- 3. RLS : lecture manager et gérant du site (créateur seulement si le site l'autorise) ; écriture manager et gérant du site.
--    Annulation : gérant, ou manager pour ce qu'il a saisi. Aucun DELETE ni TRUNCATE ; UPDATE limité aux colonnes d'annulation.
do $$
declare
  t text;
  lecture text := '(site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant''))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = %I.site and s.acces_createur_autorise))';
  manager text := 'site = (select current_employee_site_id()) and (select current_employee_role()) in (''manager'',''gerant'')';
  gerant text := 'site = (select current_employee_site_id()) and (select current_employee_role()) = ''gerant''';
begin
  foreach t in array array['tarif_anomalies_verifications','tarif_anomalies_reevaluations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists lecture_meme_site on %I', t);
    execute format('create policy lecture_meme_site on %I for select to authenticated using (%s)', t, format(lecture, t));
    execute format('drop policy if exists insertion_roles_meme_site on %I', t);
    execute format('create policy insertion_roles_meme_site on %I for insert to authenticated with check ((%s) and saisi_par = (select auth.uid()) and annule_le is null)', t, manager);
    execute format('drop policy if exists annulation_roles_meme_site on %I', t);
    execute format('create policy annulation_roles_meme_site on %I for update to authenticated using (((%s) or (%s and saisi_par = (select auth.uid()))) and annule_le is null) with check (annule_le is not null and annule_par = (select auth.uid()))', t, gerant, manager);
    execute format('drop policy if exists compte_actif_obligatoire on %I', t);
    execute format('create policy compte_actif_obligatoire on %I as restrictive for all to authenticated
      using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))
      with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.actif))', t);
    execute format('revoke all on %I from anon, public, authenticated, service_role', t);
    execute format('grant select, insert on %I to authenticated, service_role', t);
    execute format('grant update (annule_le, annule_par, motif_annulation) on %I to authenticated, service_role', t);
  end loop;
end $$;

-- Le lot d'import cité par une vérification doit appartenir au site de la personne (import_batches n'a pas de clé (id, site) : politique restrictive).
drop policy if exists lot_import_meme_site on tarif_anomalies_verifications;
create policy lot_import_meme_site on tarif_anomalies_verifications as restrictive for insert to authenticated
  with check (exists (select 1 from import_batches b where b.id = import_batch_id and b.site = tarif_anomalies_verifications.site));

-- 4. Marquer des anomalies comme vérifiées, par lot, tout ou rien. SECURITY INVOKER : la RLS s'applique à chaque insertion.
--    Champs admis par ligne, et aucun autre (le site est refusé) : article, code_barres, cause, empreinte, fichier_hash, date_releve, commentaire,
--    gravite, niveau, valeurs, periode_debut, periode_fin, import_batch_id, moteur_version (traçabilité du constat).
--    Idempotent : une vérification active identique n'est pas dupliquée, son identifiant est rendu avec o_deja = true.
create or replace function tarif_marquer_verifie(p_lignes jsonb)
returns table (o_id uuid, o_cle text, o_deja boolean)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_cle text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'tarif_verif_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then raise exception 'tarif_verif_compte_illisible : fiche employé introuvable' using errcode = 'P0001'; end if;
  if not v_emp.actif then raise exception 'tarif_verif_compte_inactif : compte désactivé' using errcode = 'P0001'; end if;
  if v_emp.est_createur then raise exception 'tarif_verif_createur_lecture_seule : le créateur ne vérifie pas' using errcode = 'P0001'; end if;
  if v_emp.role is null or v_emp.role not in ('manager','gerant') then
    raise exception 'tarif_verif_reservee_manager_gerant : réservé au manager et au gérant' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_verif_lot_invalide : de 1 à 200 anomalies par appel' using errcode = 'P0001';
  end if;
  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('article','code_barres','cause','empreinte','fichier_hash','date_releve','commentaire',
          'gravite','niveau','valeurs','periode_debut','periode_fin','import_batch_id','moteur_version')) then
      raise exception 'tarif_verif_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    v_cle := tarif_cle_reference(l->>'code_barres', l->>'article');
    if v_cle is null then raise exception 'tarif_verif_reference_absente : code-barres ou libellé obligatoire' using errcode = 'P0001'; end if;
    if (l->>'import_batch_id') is null or not exists (select 1 from import_batches b
         where b.id = (l->>'import_batch_id')::uuid and b.site = v_emp.site_id and (b.fichier_hash is null or b.fichier_hash = l->>'fichier_hash')) then
      raise exception 'tarif_verif_lot_import_incoherent : le lot d import doit exister, appartenir au site et porter ce fichier_hash' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(l->>'commentaire',''))) > 500 then
      raise exception 'tarif_verif_commentaire_trop_long : le commentaire est limité à 500 caractères' using errcode = 'P0001';
    end if;
    select v.id into v_id from tarif_anomalies_verifications v
      where v.site = v_emp.site_id and v.cle = v_cle and v.cause = l->>'cause' and v.empreinte = l->>'empreinte' and v.fichier_hash = l->>'fichier_hash' and v.annule_le is null;
    if v_id is not null then
      o_id := v_id; o_cle := v_cle; o_deja := true; return next;
    else
      insert into tarif_anomalies_verifications (site, article, code_barres, cause, empreinte, fichier_hash, date_releve, commentaire,
              gravite, niveau, valeurs, periode_debut, periode_fin, import_batch_id, moteur_version)
      values (v_emp.site_id, l->>'article', l->>'code_barres', l->>'cause', l->>'empreinte', l->>'fichier_hash',
              nullif(l->>'date_releve','')::date, nullif(btrim(l->>'commentaire'),''),
              (l->>'gravite')::numeric, nullif(l->>'niveau',''), l->'valeurs', nullif(l->>'periode_debut','')::date,
              nullif(l->>'periode_fin','')::date, (l->>'import_batch_id')::uuid, l->>'moteur_version')
      returning id into v_id;
      o_id := v_id; o_cle := v_cle; o_deja := false; return next;
    end if;
  end loop;
end $$;
revoke all on function tarif_marquer_verifie(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_marquer_verifie(jsonb) to authenticated;

-- 5. Enregistrer les réévaluations d'un nouvel import. Idempotent par (vérification, fichier_hash).
--    Champs admis : verification_id, article, code_barres, etat, fichier_hash, date_releve, empreinte, gravite, valeurs.
--    La clé et la cause de la ligne doivent correspondre à la vérification citée, sinon tarif_reeval_incoherente.
create or replace function tarif_enregistrer_reevaluations(p_lignes jsonb)
returns table (o_id uuid, o_deja boolean)
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  l jsonb;
  v_id uuid;
  v_ver record;
begin
  if v_uid is null then
    raise exception 'tarif_reeval_session_absente : aucune personne connectée' using errcode = 'P0001';
  end if;
  select e.actif, e.role, e.site_id, e.est_createur into v_emp from employees e where e.id = v_uid;
  if not found then raise exception 'tarif_reeval_compte_illisible : fiche employé introuvable' using errcode = 'P0001'; end if;
  if not v_emp.actif then raise exception 'tarif_reeval_compte_inactif : compte désactivé' using errcode = 'P0001'; end if;
  if v_emp.est_createur then raise exception 'tarif_reeval_createur_lecture_seule : le créateur n enregistre pas' using errcode = 'P0001'; end if;
  if v_emp.role is null or v_emp.role not in ('manager','gerant') then
    raise exception 'tarif_reeval_reservee_manager_gerant : réservé au manager et au gérant' using errcode = 'P0001';
  end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 200 then
    raise exception 'tarif_reeval_lot_invalide : de 1 à 200 réévaluations par appel' using errcode = 'P0001';
  end if;
  for l in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(l) <> 'object' or exists (select 1 from jsonb_object_keys(l) k where k not in
         ('verification_id','article','code_barres','etat','fichier_hash','date_releve','empreinte','gravite','valeurs','cause')) then
      raise exception 'tarif_reeval_champ_inconnu : champ non admis (le site n est jamais transmis)' using errcode = 'P0001';
    end if;
    select v.cle, v.cause into v_ver from tarif_anomalies_verifications v
      where v.id = (l->>'verification_id')::uuid and v.site = v_emp.site_id;
    if not found or v_ver.cle is distinct from tarif_cle_reference(l->>'code_barres', l->>'article')
       or (l ? 'cause' and v_ver.cause is distinct from l->>'cause') then
      raise exception 'tarif_reeval_incoherente : la référence ou la cause ne correspond pas à la vérification citée' using errcode = 'P0001';
    end if;
    select r.id into v_id from tarif_anomalies_reevaluations r
      where r.verification_id = (l->>'verification_id')::uuid and r.fichier_hash = l->>'fichier_hash' and r.annule_le is null;
    if v_id is not null then
      o_id := v_id; o_deja := true; return next;
    else
      -- La clé étrangère composée (verification_id, site) interdit une vérification d'un autre site.
      insert into tarif_anomalies_reevaluations (site, article, code_barres, verification_id, etat, fichier_hash, date_releve, empreinte, gravite, valeurs)
      values (v_emp.site_id, l->>'article', l->>'code_barres', (l->>'verification_id')::uuid, l->>'etat', l->>'fichier_hash',
              nullif(l->>'date_releve','')::date, l->>'empreinte', (l->>'gravite')::numeric, l->'valeurs')
      returning id into v_id;
      o_id := v_id; o_deja := false; return next;
    end if;
  end loop;
end $$;
revoke all on function tarif_enregistrer_reevaluations(jsonb) from public, anon, authenticated, service_role;
grant execute on function tarif_enregistrer_reevaluations(jsonb) to authenticated;
comment on function tarif_marquer_verifie(jsonb) is 'Marque des anomalies tarifaires comme vérifiées, par lot, tout ou rien, idempotent. SECURITY INVOKER : RLS appliquée. Manager ou gérant actif, non créateur, site du compte.';
comment on function tarif_enregistrer_reevaluations(jsonb) is 'Enregistre les réévaluations d un nouvel import, idempotent par vérification et fichier. SECURITY INVOKER.';
insert into ctl(nom, detail) select 'etat_apres_application', to_jsonb(q) from (select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relkind='r') as tables_t2,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relrowsecurity and c.relforcerowsecurity) as tables_rls_forcee,
  (select count(*) from pg_policies where schemaname='public' and policyname='compte_actif_obligatoire') as policies_compte_actif,
  (select count(*) from pg_policies where schemaname='public' and policyname in ('lecture_meme_site','insertion_roles_meme_site','annulation_roles_meme_site')) as policies_site,
  (select count(*) from pg_views where schemaname='public' and viewname in ('v_tarif_prix_application_actifs','v_tarif_exceptions_effectives','v_tarif_incoherences')) as vues,
  (select count(*) from pg_trigger where tgname in ('tarif_rattachements_famille','tarif_seuils_famille','tarif_prix_application_controle','tarif_decisions_lien') and not tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('tarif_cle_reference','tarif_controle_version','tarif_controle_retrogradation','tarif_controle_famille','tarif_controle_application','tarif_controle_decision_lien','tarif_enregistrer_decisions','tarif_marquer_verifie','tarif_enregistrer_reevaluations')) as fonctions,
  (select count(*) from information_schema.table_privileges where table_schema='public' and table_name in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and grantee in ('anon','public')) as droits_anon_public) q;
-- ===== Nouveaux retraits 6 a 1 =====
-- retour arriere 6
drop function if exists tarif_enregistrer_reevaluations(jsonb);
drop function if exists tarif_marquer_verifie(jsonb);
drop table if exists tarif_anomalies_reevaluations;
drop table if exists tarif_anomalies_verifications;
-- retour arriere 5
drop function if exists tarif_enregistrer_decisions(jsonb);
drop trigger if exists tarif_decisions_lien on tarif_decisions;
drop function if exists tarif_controle_decision_lien();
drop index if exists tarif_decisions_prix_decide_uq;
alter table tarif_decisions drop constraint if exists tarif_decisions_prix_meme_site_fk;
alter table tarif_decisions drop column if exists prix_decide_id;
-- retour arriere 4
drop policy if exists compte_actif_obligatoire on tarif_familles;
drop policy if exists compte_actif_obligatoire on tarif_rattachements;
drop policy if exists compte_actif_obligatoire on tarif_seuils;
drop policy if exists compte_actif_obligatoire on tarif_reglages;
drop policy if exists compte_actif_obligatoire on tarif_exceptions;
drop policy if exists compte_actif_obligatoire on tarif_prix_decides;
drop policy if exists compte_actif_obligatoire on tarif_prix_application;
drop policy if exists compte_actif_obligatoire on tarif_regimes_prix;
drop policy if exists compte_actif_obligatoire on tarif_controles_reglementaires;
drop policy if exists compte_actif_obligatoire on tarif_decisions;
drop view if exists v_tarif_exceptions_effectives;
create view v_tarif_exceptions_effectives with (security_invoker = true) as
with registre as (
  select e.site, e.article, e.code_barres, e.cle, e.type, e.statut, e.motif, e.cond_prix_ttc, e.cond_tolerance_cout, e.cond_cout_reference,
         e.id, e.saisi_le, lower(regexp_replace(btrim(coalesce(e.article, '')), '\s+', ' ', 'g')) as libelle_norm
  from v_tarif_exceptions_actifs e
),
appel as (
  select pa.site, pa.article, pa.id, pa.ajoute_le, s.timezone, lower(regexp_replace(btrim(pa.article), '\s+', ' ', 'g')) as libelle_norm
  from produits_appel pa join sites s on s.site_id = pa.site
),
candidats as (
  -- priorité 1 : décision du gérant
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions'::text as source, r.id as source_id, r.saisi_le, 1 as priorite, null::text as en_attente
  from registre r where r.statut in ('validee', 'levee')
  union all
  -- priorité 2 : produit d'appel enregistré, non couvert par une décision du gérant
  select a.site, a.article, null, tarif_cle_reference(null, a.article), 'produit_appel', 'validee',
         'enregistré dans produits_appel le ' || to_char(a.ajoute_le at time zone a.timezone, 'DD/MM/YYYY'),
         null::numeric, null::numeric, null::numeric, 'produits_appel', a.id, a.ajoute_le, 2,
         (select string_agg(r.statut || ' du ' || to_char(r.saisi_le at time zone a.timezone, 'DD/MM/YYYY'), ', ')
            from registre r where r.site = a.site and r.statut in ('candidate', 'refusee')
              and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  from appel a
  where not exists (select 1 from registre r where r.site = a.site and r.statut in ('validee', 'levee')
                      and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
  union all
  -- priorité 3 : candidature ou refus sans produit d'appel enregistré
  select r.site, r.article, r.code_barres, r.cle, r.type, r.statut, r.motif, r.cond_prix_ttc, r.cond_tolerance_cout, r.cond_cout_reference,
         'tarif_exceptions', r.id, r.saisi_le, 3, null
  from registre r
  where r.statut in ('candidate', 'refusee')
    and not exists (select 1 from appel a where a.site = r.site and (r.libelle_norm = a.libelle_norm or r.cle = tarif_cle_reference(null, a.article)))
)
select site, article, code_barres, cle, type, statut, motif, cond_prix_ttc, cond_tolerance_cout, cond_cout_reference, source, source_id, saisi_le,
       en_attente as candidature_ou_refus_sans_effet
from candidats;
revoke all on v_tarif_exceptions_effectives from anon, public, authenticated, service_role;
grant select on v_tarif_exceptions_effectives to authenticated, service_role;
-- retour arriere 3
drop view if exists v_tarif_incoherences;
drop view if exists v_tarif_exceptions_effectives;
drop view if exists v_tarif_prix_application_actifs;
-- retour arriere 2
drop policy if exists lecture_meme_site on tarif_familles;
drop policy if exists insertion_roles_meme_site on tarif_familles;
drop policy if exists annulation_roles_meme_site on tarif_familles;
alter table tarif_familles no force row level security;
alter table tarif_familles disable row level security;
drop policy if exists lecture_meme_site on tarif_rattachements;
drop policy if exists insertion_roles_meme_site on tarif_rattachements;
drop policy if exists annulation_roles_meme_site on tarif_rattachements;
alter table tarif_rattachements no force row level security;
alter table tarif_rattachements disable row level security;
drop policy if exists lecture_meme_site on tarif_seuils;
drop policy if exists insertion_roles_meme_site on tarif_seuils;
drop policy if exists annulation_roles_meme_site on tarif_seuils;
alter table tarif_seuils no force row level security;
alter table tarif_seuils disable row level security;
drop policy if exists lecture_meme_site on tarif_reglages;
drop policy if exists insertion_roles_meme_site on tarif_reglages;
drop policy if exists annulation_roles_meme_site on tarif_reglages;
alter table tarif_reglages no force row level security;
alter table tarif_reglages disable row level security;
drop policy if exists lecture_meme_site on tarif_exceptions;
drop policy if exists insertion_roles_meme_site on tarif_exceptions;
drop policy if exists annulation_roles_meme_site on tarif_exceptions;
alter table tarif_exceptions no force row level security;
alter table tarif_exceptions disable row level security;
drop policy if exists lecture_meme_site on tarif_prix_decides;
drop policy if exists insertion_roles_meme_site on tarif_prix_decides;
drop policy if exists annulation_roles_meme_site on tarif_prix_decides;
alter table tarif_prix_decides no force row level security;
alter table tarif_prix_decides disable row level security;
drop policy if exists lecture_meme_site on tarif_prix_application;
drop policy if exists insertion_roles_meme_site on tarif_prix_application;
drop policy if exists annulation_roles_meme_site on tarif_prix_application;
alter table tarif_prix_application no force row level security;
alter table tarif_prix_application disable row level security;
drop policy if exists lecture_meme_site on tarif_regimes_prix;
drop policy if exists insertion_roles_meme_site on tarif_regimes_prix;
drop policy if exists annulation_roles_meme_site on tarif_regimes_prix;
alter table tarif_regimes_prix no force row level security;
alter table tarif_regimes_prix disable row level security;
drop policy if exists lecture_meme_site on tarif_controles_reglementaires;
drop policy if exists insertion_roles_meme_site on tarif_controles_reglementaires;
drop policy if exists annulation_roles_meme_site on tarif_controles_reglementaires;
alter table tarif_controles_reglementaires no force row level security;
alter table tarif_controles_reglementaires disable row level security;
drop policy if exists lecture_meme_site on tarif_decisions;
drop policy if exists insertion_roles_meme_site on tarif_decisions;
drop policy if exists annulation_roles_meme_site on tarif_decisions;
alter table tarif_decisions no force row level security;
alter table tarif_decisions disable row level security;
drop trigger if exists tarif_rattachements_famille on tarif_rattachements;
drop trigger if exists tarif_seuils_famille on tarif_seuils;
drop trigger if exists tarif_prix_application_controle on tarif_prix_application;
drop function if exists tarif_controle_version();
drop function if exists tarif_controle_retrogradation();
drop function if exists tarif_controle_famille();
drop function if exists tarif_controle_application();
-- retour arriere 1
drop table if exists tarif_decisions;
drop table if exists tarif_controles_reglementaires;
drop table if exists tarif_regimes_prix;
drop table if exists tarif_prix_application;
drop table if exists tarif_prix_decides;
drop table if exists tarif_exceptions;
drop table if exists tarif_reglages;
drop table if exists tarif_seuils;
drop table if exists tarif_rattachements;
drop table if exists tarif_familles;
drop function if exists tarif_cle_reference(text, text);
insert into ctl(nom, detail) select 'etat_apres_second_retrait', to_jsonb(q) from (select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relkind='r') as tables_t2,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and c.relrowsecurity and c.relforcerowsecurity) as tables_rls_forcee,
  (select count(*) from pg_policies where schemaname='public' and policyname='compte_actif_obligatoire') as policies_compte_actif,
  (select count(*) from pg_policies where schemaname='public' and policyname in ('lecture_meme_site','insertion_roles_meme_site','annulation_roles_meme_site')) as policies_site,
  (select count(*) from pg_views where schemaname='public' and viewname in ('v_tarif_prix_application_actifs','v_tarif_exceptions_effectives','v_tarif_incoherences')) as vues,
  (select count(*) from pg_trigger where tgname in ('tarif_rattachements_famille','tarif_seuils_famille','tarif_prix_application_controle','tarif_decisions_lien') and not tgisinternal) as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('tarif_cle_reference','tarif_controle_version','tarif_controle_retrogradation','tarif_controle_famille','tarif_controle_application','tarif_controle_decision_lien','tarif_enregistrer_decisions','tarif_marquer_verifie','tarif_enregistrer_reevaluations')) as fonctions,
  (select count(*) from information_schema.table_privileges where table_schema='public' and table_name in ('tarif_familles','tarif_rattachements','tarif_seuils','tarif_reglages','tarif_exceptions','tarif_prix_decides','tarif_prix_application','tarif_regimes_prix','tarif_controles_reglementaires','tarif_decisions') and grantee in ('anon','public')) as droits_anon_public) q;
select jsonb_build_object('script','40_repetition_chaine_complete','etats',(select jsonb_agg(jsonb_build_object('nom',nom,'detail',detail) order by n) from ctl),
  'verdict', case when
    (select detail from ctl where nom='etat_apres_retraits') = (select detail from ctl where nom='etat_apres_second_retrait')
    and (select detail from ctl where nom='etat_initial') = (select detail from ctl where nom='etat_apres_application')
    and (select (detail->>'tables_t2')::int from ctl where nom='etat_apres_retraits')=0
    and (select (detail->>'tables_t2')::int from ctl where nom='etat_apres_application')=10
    and (select (detail->>'tables_rls_forcee')::int from ctl where nom='etat_apres_application')=10
    and (select (detail->>'policies_compte_actif')::int from ctl where nom='etat_apres_application')=10
    and (select (detail->>'droits_anon_public')::int from ctl where nom='etat_apres_application')=0
    and (select (detail->>'vues')::int from ctl where nom='etat_apres_application')=3
    then 'OK chaine complete rejouable' else 'KO voir etats' end) as repetition_40;
rollback;
