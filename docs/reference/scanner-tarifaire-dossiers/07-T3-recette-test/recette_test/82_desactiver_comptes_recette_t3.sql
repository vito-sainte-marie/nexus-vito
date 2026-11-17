-- Fin de recette T3 : désactivation des trois comptes (PROJET TEST UNIQUEMENT, NON EXÉCUTÉ). Les lignes employees restent
-- (traçabilité : saisi_par et annule_par des lignes de recette). Bannissement ensuite par l'API d'administration (lot recette_t3).
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
update public.employees set actif = false
 where username in ('recette-t3-gerant-sm', 'recette-t3-manager-sm', 'recette-t3-gerant-fantome') and compte_test;
commit;
select username from public.employees where username like 'recette-t3-%' and actif;   -- attendu : aucune ligne
