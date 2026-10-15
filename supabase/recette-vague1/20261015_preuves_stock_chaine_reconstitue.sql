-- ============================================================================
-- Recette — reconstitution du stock de chaîne d'un quart FDJ non effectué
-- Lot NEXUS-FDJ-STOCK-Q1-ABSENT-20261015 · decision-2 (ChatGPT)
--
-- Se joue en transaction ANNULÉE sur nexus-test (jamais Production) :
--   psql ... -f 20261015_preuves_stock_chaine_reconstitue.sql
-- Le fichier charge lui-même l'artefact versionné exact (commentaires compris)
-- par \ir ; via le connecteur SQL, \ir est remplacé par le contenu du fichier.
-- Sortie : un tableau unique `preuves` (id, ok, détail) ; tout `ok = false`
-- est un échec. A-F = cas métier ; R1-R7 = isolation de site ; S1-S5 = surface
-- d'exécution de la fonction SECURITY DEFINER ; Z = nettoyage constaté.
-- ============================================================================
begin;

\ir ../migrations/20261015100000_fdj_stock_chaine_reconstitue_quart_absent.sql

create temp table preuves (n serial, id text, ok boolean, detail text);
grant all on preuves to authenticated, anon;
grant usage on sequence preuves_n_seq to authenticated, anon;
create temp table snap as
  select (select count(*) from public.fdj_shifts)       as n_shifts,
         (select count(*) from public.fdj_shift_counts) as n_counts,
         (select count(*) from public.fdj_cash_controls) as n_cash,
         (select count(*) from public.fdj_audit_log)    as n_audit;
grant select on snap to authenticated;

-- Deux sites distincts (FK employees.site_id -> sites), un manager chacun, un caissier sur le site A.
insert into public.sites (site_id, nom_entreprise, timezone) values
  ('recette-reco-site-a','Recette reco A','Europe/Paris'),
  ('recette-reco-site-b','Recette reco B','Europe/Paris');
insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test) values
  ('eeeeee01-0000-4000-8000-000000000001','recette-reco-mgr-a','Recette reco manager A','manager', true,false,'recette-reco-site-a',true),
  ('eeeeee01-0000-4000-8000-000000000002','recette-reco-mgr-b','Recette reco manager B','manager', true,false,'recette-reco-site-b',true),
  ('eeeeee01-0000-4000-8000-000000000003','recette-reco-caissier-a','Recette reco caissier A','caissier',true,false,'recette-reco-site-a',true);

-- Site A : trois jeux actifs + un jeu inactif (hors ensemble attendu). Site B : un jeu.
insert into public.fdj_games (id, site, nom, prix, ordre_affichage, actif) values
  ('aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a','JEU A1',2,1,true),
  ('aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a','JEU A2',5,2,true),
  ('aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a','JEU A3',10,3,true),
  ('aaaaaa01-0000-4000-8000-000000000004','recette-reco-site-a','JEU A4 inactif',1,4,false),
  ('aaaaaa01-0000-4000-8000-000000000011','recette-reco-site-b','JEU B1',2,1,true);

-- Quarts (statut par défaut). Q2 14/10 : cas de référence ; Q1 14/10 absent.
insert into public.fdj_shifts (id, site, date, quart, ouverture_validee) values
  ('bbbbbb01-0000-4000-8000-000000000001','recette-reco-site-a','2026-10-14','2',true),   -- A : complet, confirmé
  ('bbbbbb01-0000-4000-8000-000000000002','recette-reco-site-a','2026-10-15','2',true),   -- C : un initial manquant
  ('bbbbbb01-0000-4000-8000-000000000003','recette-reco-site-a','2026-10-16','2',false),  -- D : ouverture non confirmée
  ('bbbbbb01-0000-4000-8000-000000000004','recette-reco-site-a','2026-10-12','2',true),   -- E : Q2 suivant
  ('bbbbbb01-0000-4000-8000-000000000005','recette-reco-site-a','2026-10-12','1',true),   -- E : Q1 réel (7 vs 5)
  ('bbbbbb01-0000-4000-8000-000000000006','recette-reco-site-a','2026-10-11','2',true),   -- F : Q2 suivant
  ('bbbbbb01-0000-4000-8000-000000000007','recette-reco-site-a','2026-10-11','1',true),   -- F : Q1 réel concordant
  ('bbbbbb01-0000-4000-8000-000000000021','recette-reco-site-b','2026-10-14','2',true);   -- site B

