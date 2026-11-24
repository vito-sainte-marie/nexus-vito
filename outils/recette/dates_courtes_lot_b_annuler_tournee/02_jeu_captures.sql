-- Jeu de données pour les captures du lot B (Dates courtes, « Annuler une tournée »).
-- Cible : nexus-station-test UNIQUEMENT (garde de base ci-dessous). Jamais Production.
-- Prérequis : migration 20261124100000_dates_courtes_lot_b_annuler_tournee appliquée.
-- Données fictives : produits inventés, aucun prénom réel. Auteurs = comptes de test existants
--   manager-test (m), employe-test-a (a), employe-test-b (p).
-- Repérage : clés d'idempotence 'capt-lotb-%', tournées 00000000-0000-4000-8000-0000000e08NN,
--   relevés ...e09NN ; 03_nettoyage_captures.sql retire tout à l'identique.
-- Idempotent : si le jeu est déjà posé, le script n'écrit rien. Une seule transaction.
-- 7 tournées sur 3 jours : 1 en cours, 1 à certifier, 1 annulée par son auteur (en cours),
--   1 annulée par le manager (après clôture), 2 certifiées, 1 correction demandée.
begin;

do $garde_captures$
declare v_id text; v_n integer;
begin
  select system_identifier::text into v_id from pg_control_system();
  if v_id is distinct from '7678069749886157684' then
    raise exception 'GARDE_CAPTURES : base inattendue (%), arrêt', v_id;
  end if;
  if to_regprocedure('public.dates_courtes_annuler_tournee(uuid,text,text)') is null then
    raise exception 'GARDE_CAPTURES : migration 20261124100000_dates_courtes_lot_b_annuler_tournee absente, arrêt';
  end if;
  select count(*) into v_n from employees
   where site_id = 'nexus-station-test' and compte_test and actif and username in ('manager-test', 'employe-test-a', 'employe-test-b');
  if v_n <> 3 then raise exception 'GARDE_CAPTURES : comptes de test attendus absents (% sur 3), arrêt', v_n; end if;
