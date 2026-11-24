-- Nettoyage du jeu de captures « poste du jour » : retire les deux services posés par 02_jeu_captures.sql.
-- Cible : nexus-station-test UNIQUEMENT. Retrait par identifiant exact, rien d'autre.
begin;

do $garde_nettoyage$
declare v_id text;
begin
  select system_identifier::text into v_id from pg_control_system();
  if v_id is distinct from '7678069749886157684' then
    raise exception 'GARDE_NETTOYAGE : base inattendue (%), arrêt', v_id;
  end if;
end
$garde_nettoyage$;

delete from shifts where id in ('00000000-0000-4000-8000-0000000e0901', '00000000-0000-4000-8000-0000000e0902');

select 'services restants' as table_, count(*) as lignes from shifts where id in ('00000000-0000-4000-8000-0000000e0901', '00000000-0000-4000-8000-0000000e0902');

commit;
