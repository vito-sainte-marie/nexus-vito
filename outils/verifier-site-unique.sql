-- NEXUS — test de régression A2 : une ligne, un site (04/09/2026).
--
-- Rejoue l'anomalie découverte pendant la recette navigateur du 04/09 :
-- l'écran de Prise de poste écrivait `shifts.site`, `shifts.site_id` prenait
-- son DÉFAUT — l'identifiant du site de PRODUCTION — et la RLS d'insertion ne
-- vérifiait aucun des deux. Trois passes de contrôles SQL ne l'avaient pas vu :
-- elles portaient sur des tables à colonne unique.
--
-- CE TEST DOIT ÉCHOUER sur une base où la migration
-- `20260904193000_site_unique_shifts_mission_catalog` n'est pas appliquée.
-- Un test de régression qui n'a jamais échoué ne garde rien.
--
-- Tout se déroule dans UNE transaction terminée par ROLLBACK : aucune donnée
-- n'est conservée, aucune identité n'est touchée.
--
-- Usage :
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/verifier-site-unique.sql
--
-- À NE JAMAIS LANCER SUR LA PRODUCTION : le script le refuse lui-même en
-- vérifiant que le site sentinelle n'y est pas rattaché à des employés.

begin;

do $$
declare
  SITE_TEST     constant text := 'nexus-station-test';
  SITE_ETRANGER constant text := 'vito-sainte-marie';
  MANAGER   constant uuid := (select id from public.employees where username = 'manager-test');
  CAISSIER_A constant uuid := (select id from public.employees where username = 'employe-test-a');
  CAISSIER_B constant uuid := (select id from public.employees where username = 'employe-test-b');
  r record; n int; s_id uuid;
  reussites int := 0;
begin
  if MANAGER is null or CAISSIER_A is null or CAISSIER_B is null then
    raise exception 'Base inattendue : les trois comptes de recette sont introuvables. Ce script ne vise que nexus-test.';
  end if;
  if exists (select 1 from public.employees where site_id = SITE_ETRANGER) then
    raise exception 'REFUS : des employés sont rattachés à « % ». Cette base ressemble à la PRODUCTION.', SITE_ETRANGER;
  end if;

  perform set_config('role', 'authenticated', true);

  -- ── 1. Un caissier crée un service SANS site_id (le geste de l'écran) ──
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', CAISSIER_A), true);
  insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, statut)
  values (CAISSIER_A, 'caissiere', 'caissiere', 'employe', 'soir',
          public.current_employee_site_id(), 'en_cours')
  returning * into r;

  if r.site_id = SITE_ETRANGER or r.site = SITE_ETRANGER then
    raise exception 'ÉCHEC 1 — le site de production s''est écrit tout seul : site=%, site_id=%', r.site, r.site_id;
  end if;
  if r.site is distinct from SITE_TEST or r.site_id is distinct from SITE_TEST then
    raise exception 'ÉCHEC 1 — site=% / site_id=%, attendu % des deux côtés', r.site, r.site_id, SITE_TEST;
  end if;
  reussites := reussites + 1;
  raise notice 'OK 1 — caissier sans site_id : site = site_id = %', r.site;

  -- ── 2. site_id étranger fourni explicitement : refusé ─────────────────
  begin
    insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, site_id, statut)
    values (CAISSIER_A, 'caissiere', 'caissiere', 'employe', 'matin',
            SITE_TEST, SITE_ETRANGER, 'en_cours');
    raise exception 'ÉCHEC 2 — un site_id étranger a été ACCEPTÉ.';
  exception when insufficient_privilege or check_violation then
    reussites := reussites + 1;
    raise notice 'OK 2 — site_id étranger refusé';
  end;

  -- ── 3. site étranger seul : refusé aussi ──────────────────────────────
  begin
    insert into public.shifts (employee_id, role, role_prevu, confirmed_by, quart, site, statut)
    values (CAISSIER_A, 'caissiere', 'caissiere', 'employe', 'matin', SITE_ETRANGER, 'en_cours');
    raise exception 'ÉCHEC 3 — un site étranger a été ACCEPTÉ.';
  exception when insufficient_privilege or check_violation then
    reussites := reussites + 1;
    raise notice 'OK 3 — site étranger refusé';
  end;

  -- ── 4. Un manager voit les services de SON site, pas ceux d'ailleurs ──
  s_id := r.id;
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', MANAGER), true);
  select count(*) into n from public.shifts where id = s_id;
  if n <> 1 then
    raise exception 'ÉCHEC 4 — le manager ne voit pas le service de son équipe (%). C''est le symptôme du site_id erroné.', n;
  end if;
  select count(*) into n from public.shifts where site_id is distinct from public.current_employee_site_id();
  if n <> 0 then
    raise exception 'ÉCHEC 4 — le manager voit % service(s) d''un autre site.', n;
  end if;
  reussites := reussites + 1;
  raise notice 'OK 4 — manager : voit son équipe, rien d''un autre site';

  -- ── 5. Le caissier B ne voit pas le service du caissier A ─────────────
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', CAISSIER_B), true);
  select count(*) into n from public.shifts where id = s_id;
  if n <> 0 then
    raise exception 'ÉCHEC 5 — le caissier B voit le service du caissier A.';
  end if;
  reussites := reussites + 1;
  raise notice 'OK 5 — isolation croisée A ↔ B';

  -- ── 6. La réinitialisation de scénario emporte bien ce service ────────
  -- reinitialiser-scenario-test.sh supprime `where site_id = SITE_TEST`.
  -- Avec un site_id erroné, la ligne survivrait à la remise à zéro.
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.shifts where id = s_id and site_id = SITE_TEST;
  if n <> 1 then
    raise exception 'ÉCHEC 6 — la réinitialisation ne supprimerait pas ce service : son site_id ne vaut pas %.', SITE_TEST;
  end if;
  reussites := reussites + 1;
  raise notice 'OK 6 — la réinitialisation emporterait ce service';

  -- ── 7. Aucune incohérence résiduelle dans les deux tables ─────────────
  select count(*) into n from public.shifts where site is distinct from site_id;
  if n <> 0 then raise exception 'ÉCHEC 7 — % ligne(s) de shifts portent deux sites.', n; end if;
  select count(*) into n from public.mission_catalog where site is distinct from site_id;
  if n <> 0 then raise exception 'ÉCHEC 7 — % ligne(s) de mission_catalog portent deux sites.', n; end if;
  reussites := reussites + 1;
  raise notice 'OK 7 — aucune ligne à deux sites dans shifts ni mission_catalog';

  raise notice '';
  raise notice '% / 7 scénarios passent.', reussites;
end $$;

rollback;
