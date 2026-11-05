-- Alerte « sonde à vérifier » (demande de Frédéric 04/11/2026, GO 05/11).
--
-- Quand, sur les dernières réceptions d'un carburant, l'écart mesuré - BL va
-- plusieurs fois dans le même sens et dépasse le seuil, c'est la sonde de cuve
-- qu'il faut faire vérifier, pas le livreur. Une alerte unique est ouverte ;
-- elle disparaît quand le manager la marque « vue » ou après 7 jours, et ne
-- revient pour ce carburant que si une nouvelle réception recrée le motif.
--
-- Réglages (station_config.reception_carburant_config, valeurs par défaut
-- appliquées par la fonction quand la clé est absente — aucune ligne de
-- station_config n'est modifiée) :
--   sonde_fenetre (5), sonde_nb_min (3), sonde_seuil_ecart_pct (2).
--
-- Le calcul des réceptions et les statuts a_rapprocher / coherente ne sont pas
-- touchés : la détection LIT carburant_reception_visite_lignes.

create table if not exists public.carburant_sonde_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  carburant text not null check (carburant in ('go', 'sp95', 'gnr')),
  sens text not null check (sens in ('plus', 'moins')),
  nb_receptions int not null,
  fenetre int not null,
  ecart_moyen_l numeric,
  ecart_moyen_ratio numeric,
  visite_ids uuid[] not null default '{}',
  ouverte_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '7 days',
  vue boolean not null default false,
  vue_par uuid references public.employees(id),
  vue_le timestamptz
);
comment on table public.carburant_sonde_alertes is 'Alerte « écart répété à la réception — sonde à faire vérifier » (05/11/2026). Créée par le déclencheur nexus_detecter_sonde_a_verifier ; ouverte tant que vue = false et expire_le > now(). Pas de bandeau permanent : elle disparaît au « Vu » ou à l''expiration (7 jours).';

create index if not exists idx_carburant_sonde_alertes_site_carburant
  on public.carburant_sonde_alertes (site, carburant, ouverte_le desc);

alter table public.carburant_sonde_alertes enable row level security;

create policy select_carburant_sonde_alertes on public.carburant_sonde_alertes for select
  using (
    site = (select public.current_employee_site_id())
    or (
      (select public.je_suis_createur())
      and exists (select 1 from public.sites s where s.site_id = carburant_sonde_alertes.site and s.acces_createur_autorise = true)
    )
  );
create policy marquer_vue_manager_meme_site_carburant_sonde_alertes on public.carburant_sonde_alertes for update
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  )
  with check (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  );

-- Pas d'écriture directe : la création passe par le déclencheur ; le manager
-- ne peut modifier que les trois colonnes du « Vu ».
revoke all on public.carburant_sonde_alertes from public, anon, authenticated;
grant select on public.carburant_sonde_alertes to authenticated;
grant update (vue, vue_par, vue_le) on public.carburant_sonde_alertes to authenticated;

create or replace function public.nexus_detecter_sonde_a_verifier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_fenetre int;
  v_nb_min int;
  v_seuil numeric;
  v_sens text;
  v_nb int;
  v_ecart_l numeric;
  v_ecart_ratio numeric;
  v_visites uuid[];
begin
  if new.delta_ratio is null then
    return new;
  end if;

  select reception_carburant_config into v_cfg from public.station_config where site = new.site;
  v_fenetre := coalesce(nullif(v_cfg->>'sonde_fenetre', '')::int, 5);
  v_nb_min := coalesce(nullif(v_cfg->>'sonde_nb_min', '')::int, 3);
  v_seuil := coalesce(nullif(v_cfg->>'sonde_seuil_ecart_pct', '')::numeric, 2) / 100;

  if abs(new.delta_ratio) <= v_seuil then
    return new;
  end if;
  v_sens := case when new.delta_ratio > 0 then 'plus' else 'moins' end;

  perform pg_advisory_xact_lock(hashtext('sonde:' || new.site || ':' || new.carburant));

  -- Déjà une alerte ouverte pour ce carburant, ou une alerte plus récente que
  -- cette réception (réception ancienne corrigée après coup) : rien à faire.
  if exists (
    select 1 from public.carburant_sonde_alertes a
    where a.site = new.site and a.carburant = new.carburant
      and ((not a.vue and a.expire_le > now()) or a.ouverte_le > new.created_at)
  ) then
    return new;
  end if;

  with recentes as (
    select l.visite_id, l.delta_l, l.delta_ratio
    from public.carburant_reception_visite_lignes l
    where l.site = new.site and l.carburant = new.carburant and l.delta_ratio is not null
    order by l.created_at desc, l.id desc
    limit v_fenetre
  ),
  retenues as (
    select * from recentes
    where abs(delta_ratio) > v_seuil and sign(delta_ratio) = sign(new.delta_ratio)
  )
  select count(*), avg(delta_l), avg(delta_ratio), array_agg(visite_id)
    into v_nb, v_ecart_l, v_ecart_ratio, v_visites
  from retenues;

  if v_nb >= v_nb_min
     and exists (select 1 from (
       select id from public.carburant_reception_visite_lignes
       where site = new.site and carburant = new.carburant and delta_ratio is not null
       order by created_at desc, id desc limit v_fenetre) r where r.id = new.id) then
    insert into public.carburant_sonde_alertes
      (site, carburant, sens, nb_receptions, fenetre, ecart_moyen_l, ecart_moyen_ratio, visite_ids)
    values
      (new.site, new.carburant, v_sens, v_nb, v_fenetre, v_ecart_l, v_ecart_ratio, v_visites);
  end if;
  return new;
end;
$$;

revoke all on function public.nexus_detecter_sonde_a_verifier() from public, anon, authenticated;

drop trigger if exists trg_detecter_sonde_a_verifier on public.carburant_reception_visite_lignes;
create trigger trg_detecter_sonde_a_verifier
after insert or update of delta_l, delta_ratio
on public.carburant_reception_visite_lignes
for each row
execute function public.nexus_detecter_sonde_a_verifier();
