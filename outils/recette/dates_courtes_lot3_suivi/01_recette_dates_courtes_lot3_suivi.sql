-- Recette SQL lot 3 (Dates courtes) : suivi des contrôles DLC, fonction de lecture dates_courtes_suivi_controles.
-- Jeu synthétique, comptes et noms fictifs, sites fictifs. Joue dans une transaction rollbackée.
-- Sortie : une exception RAPPORT_SUIVI_DLC <json>. Ne pas jouer sur Production.
begin;

do $garde_recette$
declare v_id text;
begin
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable' then
    select system_identifier::text into v_id from pg_control_system();
    if v_id is distinct from '7678069749886157684' then
      raise exception 'GARDE_RECETTE : base inattendue (%), arrêt', v_id;
    end if;
  end if;
  if to_regprocedure('public.dates_courtes_suivi_controles(date,date,uuid)') is null then
    raise exception 'GARDE_RECETTE : migration 20261123140000_dates_courtes_lot3_suivi absente, arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'site-fantome-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'site-fantome-test');
insert into sites (site_id) select 'nexus-station-test' where not exists (select 1 from sites where site_id = 'nexus-station-test');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0301', 'manager',  'site-fantome-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0302', 'caissier', 'site-fantome-test', false),
  ('P1',  '00000000-0000-4000-8000-0000000e0303', 'pompiste', 'site-fantome-test', false),
  ('M2',  '00000000-0000-4000-8000-0000000e0304', 'manager',  'nexus-station-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000e0305', 'gerant',   'site-fantome-test', false),
  ('CR1', '00000000-0000-4000-8000-0000000e0306', 'manager',  'site-fantome-test', true);
insert into auth.users (id, aud, role, email)
select v, 'authenticated', 'authenticated', 'recette-suivi-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-suivi-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

