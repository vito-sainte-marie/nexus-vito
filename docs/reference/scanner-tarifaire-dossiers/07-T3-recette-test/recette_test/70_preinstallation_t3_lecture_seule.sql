-- NEXUS Scanner T3 : contrôle de PRÉINSTALLATION de 20261119100000_tarif_decision_journal sur Supabase Test.
-- LECTURE SEULE : transaction en lecture seule, aucune écriture possible. Données lues : comptes et empreintes du site
-- vito-sainte-marie seulement (filtre par site). Chaque ligne : contrôle, attendu, obtenu, verdict (OK, ECART ou INFO).
-- À rejouer juste avant la migration (après GO) : les empreintes servent de référence au contrôle 71 de postinstallation.
begin transaction read only;
with
cols as (select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns
         where table_schema = 'public' and table_name = 'tarif_decisions'),
gr as (select grantee || ':' || string_agg(privilege_type, '+' order by privilege_type) g from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'tarif_decisions' and grantee in ('anon','authenticated','service_role') group by grantee),
grp as (select grantee || ':' || string_agg(privilege_type, '+' order by privilege_type) g from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'tarif_prix_decides' and grantee in ('anon','authenticated','service_role') group by grantee),
colupd as (select table_name || ':' || string_agg(column_name, '+' order by column_name) u from information_schema.column_privileges
           where table_schema = 'public' and table_name in ('tarif_decisions','tarif_prix_decides') and grantee = 'authenticated' and privilege_type = 'UPDATE'
           group by table_name),
pol as (select tablename || ':' || string_agg(policyname || '/' || permissive, '+' order by policyname) p from pg_policies
        where schemaname = 'public' and tablename in ('tarif_decisions','tarif_prix_decides') group by tablename),
