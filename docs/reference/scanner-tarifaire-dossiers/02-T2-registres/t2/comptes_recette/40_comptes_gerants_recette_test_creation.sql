-- Comptes gérants de recette T2, PROJET TEST UNIQUEMENT (PROJET, NON EXÉCUTÉ, GO distinct requis).
-- Préalable (geste réservé, hors SQL, aucun mot de passe dans ce dépôt) : créer dans Test, Authentication > Add user,
-- « Auto Confirm User » coché, fournisseur e-mail, les deux identités ci-dessous. Format identique aux 4 identités
-- existantes de Test (adresse = identifiant + @vito-nexus.local, identifiant avec tirets, e-mail confirmé),
-- ce que l'écran de connexion attend : signInWithPassword(identifiant + '@vito-nexus.local'). Le mot de passe est généré et conservé hors dépôt.
--   recette-t2-gerant-sm@vito-nexus.local        (site vito-sainte-marie de Test)
--   recette-t2-gerant-fantome@vito-nexus.local   (site site-fantome-test, sert aux contrôles d'isolation)
-- Ce script relie ensuite chaque identité à une ligne employees : rôle gerant, compte de test, non créateur.
-- Aucun autre droit n'est accordé : pas de rôle créateur, pas de GRANT, pas de modification de politique.
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
declare
  v_sm uuid; v_fa uuid;
begin
  -- Garde identités : les identités d'authentification doivent avoir été créées dans Test, actives et non bannies.
  select id into v_sm from auth.users where email = 'recette-t2-gerant-sm@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  select id into v_fa from auth.users where email = 'recette-t2-gerant-fantome@vito-nexus.local' and deleted_at is null and (banned_until is null or banned_until < now());
  if v_sm is null or v_fa is null then
    raise exception 'garde_identites : créer d abord les deux utilisateurs dans Authentication (Test)';
  end if;
  -- Garde nom : la connexion par prénom (nexus_identifiant_de_connexion) compare employees.nom sans tenir compte de la casse.
  -- Un nom déjà porté par un autre employé rendrait la connexion ambiguë pour cette personne : refus.
  if exists (select 1 from public.employees where lower(btrim(nom)) in ('recettet2sm', 'recettet2fantome') and id not in (v_sm, v_fa)) then
    raise exception 'garde_nom : nom de recette déjà utilisé';
  end if;
  insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test) values
    (v_sm, 'recette-t2-gerant-sm', 'RecetteT2SM', 'gerant', true, false, 'vito-sainte-marie', true),
    (v_fa, 'recette-t2-gerant-fantome', 'RecetteT2Fantome', 'gerant', true, false, 'site-fantome-test', true)
  on conflict (id) do update set actif = true, role = 'gerant', est_createur = false, compte_test = true,
    site_id = excluded.site_id, nom = excluded.nom, username = excluded.username;
  raise notice 'comptes de recette prêts : % (vito-sainte-marie), % (site-fantome-test)', v_sm, v_fa;
end $$;
commit;
