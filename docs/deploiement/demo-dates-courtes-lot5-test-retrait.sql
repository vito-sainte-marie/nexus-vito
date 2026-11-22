-- Retrait du jeu de démonstration Dates courtes, lot 5, sur la base de TEST seulement.
-- Annule les gestes « demo- » (motif « démo ») dans l'ordre exigé par les triggers d'immuabilité : démarques, retraits, relevés.
-- Supprime ensuite les seules lignes « [Démo] » de products, inventaire_ventes_import et le quart de démonstration.
-- Les tournées « [Démo] » restent (elles ne se suppriment pas, elles sont terminées). Rien d'autre n'est touché.
-- Refuse de tourner hors Test ou si la station nexus-station-test est absente.
begin;

do $garde_retrait$
declare v_id text;
begin
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable' then
    select system_identifier::text into v_id from pg_control_system();
    if v_id is distinct from '7678069749886157684' then
      raise exception 'GARDE_DEMO : base inattendue (%), arrêt', v_id;
    end if;
  end if;
  if not exists (select 1 from sites where site_id = 'nexus-station-test') then
    raise exception 'GARDE_DEMO : station nexus-station-test absente, arrêt';
  end if;
end
$garde_retrait$;

create temp table demo_ids (k text primary key, v uuid) on commit drop;
grant all on demo_ids to public;

-- Identité de gestion : l'auteur des démarques de démo, sinon de la tournée « Frais du matin ».
insert into demo_ids
select 'M1', saisi_par from (
  select saisi_par, 1 as o from dates_courtes_demarques where site = 'nexus-station-test' and cle_idempotence like 'demo-%'
  union all
  select saisi_par, 2 from dates_courtes_releves where site = 'nexus-station-test' and cle_idempotence = 'demo-rel-yaourt'
) q order by o limit 1;

create or replace function pg_temp.comme(k text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select demo_ids.v into v from demo_ids where demo_ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

do $annulations$
declare r record;
begin
  if not exists (select 1 from demo_ids where k = 'M1') then
    raise notice 'RETRAIT_DEMO : aucun geste de démonstration trouvé, rien à annuler';
    return;
  end if;
  perform pg_temp.comme('M1');
  for r in select id from dates_courtes_demarques where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null loop
    perform dates_courtes_annuler_demarque(r.id, 'démo');
  end loop;
  for r in select id from dates_courtes_retraits where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null loop
    perform dates_courtes_enregistrer('annulation', 'demo-annul-ret-' || r.id, jsonb_build_object('cible', 'retraits', 'id', r.id, 'motif', 'démo'));
  end loop;
  for r in select id from dates_courtes_releves where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null loop
    perform dates_courtes_enregistrer('annulation', 'demo-annul-rel-' || r.id, jsonb_build_object('cible', 'releves', 'id', r.id, 'motif', 'démo'));
  end loop;
  reset role;
end
$annulations$;

reset role;
delete from products where site = 'nexus-station-test' and categorie = '[Démo]' and article like '[Démo] %';
delete from inventaire_ventes_import where site = 'nexus-station-test' and categorie_brute = '[Démo]' and designation_brute like '[Démo] %';
delete from inventaire_quarts q where q.site = 'nexus-station-test' and q.quart = '[Démo] Dates courtes'
  and not exists (select 1 from inventaire_ventes_import i where i.quart_id = q.id);

do $controle$
begin
  raise notice 'RETRAIT_DEMO : % gestes actifs restants, % produits, % lignes d''import de démo restants',
    (select count(*) from dates_courtes_releves where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null)
    + (select count(*) from dates_courtes_retraits where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null)
    + (select count(*) from dates_courtes_demarques where site = 'nexus-station-test' and cle_idempotence like 'demo-%' and annule_le is null),
    (select count(*) from products where site = 'nexus-station-test' and categorie = '[Démo]'),
    (select count(*) from inventaire_ventes_import where site = 'nexus-station-test' and categorie_brute = '[Démo]');
end
$controle$;

commit;
