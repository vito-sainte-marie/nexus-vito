-- Jeu de données pour les captures « poste du jour » (accueil Renfort et Caissière).
-- Cible : nexus-station-test UNIQUEMENT (garde de base ci-dessous). Jamais Production.
-- Pose deux services ouverts, repérés par leurs identifiants 00000000-0000-4000-8000-0000000e0901 et ...e0902 :
--   employe-test-a (caissier) en service « caissiere » ; employe-test-b (pompiste) en service « renfort ».
-- Idempotent : si le jeu est déjà posé, rien n'est écrit. Refuse si l'un des deux comptes a déjà un service ouvert.
-- 03_nettoyage_captures.sql retire ces deux lignes à l'identique.
begin;

do $garde_captures$
declare v_id text; v_n integer;
begin
  select system_identifier::text into v_id from pg_control_system();
  if v_id is distinct from '7678069749886157684' then
    raise exception 'GARDE_CAPTURES : base inattendue (%), arrêt', v_id;
  end if;
  if to_regprocedure('public.dates_courtes_poste_du_jour()') is null then
    raise exception 'GARDE_CAPTURES : migration 20261124140000_dates_courtes_poste_du_jour absente, arrêt';
  end if;
  select count(*) into v_n from employees
   where site_id = 'nexus-station-test' and compte_test and actif and username in ('employe-test-a', 'employe-test-b');
  if v_n <> 2 then raise exception 'GARDE_CAPTURES : comptes de test attendus absents (% sur 2), arrêt', v_n; end if;
end
$garde_captures$;

do $jeu$
declare
  st constant text := 'nexus-station-test';
  a uuid; b uuid;
begin
  reset role;
  if exists (select 1 from shifts where id in ('00000000-0000-4000-8000-0000000e0901', '00000000-0000-4000-8000-0000000e0902')) then
    raise notice 'JEU_CAPTURES : déjà posé, rien écrit';
    return;
  end if;
  select id into a from employees where username = 'employe-test-a' and site_id = st;
  select id into b from employees where username = 'employe-test-b' and site_id = st;
  if exists (select 1 from shifts where employee_id in (a, b) and statut = 'en_cours') then
    raise exception 'JEU_CAPTURES : un des deux comptes a déjà un service ouvert, arrêt (rien écrit)';
  end if;
  insert into shifts (id, employee_id, site, site_id, role, statut)
    values ('00000000-0000-4000-8000-0000000e0901', a, st, st, 'caissiere', 'en_cours'),
           ('00000000-0000-4000-8000-0000000e0902', b, st, st, 'renfort', 'en_cours');
  raise notice 'JEU_CAPTURES : 2 services posés';
end
$jeu$;

select 'services' as table_, count(*) as lignes from shifts where id in ('00000000-0000-4000-8000-0000000e0901', '00000000-0000-4000-8000-0000000e0902');

commit;