insert into public.fdj_shift_counts (shift_id, game_id, site, stock_initial, stock_final) values
  -- A : trois valeurs dont un ZÉRO (0 est une valeur, pas une absence)
  ('bbbbbb01-0000-4000-8000-000000000001','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',40,38),
  ('bbbbbb01-0000-4000-8000-000000000001','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',0,0),
  ('bbbbbb01-0000-4000-8000-000000000001','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',12,10),
  -- C : A3 sans stock initial
  ('bbbbbb01-0000-4000-8000-000000000002','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',40,null),
  ('bbbbbb01-0000-4000-8000-000000000002','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',3,null),
  ('bbbbbb01-0000-4000-8000-000000000002','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',null,null),
  -- D : complet mais ouverture non confirmée
  ('bbbbbb01-0000-4000-8000-000000000003','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',1,null),
  ('bbbbbb01-0000-4000-8000-000000000003','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',1,null),
  ('bbbbbb01-0000-4000-8000-000000000003','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',1,null),
  -- E : initial Q2 = 5, final réel Q1 = 7 (contradiction) sur A1 ; A2/A3 concordent
  ('bbbbbb01-0000-4000-8000-000000000004','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',5,null),
  ('bbbbbb01-0000-4000-8000-000000000004','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',6,null),
  ('bbbbbb01-0000-4000-8000-000000000004','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',9,null),
  ('bbbbbb01-0000-4000-8000-000000000005','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',20,7),
  ('bbbbbb01-0000-4000-8000-000000000005','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',20,6),
  ('bbbbbb01-0000-4000-8000-000000000005','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',20,9),
  -- F : tout concordant
  ('bbbbbb01-0000-4000-8000-000000000006','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',4,null),
  ('bbbbbb01-0000-4000-8000-000000000006','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',4,null),
  ('bbbbbb01-0000-4000-8000-000000000006','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',4,null),
  ('bbbbbb01-0000-4000-8000-000000000007','aaaaaa01-0000-4000-8000-000000000001','recette-reco-site-a',9,4),
  ('bbbbbb01-0000-4000-8000-000000000007','aaaaaa01-0000-4000-8000-000000000002','recette-reco-site-a',9,4),
  ('bbbbbb01-0000-4000-8000-000000000007','aaaaaa01-0000-4000-8000-000000000003','recette-reco-site-a',9,4),
  -- B
  ('bbbbbb01-0000-4000-8000-000000000021','aaaaaa01-0000-4000-8000-000000000011','recette-reco-site-b',8,8);

insert into snap select (select count(*) from public.fdj_shifts), (select count(*) from public.fdj_shift_counts),
  (select count(*) from public.fdj_cash_controls), (select count(*) from public.fdj_audit_log);

