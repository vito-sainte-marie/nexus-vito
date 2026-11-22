-- Recette SQL du Lot 2.1 "Dates courtes" : nom de tournée généré par le serveur et renommage.
-- Données fictives. Joue dans une transaction rollbackée. Sortie : une exception RAPPORT_DC21 <json>.
-- Ne pas jouer sur Production. Sur Test : seulement sur accord.
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
  if to_regprocedure('dates_courtes_renommer_tournee(uuid,text,text)') is null then
    raise exception 'GARDE_RECETTE : migration dates_courtes_lot2_1_nom_tournee absente, arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'site-fantome-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'site-fantome-test');
insert into sites (site_id) select 'nexus-station-test' where not exists (select 1 from sites where site_id = 'nexus-station-test');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0201', 'manager',  'site-fantome-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000e0202', 'gerant',   'site-fantome-test', false),
  ('RF1', '00000000-0000-4000-8000-0000000e0203', 'renfort',  'site-fantome-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0204', 'caissier', 'site-fantome-test', false),
  ('P1',  '00000000-0000-4000-8000-0000000e0205', 'pompiste', 'site-fantome-test', false),
  ('V1',  '00000000-0000-4000-8000-0000000e0206', 'vacataire','site-fantome-test', false),
  ('M2',  '00000000-0000-4000-8000-0000000e0207', 'manager',  'nexus-station-test', false);
insert into auth.users (id, aud, role, email)
select v, 'authenticated', 'authenticated', 'recette-dc21-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-dc21-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

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
  r jsonb := '[]'::jsonb; res jsonb; res2 jsonb; t1 uuid; t2 uuid; t3 uuid; t_old uuid; x text;
  avant record; apres record; jour text;
