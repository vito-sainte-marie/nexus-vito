-- Recette SQL du Lot 2 "Dates courtes" : page de relevé des employés (côté serveur).
-- Données fictives. Joue dans une transaction rollbackée. Sortie : une exception RAPPORT_DC2 <json>.
-- Les cas 11 (scan réel Safari iOS) et 32 (blocage de fin de tournée avec saisie en attente) relèvent de l'appareil, hors de ce banc.
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
  if to_regprocedure('dates_courtes_rechercher_produit(text,integer)') is null then
    raise exception 'GARDE_RECETTE : migration dates_courtes_lot2_recherche absente, arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id) select 'site-fantome-test' where not exists (select 1 from sites where site_id = 'site-fantome-test');
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
select v, 'authenticated', 'authenticated', 'recette-dc2-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-dc2-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

-- Catalogue fictif : deux sites, avec prix (qui ne doivent jamais sortir de la recherche).
insert into products (site, periode_debut, periode_fin, categorie, article, code_barres, quantite, prix_achat, prix_vente, ca, marge) values
  ('site-fantome-test', '2026-10-01', '2026-10-31', 'Frais', 'Yaourt nature x4', '3000000000014', 40, 1.10, 2.35, 94, 50),
  ('site-fantome-test', '2026-10-01', '2026-10-31', 'Frais', 'Yaourt nature x4 ', '3000000000014', 10, 1.10, 2.35, 23, 12),
  ('site-fantome-test', '2026-10-01', '2026-10-31', 'Épicerie', 'Jus d''orange 1 L', '3000000000021', 30, 0.90, 1.90, 57, 30),
  ('site-fantome-test', '2026-10-01', '2026-10-31', 'Boulangerie', 'Sandwich thon', null, 12, 1.40, 3.20, 38, 21),
  ('nexus-station-test', '2026-10-01', '2026-10-31', 'Frais', 'Fromage autre station', '3000000000038', 5, 2, 4, 20, 10);
insert into products (site, periode_debut, periode_fin, categorie, article, code_barres, quantite, prix_achat, prix_vente)
select 'site-fantome-test', '2026-10-01', '2026-10-31', 'Frais', 'Boisson test ' || g, null, 1, 1, 2 from generate_series(1, 30) g;

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
  r jsonb := '[]'::jsonb; t_rf uuid; t_m uuid; res jsonb; q text; x text; rel uuid; rel2 uuid;