c(n, controle, attendu, obtenu, info) as (values
  (1,  'identifiant système du cluster (projet Test)', '7678069749886157684', (select system_identifier::text from pg_control_system()), false),
  (2,  'sites de recette propres à Test', '2', (select count(*)::text from sites where site_id in ('site-fantome-test','nexus-station-test')), false),
  (3,  'version PostgreSQL', '17.6 attendu (banc local en 16)', current_setting('server_version'), true),
  (4,  'migrations T2 enregistrées (4)', '20261117020430,20261117020652,20261117020851,20261117021059',
       (select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations where version in ('20261117020430','20261117020652','20261117020851','20261117021059')), false),
  (5,  'aucune migration T3 décision-journal déjà enregistrée', '0', (select count(*)::text from supabase_migrations.schema_migrations where name like '%decision_journal%'), false),
  (6,  'colonnes de tarif_decisions (18, sans prix_decide_id)',
       'id,site,article,code_barres,periode_debut,periode_fin,decision,prix_ttc_retenu,motif,seuil_id,moteur_version,photo,saisi_par,saisi_le,annule_le,annule_par,motif_annulation,cle',
       (select c from cols), false),
  (7,  'unicité (id, site) de tarif_prix_decides, cible de la clé étrangère', '1', (select count(*)::text from pg_constraint where conname = 'tarif_prix_decides_id_site_uq' and contype = 'u'), false),
  (8,  'objets T3 absents (fonctions, déclencheur, index, contraintes)', '0',
       ((select count(*) from pg_proc where proname in ('tarif_enregistrer_decisions','tarif_controle_decision_lien'))
        + (select count(*) from pg_trigger where tgname = 'tarif_decisions_lien')
        + (select count(*) from pg_class where relname = 'tarif_decisions_prix_decide_uq')
        + (select count(*) from pg_constraint where conname in ('tarif_decisions_prix_meme_site_fk','tarif_decisions_lien_prix')))::text, false),
  (9,  'dépendance : tarif_cle_reference(text, text)', '1', (select count(*)::text from pg_proc where proname = 'tarif_cle_reference' and pg_get_function_identity_arguments(oid) = 'p_code_barres text, p_article text'), false),
  (10, 'dépendance : vue v_tarif_prix_decides_actifs en security_invoker', 'security_invoker=true',
       (select array_to_string(reloptions, ',') from pg_class where relname = 'v_tarif_prix_decides_actifs' and relkind = 'v'), false),
  (11, 'dépendance : déclencheur de version unique sur tarif_prix_decides', '1', (select count(*)::text from pg_trigger where tgname = 'tarif_prix_decides_version' and not tgisinternal), false),
  (12, 'politiques de tarif_decisions', 'tarif_decisions:annulation_roles_meme_site/PERMISSIVE+compte_actif_obligatoire/RESTRICTIVE+insertion_roles_meme_site/PERMISSIVE+lecture_meme_site/PERMISSIVE',
       (select p from pol where p like 'tarif_decisions:%'), false),
  (13, 'politiques de tarif_prix_decides', 'tarif_prix_decides:annulation_roles_meme_site/PERMISSIVE+compte_actif_obligatoire/RESTRICTIVE+insertion_roles_meme_site/PERMISSIVE+lecture_meme_site/PERMISSIVE',
       (select p from pol where p like 'tarif_prix_decides:%'), false),
  (14, 'RLS activée et forcée sur les deux tables', 'tarif_decisions:t/t,tarif_prix_decides:t/t',
       (select string_agg(relname || ':' || left(relrowsecurity::text, 1) || '/' || left(relforcerowsecurity::text, 1), ',' order by relname) from pg_class where relname in ('tarif_decisions','tarif_prix_decides') and relkind = 'r'), false),
  (15, 'droits de table sur tarif_decisions (anon aucun)', 'authenticated:INSERT+SELECT,service_role:INSERT+SELECT', (select string_agg(g, ',' order by g) from gr), false),
  (16, 'droits de table sur tarif_prix_decides (anon aucun)', 'authenticated:INSERT+SELECT,service_role:INSERT+SELECT', (select string_agg(g, ',' order by g) from grp), false),
  (17, 'mise à jour limitée aux trois colonnes d''annulation', 'tarif_decisions:annule_le+annule_par+motif_annulation,tarif_prix_decides:annule_le+annule_par+motif_annulation',
       (select string_agg(u, ',' order by u) from colupd), false),
  (18, 'propriétaire des deux tables (exécutant de la migration)', 'postgres,postgres',
       (select string_agg(pg_get_userbyid(relowner), ',' order by relname) from pg_class where relname in ('tarif_decisions','tarif_prix_decides') and relkind = 'r'), false),
  (19, 'colonnes employees lues par la fonction', 'actif,est_createur,id,role,site_id',
       (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'employees' and column_name in ('id','actif','role','site_id','est_createur')), false),
  (20, 'politique select_employees : lecture de sa propre fiche', 'oui',
       (select case when position('auth.uid()' in qual) > 0 and position('id =' in qual) > 0 then 'oui' else 'non : ' || left(qual, 120) end from pg_policies where tablename = 'employees' and policyname = 'select_employees'), false),
  (21, 'privilèges par défaut sur les fonctions créées par postgres (raison du REVOKE de la migration)', 'EXECUTE accordé par défaut à anon/authenticated/service_role',
       (select coalesce(string_agg(array_to_string(defaclacl, ' '), ' '), 'aucun') from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and defaclobjtype = 'f' and pg_get_userbyid(defaclrole) = 'postgres'), true),
  (22, 'vito-sainte-marie : décisions au journal (toutes, dont annulées)', 'référence de postinstallation',
       (select count(*) || ' (actives ' || count(*) filter (where annule_le is null) || ')' from tarif_decisions where site = 'vito-sainte-marie'), true),
  (23, 'vito-sainte-marie : prix décidés (tous, dont annulés)', 'référence de postinstallation',
       (select count(*) || ' (actifs ' || count(*) filter (where annule_le is null) || ', nature ' || coalesce(string_agg(distinct nature, '+'), '-') || ')' from tarif_prix_decides where site = 'vito-sainte-marie'), true),
  (24, 'vito-sainte-marie : empreinte du journal (colonnes T2)', 'référence de postinstallation',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, seuil_id, moteur_version, photo::text, saisi_par, saisi_le, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_decisions where site = 'vito-sainte-marie'), true),
  (25, 'vito-sainte-marie : empreinte des prix décidés', 'référence de postinstallation',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, nature, prix_ttc, decide_le, motif, saisi_par, saisi_le, remplace_id, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_prix_decides where site = 'vito-sainte-marie'), true),
  (26, 'identités de recette T3 déjà présentes dans Auth', '0', (select count(*)::text from auth.users where email like 'recette-t3-%'), false),
  (27, 'employés de recette T3 déjà liés', '0', (select count(*)::text from employees where username like 'recette-t3-%'), false)
)
select n, controle, attendu, obtenu,
       case when info then 'INFO' when obtenu is not distinct from attendu then 'OK' else 'ECART' end as verdict
from c order by n;
rollback;
