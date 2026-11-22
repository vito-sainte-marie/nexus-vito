-- Recette SQL du Lot 5 "Dates courtes" : Prévention des pertes (lecture serveur).
-- Données fictives (jeu de la proposition validée). Instant fixe : 22/11/2026 12:00 heure Martinique.
-- Joue dans une transaction rollbackée. Sortie : une exception RAPPORT_DC5 <json> (OK ou KO par cas).
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
  if to_regprocedure('dates_courtes_prevention_pertes(timestamptz)') is null then
    raise exception 'GARDE_RECETTE : migration dates_courtes_lot5 absente, arrêt';
  end if;
end
$garde_recette$;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public;
grant usage on sequence journal_n_seq to public;

insert into sites (site_id) select 'site-fantome-test' where not exists (select 1 from sites where site_id = 'site-fantome-test');
insert into sites (site_id) select 'nexus-station-test' where not exists (select 1 from sites where site_id = 'nexus-station-test');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0501', 'manager',  'site-fantome-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000e0502', 'gerant',   'site-fantome-test', false),
  ('RF1', '00000000-0000-4000-8000-0000000e0503', 'renfort',  'site-fantome-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0504', 'caissier', 'site-fantome-test', false),
  ('P1',  '00000000-0000-4000-8000-0000000e0505', 'pompiste', 'site-fantome-test', false),
  ('V1',  '00000000-0000-4000-8000-0000000e0506', 'vacataire','site-fantome-test', false),
  ('M2',  '00000000-0000-4000-8000-0000000e0507', 'manager',  'nexus-station-test', false);
insert into auth.users (id, aud, role, email)
select v, 'authenticated', 'authenticated', 'recette-dc5-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-dc5-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

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
-- Lecture de Prévention des pertes comme un compte : jsonb ou erreur.
create function pg_temp.lire(k text, ins timestamptz default '2026-11-22 16:00:00+00') returns jsonb language plpgsql as $$
begin
  perform pg_temp.comme(k);
  return dates_courtes_prevention_pertes(ins);
exception when others then
  reset role; return jsonb_build_object('erreur', sqlerrm);
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

