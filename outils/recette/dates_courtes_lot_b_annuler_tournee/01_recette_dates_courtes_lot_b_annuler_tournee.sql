-- Recette SQL du lot B Dates courtes : « Annuler une tournée ».
-- Une transaction, rollback final ; le résultat sort dans l'exception RAPPORT_ANNUL_TOURNEE.
-- Cible : nexus-station-test UNIQUEMENT (garde ci-dessous) ou banc pglite jetable. Jamais Production.
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
  if to_regprocedure('public.dates_courtes_annuler_tournee(uuid,text,text)') is null then
    raise exception 'GARDE_RECETTE : migration 20261124100000_dates_courtes_lot_b_annuler_tournee absente, arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'site-fantome-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'site-fantome-test');
insert into sites (site_id, timezone) select 'nexus-station-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'nexus-station-test');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0601', 'manager',  'nexus-station-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0602', 'caissier', 'nexus-station-test', false),
  ('CA2', '00000000-0000-4000-8000-0000000e0603', 'caissier', 'nexus-station-test', false),
  ('P1',  '00000000-0000-4000-8000-0000000e0604', 'pompiste', 'nexus-station-test', false),
  ('M2',  '00000000-0000-4000-8000-0000000e0605', 'manager',  'site-fantome-test',  false),
  ('G1',  '00000000-0000-4000-8000-0000000e0606', 'gerant',   'nexus-station-test', false),
  ('CR1', '00000000-0000-4000-8000-0000000e0607', 'manager',  'nexus-station-test', true);

insert into auth.users (id, aud, role, email) select v, 'authenticated', 'authenticated', 'recette-annul-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  select v, 'recette-annul-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

create function pg_temp.comme(k text) returns void language plpgsql as $$
declare u uuid;
begin
  reset role;
  select v into u from ids where ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

create function pg_temp.exec(q text) returns void language plpgsql as $$
begin
  reset role; execute q;
  if current_user <> session_user then null; end if;
end $$;

create function pg_temp.val(q text) returns text language plpgsql as $$
declare r text;
begin reset role; execute q into r; return r; end $$;

create function pg_temp.essai(k text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.comme(k);
  execute q into r;
  reset role;
  return coalesce(r, '');
exception when others then
  reset role;
  return 'ERR ' || sqlerrm;
end $$;

-- n(acc, cas, attendu, obtenu) : '=x' exact, '!x' absence, sinon sous-chaîne ; alternatives séparées par '~'.
create function pg_temp.n(acc jsonb, cas text, attendu text, obtenu text) returns jsonb language plpgsql as $$
declare ok boolean := false; a text;
begin
  if left(attendu, 1) = '=' then ok := obtenu = substr(attendu, 2);
  elsif left(attendu, 1) = '!' then ok := position(substr(attendu, 2) in coalesce(obtenu, '')) = 0;
  else
    foreach a in array string_to_array(attendu, '~') loop
      if position(a in coalesce(obtenu, '')) > 0 then ok := true; end if;
    end loop;
  end if;
  return acc || jsonb_build_array(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'ok', ok));
end $$;

create function pg_temp.lire(k text, ins timestamptz default '2026-11-22 16:00:00+00') returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.comme(k);
  begin
    r := dates_courtes_prevention_pertes(ins);
  exception when others then r := jsonb_build_object('erreur', sqlerrm);
  end;
  reset role;
  return r;
end $$;

do $rapport$
declare
  st constant text := 'nexus-station-test';
  r jsonb := '[]'::jsonb;
  m1 uuid; ca1 uuid; ca2 uuid; p1 uuid;
  t text[]; i integer; n_av integer; n_ap integer; txt text; tid uuid; rid uuid;
  -- tournées : 1 EN_COURS CA1 ; 2 EN_COURS CA1 (auteur refusé après passage) ; 3 À CERTIFIER CA1 ; 4 CORRECTION_DEMANDEE CA1 ;
  -- 5 CERTIFIEE ; 6 EN_COURS CA2 ; 7 autre station ; 8 vide ; 9 corrections ; 10 démarque ; 11 EN_COURS CA1 (manager) ; 12 EN_COURS CA1 (gérant) ; 13 EN_COURS CA1 (créateur)
  base text := '00000000-0000-4000-8000-0000000e06';
