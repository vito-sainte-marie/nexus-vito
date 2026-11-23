-- Jeu de données pour les captures du lot 3 (Dates courtes, « Suivi des contrôles DLC »).
-- Cible : nexus-station-test UNIQUEMENT (garde de base ci-dessous). Jamais Production.
-- Données fictives : produits inventés, aucun prénom réel. Auteurs = comptes de test existants
--   manager-test (M1), employe-test-a (caissier), employe-test-b (pompiste).
-- Repérage : toutes les clés d'idempotence commencent par 'capt-lot3-' et tous les identifiants
--   des tournées sont 00000000-0000-4000-8000-0000000e04NN, ce que 03_nettoyage_captures.sql retire à l'identique.
-- Idempotent : si le jeu est déjà posé, le script n'écrit rien. Une seule transaction.
-- 14 tournées sur 7 jours : 2 à certifier (la plus riche en anomalies le jour même), 1 en cours,
--   1 correction demandée, 10 certifiées dont 5 renommées.
begin;

do $garde_captures$
declare v_id text; v_n integer;
begin
  select system_identifier::text into v_id from pg_control_system();
  if v_id is distinct from '7678069749886157684' then
    raise exception 'GARDE_CAPTURES : base inattendue (%), arrêt', v_id;
  end if;
  if to_regprocedure('public.dates_courtes_suivi_controles(date,date,uuid)') is null then
    raise exception 'GARDE_CAPTURES : migration 20261123140000_dates_courtes_lot3_suivi absente, arrêt';
  end if;
  select count(*) into v_n from employees
   where site_id = 'nexus-station-test' and compte_test and actif and username in ('manager-test', 'employe-test-a', 'employe-test-b');
  if v_n <> 3 then raise exception 'GARDE_CAPTURES : comptes de test attendus absents (% sur 3), arrêt', v_n; end if;
end
$garde_captures$;

-- Clé de contrôle EAN-13 : 12 chiffres en entrée, 13 en sortie.
create function pg_temp.ean13(p12 text) returns text language sql immutable as $$
  select p12 || ((10 - (sum((substr(p12, i, 1))::int * case when i % 2 = 0 then 3 else 1 end) % 10)) % 10)::text
  from generate_series(1, 12) i
$$;

do $jeu$
declare
  st constant text := 'nexus-station-test';
  tz constant text := 'America/Martinique';
  d date := (now() at time zone 'America/Martinique')::date;
  m1 uuid; ca uuid; po uuid;
  libs text[] := array['Yaourt nature 4x125 g', 'Lait demi-écrémé 1 L', 'Jus d''orange 1 L', 'Fromage râpé 200 g', 'Jambon blanc 4 tr.',
                       'Crème dessert vanille', 'Compote pomme 4x100 g', 'Beurre doux 250 g', 'Salade composée 250 g', 'Sandwich poulet',
                       'Pâtes fraîches 300 g', 'Houmous nature 200 g', 'Smoothie fruits rouges', 'Tarte aux pommes individuelle'];
  -- (n°, jours avant, heure locale, auteur, état, nom, produits, anomalies)
  -- auteur : m = manager-test, a = employe-test-a, p = employe-test-b
  spec text[][] := array[
    ['1',  '0', '', 'a', 'EN_COURS',             '',                          '3', ''],
    ['2',  '0', '', 'a', 'TERMINEE_A_CERTIFIER', '',                          '7', 'riche'],
    ['3',  '1', '16', 'p', 'TERMINEE_A_CERTIFIER', 'Rayon frais',               '5', ''],
    ['4',  '2', '9',  'a', 'CORRECTION_DEMANDEE', '',                          '4', 'texte'],
    ['5',  '2', '14', 'm', 'CERTIFIEE',           'Frigo boissons',            '6', ''],
    ['6',  '3', '8',  'p', 'CERTIFIEE',           '',                          '4', 'prov'],
    ['7',  '3', '15', 'a', 'CERTIFIEE',           '',                          '5', ''],
    ['8',  '4', '10', 'm', 'CERTIFIEE',           'Libre-service matin',       '6', ''],
    ['9',  '4', '17', 'p', 'CERTIFIEE',           '',                          '3', ''],
    ['10', '5', '9',  'a', 'CERTIFIEE',           '',                          '5', 'texte'],
    ['11', '5', '16', 'a', 'CERTIFIEE',           'Desserts',                  '4', ''],
    ['12', '6', '8',  'm', 'CERTIFIEE',           '',                          '6', ''],
    ['13', '6', '13', 'p', 'CERTIFIEE',           'Traiteur',                  '5', ''],
    ['14', '6', '18', 'a', 'CERTIFIEE',           '',                          '3', '']
  ];
  s integer; n integer; j integer; k integer; auteur uuid; tid uuid; rid uuid; seq integer := 0;
  t_saisi timestamptz; t_fin timestamptz; nb integer; an text; e text; v_nom text;