-- Jeu de données fictif (site-fantome-test). Écrit en superutilisateur sous l'identité de M1 (les déclencheurs lisent auth.uid()).
create function pg_temp.jeu() returns void language plpgsql as $$
declare
  m uuid := '00000000-0000-4000-8000-0000000e0501';
  s text := 'site-fantome-test';
  inst timestamptz := '2026-11-22 16:00:00+00';
  t_c uuid; t_r1 uuid; t_m1 uuid; t_g uuid; a uuid; l record; rid uuid; did uuid;
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', m::text, true);
  insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_par, etat) values
    (s, 'Certifiée', 'dc5-tc', m, 'EN_COURS') returning id into t_c;
  insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_par, etat) values
    (s, 'Frais rayon laitier R1', 'dc5-tr1', '00000000-0000-4000-8000-0000000e0503', 'EN_COURS') returning id into t_r1;
  insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_par, etat) values
    (s, 'Charcuterie M1', 'dc5-tm1', m, 'EN_COURS') returning id into t_m1;
  insert into dates_courtes_tournees (site, nom, cle_idempotence, saisi_par, etat) values
    (s, 'Charcuterie G1', 'dc5-tg', '00000000-0000-4000-8000-0000000e0502', 'EN_COURS') returning id into t_g;
  for l in select * from (values
    ('Yaourt nature x4', '2026-11-20'::date, 6, 1, 'r1', '3000000000014'),
    ('Salade composée', '2026-11-23', 8, 0, 'c', null),
    ('Jus d''orange 1 L', '2026-11-26', 12, 2, 'c', '3000000000021'),
    ('Sandwich thon', '2026-11-22', 3, 0, 'r1', null),
    ('Lait demi-écrémé 1 L', '2026-11-21', 4, 10, 'c', null),
    ('Biscuits chocolat', '2026-12-05', 20, 11, 'c', null),
    ('Compote pomme x4', '2026-12-10', 9, 18, 'c', null),
    ('Jambon blanc x4', '2026-12-04', 5, 2, 'r1', null),
    ('Jambon blanc x4', '2026-12-04', 6, 1, 'm1', null),
    ('Jambon blanc x4', '2026-12-04', 4, 3, 'g', null),
    ('Eau gazeuse 1,5 L', '2027-01-15', 24, 3, 'c', null)) v(nom, dl, q, age, t, ean) loop
    a := case l.t when 'r1' then '00000000-0000-4000-8000-0000000e0503'::uuid when 'g' then '00000000-0000-4000-8000-0000000e0502'::uuid else m end;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    insert into dates_courtes_releves (site, ean, libelle_vu, libelle_normalise, date_limite, quantite, cle_groupe, tournee_id, heure_geste, cle_idempotence, saisi_par)
    values (s, l.ean, l.nom, dates_courtes_normaliser_libelle(l.nom), l.dl, l.q, dates_courtes_normaliser_libelle(l.nom) || l.dl::text,
            case l.t when 'c' then t_c when 'r1' then t_r1 when 'g' then t_g else t_m1 end, inst - make_interval(days => l.age), 'dc5-r-' || l.nom || l.age,
            a);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', m::text, true);
  -- Statuts : les tournées sont terminées après la saisie (contrainte : terminée = les 3 champs renseignés).
  update dates_courtes_tournees set etat = 'CERTIFIEE', terminee_par = m, terminee_le = inst - interval '1 day', version_empreinte = 'e1' where id = t_c;
  update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = m, terminee_le = inst - interval '1 day', version_empreinte = 'e2' where id in (t_r1, t_m1);
  -- Prix de référence (products) : tous sauf le sandwich.
  insert into products (site, periode_debut, periode_fin, article, prix_achat, prix_vente, code_barres, categorie) values
    (s, '2026-10-01', '2026-11-20', 'Yaourt nature x4', 1.80, 2.60, '3000000000014', 'Produits laitiers'),
    (s, '2026-10-01', '2026-11-20', 'Salade composée', 2.40, 3.90, '3000000000038', 'Traiteur'),
    (s, '2026-10-01', '2026-11-20', 'Jus d''orange 1 L', 1.10, 1.80, '3000000000021', null),
    (s, '2026-10-01', '2026-11-20', 'Lait demi-écrémé 1 L', 1.05, 1.60, null, null),
    (s, '2026-10-01', '2026-11-20', 'Biscuits chocolat', 0.95, 1.70, null, null),
    (s, '2026-10-01', '2026-11-20', 'Compote pomme x4', 1.30, 2.10, null, null),
    (s, '2026-10-01', '2026-11-20', 'Jambon blanc x4', 2.90, 4.60, null, null),
    (s, '2026-10-01', '2026-11-20', 'Eau gazeuse 1,5 L', 0.45, 0.90, null, null),
    (s, '2026-10-01', '2026-11-20', 'Yaourt fruits x4', 1.75, 2.70, null, null),
    (s, '2026-10-01', '2026-11-20', 'Jus de pomme 1 L', 1.00, 1.65, null, null);
  -- Cohérence HT : l'inventaire donne les mêmes prix d'achat (écarts nuls ou inférieurs à 1,5 %).
  insert into inventaire_ventes_import (site, designation_brute, prix_achat_ht, prix_vente_ht, importe_le) values
    (s, 'Yaourt nature x4', 1.80, 2.60, inst - interval '5 days'),
    (s, 'Salade composée', 2.40, 3.90, inst - interval '5 days'),
    (s, 'Jus d''orange 1 L', 1.10, 1.80, inst - interval '5 days'),
    (s, 'Lait demi-écrémé 1 L', 1.06, 1.60, inst - interval '5 days'),
    (s, 'Jambon blanc x4', 2.90, 4.60, inst - interval '5 days');
  -- Démarques du mois : trois retraits, trois démarques.
  for l in select * from (values ('Yaourt fruits x4', 10, 'fige'), ('Jus de pomme 1 L', 12, 'reconstitue'), ('Salade composée', 8, 'absent')) v(nom, q, mode) loop
    insert into dates_courtes_retraits (site, libelle_normalise, date_limite, quantite, etat, trouve, cle_groupe, tournee_id, heure_geste, cle_idempotence, saisi_par)
    values (s, dates_courtes_normaliser_libelle(l.nom), '2026-11-15', l.q, 'retire_physique', true, 'g-' || l.nom, t_c, inst - interval '3 days', 'dc5-rt-' || l.nom, m)
    returning id into rid;
    insert into dates_courtes_demarques (site, retrait_id, tournee_id, quantite, heure_geste, cle_idempotence, saisi_par)
    values (s, rid, t_c, l.q, inst - interval '3 days', 'dc5-dm-' || l.nom, m) returning id into did;
    if l.mode = 'reconstitue' then
      delete from dates_courtes_prix_demarques where demarque_id = did;
    elsif l.mode = 'absent' then
      delete from dates_courtes_prix_demarques where demarque_id = did;
      insert into dates_courtes_prix_demarques (demarque_id, site, source) values (did, s, 'absent');
    end if;
  end loop;
  -- Une démarque rouvre la tournée : on certifie de nouveau après les gestes.
  update dates_courtes_tournees set etat = 'CERTIFIEE', terminee_par = m, terminee_le = inst - interval '1 day', version_empreinte = 'e1' where id = t_c;
