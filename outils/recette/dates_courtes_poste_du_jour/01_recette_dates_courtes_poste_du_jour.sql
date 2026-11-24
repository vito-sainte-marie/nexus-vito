-- Recette SQL « poste du jour » (Dates courtes : droit selon le poste pris ce jour-là).
-- Une transaction, rollback final ; le résultat sort dans l'exception RAPPORT_ACCUEIL_RENFORT.
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
  if to_regprocedure('public.dates_courtes_poste_du_jour()') is null then
    raise exception 'GARDE_RECETTE : migration 20261124140000_dates_courtes_poste_du_jour absente, arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'nexus-station-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'nexus-station-test');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0801', 'manager',  'nexus-station-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000e0802', 'gerant',   'nexus-station-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0803', 'caissier', 'nexus-station-test', false),
  ('RE1', '00000000-0000-4000-8000-0000000e0804', 'caissier', 'nexus-station-test', false),
  ('PO1', '00000000-0000-4000-8000-0000000e0805', 'pompiste', 'nexus-station-test', false),
  ('NS1', '00000000-0000-4000-8000-0000000e0806', 'caissier', 'nexus-station-test', false),
  ('SW1', '00000000-0000-4000-8000-0000000e0807', 'caissier', 'nexus-station-test', false),
  ('EN1', '00000000-0000-4000-8000-0000000e0808', 'pompiste', 'nexus-station-test', false),
  ('G2',  '00000000-0000-4000-8000-0000000e0809', 'gerant',   'nexus-station-test', false),
  ('OS1', '00000000-0000-4000-8000-0000000e080a', 'caissier', 'nexus-station-test', false);

insert into auth.users (id, aud, role, email) select v, 'authenticated', 'authenticated', 'recette-pdj-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  select v, 'recette-pdj-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

-- Services (shifts.role : caissiere sans « n » final, vocabulaire distinct de employees.role).
-- CA1 caissière ; RE1 renfort (poste préféré caissier) ; PO1 pompiste ; NS1 aucun service ;
-- SW1 a basculé en pompiste ; EN1 service terminé ; G1 et G2 gérants, G2 avec un service en renfort, G1 sans service.
insert into shifts (employee_id, site, site_id, role, statut, heure_fin, cloture_source, cloture_le)
  select v, 'nexus-station-test', 'nexus-station-test', x.sr, x.st, case when x.st = 'termine' then now() else null end,
         case when x.st = 'termine' then 'test' else null end, case when x.st = 'termine' then now() else null end
  from ids join (values ('CA1','caissiere','en_cours'), ('RE1','renfort','en_cours'), ('PO1','pompiste','en_cours'),
                        ('SW1','pompiste','en_cours'), ('EN1','pompiste','termine')) as x(k, sr, st) on x.k = ids.k;

-- OS1 : fiche de nexus-station-test, mais son seul service en_cours est posé sur une autre station, en renfort.
insert into sites (site_id, nom_entreprise, timezone) select 'recette-autre-station', 'Station de recette', 'America/Martinique' where not exists (select 1 from sites where site_id = 'recette-autre-station');
insert into shifts (employee_id, site, site_id, role, statut, heure_fin)
  select v, 'recette-autre-station', 'recette-autre-station', 'renfort', 'en_cours', null from ids where k = 'OS1';

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

do $rapport$
declare
  st constant text := 'nexus-station-test';
  r jsonb := '[]'::jsonb;
  m1 uuid; ca1 uuid; sw1 uuid; en1 uuid; po1 uuid; re1 uuid;
  base text := '00000000-0000-4000-8000-0000000e08';

