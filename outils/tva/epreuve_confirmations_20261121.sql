-- Épreuve Test du script de confirmations de TVA (outils/tva/confirmations_sainte_marie_20261121.sql).
-- Cible : Test (udljdqxerrbbbajxubfn). Refuse de tourner ailleurs (garde sur l'identifiant système).
-- Elle embarque le MÊME corps que le script de Production (texte identique entre les marqueurs, vérifié par le test du
-- dépôt), l'exécute comme bloc DO sur un site d'essai avec des fixtures, site et filtre d'auteur passés par set_config.
-- E13 prouve que RAPPORT passe sous transaction en lecture seule (aucune création de table).
-- Tout se joue dans une seule exécution et se termine par « raise exception 'RAPPORT_EPREUVE_TVA ... ' » : rien ne reste en base.
-- Fixtures (site-fantome-test, comptes et lignes fictifs « essai ») : 5 cibles
--   Alpha   : produit présent, aucune confirmation        -> à insérer (8,5)
--   Bravo   : confirmation active à 8,5, décision 0       -> à remplacer (remplace_id)
--   Charlie : confirmation active à 0, décision 0         -> déjà conforme
--   Delta   : sans code-barres, rapprochée par libellé    -> à insérer (0)
--   Echo    : absente de products                         -> APPLIQUER doit refuser
-- Sortie : une exception RAPPORT_EPREUVE_TVA avec un verdict par cas (OK / KO) et la liste détaillée.

do $garde$
begin
  if (select system_identifier from pg_control_system()) is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn';
  end if;
  if (select count(*) from public.sites where site_id = 'site-fantome-test') <> 1 then
    raise exception 'garde_projet_test : site de recette site-fantome-test absent';
  end if;
  if to_regclass('public.produits_tva_confirmations') is null then
    raise exception 'prerequis : produits_tva_confirmations absente';
  end if;
end $garde$;

-- Aide de l'épreuve : exécute le MÊME corps (texte identique entre les marqueurs) comme bloc DO, paramètres par set_config.
create function pg_temp.tva_run(p_mode text, p_site text, p_compte_test boolean, p_donnees jsonb, p_attendu int) returns text
language plpgsql as $run$
declare
  v_corps constant text := $corps$
-- DEBUT_FONCTION_PARTAGEE (texte identique dans outils/tva/epreuve_confirmations_20261121.sql, vérifié par le test du dépôt)
declare
  p_mode text := current_setting('tva.mode');
  p_site text := current_setting('tva.site');
  p_compte_test boolean := current_setting('tva.compte_test')::boolean;
  p_donnees jsonb := current_setting('tva.donnees')::jsonb;
  p_attendu int := current_setting('tva.attendu')::int;
  v_pilote uuid;
  v_nb_pilote int;
  v_plan jsonb;
  v_total int;
  v_inserer int;
  v_remplacer int;
  v_conformes int;
  v_introuvables int;
  v_inseres int := 0;
  v_actives_ok int;
  v_detail text;
  v_resultat text;
begin
  if p_mode not in ('RAPPORT', 'APPLIQUER') then
    raise exception 'MODE_INCONNU : % (attendu RAPPORT ou APPLIQUER)', p_mode;
  end if;

  select count(*), (array_agg(e.id))[1] into v_nb_pilote, v_pilote
    from employees e
   where e.site_id = p_site and e.est_createur and e.actif and e.compte_test = p_compte_test;
  if v_nb_pilote <> 1 then
    raise exception 'CONFIRME_PAR_INTROUVABLE_OU_AMBIGU : % compte(s) créateur sur %, attendu exactement 1', v_nb_pilote, p_site;
  end if;

  -- Plan calculé en mémoire (variable jsonb) : aucune table créée, le mode RAPPORT passe en transaction read only.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_plan
    from (
      select d.article, nullif(trim(d.code_barres), '') as code_barres, d.taux, d.commentaire,
             a.id as actif_id, a.taux_confirme as actif_taux,
             exists (
               select 1 from products p
                where p.site = p_site
                  and ( (nullif(trim(d.code_barres), '') is not null and trim(p.code_barres) = trim(d.code_barres))
                     or (nullif(trim(d.code_barres), '') is null
                         and lower(regexp_replace(trim(p.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(d.article), '\s+', ' ', 'g'))) )
             ) as dans_catalogue
        from jsonb_to_recordset(p_donnees) as d(article text, code_barres text, taux numeric, commentaire text)
        left join lateral (
          select c.id, c.taux_confirme
            from produits_tva_confirmations c
           where c.site = p_site
             and c.annule_le is null
             and not exists (select 1 from produits_tva_confirmations r where r.remplace_id = c.id and r.annule_le is null)
             and ( (nullif(trim(d.code_barres), '') is not null and trim(c.code_barres) = trim(d.code_barres))
                or (nullif(trim(d.code_barres), '') is null and nullif(trim(c.code_barres), '') is null
                    and lower(regexp_replace(trim(c.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(d.article), '\s+', ' ', 'g'))) )
           order by c.confirme_le desc
           limit 1
        ) a on true
    ) t;

  select count(*),
         count(*) filter (where x.actif_id is null),
         count(*) filter (where x.actif_id is not null and x.actif_taux <> x.taux),
         count(*) filter (where x.actif_id is not null and x.actif_taux = x.taux),
         count(*) filter (where not x.dans_catalogue)
    into v_total, v_inserer, v_remplacer, v_conformes, v_introuvables
    from jsonb_to_recordset(v_plan) as x(article text, code_barres text, taux numeric, commentaire text, actif_id uuid, actif_taux numeric, dans_catalogue boolean);

  select coalesce(string_agg(x.article || ' (' || x.actif_taux || ' -> ' || x.taux || ')', ' ; ' order by x.article), 'aucun')
    into v_detail
    from jsonb_to_recordset(v_plan) as x(article text, code_barres text, taux numeric, commentaire text, actif_id uuid, actif_taux numeric, dans_catalogue boolean)
   where x.actif_id is not null and x.actif_taux <> x.taux;

  if p_mode = 'RAPPORT' then
    raise exception 'RAPPORT_TVA : cibles=%, a_inserer=%, a_remplacer=%, deja_conformes=%, cibles_absentes_de_products=% ; remplacements : %',
      v_total, v_inserer, v_remplacer, v_conformes, v_introuvables, v_detail;
  end if;

  -- APPLIQUER
  if v_total <> p_attendu then
    raise exception 'DONNEES_INATTENDUES : % cibles, attendu %', v_total, p_attendu;
  end if;
  if v_introuvables > 0 then
    raise exception 'CIBLES_ABSENTES_DE_PRODUCTS : % cible(s) hors du catalogue du site, rien n''est inséré (lancer RAPPORT)', v_introuvables;
  end if;

  insert into produits_tva_confirmations (site, article, code_barres, taux_confirme, commentaire, confirme_par, remplace_id)
  select p_site, x.article, x.code_barres, x.taux, x.commentaire, v_pilote, x.actif_id
    from jsonb_to_recordset(v_plan) as x(article text, code_barres text, taux numeric, commentaire text, actif_id uuid, actif_taux numeric, dans_catalogue boolean)
   where x.actif_id is null or x.actif_taux <> x.taux;
  get diagnostics v_inseres = row_count;

  -- Relecture : chaque cible a une confirmation active au taux décidé.
  select count(*) into v_actives_ok
    from jsonb_to_recordset(v_plan) as x(article text, code_barres text, taux numeric, commentaire text, actif_id uuid, actif_taux numeric, dans_catalogue boolean)
   where exists (
     select 1 from produits_tva_confirmations c
      where c.site = p_site and c.annule_le is null and c.taux_confirme = x.taux
        and not exists (select 1 from produits_tva_confirmations r where r.remplace_id = c.id and r.annule_le is null)
        and ( (x.code_barres is not null and trim(c.code_barres) = x.code_barres)
           or (x.code_barres is null and nullif(trim(c.code_barres), '') is null
               and lower(regexp_replace(trim(c.article), '\s+', ' ', 'g')) = lower(regexp_replace(trim(x.article), '\s+', ' ', 'g'))) ));
  if v_actives_ok <> v_total then
    raise exception 'RELECTURE_ECART : % cible(s) sur % ont une confirmation active au taux décidé, rien n''est validé', v_actives_ok, v_total;
  end if;

  v_resultat := format('APPLIQUER_TVA : inseres=%s (dont remplacements=%s), deja_conformes=%s, relecture=%s/%s', v_inseres, v_remplacer, v_conformes, v_actives_ok, v_total);
  perform set_config('tva.resultat', v_resultat, false);
  raise notice '%', v_resultat;
end
-- FIN_FONCTION_PARTAGEE
$corps$;
begin
  perform set_config('tva.mode', p_mode, false);
  perform set_config('tva.site', p_site, false);
  perform set_config('tva.compte_test', p_compte_test::text, false);
  perform set_config('tva.donnees', p_donnees::text, false);
  perform set_config('tva.attendu', p_attendu::text, false);
  perform set_config('tva.resultat', '', false);
  execute 'do $tva$' || v_corps || '$tva$';
  return current_setting('tva.resultat');
end
$run$;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;

insert into auth.users(id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000e0201', 'authenticated', 'authenticated', 'epreuve-tva-createur@invalid.test');
insert into employees(id, username, nom, role, actif, est_createur, site_id, compte_test) values
  ('00000000-0000-4000-8000-0000000e0201', 'epreuve-tva-createur', 'Essai créateur', 'gerant', true, true, 'site-fantome-test', true);

insert into products(site, periode_debut, periode_fin, categorie, article, code_barres) values
  ('site-fantome-test', '2026-11-01', '2026-11-15', 'ESSAI', 'Essai Alpha',  'ESSAI-CB-1'),
  ('site-fantome-test', '2026-11-01', '2026-11-15', 'ESSAI', 'Essai Bravo',  'ESSAI-CB-2'),
  ('site-fantome-test', '2026-11-01', '2026-11-15', 'ESSAI', 'Essai Charlie','ESSAI-CB-3'),
  ('site-fantome-test', '2026-11-01', '2026-11-15', 'ESSAI', 'Essai  DELTA sans code', null);

insert into produits_tva_confirmations(id, site, article, code_barres, taux_confirme, commentaire, confirme_par, confirme_le) values
  ('00000000-0000-4000-8000-0000000e0211', 'site-fantome-test', 'Essai Bravo',   'ESSAI-CB-2', 8.5, 'avant', '00000000-0000-4000-8000-0000000e0201', '2026-11-10T08:00:00Z'),
  ('00000000-0000-4000-8000-0000000e0212', 'site-fantome-test', 'Essai Charlie', 'ESSAI-CB-3', 0,   'avant', '00000000-0000-4000-8000-0000000e0201', '2026-11-10T08:00:00Z');

do $epreuve$
declare
  c_cinq constant jsonb := '[
    {"article":"Essai Alpha","code_barres":"ESSAI-CB-1","taux":8.5,"commentaire":"essai"},
    {"article":"Essai Bravo","code_barres":"ESSAI-CB-2","taux":0,"commentaire":"essai"},
    {"article":"Essai Charlie","code_barres":"ESSAI-CB-3","taux":0,"commentaire":"essai"},
    {"article":"essai delta SANS code","code_barres":"","taux":0,"commentaire":"essai"},
    {"article":"Essai Echo absent","code_barres":"ESSAI-CB-5","taux":8.5,"commentaire":"essai"}]'::jsonb;
  c_quatre constant jsonb := (select jsonb_agg(e) from jsonb_array_elements(c_cinq) e where e->>'article' <> 'Essai Echo absent');
  c_site constant text := 'site-fantome-test';
  v_msg text;
  v_avant text;
  v_apres text;
  v_n int;
  v_ancien uuid;
  v_nouveau uuid;
  v_sortie text;
  v_orig text;
begin
  v_orig := (select md5(string_agg(c::text, '|' order by c.id)) from produits_tva_confirmations c where c.id in ('00000000-0000-4000-8000-0000000e0211','00000000-0000-4000-8000-0000000e0212'));
  v_avant := (select md5(string_agg(c::text, '|' order by c.id)) from produits_tva_confirmations c where c.site = c_site);

  -- E1 : RAPPORT sur 5 cibles, ne touche à rien
  begin perform pg_temp.tva_run('RAPPORT', c_site, true, c_cinq, 5); v_msg := 'pas d exception'; exception when others then v_msg := sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E1 RAPPORT correct',
    'cibles=5, a_inserer=2, a_remplacer=1, deja_conformes=1, cibles_absentes_de_products=1', v_msg,
    v_msg like 'RAPPORT_TVA : cibles=5, a_inserer=2, a_remplacer=1, deja_conformes=1, cibles_absentes_de_products=1%' and v_msg like '%Essai Bravo (8.5 -> 0)%');
  insert into journal(cas, attendu, obtenu, ok) values ('E2 RAPPORT ne modifie rien', 'empreinte inchangée',
    (select count(*)::text from produits_tva_confirmations where site = c_site) || ' lignes',
    v_avant = (select md5(string_agg(c::text, '|' order by c.id)) from produits_tva_confirmations c where c.site = c_site));

  -- E3 : APPLIQUER refuse si une cible manque de products, rien n'est inséré
  begin perform pg_temp.tva_run('APPLIQUER', c_site, true, c_cinq, 5); v_msg := 'pas d exception'; exception when others then v_msg := sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E3 APPLIQUER refuse (cible absente)', 'CIBLES_ABSENTES_DE_PRODUCTS, 2 lignes', v_msg,
    v_msg like 'CIBLES_ABSENTES_DE_PRODUCTS%' and (select count(*) from produits_tva_confirmations where site = c_site) = 2);

  -- E4 : mauvais nombre attendu
  begin perform pg_temp.tva_run('APPLIQUER', c_site, true, c_quatre, 62); v_msg := 'pas d exception'; exception when others then v_msg := sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E4 APPLIQUER refuse (nombre inattendu)', 'DONNEES_INATTENDUES', v_msg, v_msg like 'DONNEES_INATTENDUES : 4 cibles, attendu 62%');

  -- E5 : filtre d'auteur : le créateur d'essai est compte_test, donc introuvable avec compte_test = faux
  begin perform pg_temp.tva_run('RAPPORT', c_site, false, c_quatre, 4); v_msg := 'pas d exception'; exception when others then v_msg := sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E5 filtre d auteur', 'CONFIRME_PAR_INTROUVABLE_OU_AMBIGU : 0 compte(s)', v_msg, v_msg like 'CONFIRME_PAR_INTROUVABLE_OU_AMBIGU : 0 compte(s)%');

  -- E6 : APPLIQUER sur les 4 cibles présentes : Alpha et Delta insérées, Bravo remplacée, Charlie intacte
  v_sortie := pg_temp.tva_run('APPLIQUER', c_site, true, c_quatre, 4);
  insert into journal(cas, attendu, obtenu, ok) values ('E6 APPLIQUER insère', 'inseres=3 (dont remplacements=1), deja_conformes=1, relecture=4/4', v_sortie,
    v_sortie like '%inseres=3 (dont remplacements=1), deja_conformes=1, relecture=4/4%');
  select c.id into v_nouveau from produits_tva_confirmations c where c.site = c_site and c.code_barres = 'ESSAI-CB-2' and c.taux_confirme = 0;
  insert into journal(cas, attendu, obtenu, ok) values ('E7 remplace_id posé', 'la nouvelle ligne Bravo pointe vers l ancienne',
    coalesce((select remplace_id::text from produits_tva_confirmations where id = v_nouveau), 'aucune'),
    (select remplace_id from produits_tva_confirmations where id = v_nouveau) = '00000000-0000-4000-8000-0000000e0211');
  insert into journal(cas, attendu, obtenu, ok) values ('E8 confirme_par renseigné', 'le créateur d essai sur 3 lignes',
    (select count(*)::text from produits_tva_confirmations where site = c_site and commentaire = 'essai' and confirme_par = '00000000-0000-4000-8000-0000000e0201'),
    (select count(*) from produits_tva_confirmations where site = c_site and commentaire = 'essai' and confirme_par = '00000000-0000-4000-8000-0000000e0201') = 3);
  insert into journal(cas, attendu, obtenu, ok) values ('E9 aucune ligne existante modifiée', '2 lignes d origine identiques',
    (select count(*)::text from produits_tva_confirmations where site = c_site and commentaire = 'avant'),
    (select count(*) from produits_tva_confirmations where site = c_site) = 5
    and v_orig = (select md5(string_agg(c::text, '|' order by c.id)) from produits_tva_confirmations c where c.id in ('00000000-0000-4000-8000-0000000e0211','00000000-0000-4000-8000-0000000e0212')));
  insert into journal(cas, attendu, obtenu, ok) values ('E10 Delta rapprochée par libellé', 'une ligne Delta à 0 sans code-barres',
    (select count(*)::text from produits_tva_confirmations where site = c_site and code_barres is null and taux_confirme = 0 and article = 'essai delta SANS code'),
    (select count(*) from produits_tva_confirmations where site = c_site and code_barres is null and taux_confirme = 0 and article = 'essai delta SANS code') = 1);

  -- E11 : second APPLIQUER, 0 insertion
  v_sortie := pg_temp.tva_run('APPLIQUER', c_site, true, c_quatre, 4);
  insert into journal(cas, attendu, obtenu, ok) values ('E11 second APPLIQUER', 'inseres=0, 5 lignes', v_sortie || ' ; ' || (select count(*) from produits_tva_confirmations where site = c_site) || ' lignes',
    v_sortie like '%inseres=0 (dont remplacements=0), deja_conformes=4, relecture=4/4%' and (select count(*) from produits_tva_confirmations where site = c_site) = 5);

  -- E12 : RAPPORT après application : plus rien à faire
  begin perform pg_temp.tva_run('RAPPORT', c_site, true, c_quatre, 4); v_msg := 'pas d exception'; exception when others then v_msg := sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E12 RAPPORT après application', 'a_inserer=0, a_remplacer=0, deja_conformes=4', v_msg,
    v_msg like 'RAPPORT_TVA : cibles=4, a_inserer=0, a_remplacer=0, deja_conformes=4, cibles_absentes_de_products=0%');

  -- E13 : RAPPORT sous transaction en lecture seule (en dernier : la transaction reste en lecture seule ensuite,
  -- les écritures dans la table temporaire du journal restent permises). Un create table donnerait SQLSTATE 25006.
  perform set_config('transaction_read_only', 'on', true);
  begin perform pg_temp.tva_run('RAPPORT', c_site, true, c_quatre, 4); v_msg := 'pas d exception'; exception when others then v_msg := sqlstate || ' ' || sqlerrm; end;
  insert into journal(cas, attendu, obtenu, ok) values ('E13 RAPPORT en lecture seule', 'RAPPORT_TVA, pas 25006', v_msg,
    v_msg like 'P0001 RAPPORT_TVA : cibles=4, a_inserer=0, a_remplacer=0, deja_conformes=4, cibles_absentes_de_products=0%');
end
$epreuve$;

-- Fin : rien ne reste en base. Verdict et détail dans le message de l'exception.
do $fin$
declare v_ko int; v_tot int; v_detail text;
begin
  select count(*) filter (where not ok), count(*) into v_ko, v_tot from journal;
  select string_agg(cas || ' : ' || case when ok then 'OK' else 'KO' end || ' | attendu ' || attendu || ' | obtenu ' || coalesce(obtenu, 'null'), E'\n' order by n) into v_detail from journal;
  raise exception 'RAPPORT_EPREUVE_TVA : % cas, % KO, rien ne reste en base.%', v_tot, v_ko, E'\n' || v_detail;
end
$fin$;
