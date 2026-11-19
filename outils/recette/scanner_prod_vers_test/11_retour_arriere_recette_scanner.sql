-- Schéma de recette : jouer par execute_sql ou psql --single-transaction, jamais apply_migration.
-- Retour arrière : supprime UNIQUEMENT le schéma recette_scanner (et ce qu'il contient). Ne touche à aucun objet de « public ».
-- Les déclencheurs d'ajout seul sont supprimés avec les tables ; DROP SCHEMA n'est pas un UPDATE/DELETE de ligne.
do $garde$
declare v bigint := (select system_identifier from pg_control_system());
begin
  if v is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn. Rien n est supprimé.', v;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents. Rien n est supprimé.';
  end if;
end
$garde$;
drop schema if exists recette_scanner cascade;
