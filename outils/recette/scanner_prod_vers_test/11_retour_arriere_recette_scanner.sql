-- Retour arrière : supprime UNIQUEMENT le schéma recette_scanner (et ce qu'il contient). Ne touche à aucun objet de « public ».
-- Les déclencheurs d'ajout seul sont supprimés avec les tables ; DROP SCHEMA n'est pas un UPDATE/DELETE de ligne.
do $garde$
declare v text;
begin
  select system_identifier::text into v from pg_control_system();
  if v is distinct from '__ID_ATTENDU__' then
    raise exception 'GARDE PROJET TEST : identifiant système % différent de l''attendu __ID_ATTENDU__. Rien n''est supprimé.', v;
  end if;
end
$garde$;
drop schema if exists recette_scanner cascade;