begin
  select v into m1 from ids where k = 'M1'; select v into ca1 from ids where k = 'CA1';
  select v into ca2 from ids where k = 'CA2'; select v into p1 from ids where k = 'P1';

  -- Tournées (toutes EN_COURS à l'insertion, état final posé ensuite).
  for i in 1 .. 13 loop
    insert into dates_courtes_tournees (id, site, nom, cle_idempotence, saisi_par, saisi_le, etat, terminee_par, terminee_le, version_empreinte)
      values ((base || lpad((10 + i)::text, 2, '0'))::uuid, case when i = 7 then 'site-fantome-test' else st end, null, 'r6-t' || i,
              case when i = 6 then ca2 when i = 7 then (select v from ids where k = 'M2') else ca1 end,
              '2026-11-22 14:00:00+00', 'EN_COURS', null, null, null);
  end loop;

  -- 3 relevés par tournée (sauf 8 : 0), sur la station de la tournée.
  for i in 1 .. 13 loop
    continue when i = 8;
    -- Le déclencheur d'insertion relit le compte connecté : on prend l'identité de l'auteur de la tournée (même station).
    perform pg_temp.comme(case when i = 6 then 'CA2' when i = 7 then 'M2' else 'CA1' end); reset role;
    for t in select array[g::text] from generate_series(1, case when i = 9 then 2 else 3 end) g loop
      insert into dates_courtes_releves (id, site, ean, libelle_vu, libelle_normalise, nom_libre, date_limite, quantite, provisoire, cle_groupe,
                                         tournee_id, heure_geste, cle_idempotence, saisi_par, rectification)
        values ((base || lpad((50 + i * 3 + t[1]::int)::text, 2, '0'))::uuid, case when i = 7 then 'site-fantome-test' else st end,
                null, 'Produit ' || i || '-' || t[1], 'produit ' || i || '-' || t[1], 'Produit ' || i || '-' || t[1],
                date '2026-11-25' + i, 2, false, 'r6-g' || i || '-' || t[1],
                (base || lpad((10 + i)::text, 2, '0'))::uuid, '2026-11-22 14:05:00+00', 'r6-r' || i || '-' || t[1],
                case when i = 6 then ca2 when i = 7 then (select v from ids where k = 'M2') else ca1 end, false);
    end loop;
  end loop;
  reset role;

  -- Accès caissier : la station de recette ne l'ouvre pas par défaut, donc dates_courtes_caissier_autorise() y est faux.
  -- On l'ouvre par le geste réel de la gestion (rollback final : aucun résidu). Dernière ligne par saisi_le : celle-ci l'emporte.
  perform pg_temp.comme('M1');
  perform dates_courtes_regler_acces_caissier(true);
  perform pg_temp.comme('CA1');
  if not dates_courtes_caissier_autorise() then
    raise exception 'PREPARATION_RECETTE : accès caissier non ouvert après dates_courtes_regler_acces_caissier(true), arrêt';
  end if;
  reset role;

  -- Tournée 9 : une correction négative active et une correction déjà annulée.
  insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, releve_id, cle_groupe, tournee_id, heure_geste, rectification, cle_idempotence, saisi_par)
    select st, r.ean, r.libelle_normalise, r.date_limite, -1, r.id, 'r6-gc9a', r.tournee_id, '2026-11-22 14:10:00+00', false, 'r6-c9a', ca1
    from dates_courtes_releves r where r.cle_idempotence = 'r6-r9-1';
  insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, releve_id, cle_groupe, tournee_id, heure_geste, rectification, cle_idempotence, saisi_par)
    select st, r.ean, r.libelle_normalise, r.date_limite, 1, r.id, 'r6-gc9b', r.tournee_id, '2026-11-22 14:11:00+00', false, 'r6-c9b', ca1
    from dates_courtes_releves r where r.cle_idempotence = 'r6-r9-2';
  update dates_courtes_corrections set annule_le = '2026-11-22 14:12:00+00', annule_par = ca1, motif_annulation = 'erreur de saisie initiale' where cle_idempotence = 'r6-c9b';

  -- Tournée 10 : un retrait puis une démarque active.
  insert into dates_courtes_retraits (site, ean, libelle_normalise, date_limite, quantite, releve_id, cle_groupe, tournee_id, heure_geste, cle_idempotence, saisi_par)
    select st, r.ean, r.libelle_normalise, r.date_limite, 1, r.id, 'r6-gt10', r.tournee_id, '2026-11-22 14:20:00+00', 'r6-t10', ca1
    from dates_courtes_releves r where r.cle_idempotence = 'r6-r10-1';
  insert into dates_courtes_demarques (site, retrait_id, tournee_id, quantite, heure_geste, cle_idempotence, saisi_par)
    select st, x.id, x.tournee_id, 1, '2026-11-22 14:25:00+00', 'r6-d10', ca1 from dates_courtes_retraits x where x.cle_idempotence = 'r6-t10';

  -- États finaux.
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = ca1, terminee_le = '2026-11-22 14:30:00+00', version_empreinte = 'v3'
    where cle_idempotence in ('r6-t3', 'r6-t10');
  update dates_courtes_tournees set etat = 'CORRECTION_DEMANDEE', terminee_par = ca1, terminee_le = '2026-11-22 14:30:00+00', version_empreinte = 'v4' where cle_idempotence = 'r6-t4';
  update dates_courtes_tournees set etat = 'CERTIFIEE', terminee_par = ca1, terminee_le = '2026-11-22 14:30:00+00', version_empreinte = 'v5' where cle_idempotence = 'r6-t5';
  insert into dates_courtes_certifications (site, tournee_id, certifiee_par, certifiee_le, version_certifiee, observations, cle_idempotence)
    values (st, (base || '15')::uuid, m1, '2026-11-22 15:00:00+00', 'v5', null, 'r6-k5');
  insert into dates_courtes_demandes_correction (site, tournee_id, demandee_par, demandee_le, motif, releves_vises, cle_idempotence)
    values (st, (base || '14')::uuid, m1, '2026-11-22 15:00:00+00', 'à revérifier',
            (select array_agg(id) from (select id from dates_courtes_releves where tournee_id = (base || '14')::uuid limit 1) x), 'r6-d4');

  -- 1 droits : refus avant écriture.
  r := pg_temp.n(r, '1 pompiste sans droit', 'droit_refuse', pg_temp.essai('P1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x1')::text$f$, base || '11')));
  r := pg_temp.n(r, '2 autre employé refusé', 'tournee_interdite', pg_temp.essai('CA2', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x2')::text$f$, base || '11')));
  r := pg_temp.n(r, '3 auteur sur sa tournée à certifier refusé', 'etat_incompatible', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x3')::text$f$, base || '13')));
  r := pg_temp.n(r, '4 auteur sur correction demandée refusé', 'etat_incompatible', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x4')::text$f$, base || '14')));
  r := pg_temp.n(r, '5 certifiée refusée au caissier', 'tournee_certifiee', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x5')::text$f$, base || '15')));
  r := pg_temp.n(r, '6 certifiée refusée au manager', 'tournee_certifiee', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x6')::text$f$, base || '15')));
  r := pg_temp.n(r, '7 certifiée refusée au gérant', 'tournee_certifiee', pg_temp.essai('G1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x7')::text$f$, base || '15')));
  r := pg_temp.n(r, '8 autre station : introuvable', 'introuvable', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable','r6-x8')::text$f$, base || '17')));
  r := pg_temp.n(r, '9 tournée inconnue', 'introuvable', pg_temp.essai('M1', $f$select dates_courtes_annuler_tournee('00000000-0000-4000-8000-0000000e06ff','motif valable','r6-x9')::text$f$));
  r := pg_temp.n(r, '10 rien écrit par les refus', '=0', pg_temp.val($f$select count(*)::text from dates_courtes_tournees where etat = 'ANNULEE' and cle_idempotence like 'r6-%'$f$));

  -- 2 motif et clé.
  r := pg_temp.n(r, '11 motif vide', 'motif_invalide', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'','r6-m1')::text$f$, base || '11')));
  r := pg_temp.n(r, '12 motif de 2 caractères', 'motif_invalide', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'ab','r6-m2')::text$f$, base || '11')));
  r := pg_temp.n(r, '13 motif de 201 caractères', 'motif_invalide', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,%L,'r6-m3')::text$f$, base || '11', repeat('x', 201))));
  r := pg_temp.n(r, '14 motif d''espaces', 'motif_invalide', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'      ','r6-m4')::text$f$, base || '11')));
  r := pg_temp.n(r, '15 clé absente', 'cle_idempotence_requise', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'motif valable',null)::text$f$, base || '11')));
  r := pg_temp.n(r, '16 motif de 200 caractères accepté', '"statut": "annulee"', pg_temp.essai('CA2', format($f$select dates_courtes_annuler_tournee(%L,%L,'r6-m5')::text$f$, base || '16', repeat('y', 200))));

  -- 3 annulation par l'auteur, idempotence.
  txt := pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'saisie sur le mauvais rayon','r6-a1')::text$f$, base || '11'));
  r := pg_temp.n(r, '17 auteur annule sa tournée en cours', '"produits_annules": 3', txt);
  r := pg_temp.n(r, '18 état et auteur posés', '=ANNULEE|' || ca1::text || '|saisie sur le mauvais rayon',
                 pg_temp.val(format($f$select etat || '|' || annulee_par::text || '|' || motif_annulation from dates_courtes_tournees where id = %L$f$, base || '11')));
  r := pg_temp.n(r, '19 relevés annulés avec le préfixe', '=3',
                 pg_temp.val(format($f$select count(*)::text from dates_courtes_releves where tournee_id = %L and annule_le is not null and motif_annulation = 'Tournée annulée : saisie sur le mauvais rayon'$f$, base || '11')));
  r := pg_temp.n(r, '20 rien supprimé', '=3', pg_temp.val(format($f$select count(*)::text from dates_courtes_releves where tournee_id = %L$f$, base || '11')));
  r := pg_temp.n(r, '21 rejeu même clé : déjà annulée, 0', 'deja_annulee', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'saisie sur le mauvais rayon','r6-a1')::text$f$, base || '11')));
  r := pg_temp.n(r, '22 double annulation autre clé : 0 produit', '"produits_annules": 0', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'autre motif','r6-a1b')::text$f$, base || '11')));
  r := pg_temp.n(r, '23 la date d''annulation n''a pas bougé', '=1', pg_temp.val(format($f$select count(distinct annulee_le)::text from dates_courtes_tournees where id = %L$f$, base || '11')));

  -- 4 gestion.
  r := pg_temp.n(r, '24 manager sur « à certifier »', '"statut": "annulee"', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'doublon de contrôle','r6-g1')::text$f$, base || '13')));
  r := pg_temp.n(r, '25 manager sur « correction demandée »', '"statut": "annulee"', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'contrôle abandonné','r6-g2')::text$f$, base || '14')));
  r := pg_temp.n(r, '26 manager sur tournée d''un autre en cours', '"statut": "annulee"', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'oubli de clôture','r6-g3')::text$f$, base || '12')));
  r := pg_temp.n(r, '27 gérant', '"statut": "annulee"', pg_temp.essai('G1', format($f$select dates_courtes_annuler_tournee(%L,'doublon de contrôle','r6-g4')::text$f$, base || '22')));
  r := pg_temp.n(r, '28 créateur', '"statut": "annulee"', pg_temp.essai('CR1', format($f$select dates_courtes_annuler_tournee(%L,'doublon de contrôle','r6-g5')::text$f$, base || '23')));
  r := pg_temp.n(r, '29 l''annulation par la gestion garde le nom de l''annuleur', '=' || m1::text,
                 pg_temp.val(format($f$select annulee_par::text from dates_courtes_tournees where id = %L$f$, base || '13')));

  -- 5 tournée vide.
  r := pg_temp.n(r, '30 tournée à 0 relevé', '"produits_annules": 0', pg_temp.essai('CA1', format($f$select dates_courtes_annuler_tournee(%L,'ouverte par erreur','r6-v1')::text$f$, base || '18')));
  r := pg_temp.n(r, '31 la tournée vide est bien annulée', '=ANNULEE', pg_temp.val(format($f$select etat from dates_courtes_tournees where id = %L$f$, base || '18')));

  -- 6 corrections : active annulée, déjà annulée conservée.
  r := pg_temp.n(r, '32 tournée à corrections annulable', '"produits_annules": 2', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'contrôle repris à zéro','r6-c1')::text$f$, base || '19')));
  r := pg_temp.n(r, '33 correction active annulée', '=Tournée annulée : contrôle repris à zéro', pg_temp.val($f$select motif_annulation from dates_courtes_corrections where cle_idempotence = 'r6-c9a'$f$));
  r := pg_temp.n(r, '34 correction déjà annulée non touchée', '=erreur de saisie initiale', pg_temp.val($f$select motif_annulation from dates_courtes_corrections where cle_idempotence = 'r6-c9b'$f$));
  r := pg_temp.n(r, '35 aucune correction active restante', '=0', pg_temp.val(format($f$select count(*)::text from dates_courtes_corrections where tournee_id = %L and annule_le is null$f$, base || '19')));

  -- 7 démarque active : refus atomique.
  r := pg_temp.n(r, '36 démarque active refuse', 'demarque_active', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'contrôle à reprendre','r6-dm1')::text$f$, base || '20')));
  r := pg_temp.n(r, '37 refus atomique : relevés intacts', '=0', pg_temp.val(format($f$select count(*)::text from dates_courtes_releves where tournee_id = %L and annule_le is not null$f$, base || '20')));
  r := pg_temp.n(r, '38 refus atomique : tournée intacte', '=TERMINEE_A_CERTIFIER', pg_temp.val(format($f$select etat from dates_courtes_tournees where id = %L$f$, base || '20')));
  perform pg_temp.exec($f$update dates_courtes_demarques set annule_le = now(), annule_par = (select v from ids where k = 'M1'), motif_annulation = 'démarque retirée' where cle_idempotence = 'r6-d10'$f$);
  r := pg_temp.n(r, '39 démarque annulée : l''annulation passe', '"statut": "annulee"', pg_temp.essai('M1', format($f$select dates_courtes_annuler_tournee(%L,'contrôle à reprendre','r6-dm2')::text$f$, base || '20')));

  -- 8 prévention des pertes : les relevés annulés disparaissent.
  r := pg_temp.n(r, '40 produit annulé absent de la prévention des pertes', '!Produit 11-1', pg_temp.lire('M1')::text);
  r := pg_temp.n(r, '41a suivi liste : produits annulés de la tournée annulée', '=3',
                 pg_temp.essai('M1', format($f$select (select e->>'produits_annules' from jsonb_array_elements(dates_courtes_suivi_controles(date '2026-11-22', date '2026-11-22')->'tournees') e where e->>'id' = %L)$f$, base || '11')));
  r := pg_temp.n(r, '41b suivi détail : produits annulés comptés', '=3',
                 pg_temp.essai('M1', format($f$select (dates_courtes_suivi_controles(null, null, %L)->'tournee'->>'produits_annules')$f$, base || '11')));
  r := pg_temp.n(r, '41c suivi détail : liste des produits annulés', '=3',
                 pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(null, null, %L)->'produits_annules')::text$f$, base || '11')));
  r := pg_temp.n(r, '41d suivi détail : aucun produit actif', '=0',
                 pg_temp.essai('M1', format($f$select jsonb_array_length(dates_courtes_suivi_controles(null, null, %L)->'produits')::text$f$, base || '11')));
  r := pg_temp.n(r, '42 aucun relevé actif des tournées annulées', '=0',
                 pg_temp.val($f$select count(*)::text from dates_courtes_releves r join dates_courtes_tournees t on t.id = r.tournee_id and t.site = r.site where t.etat = 'ANNULEE' and r.annule_le is null$f$));

  -- 9 lecture : lire_tournees et suivi.
  r := pg_temp.n(r, '43 lire_tournees expose l''annulation (auteur)', 'saisie sur le mauvais rayon',
                 pg_temp.essai('CA1', format($f$select dates_courtes_lire_tournees(%L, array['ANNULEE'])::text$f$, null)));
  r := pg_temp.n(r, '44 lire_tournees : un caissier ne voit pas la tournée d''un autre', '!'||'00000000-0000-4000-8000-0000000e0616',
                 pg_temp.essai('CA1', $f$select (select string_agg(id::text, ',') from dates_courtes_lire_tournees(null, array['ANNULEE']))$f$));
  r := pg_temp.n(r, '45 suivi : Annulée en dernier', '=ANNULEE',
                 pg_temp.essai('M1', $f$select (dates_courtes_suivi_controles(date '2026-11-22', date '2026-11-22')->'tournees'->-1->>'etat')$f$));
  r := pg_temp.n(r, '46 suivi : a_certifier_total ne compte pas les annulées',
                 '=' || (select count(*) from dates_courtes_tournees where site = st and etat = 'TERMINEE_A_CERTIFIER')::text,
                 pg_temp.essai('M1', $f$select (dates_courtes_suivi_controles(date '2026-11-22', date '2026-11-22')->>'a_certifier_total')$f$));
  r := pg_temp.n(r, '47 suivi : historique « annulee »', 'annulee',
                 pg_temp.essai('M1', format($f$select (dates_courtes_suivi_controles(null, null, %L)->'historique')::text$f$, base || '11')));
  r := pg_temp.n(r, '48 suivi : motif dans la tournée', 'saisie sur le mauvais rayon',
                 pg_temp.essai('M1', format($f$select (dates_courtes_suivi_controles(null, null, %L))::text$f$, base || '11')));

  -- 10 une tournée annulée est figée.
  r := pg_temp.n(r, '49 renommer une annulée refusé', 'tournee_annulee', pg_temp.essai('CA1', format($f$select dates_courtes_renommer_tournee(%L,'Nouveau nom','r6-rn1')::text$f$, base || '11')));

  -- 11 droits d'exécution.
  r := pg_temp.n(r, '50 anon sans droit d''exécution', '=false', pg_temp.val($f$select has_function_privilege('anon', 'dates_courtes_annuler_tournee(uuid,text,text)', 'execute')::text$f$));
  r := pg_temp.n(r, '51 authenticated avec droit', '=true', pg_temp.val($f$select has_function_privilege('authenticated', 'dates_courtes_annuler_tournee(uuid,text,text)', 'execute')::text$f$));

  raise exception 'RAPPORT_ANNUL_TOURNEE %', jsonb_build_object('total', jsonb_array_length(r),
    'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
