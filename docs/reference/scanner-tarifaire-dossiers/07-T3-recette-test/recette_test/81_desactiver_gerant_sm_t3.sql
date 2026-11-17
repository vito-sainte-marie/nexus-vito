-- Recette T3, entre les phases 2 et 3 : désactivation du SEUL gérant SM de recette (PROJET TEST UNIQUEMENT, NON EXÉCUTÉ).
-- L'identité reste connectable : la phase 3 prouve que la base refuse ce compte explicitement, sans le déduire d'une lecture vide.
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
declare n int;
begin
  update public.employees set actif = false where username = 'recette-t3-gerant-sm' and compte_test and actif;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'desactivation_inattendue : % ligne(s)', n; end if;
end $$;
commit;
