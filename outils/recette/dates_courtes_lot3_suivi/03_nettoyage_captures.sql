-- Nettoyage du jeu de captures du lot 3 : retire exactement ce que 02_jeu_captures.sql a posé.
-- Cible : nexus-station-test UNIQUEMENT (garde de base). Repères : clés 'capt-lot3-%' et tournées 00000000-0000-4000-8000-0000000e04NN.
-- La trace des renommages est immuable : seul son déclencheur est suspendu, le temps de la transaction (session_replication_role).
-- Les tournées et relevés existants de la station (démo, vacataires) ne sont pas touchés. Comptage avant et après affiché.
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

create temp table capt_avant as
select 'tournees' as t, count(*) as n from dates_courtes_tournees where cle_idempotence like 'capt-lot3-%'
union all select 'releves', count(*) from dates_courtes_releves where cle_idempotence like 'capt-lot3-%'
union all select 'corrections', count(*) from dates_courtes_corrections where cle_idempotence like 'capt-lot3-%'
union all select 'certifications', count(*) from dates_courtes_certifications where cle_idempotence like 'capt-lot3-%'
union all select 'demandes', count(*) from dates_courtes_demandes_correction where cle_idempotence like 'capt-lot3-%'
union all select 'renommages', count(*) from dates_courtes_renommages_tournee where cle_idempotence like 'capt-lot3-%';

select 'AVANT' as moment, t, n from capt_avant order by t;

set local session_replication_role = replica;

delete from dates_courtes_renommages_tournee where cle_idempotence like 'capt-lot3-%';
delete from dates_courtes_demandes_correction where cle_idempotence like 'capt-lot3-%';
delete from dates_courtes_certifications where cle_idempotence like 'capt-lot3-%';
delete from dates_courtes_corrections where cle_idempotence like 'capt-lot3-%';
delete from dates_courtes_releves where cle_idempotence like 'capt-lot3-%';
delete from dates_courtes_tournees where cle_idempotence like 'capt-lot3-%';

set local session_replication_role = origin;

select 'APRES' as moment, 'tournees' as t, count(*) as n from dates_courtes_tournees where cle_idempotence like 'capt-lot3-%'
union all select 'APRES', 'releves', count(*) from dates_courtes_releves where cle_idempotence like 'capt-lot3-%'
union all select 'APRES', 'corrections', count(*) from dates_courtes_corrections where cle_idempotence like 'capt-lot3-%'
union all select 'APRES', 'certifications', count(*) from dates_courtes_certifications where cle_idempotence like 'capt-lot3-%'
union all select 'APRES', 'demandes', count(*) from dates_courtes_demandes_correction where cle_idempotence like 'capt-lot3-%'
union all select 'APRES', 'renommages', count(*) from dates_courtes_renommages_tournee where cle_idempotence like 'capt-lot3-%'
order by 2;

commit;