begin
  reset role;
  if exists (select 1 from dates_courtes_tournees where site = st and cle_idempotence like 'capt-lot3-%') then
    raise notice 'JEU_CAPTURES : déjà posé, rien écrit';
    return;
  end if;
  select id into m1 from employees where username = 'manager-test'   and site_id = st;
  select id into ca from employees where username = 'employe-test-a' and site_id = st;
  select id into po from employees where username = 'employe-test-b' and site_id = st;

  for s in 1 .. array_length(spec, 1) loop
    n := spec[s][1]::int; j := spec[s][2]::int; nb := spec[s][7]::int; an := spec[s][8]; v_nom := nullif(spec[s][6], '');
    auteur := case spec[s][4] when 'm' then m1 when 'p' then po else ca end;
    tid := ('00000000-0000-4000-8000-0000000e04' || lpad(n::text, 2, '0'))::uuid;
    t_saisi := case when j = 0 then greatest((d::timestamp + interval '5 minutes') at time zone tz, now() - (case n when 1 then interval '1 hour' else interval '3 hours' end))
               else ((d - j)::timestamp + make_interval(hours => spec[s][3]::int, mins => 10 + n)) at time zone tz end;
    t_fin := t_saisi + interval '25 minutes';

    insert into dates_courtes_tournees (id, site, nom, cle_idempotence, saisi_par, saisi_le, etat, terminee_par, terminee_le, version_empreinte)
      values (tid, st, null, 'capt-lot3-t' || n, auteur, t_saisi, 'EN_COURS', null, null, null);

    -- Les déclencheurs d'insertion relisent le compte connecté : on prend l'identité de l'auteur (même station), rôle conservé à postgres.
    perform set_config('request.jwt.claims', json_build_object('sub', auteur, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', auteur::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    for k in 1 .. nb loop
      seq := seq + 1; rid := ('00000000-0000-4000-8000-0000000e05' || lpad(seq::text, 2, '0'))::uuid;
      e := pg_temp.ean13('39990' || lpad(seq::text, 7, '0'));
      insert into dates_courtes_releves (id, site, ean, libelle_vu, libelle_normalise, nom_libre, date_limite, quantite, provisoire, cle_groupe,
                                         tournee_id, heure_geste, cle_idempotence, saisi_par, rectification)
      values (rid, st, e, libs[1 + (seq - 1) % array_length(libs, 1)], lower(libs[1 + (seq - 1) % array_length(libs, 1)]), null,
              (d - j) + 1 + (seq % 9), 1 + (seq * 3) % 7, false, 'capt-g' || seq,
              tid, t_saisi + (k * interval '2 minutes'), 'capt-lot3-r' || seq, auteur, false);
    end loop;

    -- Anomalies variées, posées sur les relevés déjà stockés (comme le ferait un import ou un geste tardif).
    if an in ('riche', 'texte', 'prov') then
      select id into rid from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 1 offset 0;
      if an in ('riche', 'texte') then
        update dates_courtes_releves set ean = null, libelle_vu = null, libelle_normalise = 'pâtisserie du jour', nom_libre = 'Pâtisserie du jour' where id = rid;
      end if;
      if an in ('riche', 'prov') then
        select id into rid from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 1 offset 1;
        update dates_courtes_releves set provisoire = true, ean = '13999000000' || '19' where id = rid;
      end if;
    end if;
    if an = 'riche' then
      select id into rid from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 1 offset 2;
      update dates_courtes_releves set ean = '399900001' where id = rid;                                   -- code incomplet (9 chiffres)
      select id into rid from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 1 offset 3;
      update dates_courtes_releves set rectification = true, recu_apres_cloture = true where id = rid;      -- modifiée après clôture
      select id into rid from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 1 offset 4;
      update dates_courtes_releves set annule_le = t_saisi + interval '12 minutes', annule_par = auteur, motif_annulation = 'saisie par erreur' where id = rid;
      insert into dates_courtes_corrections (site, ean, libelle_normalise, date_limite, delta, releve_id, cle_groupe, tournee_id, heure_geste, rectification, cle_idempotence, saisi_par)
        select st, r.ean, r.libelle_normalise, r.date_limite, 1, r.id, 'capt-gc' || n, tid, t_saisi + interval '20 minutes', false, 'capt-lot3-c' || n, auteur
        from dates_courtes_releves r where r.tournee_id = tid and r.rectification and r.annule_le is null limit 1;
      update dates_courtes_corrections set rectification = true where cle_idempotence = 'capt-lot3-c' || n;
    end if;

    -- Passage à l'état final.
    if spec[s][5] <> 'EN_COURS' then
      update dates_courtes_tournees set etat = spec[s][5], terminee_par = auteur, terminee_le = t_fin, version_empreinte = 'capt-v' || n where id = tid;
    end if;
    if spec[s][5] = 'CERTIFIEE' then
      insert into dates_courtes_certifications (site, tournee_id, certifiee_par, certifiee_le, version_certifiee, observations, cle_idempotence)
        values (st, tid, m1, t_fin + interval '40 minutes', 'capt-v' || n, case when n % 3 = 0 then 'Rien à signaler' else null end, 'capt-lot3-k' || n);
    end if;
    if spec[s][5] = 'CORRECTION_DEMANDEE' then
      insert into dates_courtes_demandes_correction (site, tournee_id, demandee_par, demandee_le, motif, releves_vises, cle_idempotence)
        values (st, tid, m1, t_fin + interval '3 hours', 'Dates à revérifier sur le rayon frais',
                (select array_agg(id) from (select id from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 2) x), 'capt-lot3-d' || n);
    end if;
    if v_nom is not null then
      update dates_courtes_tournees set nom = v_nom where id = tid;
      insert into dates_courtes_renommages_tournee (site, tournee_id, ancien_nom, nouveau_nom, renomme_par, renomme_le, cle_idempotence)
        values (st, tid, 'Contrôle DLC', v_nom, auteur, t_fin + interval '5 minutes', 'capt-lot3-n' || n);
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'JEU_CAPTURES : % tournées posées', array_length(spec, 1);
end
$jeu$;

select 'tournees' as table_, count(*) as lignes from dates_courtes_tournees where cle_idempotence like 'capt-lot3-%'
union all select 'releves', count(*) from dates_courtes_releves where cle_idempotence like 'capt-lot3-%'
union all select 'corrections', count(*) from dates_courtes_corrections where cle_idempotence like 'capt-lot3-%'
union all select 'certifications', count(*) from dates_courtes_certifications where cle_idempotence like 'capt-lot3-%'
union all select 'demandes', count(*) from dates_courtes_demandes_correction where cle_idempotence like 'capt-lot3-%'
union all select 'renommages', count(*) from dates_courtes_renommages_tournee where cle_idempotence like 'capt-lot3-%';

commit;