-- ---------------------------------------------------------------- A..F
select set_config('request.jwt.claims','{"sub":"eeeeee01-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare r jsonb; n int;
begin
  -- A : cas de référence (Q2 complet et confirmé, Q1 absent)
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
  select count(*) into n from public.fdj_stock_chaine_reconstitue where date_quart_absent='2026-10-14' and quart_absent='1';
  insert into preuves(id, ok, detail) values ('A reconstitué', (r->>'reconstitue')::boolean and n = 3 and (r->>'crees')::int = 3, r::text);
  insert into preuves(id, ok, detail) select 'A valeurs = stocks initiaux (0 conservé)',
    (select array_agg(valeur_reconstituee order by g.ordre_affichage) = array[40,0,12]::numeric[]
       from public.fdj_stock_chaine_reconstitue x join public.fdj_games g on g.id = x.game_id
      where x.date_quart_absent='2026-10-14' and x.quart_absent='1'),
    'jeu inactif exclu : ' || (select count(*) from public.fdj_stock_chaine_reconstitue where game_id='aaaaaa01-0000-4000-8000-000000000004')::text || ' ligne(s)';
  insert into preuves(id, ok, detail) select 'A provenance distincte du physique', bool_and(provenance = 'reconstitue_depuis_stock_initial_suivant' and statut = 'reconstitue' and comptage_reel_valeur is null), 'provenance + statut'
    from public.fdj_stock_chaine_reconstitue where date_quart_absent='2026-10-14';
  -- B : idempotence
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
  select count(*) into n from public.fdj_stock_chaine_reconstitue where date_quart_absent='2026-10-14';
  insert into preuves(id, ok, detail) values ('B rejeu idempotent', (r->>'crees')::int = 0 and (r->>'mis_a_jour')::int = 0 and n = 3, r::text);
  -- C : comptage initial incomplet
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000002');
  select count(*) into n from public.fdj_stock_chaine_reconstitue where date_quart_absent='2026-10-15';
  insert into preuves(id, ok, detail) values ('C initial incomplet refusé', r->>'motif' = 'comptage_initial_incomplet' and n = 0, r::text);
  -- D : ouverture non confirmée
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000003');
  select count(*) into n from public.fdj_stock_chaine_reconstitue where date_quart_absent='2026-10-16';
  insert into preuves(id, ok, detail) values ('D ouverture non confirmée refusée', r->>'motif' = 'ouverture_non_confirmee' and n = 0, r::text);
  -- E : contradiction avec un comptage réel -> les deux valeurs conservées
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000004');
  insert into preuves(id, ok, detail) select 'E contradiction : deux valeurs + écart',
    x.statut = 'en_conflit' and x.valeur_reconstituee = 5 and x.comptage_reel_valeur = 7 and x.ecart_comptage_reel = 2 and (r->>'en_conflit')::int = 1,
    r::text
    from public.fdj_stock_chaine_reconstitue x
   where x.date_quart_absent='2026-10-12' and x.game_id='aaaaaa01-0000-4000-8000-000000000001';
  -- F : quart réel concordant -> reconstitué sans conflit
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000006');
  insert into preuves(id, ok, detail) values ('F réel concordant sans conflit', (r->>'reconstitue')::boolean and (r->>'en_conflit')::int = 0 and (r->>'quart_effectue')::boolean, r::text);
end $$;

-- ---------------------------------------------------------------- R : isolation (deux sites)
do $$
declare n int; ok boolean;
begin
  -- R1 lecture autorisée (manager A lit le site A)
  select count(*) into n from public.fdj_stock_chaine_reconstitue where site = 'recette-reco-site-a';
  insert into preuves(id, ok, detail) values ('R1 lecture autorisée (site A)', n > 0, n::text || ' ligne(s)');
  -- R2 lecture intersite refusée (rien ne remonte du site B)
  select count(*) into n from public.fdj_stock_chaine_reconstitue where site = 'recette-reco-site-b';
  insert into preuves(id, ok, detail) values ('R2 lecture intersite : 0 ligne du site B', n = 0, n::text);
  -- R3 écritures directes refusées
  begin
    insert into public.fdj_stock_chaine_reconstitue (site, date_quart_absent, quart_absent, shift_source_id, game_id, stock_initial_source, valeur_reconstituee)
      values ('recette-reco-site-a','2026-10-01','1','bbbbbb01-0000-4000-8000-000000000001','aaaaaa01-0000-4000-8000-000000000001',1,1);
    insert into preuves(id, ok, detail) values ('R3 INSERT direct refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('R3 INSERT direct refusé', true, sqlstate);
  end;
  begin
    update public.fdj_stock_chaine_reconstitue set valeur_reconstituee = 999;
    insert into preuves(id, ok, detail) values ('R4 UPDATE direct refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('R4 UPDATE direct refusé', true, sqlstate);
  end;
  begin
    delete from public.fdj_stock_chaine_reconstitue;
    insert into preuves(id, ok, detail) values ('R5 DELETE direct refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('R5 DELETE direct refusé', true, sqlstate);
  end;
  -- R6 appel intersite refusé : manager A vise un quart du site B
  begin
    perform public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000021');
    insert into preuves(id, ok, detail) values ('R6 appel intersite refusé (A -> quart de B)', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('R6 appel intersite refusé (A -> quart de B)', true, sqlerrm);
  end;
end $$;

-- Second contexte de site : manager B.
reset role;
select set_config('request.jwt.claims','{"sub":"eeeeee01-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int; r jsonb;
begin
  select count(*) into n from public.fdj_stock_chaine_reconstitue;
  insert into preuves(id, ok, detail) values ('R7a manager B ne voit aucune ligne du site A', n = 0, n::text);
  begin
    perform public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
    insert into preuves(id, ok, detail) values ('R7b appel intersite refusé (B -> quart de A)', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('R7b appel intersite refusé (B -> quart de A)', true, sqlerrm);
  end;
  r := public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000021');
  select count(*) into n from public.fdj_stock_chaine_reconstitue;
  insert into preuves(id, ok, detail) values ('R7c manager B écrit chez lui (1 ligne, site B seul)', (r->>'reconstitue')::boolean and n = 1, r::text);
end $$;

-- Caissier (rôle non manager) et session absente : refus.
reset role;
select set_config('request.jwt.claims','{"sub":"eeeeee01-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
    insert into preuves(id, ok, detail) values ('S0 caissier refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('S0 caissier refusé', true, sqlerrm);
  end;
end $$;
reset role;
select set_config('request.jwt.claims','{}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
    insert into preuves(id, ok, detail) values ('S1 sans session refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('S1 sans session refusé', true, sqlerrm);
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.fdj_reconstituer_quart_absent('bbbbbb01-0000-4000-8000-000000000001');
    insert into preuves(id, ok, detail) values ('S2 anon : EXECUTE refusé', false, 'accepté');
  exception when insufficient_privilege then
    insert into preuves(id, ok, detail) values ('S2 anon : EXECUTE refusé', true, sqlerrm);
  end;
end $$;
reset role;

-- ---------------------------------------------------------------- S : surface SECURITY DEFINER
insert into preuves(id, ok, detail)
select 'S3 search_path fixé, SECURITY DEFINER', p.prosecdef and p.proconfig @> array['search_path=""'], coalesce(p.proconfig::text, 'aucun')
  from pg_proc p where p.oid = 'public.fdj_reconstituer_quart_absent(uuid)'::regprocedure;
insert into preuves(id, ok, detail)
select 'S4 EXECUTE : ni PUBLIC ni anon, seulement les rôles nécessaires',
       not exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)
       and not has_function_privilege('anon', p.oid, 'EXECUTE')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and has_function_privilege('service_role', p.oid, 'EXECUTE'),
       (select string_agg(coalesce(r.rolname,'PUBLIC'), ',' order by r.rolname) from aclexplode(p.proacl) a left join pg_roles r on r.oid = a.grantee)
  from pg_proc p where p.oid = 'public.fdj_reconstituer_quart_absent(uuid)'::regprocedure;
insert into preuves(id, ok, detail)
select 'S5 commentaires de fonction et de table présents',
       obj_description('public.fdj_reconstituer_quart_absent(uuid)'::regprocedure, 'pg_proc') is not null
       and obj_description('public.fdj_stock_chaine_reconstitue'::regclass, 'pg_class') is not null,
       'artefact versionné exact';
insert into preuves(id, ok, detail)
select 'S6 table : aucun droit d''écriture pour anon/authenticated, RLS active',
       c.relrowsecurity
       and not has_table_privilege('authenticated', c.oid, 'INSERT')
       and not has_table_privilege('authenticated', c.oid, 'UPDATE')
       and not has_table_privilege('authenticated', c.oid, 'DELETE')
       and not has_table_privilege('anon', c.oid, 'SELECT')
       and has_table_privilege('authenticated', c.oid, 'SELECT'),
       'relrowsecurity=' || c.relrowsecurity
  from pg_class c where c.oid = 'public.fdj_stock_chaine_reconstitue'::regclass;

-- ---------------------------------------------------------------- Aucun effet de bord hors table + audit
insert into preuves(id, ok, detail)
select 'G aucun quart/comptage/caisse fictif créé',
       (select count(*) from public.fdj_shifts) = s.n_shifts
       and (select count(*) from public.fdj_shift_counts) = s.n_counts
       and (select count(*) from public.fdj_cash_controls) = s.n_cash,
       'fdj_shifts / fdj_shift_counts / fdj_cash_controls inchangés depuis la fixture'
  from (select * from snap order by n_shifts desc limit 1) s;

select n, id, ok, detail from preuves order by n;

rollback;
-- Z : le nettoyage est constaté hors transaction (voir la procédure d'exécution :
-- après le rollback, `select count(*) from fdj_stock_chaine_reconstitue` doit
-- échouer ou rendre 0, et aucun employé 'recette-reco-%' ne subsiste).
