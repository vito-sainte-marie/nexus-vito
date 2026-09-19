-- NEXUS — un import de planning Google Sheets n'ecrit que ce qu'il a lu,
-- et JAMAIS un horaire qu'il aurait suppose (19/09/2026).
--
-- Ce que seule une vraie base peut prouver, et que la suite de
-- non-regression du depot ne peut pas eprouver puisqu'elle n'ouvre aucune
-- connexion : le comportement de `importer_planning_google`
-- (20260919200000_import_planning_google_sheets.sql).
--
-- Les refus, d'abord — un import qui ecrit n'importe quoi est pire que pas
-- d'import du tout :
--   T1  lot vide                       -> refus (un import vide effacerait le mois)
--   T2  aucun identifiant de lot       -> refus (un import doit pouvoir etre annule en bloc)
--   T3  site dont la source est NEXUS  -> refus (deux plannings concurrents)
--   T4  ligne hors de la periode       -> refus (des jours que rien ne remplace)
--   T5  employe d'un autre site        -> refus (onglet mal choisi)
--   T6  meme case deux fois dans le lot-> refus
-- puis ce qui est ecrit :
--   T7  brouillon : `publie = false`, provenance et case d'origine portees
--   T8  `duree_heures` vient du SHEET, `heure_debut`/`heure_fin` de
--       PARAMETRES STATION, et un quart sans horaire declare reste NULL —
--       il est COMPTE, pas comble
--   T9  un reimport REMPLACE sa periode sans jamais doubler,
--       et ne touche pas une ligne `source = 'nexus'`
--
-- Transaction close par ROLLBACK : rien n'est conserve, pas meme la bascule
-- temporaire de la source officielle du site d'essai.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/epreuve-import-planning-google.sql
--
-- EN TEST UNIQUEMENT. Ce script bascule la source officielle d'un site et
-- ecrit du planning ; il ne les conserve pas, mais il n'a rien a faire sur la
-- base de Production.

begin;

do $$
declare
  v_site    constant text := 'nexus-station-test';
  v_autre   constant text := 'site-fantome-test';
  LUNDI     constant date := date '2026-11-02';   -- horaire declare  (normal)
  JEUDI     constant date := date '2026-11-05';   -- horaire NON declare (etendu)
  DEBUT     constant date := date '2026-11-01';
  FIN       constant date := date '2026-12-01';   -- borne exclusive
  v_emp     uuid;
  v_emp2    uuid;
  v_ailleurs uuid;
  v_lot     jsonb;
  v_r       record;
  v_n       int;
  v_code    text;
  v_echecs  text[] := array[]::text[];
