-- Nettoyage du jeu de captures du lot 3 : retire ce que 02_jeu_captures.sql a posé, et ce que la capture a ajouté dessus.
-- Cible : nexus-station-test UNIQUEMENT (garde de base). Périmètre : les tournées 'capt-lot3-%' et TOUT ce qui s'y rattache par
--   tournee_id (certifications, demandes de correction, corrections, renommages, retraits, démarques, relevés), que la clé soit
--   'capt-lot3-%' ou générée par la page (certification faite pendant la capture, demande envoyée depuis l'écran).
-- La trace des renommages est immuable : session_replication_role = replica le temps de la transaction (coupe aussi les clés étrangères),
--   d'où le contrôle d'orphelins après retour à origin : il fait échouer le script (donc annule tout) s'il reste une référence pendante.
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

create temp table capt_tournees on commit drop as
  select id, site from dates_courtes_tournees where cle_idempotence like 'capt-lot3-%';

create temp table capt_avant on commit drop as
select 'tournees' as t, count(*) as n from dates_courtes_tournees x where exists (select 1 from capt_tournees c where c.id = x.id and c.site = x.site)
union all select 'releves', count(*) from dates_courtes_releves x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'corrections', count(*) from dates_courtes_corrections x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'certifications', count(*) from dates_courtes_certifications x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'demandes', count(*) from dates_courtes_demandes_correction x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'renommages', count(*) from dates_courtes_renommages_tournee x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'retraits', count(*) from dates_courtes_retraits x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site)
union all select 'demarques', count(*) from dates_courtes_demarques x where exists (select 1 from capt_tournees c where c.id = x.tournee_id and c.site = x.site);

select 'AVANT' as moment, t, n from capt_avant order by t;

set local session_replication_role = replica;

delete from dates_courtes_renommages_tournee x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_demandes_correction x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_certifications x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_retraits x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_demarques x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_corrections x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_releves x using capt_tournees c where c.id = x.tournee_id and c.site = x.site;
delete from dates_courtes_tournees x using capt_tournees c where c.id = x.id and c.site = x.site;

set local session_replication_role = origin;

-- Contrôle d'orphelins (références non nulles seulement) : toute ligne dont la tournée ou le relevé référencé a disparu fait échouer le script.
do $orphelins$
declare v_n integer;
begin
  select count(*) into v_n from (
    select 1 from dates_courtes_releves x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_corrections x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_corrections x where x.releve_id is not null and not exists (select 1 from dates_courtes_releves r where r.id = x.releve_id and r.site = x.site)
    union all select 1 from dates_courtes_certifications x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_demandes_correction x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_renommages_tournee x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_demarques x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_retraits x where not exists (select 1 from dates_courtes_tournees t where t.id = x.tournee_id and t.site = x.site)
    union all select 1 from dates_courtes_retraits x where x.releve_id is not null and not exists (select 1 from dates_courtes_releves r where r.id = x.releve_id and r.site = x.site)
  ) o;
  if v_n > 0 then raise exception 'NETTOYAGE_ORPHELINS : % ligne(s) orpheline(s) dans dates_courtes_*, annulation', v_n; end if;
end
$orphelins$;

select 'APRES' as moment, 'tournees' as t, count(*) as n from dates_courtes_tournees x where x.cle_idempotence like 'capt-lot3-%' or x.id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'releves', count(*) from dates_courtes_releves x where x.cle_idempotence like 'capt-lot3-%' or x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'corrections', count(*) from dates_courtes_corrections x where x.cle_idempotence like 'capt-lot3-%' or x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'certifications', count(*) from dates_courtes_certifications x where x.cle_idempotence like 'capt-lot3-%' or x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'demandes', count(*) from dates_courtes_demandes_correction x where x.cle_idempotence like 'capt-lot3-%' or x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'renommages', count(*) from dates_courtes_renommages_tournee x where x.cle_idempotence like 'capt-lot3-%' or x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'retraits', count(*) from dates_courtes_retraits x where x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
union all select 'APRES', 'demarques', count(*) from dates_courtes_demarques x where x.tournee_id::text like '00000000-0000-4000-8000-0000000e04%'
order by 2;

commit;