end
$garde_captures$;

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
                       'Crème dessert vanille', 'Compote pomme 4x100 g', 'Beurre doux 250 g', 'Salade composée 250 g', 'Sandwich poulet'];
  -- (n°, jours avant, heure locale, auteur, état, nom, produits, motif d'annulation, annulée par)
  spec text[][] := array[
    ['1', '0', '',   'a', 'EN_COURS',             '',                    '3', '', ''],
    ['2', '0', '',   'a', 'TERMINEE_A_CERTIFIER', '',                    '5', '', ''],
    ['3', '0', '',   'a', 'ANNULEE',              '',                    '4', 'Saisie sur le mauvais rayon', 'a'],
    ['4', '1', '16', 'p', 'ANNULEE',              'Rayon frais',         '5', 'Doublon avec le contrôle du matin', 'm'],
    ['5', '1', '9',  'm', 'CERTIFIEE',            'Frigo boissons',      '6', '', ''],
    ['6', '2', '14', 'a', 'CERTIFIEE',            '',                    '4', '', ''],
    ['7', '2', '9',  'p', 'CORRECTION_DEMANDEE',  '',                    '4', '', '']
  ];
  s integer; n integer; j integer; k integer; auteur uuid; qui uuid; tid uuid; rid uuid; seq integer := 0;
  t_saisi timestamptz; t_fin timestamptz; nb integer; v_nom text; v_etat text; v_motif text;
begin
  reset role;
  if exists (select 1 from dates_courtes_tournees where site = st and cle_idempotence like 'capt-lotb-%') then
    raise notice 'JEU_CAPTURES : déjà posé, rien écrit';
    return;
  end if;
  select id into m1 from employees where username = 'manager-test'   and site_id = st;
  select id into ca from employees where username = 'employe-test-a' and site_id = st;
  select id into po from employees where username = 'employe-test-b' and site_id = st;

  -- Accès caissier : fermé par défaut sur la station ; on l'ouvre par le geste de gestion réel (identité du manager).
  perform set_config('request.jwt.claims', json_build_object('sub', m1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', m1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform dates_courtes_regler_acces_caissier(true);

  for s in 1 .. array_length(spec, 1) loop
    n := spec[s][1]::int; j := spec[s][2]::int; nb := spec[s][7]::int; v_nom := nullif(spec[s][6], ''); v_etat := spec[s][5]; v_motif := nullif(spec[s][8], '');
    auteur := case spec[s][4] when 'm' then m1 when 'p' then po else ca end;
    qui := case spec[s][9] when 'm' then m1 when 'a' then ca else null end;
    tid := ('00000000-0000-4000-8000-0000000e08' || lpad(n::text, 2, '0'))::uuid;
    t_saisi := case when j = 0 then greatest((d::timestamp + interval '5 minutes') at time zone tz, now() - (case n when 1 then interval '1 hour' when 3 then interval '2 hours' else interval '3 hours' end))
               else ((d - j)::timestamp + make_interval(hours => spec[s][3]::int, mins => 10 + n)) at time zone tz end;
    t_fin := t_saisi + interval '25 minutes';

    insert into dates_courtes_tournees (id, site, nom, cle_idempotence, saisi_par, saisi_le, etat, terminee_par, terminee_le, version_empreinte)
      values (tid, st, null, 'capt-lotb-t' || n, auteur, t_saisi, 'EN_COURS', null, null, null);

    perform set_config('request.jwt.claims', json_build_object('sub', auteur, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', auteur::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    for k in 1 .. nb loop
      seq := seq + 1; rid := ('00000000-0000-4000-8000-0000000e09' || lpad(seq::text, 2, '0'))::uuid;
      insert into dates_courtes_releves (id, site, ean, libelle_vu, libelle_normalise, nom_libre, date_limite, quantite, provisoire, cle_groupe,
                                         tournee_id, heure_geste, cle_idempotence, saisi_par, rectification)
      values (rid, st, pg_temp.ean13('39991' || lpad(seq::text, 7, '0')), libs[1 + (seq - 1) % array_length(libs, 1)],
              lower(libs[1 + (seq - 1) % array_length(libs, 1)]), null, (d - j) + 1 + (seq % 9), 1 + (seq * 3) % 7, false, 'capt-lotb-g' || seq,
              tid, t_saisi + (k * interval '2 minutes'), 'capt-lotb-r' || seq, auteur, false);
    end loop;

    -- Clôture préalable (sauf tournée annulée en cours).
    if v_etat in ('TERMINEE_A_CERTIFIER', 'CERTIFIEE', 'CORRECTION_DEMANDEE') or (v_etat = 'ANNULEE' and qui = m1) then
      update dates_courtes_tournees set etat = case when v_etat = 'ANNULEE' then 'TERMINEE_A_CERTIFIER' else v_etat end,
             terminee_par = auteur, terminee_le = t_fin, version_empreinte = 'capt-lotb-v' || n where id = tid;
    end if;
    if v_etat = 'CERTIFIEE' then
      insert into dates_courtes_certifications (site, tournee_id, certifiee_par, certifiee_le, version_certifiee, observations, cle_idempotence)
        values (st, tid, m1, t_fin + interval '40 minutes', 'capt-lotb-v' || n, null, 'capt-lotb-k' || n);
    end if;
    if v_etat = 'CORRECTION_DEMANDEE' then
      insert into dates_courtes_demandes_correction (site, tournee_id, demandee_par, demandee_le, motif, releves_vises, cle_idempotence)
        values (st, tid, m1, t_fin + interval '3 hours', 'Dates à revérifier sur le rayon frais',
                (select array_agg(id) from (select id from dates_courtes_releves where tournee_id = tid order by saisi_le, id limit 2) x), 'capt-lotb-d' || n);
    end if;
    if v_nom is not null then
      update dates_courtes_tournees set nom = v_nom where id = tid;
      insert into dates_courtes_renommages_tournee (site, tournee_id, ancien_nom, nouveau_nom, renomme_par, renomme_le, cle_idempotence)
        values (st, tid, 'Contrôle DLC', v_nom, auteur, t_fin + interval '5 minutes', 'capt-lotb-n' || n);
    end if;

    -- Annulation : ce que ferait dates_courtes_annuler_tournee, posé directement (les relevés gardent leur ligne).
    if v_etat = 'ANNULEE' then
      update dates_courtes_releves set annule_le = t_fin + interval '10 minutes', annule_par = qui,
             motif_annulation = 'Tournée annulée : ' || v_motif where tournee_id = tid and annule_le is null;
      update dates_courtes_tournees set etat = 'ANNULEE', annulee_le = t_fin + interval '10 minutes', annulee_par = qui, motif_annulation = v_motif where id = tid;
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'JEU_CAPTURES : % tournées posées', array_length(spec, 1);
end
$jeu$;

select 'tournees' as table_, count(*) as lignes from dates_courtes_tournees where cle_idempotence like 'capt-lotb-%'
union all select 'annulees', count(*) from dates_courtes_tournees where cle_idempotence like 'capt-lotb-%' and etat = 'ANNULEE'
union all select 'releves', count(*) from dates_courtes_releves where cle_idempotence like 'capt-lotb-%'
union all select 'releves_annules', count(*) from dates_courtes_releves where cle_idempotence like 'capt-lotb-%' and annule_le is not null;

commit;