begin
  select id into v_emp      from employees where site_id = v_site  and actif order by nom limit 1;
  select id into v_emp2     from employees where site_id = v_site  and actif and id <> v_emp order by nom limit 1;
  select id into v_ailleurs from employees where site_id = v_autre and actif order by nom limit 1;
  if v_emp is null or v_emp2 is null or v_ailleurs is null then
    raise exception 'Epreuve impossible : il faut deux employes sur % et un sur %.', v_site, v_autre;
  end if;

  v_lot := jsonb_build_array(
    jsonb_build_object('employee_id', v_emp, 'date', LUNDI, 'quart', 'quart1',
                       'duree_heures', 7, 'statut', 'travail_normal',
                       'source_ref', 'TEST11!2026-11-02|QUART A|EMP1')
  );

  -- T1 — un lot vide effacerait la periode sans rien mettre a la place.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN, '[]'::jsonb, gen_random_uuid(), null);
    v_echecs := v_echecs || 'T1 un lot vide a ete accepte'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '22004' then v_echecs := v_echecs || ('T1 refus attendu 22004, obtenu ' || v_code); end if;
  end;

  -- T2 — sans identifiant de lot, un import ne peut plus etre annule en bloc.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN, v_lot, null, null);
    v_echecs := v_echecs || 'T2 un lot sans import_id a ete accepte'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '22004' then v_echecs := v_echecs || ('T2 refus attendu 22004, obtenu ' || v_code); end if;
  end;

  -- T3 — la source officielle du site fait foi. Elle vaut encore 'nexus' ici.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN, v_lot, gen_random_uuid(), null);
    v_echecs := v_echecs || 'T3 un import a ete accepte alors que la source officielle est NEXUS'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('T3 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  -- La bascule s'ecrit DES DEUX COTES dans la meme transaction : c'est ce
  -- qu'exige le controle differe `trg_planning_source_coherence`.
  insert into planning_source_periodes (site, source, source_precedente, date_effet, motif)
  values (v_site, 'google_sheets', 'nexus', DEBUT, 'epreuve d''import — annulee par ROLLBACK');
  update station_config sc set planning_source = 'google_sheets' where sc.site = v_site;

  -- T4 — une ligne hors periode laisserait un jour que rien ne remplace.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN,
      jsonb_build_array(jsonb_build_object('employee_id', v_emp, 'date', date '2026-12-02',
        'quart', 'quart1', 'duree_heures', 7, 'source_ref', 'TEST12!hors-periode')),
      gen_random_uuid(), null);
    v_echecs := v_echecs || 'T4 une ligne hors periode a ete acceptee'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '22004' then v_echecs := v_echecs || ('T4 refus attendu 22004, obtenu ' || v_code); end if;
  end;

  -- T5 — un onglet mal choisi ecrirait le planning d'une autre station.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN,
      jsonb_build_array(jsonb_build_object('employee_id', v_ailleurs, 'date', LUNDI,
        'quart', 'quart1', 'duree_heures', 7, 'source_ref', 'TEST11!autre-site')),
      gen_random_uuid(), null);
    v_echecs := v_echecs || 'T5 un employe d''un autre site a ete importe'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23503' then v_echecs := v_echecs || ('T5 refus attendu 23503, obtenu ' || v_code); end if;
  end;

  -- T6 — la meme case lue deux fois signale une grille mal decoupee.
  begin
    perform * from importer_planning_google(v_site, DEBUT, FIN,
      v_lot || v_lot, gen_random_uuid(), null);
    v_echecs := v_echecs || 'T6 la meme case a ete importee deux fois'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23505' then v_echecs := v_echecs || ('T6 refus attendu 23505, obtenu ' || v_code); end if;
  end;

  -- Une ligne de provenance NEXUS, posee AVANT l'import, pour T9.
  insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, source, publie)
  values (v_site, v_emp2, LUNDI, 'quart2', 'travail_normal', 7, 'nexus', false);

  -- T7 et T8 — l'import nominal.
  --   `duree_heures` = 6 est VOLONTAIREMENT different de l'horaire declare
  --   (06:00-13:00, soit 7 h) : le Sheet dit la duree, Parametres Station dit
  --   l'horaire, et l'un n'ecrase pas l'autre.
  select * into v_r from importer_planning_google(v_site, DEBUT, FIN,
    jsonb_build_array(
      jsonb_build_object('employee_id', v_emp, 'date', LUNDI, 'quart', 'quart1',
                         'duree_heures', 6, 'statut', 'travail_normal',
                         'source_ref', 'TEST11!2026-11-02|QUART A|EMP1'),
      jsonb_build_object('employee_id', v_emp, 'date', JEUDI, 'quart', 'quart1',
                         'duree_heures', 7, 'statut', 'travail_normal',
                         'source_ref', 'TEST11!2026-11-05|QUART A|EMP1')
    ), gen_random_uuid(), null);

  if v_r.lignes_ecrites <> 2 then
    v_echecs := v_echecs || ('T7 lignes ecrites attendues 2, obtenu ' || v_r.lignes_ecrites);
  end if;
  if v_r.lignes_remplacees <> 0 then
    v_echecs := v_echecs || ('T7 premier import : aucune ligne a remplacer, obtenu ' || v_r.lignes_remplacees);
  end if;

  select count(*) into v_n from planning_shifts
   where site_id = v_site and source = 'google_sheets' and publie;
  if v_n <> 0 then
    v_echecs := v_echecs || ('T7 un import doit rester un brouillon : ' || v_n || ' ligne(s) publiee(s)');
  end if;

  select count(*) into v_n from planning_shifts
   where site_id = v_site and source = 'google_sheets'
     and (import_id is null or source_ref is null);
  if v_n <> 0 then
    v_echecs := v_echecs || ('T7 ' || v_n || ' ligne(s) importee(s) ne citent pas leur lot ou leur case');
  end if;

  -- T8a — le lundi : l'horaire vient de Parametres Station, la duree du Sheet.
  select * into v_r from (
    select duree_heures, heure_debut, heure_fin from planning_shifts
     where site_id = v_site and source = 'google_sheets' and date = LUNDI) s;
  if v_r.heure_debut is distinct from time '06:00' or v_r.heure_fin is distinct from time '13:00' then
    v_echecs := v_echecs || ('T8a horaire theorique attendu 06:00-13:00, obtenu '
                             || coalesce(v_r.heure_debut::text, 'NULL') || '-' || coalesce(v_r.heure_fin::text, 'NULL'));
  end if;
  if v_r.duree_heures <> 6 then
    v_echecs := v_echecs || ('T8a la duree du Sheet a ete ecrasee : attendu 6, obtenu ' || v_r.duree_heures);
  end if;

  -- T8b — le jeudi : la station ne declare pas d'horaire etendu. NEXUS ne le
  -- devine pas. La ligne existe, son horaire theorique reste NULL.
  select * into v_r from (
    select duree_heures, heure_debut, heure_fin from planning_shifts
     where site_id = v_site and source = 'google_sheets' and date = JEUDI) s;
  if v_r.heure_debut is not null then
    v_echecs := v_echecs || ('T8b un horaire non declare a ete invente : ' || v_r.heure_debut::text);
  end if;
  if v_r.duree_heures <> 7 then
    v_echecs := v_echecs || ('T8b la duree du Sheet a ete perdue : ' || coalesce(v_r.duree_heures::text, 'NULL'));
  end if;

  -- T9 — le reimport remplace, ne double pas, et laisse NEXUS tranquille.
  select * into v_r from importer_planning_google(v_site, DEBUT, FIN,
    jsonb_build_array(
      jsonb_build_object('employee_id', v_emp, 'date', LUNDI, 'quart', 'quart1',
                         'duree_heures', 8, 'statut', 'travail_normal',
                         'source_ref', 'TEST11!2026-11-02|QUART A|EMP1')
    ), gen_random_uuid(), null);

  if v_r.lignes_remplacees <> 2 then
    v_echecs := v_echecs || ('T9 lignes remplacees attendues 2, obtenu ' || v_r.lignes_remplacees);
  end if;

  select count(*) into v_n from planning_shifts
   where site_id = v_site and source = 'google_sheets' and date >= DEBUT and date < FIN;
  if v_n <> 1 then
    v_echecs := v_echecs || ('T9 le reimport a double la periode : ' || v_n || ' ligne(s) au lieu de 1');
  end if;

  select count(*) into v_n from planning_shifts
   where site_id = v_site and source = 'nexus' and employee_id = v_emp2 and date = LUNDI;
  if v_n <> 1 then
    v_echecs := v_echecs || 'T9 un import a efface une ligne de provenance NEXUS'::text;
  end if;

  -- ------------------------------------------------------------------
  -- T10 a T13 — les gardes des DICTIONNAIRES d'import.
  --
  -- Ces deux colonnes de `station_config` sont ce qui permet a NEXUS de ne
  -- RIEN deviner : `planning_alias` dit quel nom du classeur designe quel
  -- employe, `planning_codes_sites` dit quel code de cellule designe quel
  -- site. Tout ce qui n'y figure pas ressort en anomalie au moment de
  -- l'import — c'est voulu, et c'est le seul comportement sur.
  --
  -- Le risque n'est donc pas l'absence de correspondance : c'est une
  -- correspondance QUI EXISTE ET QUI MENT. Un code pointant vers un
  -- `site_id` inexistant fabriquerait des heures « travaillees ailleurs »
  -- sur un site fantome ; une valeur vide ou non textuelle ferait echouer
  -- l'import loin d'ici, dans le moteur, avec un message qui ne nommerait
  -- plus le reglage fautif. Les deux gardes doivent donc mordre A L'ECRITURE
  -- du reglage, pendant que le manager a encore la main dessus.
  -- ------------------------------------------------------------------

  -- T10 — un code de site qui designe un `site_id` inconnu.
  --   Refus du trigger `trg_planning_codes_sites_controle`, en 23503 : c'est
  --   bien une reference qui ne pointe sur rien, meme sans cle etrangere.
  begin
    update station_config sc
       set planning_codes_sites = jsonb_build_object('SMU', 'site-qui-n-existe-pas')
     where sc.site = v_site;
    v_echecs := v_echecs || 'T10 un code de site designant un site inexistant a ete accepte'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23503' then v_echecs := v_echecs || ('T10 refus attendu 23503, obtenu ' || v_code); end if;
  end;

  -- T11 — le meme geste, vers un site que NEXUS connait : il doit passer.
  --   Sans ce controle, T10 serait satisfait par une garde qui refuse tout,
  --   et le reglage deviendrait inutilisable sans que rien ne le dise.
  begin
    update station_config sc
       set planning_codes_sites = jsonb_build_object('SMU', v_site)
     where sc.site = v_site;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_echecs := v_echecs || ('T11 une correspondance vers un site existant a ete refusee : ' || v_code);
  end;

  select count(*) into v_n from station_config sc
   where sc.site = v_site and sc.planning_codes_sites ->> 'SMU' = v_site;
  if v_n <> 1 then
    v_echecs := v_echecs || 'T11 la correspondance acceptee n''a pas ete enregistree'::text;
  end if;

  -- T12 — une cible vide : la correspondance existe et ne designe rien.
  --   Refus de la contrainte `station_config_planning_alias_check`, en 23514.
  begin
    update station_config sc
       set planning_alias = jsonb_build_object('LOANNE', '')
     where sc.site = v_site;
    v_echecs := v_echecs || 'T12 un alias de cible vide a ete accepte'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('T12 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  -- T13 — une cible qui n'est pas du texte. `->>` la rendrait « 5 », et
  --   l'import chercherait un employe nomme 5 sans jamais le dire.
  begin
    update station_config sc
       set planning_alias = jsonb_build_object('LOANNE', 5)
     where sc.site = v_site;
    v_echecs := v_echecs || 'T13 un alias de cible non textuelle a ete accepte'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('T13 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  if array_length(v_echecs, 1) is null then
    raise notice 'IMPORT PLANNING GOOGLE : 13 controles verts.';
  else
    raise exception E'IMPORT PLANNING GOOGLE — ECHECS :\n  %', array_to_string(v_echecs, E'\n  ');
  end if;
end $$;

rollback;
