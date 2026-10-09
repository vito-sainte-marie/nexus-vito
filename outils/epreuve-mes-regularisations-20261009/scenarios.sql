-- Scénarios de `mes_regularisations()` : chaque bloc part des fixtures de
-- l'épreuve 20261008 et se termine par rollback. Étiquettes en majuscules
-- sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- Périmètre : le pompiste reçoit ses postes contrôlés dont il est seul
-- détenteur, dans la forme lue par l'écran manager, et aucun poste d'autrui.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok((select array_agg(x->>'id' order by x->>'id') from jsonb_array_elements(r->'audits') x)
    = array['ad000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000004','ad000000-0000-0000-0000-000000000007'],
    'audits ad1, ad4, ad7 seulement : ' || (r->'audits')::text);
  perform pg_temp.ok((select (x->>'ecart_piste')::numeric = -20 and (x->>'ecart_piste_valide')::numeric = -20
                        and x->>'valide_le_piste' is not null
                        and x->'employes_piste' = '["a0000000-0000-0000-0000-000000000003"]'::jsonb
                        and x->>'date' = pg_temp.j(-10)::text and x->>'quart' = '1'
                        from jsonb_array_elements(r->'audits') x where x->>'id' = 'ad000000-0000-0000-0000-000000000001'),
    'forme manager de ad1');
  perform pg_temp.ok(not (r->'audits')::text like '%ad000000-0000-0000-0000-000000000005%'
                     and not (r->'audits')::text like '%ad000000-0000-0000-0000-000000000006%', 'ad5 et ad6 absents');
  raise notice 'OK PERIMETRE';
end $$;
rollback;

-- Poste partagé : « collectif non imputé » chez le manager, absent ici.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok(not (r->'audits')::text like '%ad000000-0000-0000-0000-000000000003%', 'ad3 partagé absent');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000006');
  r := public.mes_regularisations();
  perform pg_temp.ok(not (r->'audits')::text like '%ad000000-0000-0000-0000-000000000003%', 'ad3 absent pour l''autre détenteur');
  raise notice 'OK PARTAGE';
end $$;
rollback;

-- Écart non contrôlé : aucun montant avant contrôle (arbitrage du 16/09).
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok(not r::text like '%ad000000-0000-0000-0000-000000000002%', 'ad2 non validé absent');
  raise notice 'OK CONTROLE';
end $$;
rollback;

-- FDJ : les quarts du caissier à verdict, marqueur 'controle' ; rien pour le pompiste.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000004');
  r := public.mes_regularisations();
  perform pg_temp.ok(jsonb_array_length(r->'fdj') = 3, 'trois quarts FDJ : ' || (r->'fdj')::text);
  perform pg_temp.ok((select bool_and(x->'fdj_cash_controls'->>'resultat_controle' = 'controle'
                                      and x->>'employee_id' = 'a0000000-0000-0000-0000-000000000004')
                        from jsonb_array_elements(r->'fdj') x), 'marqueur controle, jamais le texte');
  perform pg_temp.ok(not r::text like '%a_regulariser%' and not r::text like '%a_revoir%', 'verdicts non rendus');
  perform pg_temp.ok(jsonb_array_length(r->'audits') = 0, 'aucun audit pour le caissier');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok(jsonb_array_length(r->'fdj') = 0, 'aucun quart FDJ pour le pompiste');
  raise notice 'OK FDJ';
end $$;
rollback;

-- Versement saisi par le manager : rendu au détenteur, montant et date exacts.
begin; \i fixtures.sql
do $$ declare r jsonb; v jsonb; begin
  perform pg_temp.verser(10);
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok(jsonb_array_length(r->'versements') = 1, 'un versement : ' || (r->'versements')::text);
  v := r->'versements'->0;
  perform pg_temp.ok((v->>'montant')::numeric = 10 and v->>'audit_id' = 'ad000000-0000-0000-0000-000000000001'
                     and v->>'caisse_origine' = 'piste' and v->>'module_origine' = 'verify'
                     and v->>'mode_encaissement' = 'especes' and v->>'destination' = 'tiroir_verify_piste'
                     and v->>'employee_id' = 'a0000000-0000-0000-0000-000000000003'
                     and v->>'auteur_id' = 'manager' and v->>'annule_le' is null, 'forme du versement : ' || v::text);
  raise notice 'OK VERSEMENT';