begin
  -- Tournées individuelles : RF1 et M1 créent la leur.
  perform pg_temp.comme('RF1');
  res := dates_courtes_creer_tournee('Frais R1', 'dc2-t-rf'); t_rf := (res->>'tournee_id')::uuid;
  perform pg_temp.comme('M1');
  res := dates_courtes_creer_tournee('Rayon M1', 'dc2-t-m'); t_m := (res->>'tournee_id')::uuid;
  r := pg_temp.n(r, 'tournées créées (RF1 et M1 distinctes)', '=2', (select count(distinct t)::text from (values (t_rf),(t_m)) v(t)));
  r := pg_temp.n(r, 'rejeu création de tournée : même tournée', '=deja_enregistre', pg_temp.essai('RF1', $f$select dates_courtes_creer_tournee('Frais R1', 'dc2-t-rf')->>'statut'$f$));

  -- Cas 6 : EAN inconnu du catalogue (3168930171683) : entrée provisoire, aucune référence créée.
  r := pg_temp.n(r, '6 recherche EAN inconnu : aucune ligne', '=0', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('3168930171683')$f$));
  q := format($f$select dates_courtes_enregistrer('releve', 'dc2-6', jsonb_build_object('tournee_id', %L, 'ean', '3168930171683', 'nom_libre', 'Produit vu en rayon', 'date_limite', '2026-12-05', 'quantite', 3))->>'statut'$f$, t_rf);
  r := pg_temp.n(r, '6 relevé EAN inconnu accepté', '=cree', pg_temp.essai('RF1', q));
  r := pg_temp.n(r, '6 ligne marquée provisoire', '=true', pg_temp.val($f$select provisoire::text from dates_courtes_releves where cle_idempotence = 'dc2-6'$f$));

  -- Cas 11 (serveur) : scan d'un EAN connu = recherche exacte, une ligne avec libellé, EAN, rayon.
  r := pg_temp.n(r, '11 scan EAN connu : une ligne', '=1', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('3000000000014')$f$));
  r := pg_temp.n(r, '11 scan EAN connu : libellé et rayon', 'Yaourt nature x4|Frais', pg_temp.essai('RF1', $f$select libelle || '|' || rayon from dates_courtes_rechercher_produit('3000000000014')$f$));
  -- Douchette Bluetooth : suffixe Entrée et espaces parasites, GS1 AI 17 collé à l'EAN : l'EAN seul est reconnu côté page ; côté serveur l'EAN nu et avec espaces passent.
  r := pg_temp.n(r, 'douchette EAN avec espaces', '=1', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('  3000000000014  ')$f$));

  -- Cas 15 : produit sans EAN trouvé par nom, relevé deux fois (deux dates).
  r := pg_temp.n(r, '15 recherche par nom sans EAN', 'Sandwich thon', pg_temp.essai('RF1', $f$select libelle from dates_courtes_rechercher_produit('sandwich')$f$));
  perform pg_temp.comme('RF1');
  perform dates_courtes_enregistrer('releve', 'dc2-15a', jsonb_build_object('tournee_id', t_rf, 'libelle', 'Sandwich thon', 'date_limite', '2026-11-25', 'quantite', 2));
  perform dates_courtes_enregistrer('releve', 'dc2-15b', jsonb_build_object('tournee_id', t_rf, 'libelle', 'Sandwich thon', 'date_limite', '2026-11-28', 'quantite', 4));
  reset role;
  r := pg_temp.n(r, '15 un groupe par date', '=2', pg_temp.val($f$select count(distinct date_limite)::text from dates_courtes_releves where cle_idempotence in ('dc2-15a','dc2-15b')$f$));

  -- Cas 18 : renvoi réseau de la même saisie : une seule ligne, même résultat.
  q := format($f$select dates_courtes_enregistrer('releve', 'dc2-18', jsonb_build_object('tournee_id', %L, 'ean', '3000000000021', 'date_limite', '2026-12-01', 'quantite', 5))->>'statut'$f$, t_rf);
  r := pg_temp.n(r, '18 première émission', '=cree', pg_temp.essai('RF1', q));
  r := pg_temp.n(r, '18 renvoi après coupure : pas de doublon', '=deja_enregistre', pg_temp.essai('RF1', q));
  r := pg_temp.n(r, '18 une seule ligne en base', '=1', pg_temp.val($f$select count(*)::text from dates_courtes_releves where cle_idempotence = 'dc2-18'$f$));

  -- Cas 44 : geste hors ligne reçu plus tard : heure du geste conservée.
  q := format($f$select dates_courtes_enregistrer('releve', 'dc2-44', jsonb_build_object('tournee_id', %L, 'ean', '3000000000014', 'date_limite', '2026-12-03', 'quantite', 2, 'heure_geste', '2026-11-22T09:15:00Z'))->>'statut'$f$, t_rf);
  r := pg_temp.n(r, '44 geste hors ligne accepté', '=cree', pg_temp.essai('RF1', q));
  r := pg_temp.n(r, '44 heure du geste conservée', '2026-11-22 09:15', pg_temp.val($f$select heure_geste::text from dates_courtes_releves where cle_idempotence = 'dc2-44'$f$));

  -- Cas 43 : « trouvé et retiré » le premier jour par un renfort : accepté, sans refus de plancher.
  q := format($f$select dates_courtes_enregistrer('trouve_retire', 'dc2-43', jsonb_build_object('tournee_id', %L, 'ean', '3000000000038', 'libelle', 'Fromage vu', 'date_limite', '2026-11-30', 'quantite', 3))->>'statut'$f$, t_rf);
  r := pg_temp.n(r, '43 trouvé et retiré accepté pour un renfort', '=cree', pg_temp.essai('RF1', q));

  -- Correction d'une ligne puis refus sous zéro.
  select id into rel from dates_courtes_releves where cle_idempotence = 'dc2-18';
  q := format($f$select dates_courtes_enregistrer('correction', 'dc2-corr', jsonb_build_object('tournee_id', %L, 'ean', '3000000000021', 'date_limite', '2026-12-01', 'delta', -2, 'releve_id', %L, 'motif', 'recompte'))->>'statut'$f$, t_rf, rel);
  r := pg_temp.n(r, 'correction moins 2 acceptée', '=cree', pg_temp.essai('RF1', q));

  -- Cas 38 : fin de tournée puis demande de correction du manager.
  r := pg_temp.n(r, 'terminer sa tournée', 'TERMINEE_A_CERTIFIER', pg_temp.essai('RF1', format($f$select dates_courtes_terminer_tournee(%L)::text$f$, t_rf)));
  q := format($f$select dates_courtes_demander_correction(%L, array[%L]::uuid[], 'Quantité à revérifier', 'dc2-38')::text$f$, t_rf, rel);
  r := pg_temp.n(r, '38 manager demande une correction', 'CORRECTION_DEMANDEE~cree', pg_temp.essai('M1', q));
  r := pg_temp.n(r, '38 tournée en CORRECTION_DEMANDEE', '=CORRECTION_DEMANDEE', pg_temp.val(format($f$select etat from dates_courtes_tournees where id = %L$f$, t_rf)));
  r := pg_temp.n(r, '38 renfort ne peut pas demander une correction', 'ERR', pg_temp.essai('RF1', format($f$select dates_courtes_demander_correction(%L, array[%L]::uuid[], 'Test', 'dc2-38b')::text$f$, t_rf, rel)));

  -- Refus : pompiste, vacataire, caissier sans accès.
  foreach x in array array['P1', 'V1', 'CA1'] loop
    r := pg_temp.n(r, 'refus ' || x || ' création de tournée', 'droit_refuse', pg_temp.essai(x, format($f$select dates_courtes_creer_tournee('X', 'dc2-ref-%s')::text$f$, x)));
    r := pg_temp.n(r, 'refus ' || x || ' saisie', 'ERR', pg_temp.essai(x, format($f$select dates_courtes_enregistrer('releve', 'dc2-ref-s', jsonb_build_object('tournee_id', %L, 'ean', '3000000000014', 'date_limite', '2026-12-01', 'quantite', 1))::text$f$, t_rf)));
    r := pg_temp.n(r, 'refus ' || x || ' recherche', 'droit_refuse', pg_temp.essai(x, $f$select count(*)::text from dates_courtes_rechercher_produit('yaourt')$f$));
  end loop;
  r := pg_temp.n(r, 'gérant autorisé à rechercher', '=1', pg_temp.essai('G1', $f$select count(*)::text from dates_courtes_rechercher_produit('yaourt')$f$));

  -- Recherche : pas de prix, pas de fuite entre stations, minimum 2 caractères, limite 20, doublons fondus.
  r := pg_temp.n(r, 'recherche : colonnes libelle, ean, rayon seulement', 'ok', case when pg_get_function_result('dates_courtes_rechercher_produit(text,integer)'::regprocedure) ~ '^TABLE\(libelle text, ean text, rayon text\)$' then 'ok' else pg_get_function_result('dates_courtes_rechercher_produit(text,integer)'::regprocedure) end);
  r := pg_temp.n(r, 'recherche : aucun champ prix, vente ou marge dans la signature', '=0', pg_temp.val($f$select count(*)::text from pg_proc p where p.proname = 'dates_courtes_rechercher_produit' and pg_get_function_result(p.oid) ~* '(prix|vente|marge|ca\y|quantite)'$f$));
  r := pg_temp.n(r, 'recherche : aucun produit d''une autre station', '=0', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('fromage autre')$f$));
  r := pg_temp.n(r, 'recherche : la station de M2 voit son produit', '=1', pg_temp.essai('M2', $f$select count(*)::text from dates_courtes_rechercher_produit('fromage autre')$f$));
  r := pg_temp.n(r, 'recherche : un caractère refusé en silence', '=0', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('y')$f$));
  r := pg_temp.n(r, 'recherche : au plus 20 lignes', '=20', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('boisson test', 500)$f$));
  r := pg_temp.n(r, 'recherche : doublon EAN fondu', '=1', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('yaourt')$f$));
  r := pg_temp.n(r, 'recherche : caractère générique % traité comme texte', '=0', pg_temp.essai('RF1', $f$select count(*)::text from dates_courtes_rechercher_produit('%%')$f$));

  -- Anonyme : refusé.
  reset role; set local role anon;
  begin perform count(*) from dates_courtes_rechercher_produit('yaourt'); x := 'ouvert'; exception when others then x := 'ERR ' || sqlerrm; end;
  reset role;
  r := pg_temp.n(r, 'anonyme refusé sur la recherche', 'ERR', x);
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role authenticated;
  begin perform count(*) from dates_courtes_rechercher_produit('yaourt'); x := 'ouvert'; exception when others then x := 'ERR ' || sqlerrm; end;
  reset role;
  r := pg_temp.n(r, 'sans identité : non_authentifie', 'non_authentifie', x);

  raise exception 'RAPPORT_DC2 %', jsonb_build_object('total', jsonb_array_length(r), 'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
