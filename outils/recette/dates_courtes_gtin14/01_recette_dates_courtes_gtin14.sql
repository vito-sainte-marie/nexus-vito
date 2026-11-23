-- Recette SQL GTIN-14 (Dates courtes) : forme commune de rapprochement des codes-barres.
-- Jeu synthetique sur sites fictifs (products est vide sur Test). Joue dans une transaction rollbackee.
-- Sortie : une exception RAPPORT_GTIN14 <json>. Ne pas jouer sur Production. Sur Test : seulement apres relecture de Guardian.
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
  if to_regprocedure('public.gtin14(text)') is null then
    raise exception 'GARDE_RECETTE : migration 20261123100000_dates_courtes_gtin14 absente, arrêt';
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
  ('M2',  '00000000-0000-4000-8000-0000000e0304', 'manager',  'nexus-station-test', false);
insert into auth.users (id, aud, role, email)
select v, 'authenticated', 'authenticated', 'recette-gtin-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-gtin-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

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


-- Aides propres a cette recette.
create function pg_temp.avec(corps text) returns text language plpgsql as $$
declare c text := lpad(corps, 13, '0'); s int := 0; i int;
begin
  for i in 1..13 loop s := s + substr(c, i, 1)::int * case when i % 2 = 1 then 3 else 1 end; end loop;
  return corps || ((10 - s % 10) % 10)::text;
end $$;
create function pg_temp.g(x text) returns text language plpgsql as $$
declare r text; cur text := current_user;
begin
  reset role; select coalesce(gtin14(x), 'NULL') into r;
  if cur <> session_user then execute format('set local role %I', cur); end if;
  return r;