end $$;
rollback;

-- Annulation : historique rendu, signataire masqué.
begin; \i fixtures.sql
do $$ declare id uuid; v jsonb; begin
  id := (pg_temp.verser(20)->>'versement_id')::uuid;
  perform public.annuler_versement_regularisation(id, 'saisi sur le mauvais écart');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  v := public.mes_regularisations()->'versements'->0;
  perform pg_temp.ok(v->>'annule_le' is not null and v->>'annule_par' = 'manager'
                     and v->>'motif_annulation' = 'saisi sur le mauvais écart', 'annulation : ' || v::text);
  raise notice 'OK ANNULATION';
end $$;
rollback;

-- Aucun UUID de collègue ni de manager ne sort.
begin; \i fixtures.sql
do $$ declare id uuid; t text; begin
  perform pg_temp.verser(5);
  id := (pg_temp.verser(5)->>'versement_id')::uuid;
  perform public.annuler_versement_regularisation(id, 'doublon de saisie');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  t := public.mes_regularisations()::text;
  perform pg_temp.ok(t not like '%a0000000-0000-0000-0000-000000000001%' and t not like '%a0000000-0000-0000-0000-000000000002%'
                     and t not like '%a0000000-0000-0000-0000-000000000004%' and t not like '%a0000000-0000-0000-0000-000000000006%'
                     and t not like '%b0000000%', 'aucun UUID étranger : ' || t);
  raise notice 'OK FUITE';
end $$;
rollback;

-- Rattachement : les versements d'autres écarts (autre station, FDJ d'un
-- collègue) ne sont jamais rendus.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform public.enregistrer_versement_regularisation(null, null, 'fc000000-0000-0000-0000-000000000001',
    15, 'especes', null, 'tiroir_verify_boutique', pg_temp.j(-1), '2', gen_random_uuid());
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.verser(10, audit => 'ad000000-0000-0000-0000-000000000006');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  r := public.mes_regularisations();
  perform pg_temp.ok(jsonb_array_length(r->'versements') = 0, 'aucun versement étranger : ' || (r->'versements')::text);
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000004');
  r := public.mes_regularisations();
  perform pg_temp.ok(jsonb_array_length(r->'versements') = 1
                     and r->'versements'->0->>'fdj_cash_control_id' = 'fc000000-0000-0000-0000-000000000001',
                     'le caissier voit son versement FDJ : ' || (r->'versements')::text);
  raise notice 'OK RATTACHEMENT';
end $$;
rollback;

-- Sans identité : rien.
begin; \i fixtures.sql
do $$ declare r jsonb; begin
  perform pg_temp.verser(10);
  perform pg_temp.qui(null);
  r := public.mes_regularisations();
  perform pg_temp.ok(r = '{"fdj": [], "audits": [], "versements": [], "restitutions": []}'::jsonb, 'vide : ' || r::text);
  raise notice 'OK ANONYME';
end $$;
rollback;

-- Privilèges écrits : authenticated et service_role seulement.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.ok(not has_function_privilege('anon', 'public.mes_regularisations()', 'execute'), 'anon sans EXECUTE');
  perform pg_temp.ok(not has_function_privilege('public', 'public.mes_regularisations()', 'execute'), 'PUBLIC sans EXECUTE');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.mes_regularisations()', 'execute'), 'authenticated avec EXECUTE');
  perform pg_temp.ok((select prosecdef and proconfig = array['search_path=""'] from pg_proc
                       where oid = 'public.mes_regularisations()'::regprocedure), 'security definer, search_path vide');
  raise notice 'OK DROITS';
end $$;
rollback;