end $$;

select pg_temp.jeu();

do $rapport$
declare
  r jsonb := '[]'::jsonb; g jsonb; x jsonb; k text; v jsonb;
begin
  g := pg_temp.lire('M1');
  r := pg_temp.n(r, '0 lecture gestion sans erreur', '=ok', case when g ? 'erreur' then g->>'erreur' else 'ok' end);
  -- 1 ancienneté et états
  r := pg_temp.n(r, '1 age L5 (10 j, périmé) = vérifier la présence', 'présence', (select (e->>'action') || '/' || (e->>'etat_age') from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Lait%'));
  r := pg_temp.n(r, '1 age L7 (18 j) = à recontrôler', '=a_recontroler', (select e->>'etat_age' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Compote%'));
  r := pg_temp.n(r, '1 age L1 (1 j) périmé = À retirer', 'retirer', (select e->>'action' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Yaourt nature%'));
  -- 1b autres tournées : quantité, rôle, état, jamais de nom ni d'identifiant d'auteur (jambon : 2 autres tournées de rôles différents)
  v := (select e->'autres_tournees' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Jambon%' limit 1);
  r := pg_temp.n(r, '1b autres tournées : 2 lignes', '=2', jsonb_array_length(v)::text);
  r := pg_temp.n(r, '1b autre Renfort : quantité 5, état terminée', '=Renfort/5/TERMINEE_A_CERTIFIER', (select (e->>'role') || '/' || (e->>'quantite') || '/' || (e->>'etat') from jsonb_array_elements(v) e where e->>'role' = 'Renfort'));
  r := pg_temp.n(r, '1b autre Gérant : quantité 4, état en cours', '=Gérant/4/EN_COURS', (select (e->>'role') || '/' || (e->>'quantite') || '/' || (e->>'etat') from jsonb_array_elements(v) e where e->>'role' = 'Gérant'));
  r := pg_temp.n(r, '1b aucun saisi_par dans la réponse', '!saisi_par', g::text);
  r := pg_temp.n(r, '1b aucun uuid d''auteur dans la réponse', '!0e050', g::text);
  r := pg_temp.n(r, '1b aucun nom d''employé dans la réponse', '!Recette', g::text);
  r := pg_temp.n(r, '1b ligne sans autre tournée : aucune clé', '=ok', (select case when bool_and(e->'autres_tournees' is null or jsonb_typeof(e->'autres_tournees') = 'null' or e->>'libelle' ilike 'Jambon%' or e->>'libelle' ilike 'Yaourt%' or e->>'libelle' ilike 'Sandwich%') then 'ok' else 'ko' end from jsonb_array_elements(g->'liste') e));
  -- 1c délais : jours restants (−2, −1, 0, +1, +4) lus par la page, jamais recalculés
  r := pg_temp.n(r, '1c délai -2', '=-2', (select e->>'jours_restants' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Yaourt nature%'));
  r := pg_temp.n(r, '1c délai -1', '=-1', (select e->>'jours_restants' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Lait%'));
  r := pg_temp.n(r, '1c délai 0', '=0', (select e->>'jours_restants' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Sandwich%'));
  r := pg_temp.n(r, '1c délai +1', '=1', (select e->>'jours_restants' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Salade%'));
  r := pg_temp.n(r, '1c délai +4', '=4', (select e->>'jours_restants' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Jus d%'));
  -- 1d dernier relevé : par ligne et pour le site
  r := pg_temp.n(r, '1d dernier relevé de la ligne', '=ok', (select case when bool_and(e->>'dernier_releve' is not null) then 'ok' else 'ko' end from jsonb_array_elements(g->'liste') e));
  r := pg_temp.n(r, '1d dernier relevé du site', '=ok', case when g->>'dernier_releve' is not null then 'ok' else 'ko' end);
  -- 1e rayon : par EAN seulement, jamais par ressemblance de nom
  r := pg_temp.n(r, '1e rayon : EAN et rayon connu', '=Produits laitiers', (select e->>'rayon' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Yaourt nature%'));
  r := pg_temp.n(r, '1e rayon : sans EAN, trouvé par le libellé seul', '=', (select coalesce(e->>'rayon', '') from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Salade%'));
  r := pg_temp.n(r, '1e rayon : EAN et rayon inconnu', '=', (select coalesce(e->>'rayon', '') from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Jus d%'));
  -- 2 A
  r := pg_temp.n(r, '2 A valeur', '=71.40~=71.4', g#>>'{a,valeur}');
  r := pg_temp.n(r, '2 A dont non certifiées', '=28.20~=28.2', g#>>'{a,dont_non_certifiees}');
  r := pg_temp.n(r, '2 A indicatif', '=23.20~=23.2', g#>>'{a,indicatif,valeur}');
  r := pg_temp.n(r, '2 A exclus', '=1', g#>>'{a,exclus}');
  r := pg_temp.n(r, '2 compteur certifier', '=2', g#>>'{compteurs,certifier}');
  -- 3 pas de double comptage (jambon 6 x 2,90 = 17,40)
  r := pg_temp.n(r, '3 jambon compté une fois', '=17.40~=17.4', (select e->>'valeur' from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Jambon%' limit 1));
  r := pg_temp.n(r, '3 jambon une seule ligne', '=1', (select count(*)::text from jsonb_array_elements(g->'liste') e where e->>'libelle' ilike 'Jambon%'));
  -- 4 sans prix
  r := pg_temp.n(r, '4 sans prix lignes', '=1', g#>>'{a,sans_prix,lignes}');
  r := pg_temp.n(r, '4 sans prix unités', '=3', g#>>'{a,sans_prix,unites}');
  -- 5 B
  r := pg_temp.n(r, '5 B valeur', '=29.50~=29.5', g#>>'{b,valeur}');
  r := pg_temp.n(r, '5 B reconstitué', '=12.00~=12', g#>>'{b,reconstitue}');
  r := pg_temp.n(r, '5 B badge', '=partiellement_reconstitue', g#>>'{b,badge}');
  r := pg_temp.n(r, '5 B lignes sans prix', '=1', g#>>'{b,lignes_sans_prix}');
  -- 7 C et D
  r := pg_temp.n(r, '7 C indisponible', '=indisponible', g#>>'{c,statut}');
  r := pg_temp.n(r, '7 D indisponible', '=indisponible', g#>>'{d,statut}');
  r := pg_temp.n(r, '7 C raisons : ventes sans DLC', 'DLC', (g#>'{c,raisons}')::text);
  r := pg_temp.n(r, '7 C raisons : aucune vente attribuée', 'Aucune vente', (g#>'{c,raisons}')::text);
  r := pg_temp.n(r, '7 C raisons sans promotion ni lot 6', '!romotion', (g#>'{c,raisons}')::text);
  r := pg_temp.n(r, '7 C au moins 2 raisons', '=ok', case when jsonb_array_length(g#>'{c,raisons}') >= 2 then 'ok' else 'ko' end);
  r := pg_temp.n(r, '7 D raisons : hypothèse de référence', 'ypothèse de référence non validée', (g#>'{d,raisons}')::text);
  r := pg_temp.n(r, '7 D raisons sans commandes fournisseurs', '!ommandes fournisseurs', (g#>'{d,raisons}')::text);
  r := pg_temp.n(r, '7 D raisons : vente jamais perte évitée', 'jamais', (g#>'{d,raisons}')::text);
  r := pg_temp.n(r, '7 D 3 raisons', '=3', (select jsonb_array_length(g#>'{d,raisons}')::text));
  r := pg_temp.n(r, '7 B détail : source', '=0', (select count(*)::text from jsonb_array_elements(g#>'{b,detail}') e where not (e ? 'source')));
  r := pg_temp.n(r, '7 B détail : date de comptabilisation', '=0', (select count(*)::text from jsonb_array_elements(g#>'{b,detail}') e where coalesce(e->>'date_comptabilisation','') = ''));
  r := pg_temp.n(r, '7 B détail : état', '=0', (select count(*)::text from jsonb_array_elements(g#>'{b,detail}') e where coalesce(e->>'etat','') = ''));
  r := pg_temp.n(r, '7 B détail : clés période et prix', '=0', (select count(*)::text from jsonb_array_elements(g#>'{b,detail}') e where not (e ? 'periode_debut' and e ? 'periode_fin' and e ? 'prix_unitaire')));
  r := pg_temp.n(r, '7 B détail : prix unitaire sur ligne chiffrée', '=ok', (select case when count(*) filter (where e->>'prix_unitaire' is not null) > 0 then 'ok' else 'ko' end from jsonb_array_elements(g#>'{b,detail}') e));
  -- 13 14 marges
  r := pg_temp.n(r, '13 marge A CA', '=117.60~=117.6', g#>>'{marge,a,ca_potentiel}');
  r := pg_temp.n(r, '13 marge A marge', '=46.20~=46.2', g#>>'{marge,a,marge_exposee}');
  r := pg_temp.n(r, '13 marge A hors calcul', '=1', g#>>'{marge,a,hors_calcul}');
  r := pg_temp.n(r, '14 marge B CA', '=46.80~=46.8', g#>>'{marge,b,ca_theorique}');
  r := pg_temp.n(r, '14 marge B marge', '=17.30~=17.3', g#>>'{marge,b,marge_non_realisee}');
  r := pg_temp.n(r, '14 marge B dont reconstituée', '=7.80~=7.8', g#>>'{marge,b,dont_reconstituee}');
  -- prix figé : modifier products après la démarque ne bouge pas B
  perform pg_temp.exec($q$update products set prix_achat = 9.99, prix_vente = 19.99 where site = 'site-fantome-test' and article = 'Yaourt fruits x4'$q$);
  x := pg_temp.lire('M1');
  r := pg_temp.n(r, 'fige B inchangé après modif de products', '=29.50~=29.5', x#>>'{b,valeur}');
  -- 2b tout provisoire : aucune tournée certifiée
  perform pg_temp.exec($q$update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER' where site = 'site-fantome-test' and etat = 'CERTIFIEE'$q$);
  x := pg_temp.lire('M1');
  r := pg_temp.n(r, '2b tout provisoire : dont non certifiées = valeur', '=ok', case when x#>>'{a,valeur}' is not null and x#>>'{a,dont_non_certifiees}' = x#>>'{a,valeur}' then 'ok' else coalesce(x#>>'{a,valeur}', 'null') || '/' || coalesce(x#>>'{a,dont_non_certifiees}', 'null') end);
  -- 6 nature fiscale non déterminée : on vide l'inventaire
  perform pg_temp.exec($q$delete from inventaire_ventes_import where site = 'site-fantome-test'$q$);
  x := pg_temp.lire('M1');
  r := pg_temp.n(r, '6 nature non déterminée', '=false', x#>>'{nature_fiscale,determinee}');
  r := pg_temp.n(r, '6 A valeur sans montant', '=', coalesce(x#>>'{a,valeur}', ''));
  r := pg_temp.n(r, '6 A calculable faux', '=false', x#>>'{a,calculable}');
  r := pg_temp.n(r, '6 B valeur sans montant', '=', coalesce(x#>>'{b,valeur}', ''));
  r := pg_temp.n(r, '6 détail B sans prix', '!pu', (x#>'{b,detail}')::text);
  r := pg_temp.n(r, '15 marge A indisponible', '=', coalesce(x#>>'{marge,a,marge_exposee}', ''));
  r := pg_temp.n(r, '15 marge B indisponible', '=', coalesce(x#>>'{marge,b,marge_non_realisee}', ''));
  r := pg_temp.n(r, '6 quantités visibles', '=oui', (select case when coalesce(sum((e->>'quantite')::numeric),0) > 0 then 'oui' else 'non' end from jsonb_array_elements(g->'liste') e));
  -- 10 droits
  foreach k in array array['G1'] loop
    x := pg_temp.lire(k);
    r := pg_temp.n(r, '10 gérant autorisé ' || k, '=ok', case when x ? 'erreur' then x->>'erreur' else 'ok' end);
  end loop;
  foreach k in array array['RF1','CA1','P1','V1'] loop
    x := pg_temp.lire(k);
    r := pg_temp.n(r, '10 refusé ' || k, 'droit_refuse', coalesce(x->>'erreur', 'ACCEPTE'));
  end loop;
  x := pg_temp.lire('M2');
  r := pg_temp.n(r, '10 autre site : aucune donnée', '=0', coalesce(x#>>'{compteurs,traiter}', 'x'));
  r := pg_temp.n(r, '10 autre site : B vide', '=0', coalesce(x#>>'{b,demarques}', 'x'));
  -- 8 aucune donnée : site vide (M2)
  r := pg_temp.n(r, '8 compteurs vides', '=0', (coalesce(x#>>'{compteurs,verifier}','x')));
  r := pg_temp.n(r, '8 badge aucune perte', '=aucune_perte', x#>>'{b,badge}');
  r := pg_temp.n(r, '8 A non calculable', '=false', x#>>'{a,calculable}');
  -- anonyme
  begin
    reset role; perform set_config('request.jwt.claims', '{}', true); perform set_config('request.jwt.claim.sub', '', true);
    set local role anon;
    perform dates_courtes_prevention_pertes('2026-11-22 16:00:00+00');
    r := pg_temp.n(r, '10 anon', 'refus', 'ACCEPTE');
  exception when others then
    reset role; r := pg_temp.n(r, '10 anon', 'refus', 'refus ' || sqlerrm);
  end;
  reset role;
  raise exception 'RAPPORT_DC5 %', jsonb_build_object('total', jsonb_array_length(r), 'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
