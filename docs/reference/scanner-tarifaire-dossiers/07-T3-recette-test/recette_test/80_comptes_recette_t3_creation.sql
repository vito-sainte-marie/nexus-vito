-- Comptes de recette T3, PROJET TEST UNIQUEMENT (PROJET, NON EXÉCUTÉ, GO distinct requis).
-- Réexamen du nombre (arbitrage du 17/11, condition 9) : TROIS identités suffisent.
--   recette-t3-gerant-sm@vito-nexus.local       gérant, vito-sainte-marie : décisions, annulations, puis désactivé (script 81)
--   recette-t3-manager-sm@vito-nexus.local      manager, vito-sainte-marie : refus de décider, lecture du journal
--   recette-t3-gerant-fantome@vito-nexus.local  gérant, site-fantome-test : isolation multisite
-- Le cas « créateur » est prouvé sur le banc local (aucun compte créateur sur Test).
-- Préalable (geste réservé, hors SQL) : créer les trois identités dans Test, Authentication > Add user, « Auto Confirm User »,
-- mot de passe généré et conservé hors dépôt (trousseau, service nexus-recette-t3).
-- Les identités T2 restent désactivées et bannies : aucune réutilisation, aucune réactivation.
begin;
-- GARDE PROJET TEST (obligatoire, en tête de transaction) : identifiant système du cluster propre au projet Supabase Test
-- udljdqxerrbbbajxubfn, puis sites de recette. Toute autre base, Production comprise, est refusée avant la moindre écriture.
do $garde$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde$;
do $$
declare v_gsm uuid; v_msm uuid; v_gfa uuid;
begin
  select id into v_gsm from auth.users where email = 'recette-t3-gerant-sm@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  select id into v_msm from auth.users where email = 'recette-t3-manager-sm@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  select id into v_gfa from auth.users where email = 'recette-t3-gerant-fantome@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  if v_gsm is null or v_msm is null or v_gfa is null then
    raise exception 'garde_identites : créer d abord les trois utilisateurs dans Authentication (Test)';
  end if;
  if exists (select 1 from public.employees where lower(btrim(nom)) in ('recettet3sm', 'recettet3managersm', 'recettet3fantome') and id not in (v_gsm, v_msm, v_gfa)) then
    raise exception 'garde_nom : nom de recette déjà utilisé';
  end if;
  if exists (select 1 from public.employees where id in (v_gsm, v_msm, v_gfa)
             or username in ('recette-t3-gerant-sm', 'recette-t3-manager-sm', 'recette-t3-gerant-fantome')) then
    raise exception 'compte_deja_lie : une identité ou un identifiant de recette T3 est déjà lié ; aucune réactivation implicite';
  end if;
  insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test) values
    (v_gsm, 'recette-t3-gerant-sm', 'RecetteT3SM', 'gerant', true, false, 'vito-sainte-marie', true),
    (v_msm, 'recette-t3-manager-sm', 'RecetteT3ManagerSM', 'manager', true, false, 'vito-sainte-marie', true),
    (v_gfa, 'recette-t3-gerant-fantome', 'RecetteT3Fantome', 'gerant', true, false, 'site-fantome-test', true);
  raise notice 'comptes de recette T3 prêts : gérant SM %, manager SM %, gérant fantôme %', v_gsm, v_msm, v_gfa;
end $$;
commit;
