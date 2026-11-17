-- Désactivation des comptes gérants de recette T2 après les essais, PROJET TEST UNIQUEMENT (PROJET, NON EXÉCUTÉ).
-- Trois verrous, du plus immédiat au plus définitif :
--   1. employees.actif = false : avec 20261118100300, plus aucun accès aux registres T2, même avec une session ouverte.
--   2. Suppression de l'identité dans Authentication > Users (geste réservé, hors SQL). Elle supprime aussi les sessions
--      et jetons de rafraîchissement ; à défaut, bannissement par l'API d'administration (ban_duration).
--      Nécessaire : nexus_identifiant_de_connexion laisse encore se connecter un compte_test désactivé, et les autres
--      tables NEXUS de Test ne tiennent pas compte d'actif.
--   3. Les lignes employees restent : les registres T2 y font référence (saisi_par), pour la traçabilité de la recette.
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
declare n int;
begin
  update public.employees set actif = false
   where username in ('recette-t2-gerant-sm', 'recette-t2-gerant-fantome') and compte_test;
  get diagnostics n = row_count;
  raise notice 'comptes de recette désactivés : %', n;
end $$;
commit;
-- Vérification attendue après coup : aucune ligne.
select username from public.employees where username like 'recette-t2-%' and actif;
