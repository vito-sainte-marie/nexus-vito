-- NEXUS — declarer la source officielle de planning laisse toujours une trace,
-- et ne reecrit jamais une journee deja passee (19/09/2026).
--
-- Ce que seule une vraie base peut prouver, et que la suite de non-regression
-- du depot ne peut pas eprouver puisqu'elle n'ouvre aucune connexion : le
-- comportement de `basculer_source_planning`
-- (20260919220000_bascule_source_planning_tracee.sql) et des gardes posees par
-- 20260919180000.
--
-- Partie A — la mecanique, en superuser (la RLS n'y mord pas) :
--   B1  update de `station_config.planning_source` SEUL     -> refus 23514
--       (c'est le defaut qui rendait le bouton inutilisable)
--   B2  la RPC ecrit les deux cotes et passe la garde differee
--   B3  elle annonce la source precedente et le jour de la STATION
--   B4  une ligne d'historique existe bien a ce jour
--   B5  se raviser le jour meme corrige au lieu de heurter un 23505
--   B6  ... et les deux cotes restent d'accord apres correction
--   B7  une correction du jour meme CONSERVE la source precedente
--       (la recalculer trouverait la ligne elle-meme et mentirait)
--   B8  source inconnue                                     -> refus 22023
--   B9  site sans configuration de station                  -> refus P0002
--   B10 redater une bascule                                 -> refus 23514
--   B11 deplacer une bascule vers un autre site             -> refus 23514
--   B12 la bascule ne touche pas les horaires de la station
--
-- Partie B — la RLS, en se faisant passer pour un manager du site :
--   R0  `planning_jour_station` reste fermee, et l'ouverture etroite ne
--       repond que sur son propre site                      -> refus 42501
--   R1  le manager bascule son propre site
--   R2  il ne bascule pas un autre site
--   R3  il ne reecrit PAS une bascule deja ecoulee (0 ligne touchee)
--   R4  il reecrit celle du jour (1 ligne touchee)
--   R5  il ne supprime aucune bascule                       -> refus 42501
--   R6  il ne vide pas la table par TRUNCATE, que la RLS ne voit pas
--
-- Transaction close par ROLLBACK : aucune bascule n'est conservee.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/epreuve-bascule-source-planning.sql
--
-- EN TEST UNIQUEMENT. Ce script bascule la source officielle d'un site ; il ne
-- la conserve pas, mais il n'a rien a faire sur la base de Production.

begin;

-- ---------------------------------------------------------------------------
-- Partie A — la mecanique.
-- ---------------------------------------------------------------------------
do $$
declare
  v_site    constant text := 'nexus-station-test';
  v_absent  constant text := 'site-qui-n-existe-pas';
  v_jour    date;
  v_avant   text;
  v_horaires jsonb;
  v_r       jsonb;
  v_n       int;
  v_txt     text;
  v_code    text;
  v_echecs  text[] := array[]::text[];
begin
  select sc.planning_source, sc.horaires into v_avant, v_horaires
    from station_config sc where sc.site = v_site;
  if v_avant is null then
    raise exception 'Epreuve impossible : pas de configuration de station pour %.', v_site;
  end if;
  v_jour := public.planning_jour_station(v_site);

  -- B1 — le defaut d'origine. Un ecran qui n'ecrit qu'un cote ne commite pas.
  begin
    set constraints all deferred;
    update station_config sc set planning_source = 'google_sheets' where sc.site = v_site;
    set constraints all immediate;
    v_echecs := v_echecs || 'B1 une bascule sans trace a ete acceptee'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('B1 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  -- B2 — la RPC fait le geste complet.
  begin
    set constraints all deferred;
    v_r := public.basculer_source_planning(v_site, 'google_sheets');
    set constraints all immediate;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_echecs := v_echecs || ('B2 la bascule tracee a ete refusee : ' || v_code || ' ' || sqlerrm);
  end;

  -- B3 — ce qu'elle annonce.
  if v_r is null then
    v_echecs := v_echecs || 'B3 aucun compte rendu de bascule'::text;
  else
    if (v_r->>'date_effet')::date is distinct from v_jour then
      v_echecs := v_echecs || ('B3 date d''effet annoncee ' || coalesce(v_r->>'date_effet','null')
                               || ', jour de la station ' || v_jour::text);
    end if;
    if v_r->>'source_precedente' is distinct from v_avant then
      v_echecs := v_echecs || ('B3 source precedente annoncee ' || coalesce(v_r->>'source_precedente','null')
                               || ', declaree avant ' || v_avant);
    end if;
  end if;

  -- B4 — la trace existe.
  select count(*) into v_n from planning_source_periodes p
   where p.site = v_site and p.date_effet = v_jour and p.source = 'google_sheets';
  if v_n <> 1 then
    v_echecs := v_echecs || ('B4 ' || v_n || ' trace(s) de bascule au ' || v_jour::text || ', attendu 1');
  end if;

  -- B5/B6/B7 — se raviser le jour meme.
  begin
    set constraints all deferred;
    v_r := public.basculer_source_planning(v_site, 'nexus', 'essai de correction');
    set constraints all immediate;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_echecs := v_echecs || ('B5 la correction du jour meme a ete refusee : ' || v_code || ' ' || sqlerrm);
  end;

  select sc.planning_source into v_txt from station_config sc where sc.site = v_site;
  if v_txt is distinct from 'nexus'
     or public.source_planning_applicable(v_site, v_jour) is distinct from 'nexus' then
    v_echecs := v_echecs || ('B6 apres correction : reglage « ' || coalesce(v_txt,'null')
                             || ' », historique « '
                             || coalesce(public.source_planning_applicable(v_site, v_jour),'null') || ' »');
  end if;

  select p.source_precedente into v_txt from planning_source_periodes p
   where p.site = v_site and p.date_effet = v_jour;
  if v_txt is distinct from v_avant then
    v_echecs := v_echecs || ('B7 source precedente devenue « ' || coalesce(v_txt,'null')
                             || ' » apres correction, attendu « ' || v_avant || ' »');
  end if;

  -- B8 — une source qui n'existe pas.
  begin
    v_r := public.basculer_source_planning(v_site, 'excel');
    v_echecs := v_echecs || 'B8 une source inconnue a ete acceptee'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '22023' then v_echecs := v_echecs || ('B8 refus attendu 22023, obtenu ' || v_code); end if;
  end;

  -- B9 — un site sans configuration. La bascule ne cree pas la station.
  begin
    v_r := public.basculer_source_planning(v_absent, 'nexus');
    v_echecs := v_echecs || 'B9 un site sans configuration a ete bascule'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> 'P0002' then v_echecs := v_echecs || ('B9 refus attendu P0002, obtenu ' || v_code); end if;
  end;

  -- B10 — redater une bascule contournerait la borne de la policy.
  begin
    update planning_source_periodes p set date_effet = v_jour + 1
     where p.site = v_site and p.date_effet = v_jour;
    v_echecs := v_echecs || 'B10 une bascule a ete redatee'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('B10 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  -- B11 — la deplacer vers un autre site la sortirait de sa RLS d'origine.
  begin
    update planning_source_periodes p set site = 'site-fantome-test'
     where p.site = v_site and p.date_effet = v_jour;
    v_echecs := v_echecs || 'B11 une bascule a ete deplacee vers un autre site'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '23514' then v_echecs := v_echecs || ('B11 refus attendu 23514, obtenu ' || v_code); end if;
  end;

  -- B12 — `horaires` est NOT NULL et ne regarde pas la source de planning.
  select sc.horaires into v_r from station_config sc where sc.site = v_site;
  if v_r is distinct from v_horaires then
    v_echecs := v_echecs || 'B12 la bascule a modifie les horaires de la station'::text;
  end if;

  -- Une bascule d'hier, pour la partie B. Motif obligatoire : elle est passee.
  set constraints all deferred;
  insert into planning_source_periodes (site, source, date_effet, motif)
  values (v_site, 'nexus', v_jour - 1, 'temoin d''epreuve : bascule deja ecoulee');
  set constraints all immediate;

  if array_length(v_echecs, 1) is null then
    raise notice 'BASCULE SOURCE PLANNING — partie A : 12 controles verts.';
  else
    raise exception E'BASCULE SOURCE PLANNING — partie A, ECHECS :\n  %', array_to_string(v_echecs, E'\n  ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Partie B — la RLS, vue par un manager du site.
-- ---------------------------------------------------------------------------
-- La RLS ne s'applique pas au proprietaire de la base : sans changement de
-- role, les bornes de la policy seraient declarees vertes sans jamais avoir
-- ete eprouvees (cf. « les gardes qui ne mordent pas »).
select e.id::text as mgr
  from employees e
 where e.site_id = 'nexus-station-test' and e.role = 'manager' and e.actif
 order by e.nom limit 1
\gset

select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'mgr', 'role', 'authenticated')::text,
  true) \gset ignore_

set local role authenticated;

do $$
declare
  v_site    constant text := 'nexus-station-test';
  v_autre   constant text := 'site-fantome-test';
  v_jour    date;
  v_n       int;
  v_code    text;
  v_echecs  text[] := array[]::text[];
begin
  -- R0 — `planning_jour_station` reste fermee : elle lit `sites` hors RLS.
  --   Seule l'ouverture etroite du lot du jour repond, et seulement sur son
  --   propre site.
  begin
    v_jour := public.planning_jour_station(v_site);
    v_echecs := v_echecs || 'R0 planning_jour_station est ouverte a authenticated'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '42501' then v_echecs := v_echecs || ('R0 refus attendu 42501, obtenu ' || v_code); end if;
  end;
  v_jour := public.planning_jour_de_ma_station(v_site);

  begin
    perform public.planning_jour_de_ma_station(v_autre);
    v_echecs := v_echecs || 'R0 le jour d''un autre site a ete rendu'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '42501' then v_echecs := v_echecs || ('R0 refus attendu 42501, obtenu ' || v_code); end if;
  end;

  -- R1 — son propre site.
  begin
    set constraints all deferred;
    perform public.basculer_source_planning(v_site, 'google_sheets');
    set constraints all immediate;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    v_echecs := v_echecs || ('R1 le manager n''a pas pu basculer son site : ' || v_code || ' ' || sqlerrm);
  end;

  -- R2 — un autre site. La RPC n'accorde rien : la RLS le laisse dehors.
  begin
    set constraints all deferred;
    perform public.basculer_source_planning(v_autre, 'google_sheets');
    set constraints all immediate;
    v_echecs := v_echecs || 'R2 le manager a bascule un site qui n''est pas le sien'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code not in ('P0002', '42501') then
      v_echecs := v_echecs || ('R2 refus attendu P0002 ou 42501, obtenu ' || v_code);
    end if;
  end;

  -- R3 — le passe ne se reecrit pas. La policy ne leve rien : elle ne rend
  --   simplement aucune ligne a modifier.
  set constraints all deferred;
  update planning_source_periodes p set source = 'google_sheets'
   where p.site = v_site and p.date_effet = v_jour - 1;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    v_echecs := v_echecs || ('R3 ' || v_n || ' bascule(s) deja ecoulee(s) reecrite(s), attendu 0');
  end if;

  -- R4 — celle du jour, si.
  update planning_source_periodes p set motif = 'correction du jour meme'
   where p.site = v_site and p.date_effet = v_jour;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    v_echecs := v_echecs || ('R4 ' || v_n || ' bascule(s) du jour corrigee(s), attendu 1');
  end if;
  set constraints all immediate;

  -- R5 — l'historique ne s'efface pas. Le privilege lui-meme doit manquer :
  --   sans policy DELETE, un delete ne leve rien, il ne touche aucune ligne —
  --   une garde qui ne mord pas.
  begin
    delete from planning_source_periodes p where p.site = v_site and p.date_effet = v_jour;
    v_echecs := v_echecs || 'R5 le privilege DELETE est encore accorde'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '42501' then v_echecs := v_echecs || ('R5 refus attendu 42501, obtenu ' || v_code); end if;
  end;

  -- R6 — TRUNCATE ne passe pas par la RLS : seul le privilege l'arrete.
  begin
    truncate table planning_source_periodes;
    v_echecs := v_echecs || 'R6 l''historique des bascules a ete vide par TRUNCATE'::text;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> '42501' then v_echecs := v_echecs || ('R6 refus attendu 42501, obtenu ' || v_code); end if;
  end;

  if array_length(v_echecs, 1) is null then
    raise notice 'BASCULE SOURCE PLANNING — partie B : 8 controles verts.';
  else
    raise exception E'BASCULE SOURCE PLANNING — partie B, ECHECS :\n  %', array_to_string(v_echecs, E'\n  ');
  end if;
end $$;

reset role;

rollback;
