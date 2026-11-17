-- NEXUS Scanner T3 : contrôle de POSTINSTALLATION de la migration décision-journal sur Supabase Test (LECTURE SEULE).
-- Données lues : comptes et empreintes du site vito-sainte-marie seulement. Verdict OK ou ECART ; aucun INFO.
-- Version 2 (17/11/2026, 12 h) : lignes 17 à 20, privilèges effectifs (has_function_privilege, has_column_privilege).
-- Les valeurs attendues des lignes 13 à 16 sont celles du contrôle 70 rejoué le jour de la migration :
-- les remplacer avant exécution si le 70 du jour diffère de celui du 17/11/2026 (journal vide, prix décidés 1b75f1f3…).
begin transaction read only;
with c(n, controle, attendu, obtenu) as (values
  (1,  'identifiant système du cluster (projet Test)', '7678069749886157684', (select system_identifier::text from pg_control_system())),
  (2,  'migration enregistrée une seule fois', '1', (select count(*)::text from supabase_migrations.schema_migrations where name like '%decision_journal%')),
  (3,  'colonne prix_decide_id : uuid, facultative', 'uuid/YES', (select data_type || '/' || is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'tarif_decisions' and column_name = 'prix_decide_id')),
  (4,  'clé étrangère composite vers le prix décidé du même site', 'FOREIGN KEY (prix_decide_id, site) REFERENCES tarif_prix_decides(id, site)',
       (select pg_get_constraintdef(oid) from pg_constraint where conname = 'tarif_decisions_prix_meme_site_fk')),
  (5,  'aucune contrainte CHECK sur le lien (annulations jamais bloquées)', '0',
       (select count(*)::text from pg_constraint where conrelid = 'public.tarif_decisions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%prix_decide_id%')),
  (6,  'index unique partiel : un journal par prix décidé', '1', (select count(*)::text from pg_indexes where indexname = 'tarif_decisions_prix_decide_uq' and indexdef like '%UNIQUE%WHERE (prix_decide_id IS NOT NULL)%')),
  (7,  'déclencheur d''insertion du lien, actif', 'BEFORE INSERT/O',
       (select case when (tgtype & 2) > 0 then 'BEFORE' else 'AFTER' end || case when (tgtype & 4) > 0 and (tgtype & 16) = 0 then ' INSERT' else ' AUTRE' end || '/' || tgenabled::text from pg_trigger where tgname = 'tarif_decisions_lien')),
  (8,  'fonction : SECURITY INVOKER, volatile, search_path fixé', 'false/v/search_path=public, pg_temp',
       (select prosecdef::text || '/' || provolatile::text || '/' || array_to_string(proconfig, ',') from pg_proc where proname = 'tarif_enregistrer_decisions')),
  (9,  'exécution de la fonction : authenticated et propriétaire seulement', 'authenticated,postgres',
       (select string_agg(grantee::regrole::text, ',' order by grantee::regrole::text) from pg_proc, aclexplode(proacl) where proname = 'tarif_enregistrer_decisions' and privilege_type = 'EXECUTE')),
  (10, 'fonction de déclencheur : aucun droit d''exécution hors propriétaire', 'postgres',
       (select string_agg(grantee::regrole::text, ',' order by grantee::regrole::text) from pg_proc, aclexplode(proacl) where proname = 'tarif_controle_decision_lien' and privilege_type = 'EXECUTE')),
  (11, 'droits de table inchangés sur tarif_decisions', 'authenticated:INSERT+SELECT,service_role:INSERT+SELECT',
       (select string_agg(g, ',' order by g) from (select grantee || ':' || string_agg(privilege_type, '+' order by privilege_type) g from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'tarif_decisions' and grantee in ('anon','authenticated','service_role') group by grantee) x)),
  (12, 'mise à jour toujours limitée aux trois colonnes d''annulation (pas prix_decide_id)', 'annule_le+annule_par+motif_annulation',
       (select string_agg(column_name, '+' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'tarif_decisions' and grantee = 'authenticated' and privilege_type = 'UPDATE')),
  (13, 'vito-sainte-marie : journal inchangé (nombre)', '0 (actives 0)',
       (select count(*) || ' (actives ' || count(*) filter (where annule_le is null) || ')' from tarif_decisions where site = 'vito-sainte-marie')),
  (14, 'vito-sainte-marie : journal inchangé (empreinte des colonnes T2)', 'vide',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, seuil_id, moteur_version, photo::text, saisi_par, saisi_le, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_decisions where site = 'vito-sainte-marie')),
  (15, 'vito-sainte-marie : prix décidés inchangés (empreinte)', '1b75f1f3ca55c1282f87f47ca8822780',
       (select coalesce(md5(string_agg(concat_ws('|', id, site, article, code_barres, nature, prix_ttc, decide_le, motif, saisi_par, saisi_le, remplace_id, annule_le, annule_par, motif_annulation), ';' order by id)), 'vide')
          from tarif_prix_decides where site = 'vito-sainte-marie')),
  (16, 'vito-sainte-marie : lignes historiques sans lien (aucun lien posé par la migration)', '0',
       (select count(*)::text from tarif_decisions where site = 'vito-sainte-marie' and prix_decide_id is not null)),
  -- Privilèges EFFECTIFS (condition 3 du 17/11, 11 h 59) : ce que chaque rôle peut réellement faire, héritages compris.
  (17, 'privilège effectif EXECUTE sur la fonction : anon / authenticated / service_role / public', 'non/oui/non/non',
       (select string_agg(case when r = 'public' then (case when exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.proname = 'tarif_enregistrer_decisions' and a.grantee = 0 and a.privilege_type = 'EXECUTE') then 'oui' else 'non' end)
                               else (case when has_function_privilege(r, 'public.tarif_enregistrer_decisions(jsonb)', 'EXECUTE') then 'oui' else 'non' end) end, '/' order by o)
          from (values (1, 'anon'), (2, 'authenticated'), (3, 'service_role'), (4, 'public')) v(o, r))),
  (18, 'privilège effectif EXECUTE sur la fonction de déclencheur : anon / authenticated / service_role', 'non/non/non',
       (select string_agg(case when has_function_privilege(r, 'public.tarif_controle_decision_lien()', 'EXECUTE') then 'oui' else 'non' end, '/' order by o)
          from (values (1, 'anon'), (2, 'authenticated'), (3, 'service_role')) v(o, r))),
  (19, 'privilège effectif UPDATE de prix_decide_id : anon / authenticated / service_role', 'non/non/non',
       (select string_agg(case when has_column_privilege(r, 'public.tarif_decisions', 'prix_decide_id', 'UPDATE') then 'oui' else 'non' end, '/' order by o)
          from (values (1, 'anon'), (2, 'authenticated'), (3, 'service_role')) v(o, r))),
  (20, 'privilège effectif SELECT et INSERT de prix_decide_id pour authenticated (lecture et lien par la fonction)', 'oui/oui',
       (select (case when has_column_privilege('authenticated', 'public.tarif_decisions', 'prix_decide_id', 'SELECT') then 'oui' else 'non' end) || '/' ||
               (case when has_column_privilege('authenticated', 'public.tarif_decisions', 'prix_decide_id', 'INSERT') then 'oui' else 'non' end)))
)
select n, controle, attendu, obtenu, case when obtenu is not distinct from attendu then 'OK' else 'ECART' end as verdict from c order by n;
rollback;