begin
  -- Prénoms fictifs : RF1 se nomme R1 et M1 se nomme M1 dans l'annuaire du banc.
  update employees set nom = 'R1' where id = (select v from ids where k = 'RF1');
  update employees set nom = 'M1' where id = (select v from ids where k = 'M1');
  jour := to_char(now() at time zone 'America/Martinique', 'DD/MM');

  -- 1 nom généré à la création
  perform pg_temp.comme('RF1');
  res := dates_courtes_creer_tournee(null, 'dc21-a'); t1 := (res->>'tournee_id')::uuid;
  r := pg_temp.n(r, '1 création sans nom : statut', '=cree', res->>'statut');
  r := pg_temp.n(r, '1 nom généré : préfixe, prénom, date du jour du site', '=Contrôle DLC · R1 · ' || jour, res->>'nom');
  r := pg_temp.n(r, '1 heure de début lisible', ' h ', res->>'commencee_a');

  -- 1b 23:30 heure du site (03:30 UTC le lendemain) : la date reste celle du site
  reset role;
  update dates_courtes_tournees set saisi_le = '2026-11-23 03:30:00+00' where id = t1;
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '1b nom généré à 23:30 heure du site : 22/11, jamais la date UTC', '=Contrôle DLC · R1 · 22/11', dates_courtes_nom_genere('site-fantome-test', (select v from ids where k = 'RF1'), '2026-11-23 03:30:00+00'));
  r := pg_temp.n(r, '1b heure affichée dans le fuseau du site', '=23 h 30', (select commencee_a from dates_courtes_lire_tournees(t1)));
  reset role;
  update dates_courtes_tournees set saisi_le = now() where id = t1;

  -- 1c nom d'espaces : même résultat qu'un nom absent ; 1d nom libre conservé
  perform pg_temp.comme('RF1');
  res2 := dates_courtes_creer_tournee('   ', 'dc21-b'); t2 := (res2->>'tournee_id')::uuid;
  r := pg_temp.n(r, '1c nom d''espaces : nom généré', '=Contrôle DLC · R1 · ' || jour, res2->>'nom');
  res := dates_courtes_creer_tournee('Frais R1', 'dc21-c'); t3 := (res->>'tournee_id')::uuid;
  r := pg_temp.n(r, '1d nom libre conservé', '=Frais R1', res->>'nom');

  -- 2 deux tournées le même jour : deux identifiants, même nom, aucune fusion
  r := pg_temp.n(r, '2 deux tournées distinctes', '=2', (select count(distinct t)::text from (values (t1),(t2)) v(t)));
  reset role;
  r := pg_temp.n(r, '2 même nom possible', '=ok', case when (select nom from dates_courtes_tournees where id = t1) is not distinct from (select nom from dates_courtes_tournees where id = t2) then 'ok' else 'ko' end);
  r := pg_temp.n(r, '2 rejeu de la clé : même tournée', '=deja_enregistre', pg_temp.essai('RF1', $f$select dates_courtes_creer_tournee(null, 'dc21-a')->>'statut'$f$));
  r := pg_temp.n(r, '2 rejeu : une seule ligne pour la clé', '=1', pg_temp.val($f$select count(*)::text from dates_courtes_tournees where cle_idempotence = 'dc21-a'$f$));

  -- 3 renommage par l'auteur
  select saisi_par, saisi_le, terminee_par, terminee_le, id, etat into avant from dates_courtes_tournees where id = t1;
  perform pg_temp.comme('RF1');
  res := dates_courtes_renommer_tournee(t1, '  Frais   rayon  nord ', 'dc21-r1');
  r := pg_temp.n(r, '3 renommage par l''auteur', '=renomme', res->>'statut');
  reset role;
  r := pg_temp.n(r, '3 nom nettoyé', '=Frais rayon nord', (select nom from dates_courtes_tournees where id = t1));
  select saisi_par, saisi_le, terminee_par, terminee_le, id, etat into apres from dates_courtes_tournees where id = t1;
  r := pg_temp.n(r, '3 saisi_par, saisi_le, id, terminee_*, état inchangés', '=ok', case when avant is not distinct from apres then 'ok' else 'ko' end);
  r := pg_temp.n(r, '3 trace écrite : une ligne', '=1', (select count(*)::text from dates_courtes_renommages_tournee where tournee_id = t1));
  r := pg_temp.n(r, '3 trace : ancien et nouveau nom', '=Contrôle DLC · R1 · ' || jour || '>Frais rayon nord', (select ancien_nom || '>' || nouveau_nom from dates_courtes_renommages_tournee where tournee_id = t1));
  r := pg_temp.n(r, '3 trace : auteur du geste', '=ok', case when (select renomme_par from dates_courtes_renommages_tournee where tournee_id = t1) = (select v from ids where k = 'RF1') then 'ok' else 'ko' end);

  -- 4 idempotence
  r := pg_temp.n(r, '4 rejeu du renommage', '=deja_enregistre', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Frais rayon nord', 'dc21-r1')->>'statut'$f$, t1)));
  r := pg_temp.n(r, '4 rejeu : toujours une seule trace', '=1', pg_temp.val(format($f$select count(*)::text from dates_courtes_renommages_tournee where tournee_id = %L$f$, t1)));
  r := pg_temp.n(r, '4 même clé sur une autre tournée refusée', 'cle_deja_utilisee', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Autre', 'dc21-r1')::text$f$, t2)));
  r := pg_temp.n(r, '4 nom identique : inchange', '=inchange', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Frais rayon nord', 'dc21-r2')->>'statut'$f$, t1)));
  r := pg_temp.n(r, '4 inchange : pas de trace de plus', '=1', pg_temp.val(format($f$select count(*)::text from dates_courtes_renommages_tournee where tournee_id = %L$f$, t1)));

  -- 5 validation du nom
  r := pg_temp.n(r, '5 nom vide refusé', 'valeur_invalide', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, '   ', 'dc21-r3')::text$f$, t1)));
  r := pg_temp.n(r, '5 nom de 61 caractères refusé', 'valeur_invalide', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, repeat('a', 61), 'dc21-r4')::text$f$, t1)));
  r := pg_temp.n(r, '5 nom de 60 caractères accepté', '=renomme', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, repeat('a', 60), 'dc21-r5')->>'statut'$f$, t1)));
  r := pg_temp.n(r, '5 clé absente refusée', 'cle_idempotence_requise', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Ok', '')::text$f$, t1)));

  -- 6 droits
  r := pg_temp.n(r, '6 autre employé refusé', 'droit_refuse', pg_temp.essai('CA1', format($f$select dates_courtes_renommer_tournee(%L, 'Pirate', 'dc21-r6')::text$f$, t1)));
  r := pg_temp.n(r, '6 pompiste refusé', 'ERR', pg_temp.essai('P1', format($f$select dates_courtes_renommer_tournee(%L, 'Pirate', 'dc21-r7')::text$f$, t1)));
  r := pg_temp.n(r, '6 vacataire refusé', 'ERR', pg_temp.essai('V1', format($f$select dates_courtes_renommer_tournee(%L, 'Pirate', 'dc21-r8')::text$f$, t1)));
  r := pg_temp.n(r, '6 manager du même site accepté', '=renomme', pg_temp.essai('M1', format($f$select dates_courtes_renommer_tournee(%L, 'Revu par la gestion', 'dc21-r9')->>'statut'$f$, t1)));
  r := pg_temp.n(r, '6 gérant du même site accepté', '=renomme', pg_temp.essai('G1', format($f$select dates_courtes_renommer_tournee(%L, 'Revu par le gérant', 'dc21-r10')->>'statut'$f$, t1)));
  r := pg_temp.n(r, '6 manager d''une autre station refusé', 'tournee_introuvable', pg_temp.essai('M2', format($f$select dates_courtes_renommer_tournee(%L, 'Pirate', 'dc21-r11')::text$f$, t1)));
  reset role;
  r := pg_temp.n(r, '6 refus : nom inchangé par les refus', '=Revu par le gérant', (select nom from dates_courtes_tournees where id = t1));
  r := pg_temp.n(r, '6 gestion : saisi_par reste celui de l''auteur', '=ok', case when (select saisi_par from dates_courtes_tournees where id = t1) = (select v from ids where k = 'RF1') then 'ok' else 'ko' end);
  r := pg_temp.n(r, '6 trace : le gestionnaire est nommé renommeur', '=ok', case when exists (select 1 from dates_courtes_renommages_tournee where tournee_id = t1 and renomme_par = (select v from ids where k = 'M1')) then 'ok' else 'ko' end);
  begin
    set local role anon; perform dates_courtes_renommer_tournee(t1, 'Anon', 'dc21-r12'); x := 'ACCEPTE';
  exception when others then x := 'refus ' || sqlerrm; end;
  reset role;
  r := pg_temp.n(r, '6 anon ne renomme pas', 'refus', x);
  begin
    set local role anon; perform dates_courtes_creer_tournee(null, 'dc21-anon'); x := 'ACCEPTE';
  exception when others then x := 'refus ' || sqlerrm; end;
  reset role;
  r := pg_temp.n(r, '6 anon ne crée pas', 'refus', x);

  -- 7 tournée certifiée : renommage refusé, même pour la gestion
  update dates_courtes_tournees set etat = 'CERTIFIEE', terminee_par = (select v from ids where k = 'M1'), terminee_le = now(), version_empreinte = 'e1' where id = t2;
  r := pg_temp.n(r, '7 certifiée : refus à l''auteur', 'tournee_certifiee', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Tard', 'dc21-r13')::text$f$, t2)));
  r := pg_temp.n(r, '7 certifiée : refus à la gestion', 'tournee_certifiee', pg_temp.essai('M1', format($f$select dates_courtes_renommer_tournee(%L, 'Tard', 'dc21-r14')::text$f$, t2)));
  r := pg_temp.n(r, '7 certifiée : aucune trace', '=0', pg_temp.val(format($f$select count(*)::text from dates_courtes_renommages_tournee where tournee_id = %L$f$, t2)));

  -- 8 trace immuable et cloisonnée
  begin update dates_courtes_renommages_tournee set nouveau_nom = 'x'; x := 'ACCEPTE';
  exception when others then x := sqlerrm; end;
  r := pg_temp.n(r, '8 trace non modifiable', 'trace_immuable', x);
  begin delete from dates_courtes_renommages_tournee; x := 'ACCEPTE';
  exception when others then x := sqlerrm; end;
  r := pg_temp.n(r, '8 trace non supprimable', 'trace_immuable', x);
  r := pg_temp.n(r, '8 trace lisible par la gestion du site', '=4', pg_temp.essai('M1', 'select count(*)::text from dates_courtes_renommages_tournee'));
  r := pg_temp.n(r, '8 trace invisible pour un autre employé', '=0', pg_temp.essai('CA1', 'select count(*)::text from dates_courtes_renommages_tournee'));
  r := pg_temp.n(r, '8 trace invisible depuis une autre station', '=0', pg_temp.essai('M2', 'select count(*)::text from dates_courtes_renommages_tournee'));

  -- 9 anciennes tournées sans nom : repli à la lecture, ligne non réécrite
  insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_par, saisi_le)
  values ('site-fantome-test', null, 'dc21-old', (select v from ids where k = 'RF1'), '2026-11-10 15:05:00+00') returning id into t_old;
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '9 repli : nom calculé à la lecture', '=Contrôle DLC · R1 · 10/11', (select nom from dates_courtes_lire_tournees(t_old)));
  r := pg_temp.n(r, '9 repli : nom non personnalisé', '=false', (select nom_personnalise::text from dates_courtes_lire_tournees(t_old)));
  r := pg_temp.n(r, '9 repli : heure de début 11 h 05 heure du site', '=11 h 05', (select commencee_a from dates_courtes_lire_tournees(t_old)));
  reset role;
  r := pg_temp.n(r, '9 repli : la ligne n''a pas été réécrite', '=ok', case when (select nom from dates_courtes_tournees where id = t_old) is null then 'ok' else 'ko' end);
  r := pg_temp.n(r, '9 renommer une ancienne tournée', '=renomme', pg_temp.essai('RF1', format($f$select dates_courtes_renommer_tournee(%L, 'Contrôle du soir', 'dc21-r15')->>'statut'$f$, t_old)));
  r := pg_temp.n(r, '9 trace : ancien nom = repli', '=Contrôle DLC · R1 · 10/11', pg_temp.val(format($f$select ancien_nom from dates_courtes_renommages_tournee where tournee_id = %L$f$, t_old)));

  -- 10 lecture cloisonnée
  r := pg_temp.n(r, '10 auteur : voit ses tournées', '=4', pg_temp.essai('RF1', 'select count(*)::text from dates_courtes_lire_tournees()'));
  r := pg_temp.n(r, '10 caissier non autorisé : lecture refusée', 'droit_refuse', pg_temp.essai('CA1', 'select count(*)::text from dates_courtes_lire_tournees()'));
  r := pg_temp.n(r, '10 autre station : aucune donnée', '=0', pg_temp.essai('M2', format($f$select count(*)::text from dates_courtes_lire_tournees(%L)$f$, t1)));
  r := pg_temp.n(r, '10 gestion : lit la tournée demandée', '=1', pg_temp.essai('M1', format($f$select count(*)::text from dates_courtes_lire_tournees(%L)$f$, t1)));
  r := pg_temp.n(r, '10 nom généré : aucun prénom d''une autre station', '=Contrôle DLC · équipe · ' || jour, pg_temp.essai('M2', format($f$select dates_courtes_nom_genere('site-fantome-test', %L::uuid, now())$f$, (select v from ids where k = 'RF1'))));

  reset role;
  raise exception 'RAPPORT_DC21 %', jsonb_build_object('total', jsonb_array_length(r), 'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
