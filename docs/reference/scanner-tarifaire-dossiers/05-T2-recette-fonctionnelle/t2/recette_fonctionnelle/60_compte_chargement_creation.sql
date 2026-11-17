-- Compte de chargement de la recette fonctionnelle T2, PROJET TEST UNIQUEMENT (PROJET, NON EXÉCUTÉ, GO distinct requis).
-- Préalable (geste réservé) : créer dans Test l'identité recette-t2-chargement-sm@vito-nexus.local (API d'administration, e-mail confirmé).
-- Relie cette identité à une fiche employees : gérant de vito-sainte-marie, compte de test, non créateur. Aucun autre droit.
-- Refus si l'identité ou l'identifiant est déjà lié à un employé : aucune réactivation implicite.
begin;
-- GARDE PROJET TEST (obligatoire, en tête de transaction). Identité vérifiée : l'identifiant système du cluster
-- PostgreSQL, fixé à sa création et propre au projet Supabase Test udljdqxerrbbbajxubfn (relu le 16/11/2026).
-- Toute autre base, Production comprise, est refusée avant la moindre écriture. Seconde vérification : sites de recette.
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
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'recette-t2-chargement-sm@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  if v_id is null then raise exception 'garde_identite : créer d abord l identité recette-t2-chargement-sm dans Authentication (Test)'; end if;
  if exists (select 1 from public.employees where id = v_id or username = 'recette-t2-chargement-sm' or lower(btrim(nom)) = 'recettet2chargementsm') then
    raise exception 'compte_deja_lie : identité, identifiant ou nom déjà lié à un employé ; aucune réactivation implicite';
  end if;
  insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
    values (v_id, 'recette-t2-chargement-sm', 'RecetteT2ChargementSM', 'gerant', true, false, 'vito-sainte-marie', true);
end $$;
commit;