begin
  select v into m1 from ids where k = 'M1'; select v into ca1 from ids where k = 'CA1';
  select v into sw1 from ids where k = 'SW1'; select v into en1 from ids where k = 'EN1';
  select v into po1 from ids where k = 'PO1'; select v into re1 from ids where k = 'RE1';

  -- Tournées EN_COURS : 1x par auteur pour les cas de terminer, 2x pour SW1/EN1 (terminer puis annuler).
  insert into dates_courtes_tournees (id, site, nom, cle_idempotence, saisi_par, saisi_le, etat, terminee_par, terminee_le, version_empreinte) values
    ((base || '11')::uuid, st, null, 'pdj-t1', sw1, '2026-11-24 14:00:00+00', 'EN_COURS', null, null, null),
    ((base || '12')::uuid, st, null, 'pdj-t2', sw1, '2026-11-24 14:01:00+00', 'EN_COURS', null, null, null),
    ((base || '13')::uuid, st, null, 'pdj-t3', en1, '2026-11-24 14:02:00+00', 'EN_COURS', null, null, null),
    ((base || '14')::uuid, st, null, 'pdj-t4', en1, '2026-11-24 14:03:00+00', 'EN_COURS', null, null, null),
    ((base || '15')::uuid, st, null, 'pdj-t5', ca1, '2026-11-24 14:04:00+00', 'EN_COURS', null, null, null),
    ((base || '16')::uuid, st, null, 'pdj-t6', po1, '2026-11-24 14:05:00+00', 'TERMINEE_A_CERTIFIER', po1, '2026-11-24 14:30:00+00', 'v6'),
    ((base || '17')::uuid, st, null, 'pdj-t7', re1, '2026-11-24 14:06:00+00', 'EN_COURS', null, null, null),
    ((base || '18')::uuid, st, null, 'pdj-t8', sw1, '2026-11-24 14:07:00+00', 'EN_COURS', null, null, null);

  -- 1 poste du jour lu
  r := pg_temp.n(r, '1 caissière : poste du jour', '=caissiere', pg_temp.essai('CA1', 'select dates_courtes_poste_du_jour()'));
  r := pg_temp.n(r, '2 renfort : poste du jour', '=renfort', pg_temp.essai('RE1', 'select dates_courtes_poste_du_jour()'));
  r := pg_temp.n(r, '3 pompiste : poste du jour', '=pompiste', pg_temp.essai('PO1', 'select dates_courtes_poste_du_jour()'));
  r := pg_temp.n(r, '4 sans service : aucun poste', '=', pg_temp.essai('NS1', 'select dates_courtes_poste_du_jour()'));
  r := pg_temp.n(r, '5 service terminé : aucun poste', '=', pg_temp.essai('EN1', 'select dates_courtes_poste_du_jour()'));

  -- 2 accès caissier fermé : seul le renfort (et la gestion) opère
  -- L'état testé est posé ici, jamais supposé : dernière ligne de la station = fermée (annulé en fin de recette).
  reset role;
  insert into dates_courtes_acces_caissier (site, actif, saisi_par) values (st, false, m1);
  r := pg_temp.n(r, '6 accès fermé', '=false', pg_temp.essai('CA1', 'select dates_courtes_acces_caissier_ouvert()::text'));
  r := pg_temp.n(r, '7 renfort opère accès fermé', '=true', pg_temp.essai('RE1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '8 caissière refusée accès fermé', '=false', pg_temp.essai('CA1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '9 pompiste refusé', '=false', pg_temp.essai('PO1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '10 sans service refusé', '=false', pg_temp.essai('NS1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '11 service terminé refusé', '=false', pg_temp.essai('EN1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '12 manager opère sans service', '=true', pg_temp.essai('M1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '13 gérant sans service opère', '=true', pg_temp.essai('G1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '14 gérant avec service renfort opère', '=true', pg_temp.essai('G2', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '15 gestion : manager', '=true', pg_temp.essai('M1', 'select dates_courtes_gestion()::text'));
  r := pg_temp.n(r, '16 gestion : gérant', '=true', pg_temp.essai('G1', 'select dates_courtes_gestion()::text'));
  r := pg_temp.n(r, '17 gestion : renfort non', '=false', pg_temp.essai('RE1', 'select dates_courtes_gestion()::text'));
  r := pg_temp.n(r, '18 gestion : caissière non', '=false', pg_temp.essai('CA1', 'select dates_courtes_gestion()::text'));

  -- 3 ouverture de l'accès par le geste réel de la gestion
  perform pg_temp.comme('M1');
  perform dates_courtes_regler_acces_caissier(true);
  reset role;
  r := pg_temp.n(r, '19 accès ouvert, vu par la caissière', '=true', pg_temp.essai('CA1', 'select dates_courtes_acces_caissier_ouvert()::text'));
  r := pg_temp.n(r, '20 caissière opère accès ouvert', '=true', pg_temp.essai('CA1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '21 caissière autorisée accès ouvert', '=true', pg_temp.essai('CA1', 'select dates_courtes_caissier_autorise()::text'));
  r := pg_temp.n(r, '22 pompiste toujours refusé accès ouvert', '=false', pg_temp.essai('PO1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '23 sans service toujours refusé', '=false', pg_temp.essai('NS1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '24 renfort non concerné par caissier_autorise', '=false', pg_temp.essai('RE1', 'select dates_courtes_caissier_autorise()::text'));
  r := pg_temp.n(r, '25 caissière lit le réglage d''accès', '=1', pg_temp.essai('CA1', 'select (count(*) > 0)::int::text from dates_courtes_acces_caissier'));
  r := pg_temp.n(r, '26 pompiste ne lit pas le réglage', '=0', pg_temp.essai('PO1', 'select count(*)::text from dates_courtes_acces_caissier'));

  -- 4 terminer / annuler sa propre tournée EN_COURS malgré un poste du jour sans droit
  r := pg_temp.n(r, '27 basculé en pompiste : terminer sa tournée', '"statut": "terminee"', pg_temp.essai('SW1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '11')));
  r := pg_temp.n(r, '28 basculé en pompiste : annuler sa tournée', '"statut": "annulee"', pg_temp.essai('SW1', format($f$select dates_courtes_annuler_tournee(%L,'bascule de poste','pdj-a1')::text$f$, base || '12')));
  r := pg_temp.n(r, '29 service terminé : terminer sa tournée', '"statut": "terminee"', pg_temp.essai('EN1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '13')));
  r := pg_temp.n(r, '30 service terminé : annuler sa tournée', '"statut": "annulee"', pg_temp.essai('EN1', format($f$select dates_courtes_annuler_tournee(%L,'service terminé','pdj-a2')::text$f$, base || '14')));
  r := pg_temp.n(r, '31 pompiste ne termine pas la tournée d''un autre', 'droit_refuse', pg_temp.essai('PO1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '15')));
  r := pg_temp.n(r, '32 pompiste n''annule pas la tournée d''un autre', 'droit_refuse', pg_temp.essai('PO1', format($f$select dates_courtes_annuler_tournee(%L,'pas la mienne','pdj-a3')::text$f$, base || '15')));
  r := pg_temp.n(r, '33 pompiste : sa tournée déjà terminée ne rouvre rien', 'droit_refuse', pg_temp.essai('PO1', format($f$select dates_courtes_annuler_tournee(%L,'trop tard','pdj-a4')::text$f$, base || '16')));
  r := pg_temp.n(r, '34 renfort ne termine pas la tournée d''un autre', 'tournee_interdite', pg_temp.essai('RE1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '18')));
  r := pg_temp.n(r, '35 renfort termine sa propre tournée', '"statut": "terminee"', pg_temp.essai('RE1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '17')));
  r := pg_temp.n(r, '36 sans service : tournée d''un autre refusée', 'droit_refuse', pg_temp.essai('NS1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, base || '18')));

  -- 5 octrois
  r := pg_temp.n(r, '37 anon sans EXECUTE sur le poste du jour', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.dates_courtes_poste_du_jour()', 'execute')::text$f$));
  r := pg_temp.n(r, '38 authenticated avec EXECUTE', '=true', pg_temp.val($f$select has_function_privilege('authenticated', 'public.dates_courtes_poste_du_jour()', 'execute')::text$f$));
  r := pg_temp.n(r, '39 anon sans EXECUTE sur operer', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.dates_courtes_operer()', 'execute')::text$f$));
  r := pg_temp.n(r, '40 anon sans EXECUTE sur terminer', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.dates_courtes_terminer_tournee(uuid)', 'execute')::text$f$));

  -- 6 service d'une autre station : refusé (le poste du jour se lit sur la station de la fiche)
  r := pg_temp.n(r, '41 service d''une autre station : aucun poste', '=', pg_temp.essai('OS1', 'select dates_courtes_poste_du_jour()'));
  r := pg_temp.n(r, '42 service d''une autre station : opérer refusé', '=false', pg_temp.essai('OS1', 'select dates_courtes_operer()::text'));
  r := pg_temp.n(r, '43 service d''une autre station : créer une tournée refusé', 'droit_refuse', pg_temp.essai('OS1', $f$select dates_courtes_creer_tournee('Tournée autre station','pdj-os1')::text$f$));

  -- 7 jamais NULL : un NULL ferait passer « if not (...) » sans lever le refus
  r := pg_temp.n(r, '44 sans service : operer et caissier_autorise non nuls', '=false', pg_temp.essai('NS1', 'select ((dates_courtes_operer() is null) or (dates_courtes_caissier_autorise() is null))::text'));
  r := pg_temp.n(r, '45 autre station : operer et caissier_autorise non nuls', '=false', pg_temp.essai('OS1', 'select ((dates_courtes_operer() is null) or (dates_courtes_caissier_autorise() is null))::text'));

  raise exception 'RAPPORT_ACCUEIL_RENFORT %', jsonb_build_object('total', jsonb_array_length(r),
    'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