end $$;
-- Recherche de produit comme un compte : « libelle|ean » separes par ; (vide si aucun resultat).
create function pg_temp.rech(k text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.comme(k);
  select string_agg(s.libelle || '|' || coalesce(s.ean, 'null'), ';' order by s.libelle) into r from dates_courtes_rechercher_produit(q) s;
  reset role;
  return coalesce(r, '');
exception when others then reset role; return 'ERR ' || sqlerrm;
end $$;
-- Prix : « achat|vente|source » (vide si rien), execute en proprietaire (fonction sans droit client).
create function pg_temp.prix(site text, ean text, libelle text, d date) returns text language plpgsql as $$
declare r text; cur text := current_user;
begin
  reset role;
  select p.prix_achat::text || '|' || coalesce(p.prix_vente::text, 'null') || '|' || p.source into r from dates_courtes_prix_article(site, ean, libelle, d) p;
  if cur <> session_user then execute format('set local role %I', cur); end if;
  return coalesce(r, '');
end $$;

do $rapport$
declare
  r jsonb := '[]'::jsonb; x text;
  upca text; ean13 text; ean8 text; g14_0 text; colis text; onze text; mauvaise text; dup13 text; dup12 text;
  d date := '2026-11-23';
begin
  -- jeu de codes valides calcules (cle mod-10 ajoutee a un corps)
  upca := pg_temp.avec('12345678901');          -- 12 chiffres
  ean13 := '0' || upca;                          -- meme GTIN que l'UPC-A
  ean8 := pg_temp.avec('1234567');
  g14_0 := '0' || ean13;                         -- GTIN-14 commencant par 0
  colis := pg_temp.avec('1234567890123');        -- GTIN-14 logistique (ne commence pas par 0)
  onze := '12345678901';
  mauvaise := left(ean13, 12) || ((right(ean13, 1)::int + 1) % 10)::text;
  dup13 := '0' || pg_temp.avec('23456789012');
  dup12 := right(dup13, 12);

  -- 1 fonction gtin14 : formes valides
  r := pg_temp.n(r, '1 EAN-13 : 0 + EAN', '=0' || ean13, pg_temp.g(ean13));
  r := pg_temp.n(r, '1 UPC-A : 00 + UPC, egal a l''EAN-13 « 0 + UPC »', '=0' || ean13, pg_temp.g(upca));
  r := pg_temp.n(r, '1 GTIN-8 : 000000 + code', '=000000' || ean8, pg_temp.g(ean8));
  r := pg_temp.n(r, '1 GTIN-14 : inchange', '=' || g14_0, pg_temp.g(g14_0));
  r := pg_temp.n(r, '1 GTIN-14 logistique : inchange', '=' || colis, pg_temp.g(colis));
  r := pg_temp.n(r, '1 espaces de bordure retires', '=0' || ean13, pg_temp.g('  ' || ean13 || ' '));
  -- 2 refus
  r := pg_temp.n(r, '2 9 chiffres : refus', '=NULL', pg_temp.g(left(onze, 9)));
  r := pg_temp.n(r, '2 10 chiffres : refus', '=NULL', pg_temp.g(left(onze, 10)));
  r := pg_temp.n(r, '2 11 chiffres : refus, jamais complete', '=NULL', pg_temp.g(onze));
  r := pg_temp.n(r, '2 cle fausse : refus', '=NULL', pg_temp.g(mauvaise));
  r := pg_temp.n(r, '2 lettres : refus', '=NULL', pg_temp.g(left(ean13, 5) || 'A' || substr(ean13, 7)));
  r := pg_temp.n(r, '2 espace interne : refus', '=NULL', pg_temp.g(left(ean13, 6) || ' ' || substr(ean13, 7)));
  r := pg_temp.n(r, '2 15 chiffres (00 + EAN-13) : refus', '=NULL', pg_temp.g('00' || ean13));
  r := pg_temp.n(r, '2 vide et null : refus', '=NULL', pg_temp.g(''));
  r := pg_temp.n(r, '2 null : refus', '=NULL', coalesce(pg_temp.val('select gtin14(null)'), 'NULL'));

  -- 3 droits
  r := pg_temp.n(r, '3 gtin14 non appelable par authenticated', '=false', pg_temp.val($f$select has_function_privilege('authenticated', 'public.gtin14(text)', 'execute')::text$f$));
  r := pg_temp.n(r, '3 gtin14 non appelable par anon', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.gtin14(text)', 'execute')::text$f$));
  r := pg_temp.n(r, '3 rechercher_produit : authenticated oui', '=true', pg_temp.val($f$select has_function_privilege('authenticated', 'public.dates_courtes_rechercher_produit(text,integer)', 'execute')::text$f$));
  r := pg_temp.n(r, '3 rechercher_produit : anon non', '=false', pg_temp.val($f$select has_function_privilege('anon', 'public.dates_courtes_rechercher_produit(text,integer)', 'execute')::text$f$));
  r := pg_temp.n(r, '3 prix_article : aucun droit client', '=false', pg_temp.val($f$select (has_function_privilege('authenticated', 'public.dates_courtes_prix_article(text,text,text,date)', 'execute') or has_function_privilege('anon', 'public.dates_courtes_prix_article(text,text,text,date)', 'execute'))::text$f$));
  r := pg_temp.n(r, '3 caissier non autorise : recherche refusee', 'droit_refuse', pg_temp.essai('P1', format($f$select count(*)::text from dates_courtes_rechercher_produit(%L)$f$, ean13)));

  -- jeu synthetique : site fictif, sauf F
  insert into products (site, periode_debut, periode_fin, categorie, article, code_barres, prix_achat, prix_vente) values
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN A zero perdu',  right(ean13, 12), 1.10, 2.20),  -- EAN-13 stocke sur 12 (zero perdu)
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN B huit',        ean8,             0.50, 1.00),
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN C colis',       colis,            9.00, 12.00),
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'BOISSONS', 'GTIN D doublon un',  dup13,            1.00, 2.00),
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'BOISSONS', 'GTIN E doublon deux', dup12,           3.00, 4.00),
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN G cle fausse',  mauvaise,         5.00, 6.00),
    ('site-fantome-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN H onze',        onze,             7.00, 8.00),
    ('nexus-station-test', '2026-01-01', '2026-12-31', 'EPICERIE', 'GTIN F autre site', dup13,            6.50, 7.50);

  -- 4 recherche par code : une seule fiche, rapprochee quelle que soit la forme
  r := pg_temp.n(r, '4 base 12 chiffres (zero perdu), scan EAN-13 : meme article, ean a conserver = EAN-13',
    '=GTIN A zero perdu|' || ean13, pg_temp.rech('M1', ean13));
  r := pg_temp.n(r, '4 scan UPC-A (12) : meme article', '=GTIN A zero perdu|' || ean13, pg_temp.rech('M1', upca));
  r := pg_temp.n(r, '4 scan GTIN-14 (0 + EAN-13) : meme article', '=GTIN A zero perdu|' || ean13, pg_temp.rech('M1', g14_0));
  r := pg_temp.n(r, '4 GTIN-8 : article, ean sur 8 chiffres', '=GTIN B huit|' || ean8, pg_temp.rech('M1', ean8));
  r := pg_temp.n(r, '4 GTIN-14 logistique : article trouve, ean null (provisoire)', '=GTIN C colis|null', pg_temp.rech('M1', colis));
  r := pg_temp.n(r, '4 cle fausse : aucun article', '=', pg_temp.rech('M1', mauvaise));
  r := pg_temp.n(r, '4 11 chiffres : jamais complete en GTIN (ne ramene ni l''UPC-A ni l''EAN-13 voisin)', '!GTIN A', pg_temp.rech('M1', onze));

  -- 5 ambiguite : deux articles, meme GTIN-14, meme station
  r := pg_temp.n(r, '5 doublon : les deux articles sont renvoyes', '=GTIN D doublon un|' || dup13 || ';GTIN E doublon deux|' || dup13, pg_temp.rech('M1', dup13));
  r := pg_temp.n(r, '5 doublon : meme chose par la forme 12 chiffres', '=GTIN D doublon un|' || dup13 || ';GTIN E doublon deux|' || dup13, pg_temp.rech('M1', dup12));
  r := pg_temp.n(r, '5 doublon : aucun prix pris par le code', '=', pg_temp.prix('site-fantome-test', dup13, null, d));
  r := pg_temp.n(r, '5 doublon : le libelle seul rapproche', '=1.00|2.00|products', pg_temp.prix('site-fantome-test', dup13, 'gtin d doublon un', d));
  -- 6 autre station : pas d'ambiguite, site filtre
  r := pg_temp.n(r, '6 meme GTIN sur une autre station : un seul article', '=GTIN F autre site|' || dup13, pg_temp.rech('M2', dup13));
  r := pg_temp.n(r, '6 autre station : prix de son propre article', '=6.50|7.50|products', pg_temp.prix('nexus-station-test', dup13, null, d));
  r := pg_temp.n(r, '6 l''article de la station A reste invisible pour B', '=', pg_temp.rech('M2', ean13));

  -- 7 prix par forme
  r := pg_temp.n(r, '7 prix : base 12 chiffres, scan EAN-13', '=1.10|2.20|products', pg_temp.prix('site-fantome-test', ean13, null, d));
  r := pg_temp.n(r, '7 prix : scan UPC-A', '=1.10|2.20|products', pg_temp.prix('site-fantome-test', upca, null, d));
  r := pg_temp.n(r, '7 prix : scan GTIN-14', '=1.10|2.20|products', pg_temp.prix('site-fantome-test', g14_0, null, d));
  r := pg_temp.n(r, '7 prix : GTIN-8', '=0.50|1.00|products', pg_temp.prix('site-fantome-test', ean8, null, d));
  r := pg_temp.n(r, '7 prix : GTIN-14 logistique', '=9.00|12.00|products', pg_temp.prix('site-fantome-test', colis, null, d));
  r := pg_temp.n(r, '7 prix : 11 chiffres ne rapproche rien par le code', '=', pg_temp.prix('site-fantome-test', left(onze, 11), null, d));
  r := pg_temp.n(r, '7 prix : cle fausse ne rapproche rien', '=', pg_temp.prix('site-fantome-test', mauvaise, null, d));

  -- 8 cles historiques inchangees : GTIN-14 ne reecrit jamais une cle
  r := pg_temp.n(r, '8 cle_groupe EAN-13 inchangee', '=site-fantome-test|E|' || ean13 || '|2026-11-23', pg_temp.val(format($f$select dates_courtes_cle_groupe('site-fantome-test', %L, null, %L)$f$, ean13, d)));
  r := pg_temp.n(r, '8 normaliser_ean : UPC-A toujours non normalise (12 chiffres)', '=NULL', coalesce(pg_temp.val(format($f$select dates_courtes_normaliser_ean(%L)$f$, upca)), 'NULL'));
  r := pg_temp.n(r, '8 normaliser_ean : EAN-13 inchange', '=' || ean13, pg_temp.val(format($f$select dates_courtes_normaliser_ean(%L)$f$, ean13)));
  r := pg_temp.n(r, '8 normaliser_ean : GTIN-14 toujours refuse', '=NULL', coalesce(pg_temp.val(format($f$select dates_courtes_normaliser_ean(%L)$f$, g14_0)), 'NULL'));
  r := pg_temp.n(r, '8 cle_canonique : accepte toujours (site, ean, libelle, date)', '!ERR', pg_temp.essai('M1', format($f$select dates_courtes_cle_canonique('site-fantome-test', %L, null, %L)$f$, ean13, d)));
  r := pg_temp.n(r, '8 products non modifie par la lecture : code stocke sur 12 chiffres', '=' || right(ean13, 12), pg_temp.val($f$select code_barres from products where article = 'GTIN A zero perdu'$f$));
  r := pg_temp.n(r, '8 products : 8 lignes de jeu, aucune reecrite', '=8', pg_temp.val($f$select count(*)::text from products where article like 'GTIN %'$f$));

  -- 9 article libelle : la recherche textuelle ne change pas
  r := pg_temp.n(r, '9 recherche par libelle', '=GTIN B huit|' || ean8, pg_temp.rech('M1', 'gtin b'));
  r := pg_temp.n(r, '9 recherche par libelle sur code stocke fautif : ean null', '=GTIN G cle fausse|null', pg_temp.rech('M1', 'gtin g'));

  reset role;
  raise exception 'RAPPORT_GTIN14 %', jsonb_build_object('total', jsonb_array_length(r), 'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