create function pg_temp.comme(k text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select ids.v into v from ids where ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;
create function pg_temp.exec(q text) returns void language plpgsql as $$
declare cur text := current_user;
begin
  reset role; execute q;
  if cur <> session_user then execute format('set local role %I', cur); end if;
end $$;
create function pg_temp.val(q text) returns text language plpgsql as $$
declare r text; cur text := current_user;
begin
  reset role; execute q into r;
  if cur <> session_user then execute format('set local role %I', cur); end if;
  return r;
end $$;
-- Exécute une requête comme un compte ; renvoie le résultat texte ou « ERR message ».
create function pg_temp.essai(k text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.comme(k);
  execute q into r;
  reset role;
  return coalesce(r, '');
exception when others then
  reset role; return 'ERR ' || sqlerrm;
end $$;
create function pg_temp.n(acc jsonb, cas text, attendu text, obtenu text) returns jsonb language plpgsql as $$
declare a text; ok boolean := false;
begin
  foreach a in array string_to_array(attendu, '~') loop
    if left(a, 1) = '=' then ok := ok or coalesce(obtenu, '') = substr(a, 2);
    elsif left(a, 1) = '!' then ok := ok or position(substr(a, 2) in coalesce(obtenu, '')) = 0;
    else ok := ok or position(a in coalesce(obtenu, '')) > 0; end if;
  end loop;
  return acc || jsonb_build_array(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'ok', ok));
end $$;

do $rapport$
declare
  r jsonb := '[]'::jsonb; d date := (now() at time zone 'America/Martinique')::date;
  u text := '00000000-0000-4000-8000-0000000e03'; q text; avant text; apres text;
  t1 uuid := '00000000-0000-4000-8000-0000000e0311'; t2 uuid := '00000000-0000-4000-8000-0000000e0312';
  t3 uuid := '00000000-0000-4000-8000-0000000e0313'; t4 uuid := '00000000-0000-4000-8000-0000000e0314';
  t5 uuid := '00000000-0000-4000-8000-0000000e0315'; t6 uuid := '00000000-0000-4000-8000-0000000e0316';
  ca uuid := '00000000-0000-4000-8000-0000000e0302'; m1 uuid := '00000000-0000-4000-8000-0000000e0301';
  m2 uuid := '00000000-0000-4000-8000-0000000e0304';
  t7 uuid := '00000000-0000-4000-8000-0000000e0317'; r7 uuid := '00000000-0000-4000-8000-0000000e0327'; r8 uuid := '00000000-0000-4000-8000-0000000e0328';
  r1 uuid := '00000000-0000-4000-8000-0000000e0321'; r2 uuid := '00000000-0000-4000-8000-0000000e0322';
  r3 uuid := '00000000-0000-4000-8000-0000000e0323'; r4 uuid := '00000000-0000-4000-8000-0000000e0324';
  r5 uuid := '00000000-0000-4000-8000-0000000e0325'; r6 uuid := '00000000-0000-4000-8000-0000000e0326';
begin
  reset role;
  -- Jeu : site A (fantome) 5 tournées, site B 1 tournée.
  insert into dates_courtes_tournees (id, site, nom, cle_idempotence, saisi_par, saisi_le, etat, terminee_par, terminee_le, version_empreinte) values
    (t1, 'site-fantome-test', null,             'r3-t1', ca, now() - interval '3 hours', 'EN_COURS', null, null, null),
    (t2, 'site-fantome-test', 'Rayon boissons', 'r3-t2', ca, now() - interval '30 hours', 'EN_COURS', null, null, null),
    (t3, 'site-fantome-test', null,             'r3-t3', ca, now() - interval '10 minutes', 'EN_COURS',         null, null, null),
    (t4, 'site-fantome-test', 'Frais libre-service', 'r3-t4', ca, now() - interval '50 hours', 'EN_COURS', null, null, null),
    (t5, 'site-fantome-test', 'Ancienne tournée', 'r3-t5', ca, now() - interval '40 days', 'EN_COURS', null, null, null),
    (t6, 'nexus-station-test', 'Tournée autre station', 'r3-t6', m2, now() - interval '2 hours', 'EN_COURS', null, null, null),
    (t7, 'site-fantome-test', 'Égalité liste détail', 'r3-t7', ca, now() - interval '5 hours', 'EN_COURS', null, null, null);
  -- Les déclencheurs d'insertion relisent le compte connecté : les relevés et corrections s'insèrent comme CA1 (même station, auteur des tournées).
  perform pg_temp.comme('CA1');
  reset role; -- identité CA1 conservée pour les gardes ; la RLS d'insertion (rôle caissier autorisé) n'est pas l'objet de cette recette.
  insert into dates_courtes_releves (id, site, ean, libelle_vu, libelle_normalise, nom_libre, date_limite, quantite, provisoire, cle_groupe, tournee_id, heure_geste, cle_idempotence, saisi_par, annule_le, annule_par, motif_annulation, rectification) values
    (r1, 'site-fantome-test', '3000000000017', 'Yaourt nature', 'yaourt nature', null, d + 2, 4, false, 'g1', t1, now(), 'r3-r1', ca, null, null, null, false),
    (r2, 'site-fantome-test', '3000000000', 'Code court', 'code court', null, d + 3, 1, false, 'g2', t1, now(), 'r3-r2', ca, null, null, null, false),
    (r3, 'site-fantome-test', '13000000000014', 'Colis logistique', 'colis logistique', null, d + 4, 2, true, 'g3', t1, now(), 'r3-r3', ca, null, null, null, false),
    (r4, 'site-fantome-test', null, null, 'article libre', 'Pâtisserie du jour', d + 1, 6, false, 'g4', t1, now(), 'r3-r4', ca, null, null, null, false),
    (r5, 'site-fantome-test', '3000000000024', 'Jus annulé', 'jus annule', null, d + 5, 3, false, 'g5', t1, now(), 'r3-r5', ca, now(), ca, 'saisie par erreur', false),
    (r6, 'site-fantome-test', '3000000000031', 'Lait demi-écrémé', 'lait demi ecreme', null, d + 6, 8, false, 'g6', t2, now(), 'r3-r6', ca, null, null, null, true),
    -- r7 cumule deux anomalies (code incomplet + code provisoire) ; r8 est annulé et porte aussi deux anomalies, qui ne doivent pas compter.
    (r7, 'site-fantome-test', '3000000001', 'Compote', 'compote', null, d + 2, 2, true, 'g7', t7, now(), 'r3-r7', ca, null, null, null, false),
    (r8, 'site-fantome-test', '3000000002', 'Biscuits annulés', 'biscuits annules', null, d + 2, 2, true, 'g8', t7, now(), 'r3-r8', ca, now(), ca, 'saisie par erreur', true);
  -- Une correction rectifiée sur le produit annulé r8 : anomalie « sans produit » ; une autre sur r7 : paire (r7, modifiee_apres_cloture).
  insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, releve_id, cle_groupe, tournee_id, heure_geste, rectification, cle_idempotence, saisi_par)
    values ('site-fantome-test', '3000000002', 'biscuits annules', d + 2, 1, r8, 'g8c', t7, now(), true, 'r3-c8', ca),
           ('site-fantome-test', '3000000001', 'compote', d + 2, 1, r7, 'g7c', t7, now(), true, 'r3-c7', ca);
  reset role;
  -- Les gestes sont saisis tournées ouvertes (sinon tournee_terminee) ; on les amène ensuite à leur état final.
  update dates_courtes_releves set rectification = true where id in (r6, r8);
  -- Le déclencheur d'insertion efface tout code qui n'est pas un EAN valide ; le « code incomplet » se constate sur des codes déjà stockés : on les pose après coup.
  update dates_courtes_releves set ean = case id when r2 then '3000000000' when r7 then '3000000001' else '3000000002' end where id in (r2, r7, r8);
  update dates_courtes_tournees set etat = 'CERTIFIEE', terminee_par = ca, terminee_le = now() - interval '29 hours', version_empreinte = 'v-t2' where id = t2;
  update dates_courtes_corrections set rectification = true where cle_idempotence in ('r3-c8', 'r3-c7');
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = ca, terminee_le = now() - interval '2 hours', version_empreinte = 'v-t1' where id = t1;
  update dates_courtes_tournees set etat = 'CORRECTION_DEMANDEE', terminee_par = ca, terminee_le = now() - interval '49 hours', version_empreinte = 'v-t4' where id = t4;
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = ca, terminee_le = now() - interval '40 days' + interval '1 hour', version_empreinte = 'v-t5' where id = t5;
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = m2, terminee_le = now() - interval '1 hour', version_empreinte = 'v-t6' where id = t6;
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = ca, terminee_le = now() - interval '4 hours', version_empreinte = 'v-t7' where id = t7;
  insert into dates_courtes_certifications (site, tournee_id, certifiee_par, certifiee_le, version_certifiee, observations, cle_idempotence)
    values ('site-fantome-test', t2, m1, now() - interval '28 hours', 'v-t2', 'Rien à signaler', 'r3-c2');
  insert into dates_courtes_demandes_correction (site, tournee_id, demandee_par, demandee_le, motif, releves_vises, cle_idempotence)
    values ('site-fantome-test', t4, m1, now() - interval '48 hours', 'Dates à revérifier', array[r6], 'r3-d4');
  insert into dates_courtes_renommages_tournee (site, tournee_id, ancien_nom, nouveau_nom, renomme_par, renomme_le, cle_idempotence)
    values ('site-fantome-test', t2, 'Contrôle DLC', 'Rayon boissons', ca, now() - interval '29 hours', 'r3-n2');

  avant := pg_temp.val($f$select (select count(*) from dates_courtes_tournees)::text || '/' || (select count(*) from dates_courtes_releves) || '/' || (select count(*) from dates_courtes_certifications) || '/' || (select count(*) from dates_courtes_demandes_correction) || '/' || (select count(*) from dates_courtes_renommages_tournee)$f$);

  q := format($f$select dates_courtes_suivi_controles(%L, %L)::text$f$, d - 6, d);
  -- 1 droits
  r := pg_temp.n(r, '1 manager autorisé', '!ERR', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '1 gérant autorisé', '!ERR', pg_temp.essai('G1', q));
  r := pg_temp.n(r, '1 créateur autorisé', '!ERR', pg_temp.essai('CR1', q));
  r := pg_temp.n(r, '1 caissier refusé', 'droit_refuse', pg_temp.essai('CA1', q));
  r := pg_temp.n(r, '1 pompiste refusé', 'droit_refuse', pg_temp.essai('P1', q));
  r := pg_temp.n(r, '1 détail : caissier refusé', 'droit_refuse', pg_temp.essai('CA1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t1)));
  perform pg_temp.exec('reset role');
  r := pg_temp.n(r, '1 anonyme refusé (aucun octroi)', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.dates_courtes_suivi_controles(date,date,uuid)', 'execute')::text$f$));
  r := pg_temp.n(r, '1 authenticated a le droit d''exécuter', '=true', pg_temp.val($f$select has_function_privilege('authenticated', 'public.dates_courtes_suivi_controles(date,date,uuid)', 'execute')::text$f$));

  -- 2 période
  r := pg_temp.n(r, '2 période de 31 jours acceptée', '!ERR', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)::text$f$, d - 30, d)));
  r := pg_temp.n(r, '2 période de 32 jours refusée', 'periode_trop_longue', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)::text$f$, d - 31, d)));
  r := pg_temp.n(r, '2 période inversée refusée', 'valeur_invalide', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)::text$f$, d, d - 1)));
  r := pg_temp.n(r, '2 dates nulles refusées', 'valeur_invalide', pg_temp.essai('M1', $f$select dates_courtes_suivi_controles(null, null)::text$f$));
  r := pg_temp.n(r, '2 une seule date nulle refusée', 'valeur_invalide', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, null)::text$f$, d)));

  -- 3 liste, site, ordre
  r := pg_temp.n(r, '3 nombre de tournées de la liste', '=5', pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(%L, %L)->'tournees')::text$f$, d - 6, d)));
  r := pg_temp.n(r, '3 à certifier du site, toutes périodes (la tournée ancienne compte)', '=3', pg_temp.essai('M1', format($f$select (dates_courtes_suivi_controles(%L, %L)->>'a_certifier_total')$f$, d - 6, d)));
  r := pg_temp.n(r, '3 ordre : 1re = à certifier', '=TERMINEE_A_CERTIFIER', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'etat'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 ordre : 2e = à certifier (t7)', '=TERMINEE_A_CERTIFIER', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->1->>'etat'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 ordre : 3e = correction demandée', '=CORRECTION_DEMANDEE', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->2->>'etat'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 ordre : 4e = en cours', '=EN_COURS', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->3->>'etat'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 ordre : 5e = certifiée', '=CERTIFIEE', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->4->>'etat'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 manager d''une autre station ne voit pas ces tournées', '=0', pg_temp.essai('M2', format($f$select count(*)::text from jsonb_array_elements(dates_courtes_suivi_controles(%L, %L)->'tournees') e where e->>'id' in (%L, %L, %L, %L, %L, %L)$f$, d - 6, d, t1, t2, t3, t4, t5, t7)));
  r := pg_temp.n(r, '3 autre station : sa propre tournée seulement', '=Tournée autre station', pg_temp.essai('M2', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'nom'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 période de 30 jours : l''ancienne tournée (40 jours) reste absente', '=5', pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(%L, %L)->'tournees')::text$f$, d - 29, d)));
  r := pg_temp.n(r, '3 auteur = nom affiché, jamais l''identifiant', '=Recette CA1', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'auteur'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 nom de repli lisible', 'Contrôle DLC · Recette CA1 · ', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'nom'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 tournée en cours : pas d''heure de fin', '=', pg_temp.essai('M1', format($f$select coalesce(dates_courtes_suivi_controles(%L, %L)->'tournees'->3->>'fin', '')$f$, d - 6, d)));
  r := pg_temp.n(r, '3 heure de début HH:MM', '=true', pg_temp.essai('M1', format($f$select (dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'debut') ~ '^[0-9]{2}:[0-9]{2}$'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 produits comptés hors annulés (T1 : 4)', '=4', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'produits'$f$, d - 6, d)));
  r := pg_temp.n(r, '3 anomalies comptées (T1 : 3)', '=3', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(%L, %L)->'tournees'->0->>'anomalies'$f$, d - 6, d)));

  -- 3b égalité liste / détail : paires (produit, anomalie) sur produits non annulés + anomalies sans produit
  r := pg_temp.n(r, '3b T7 liste : 4 anomalies (r7 : 3 paires, r8 annulé : 1 sans produit)', '=4', pg_temp.essai('M1', format($f$select (select e->>'anomalies' from jsonb_array_elements(dates_courtes_suivi_controles(%L, %L)->'tournees') e where e->>'id' = %L)$f$, d - 6, d, t7)));
  r := pg_temp.n(r, '3b T7 détail : même nombre dans l''en-tête', '=4', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)->'tournee'->>'anomalies'$f$, t7)));
  r := pg_temp.n(r, '3b T7 détail : somme des anomalies des produits + sans produit = nombre de la liste', '=4', pg_temp.essai('M1', format($f$select (select coalesce(sum(jsonb_array_length(p->'anomalies')), 0) from jsonb_array_elements(x->'produits') p) + jsonb_array_length(x->'anomalies_sans_produit') from (select dates_courtes_suivi_controles(null, null, %L) x) y$f$, t7)));
  r := pg_temp.n(r, '3b T7 détail : le produit r7 porte trois anomalies', '=3', pg_temp.essai('M1', format($f$select jsonb_array_length(p->'anomalies')::text from jsonb_array_elements(dates_courtes_suivi_controles(null, null, %L)->'produits') p where p->>'id' = %L$f$, t7, r7)));
  r := pg_temp.n(r, '3b T7 : une seule ligne produit (l''annulé est absent)', '=1', pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(null, null, %L)->'produits')::text$f$, t7)));
  r := pg_temp.n(r, '3b T7 : anomalies sans produit = 1 (modifiee_apres_cloture)', '=1', pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(null, null, %L)->'anomalies_sans_produit')::text$f$, t7)));
  r := pg_temp.n(r, '3b liste = détail pour chaque tournée de la période', '=0', pg_temp.essai('M1', format($f$select count(*)::text from jsonb_array_elements(dates_courtes_suivi_controles(%L, %L)->'tournees') e where (e->>'anomalies')::int <> (dates_courtes_suivi_controles(null, null, (e->>'id')::uuid)->'tournee'->>'anomalies')::int$f$, d - 6, d)));

  -- 4 détail et anomalies déduites
  q := format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t1);
  r := pg_temp.n(r, '4 détail : produits non annulés', '=4', pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(null, null, %L)->'produits')::text$f$, t1)));
  r := pg_temp.n(r, '4 anomalie code incomplet', 'code_incomplet', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '4 anomalie code logistique provisoire', 'code_logistique_provisoire', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '4 anomalie article texte libre', 'article_texte_libre', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '4 jamais d''anomalie « ambigu »', '!ambigu', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '4 le produit annulé n''apparaît pas', '!Jus annulé', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '4 le produit sans anomalie n''en porte pas', '=0', pg_temp.essai('M1', format($f$select jsonb_array_length(p->'anomalies')::text from jsonb_array_elements(dates_courtes_suivi_controles(null, null, %L)->'produits') p where p->>'id' = %L$f$, t1, r1)));
  r := pg_temp.n(r, '4 modifiée après clôture (rectification, T2)', 'modifiee_apres_cloture', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t2)));
  r := pg_temp.n(r, '4 détail : historique commencée', 'commencee', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t2)));
  r := pg_temp.n(r, '4 historique : renommée', 'renommee', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t2)));
  r := pg_temp.n(r, '4 historique : certifiée par le manager avec l''observation', 'Rien à signaler', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t2)));
  r := pg_temp.n(r, '4 historique : correction demandée avec motif', 'Dates à revérifier', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t4)));
  r := pg_temp.n(r, '4 détail d''une tournée d''une autre station : introuvable', 'introuvable', pg_temp.essai('M1', format($f$select dates_courtes_suivi_controles(null, null, %L)::text$f$, t6)));
  r := pg_temp.n(r, '4 détail d''une tournée inexistante : introuvable', 'introuvable', pg_temp.essai('M1', $f$select dates_courtes_suivi_controles(null, null, '00000000-0000-4000-8000-0000000e03ff')::text$f$));

  -- 5 aucune écriture
  reset role;
  apres := pg_temp.val($f$select (select count(*) from dates_courtes_tournees)::text || '/' || (select count(*) from dates_courtes_releves) || '/' || (select count(*) from dates_courtes_certifications) || '/' || (select count(*) from dates_courtes_demandes_correction) || '/' || (select count(*) from dates_courtes_renommages_tournee)$f$);
  r := pg_temp.n(r, '5 aucune écriture (comptes avant = après)', '=' || avant, apres);
  r := pg_temp.n(r, '5 fonction en lecture seule (stable)', '=s', pg_temp.val($f$select provolatile::text from pg_proc where proname = 'dates_courtes_suivi_controles'$f$));
  r := pg_temp.n(r, '5 security invoker', '=false', pg_temp.val($f$select prosecdef::text from pg_proc where proname = 'dates_courtes_suivi_controles'$f$));

  raise exception 'RAPPORT_SUIVI_DLC %', jsonb_build_object('total', jsonb_array_length(r), 'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
