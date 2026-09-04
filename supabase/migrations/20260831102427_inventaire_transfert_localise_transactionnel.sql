-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831102427 · inventaire_transfert_localise_transactionnel
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.inventaire_enregistrer_transfert_localise(
  p_site text,
  p_quart_id uuid,
  p_produit_id uuid,
  p_zone_source_id uuid,
  p_zone_destination_id uuid,
  p_quantite_base numeric,
  p_unite_saisie text default 'unite',
  p_quantite_saisie numeric default null,
  p_facteur_conditionnement numeric default 1,
  p_justification text default null
)
returns table(
  mouvement_id uuid,
  stock_source_avant numeric,
  stock_source_apres numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees%rowtype;
  v_releve inventaire_stock_localise_releves%rowtype;
  v_stock numeric;
  v_delta numeric;
  v_mouvement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUISE';
  end if;

  select * into v_employee from employees where id = auth.uid();
  if not found or v_employee.site_id is distinct from p_site then
    raise exception 'SITE_NON_AUTORISE';
  end if;
  if v_employee.role not in ('manager','gerant') then
    raise exception 'ROLE_NON_AUTORISE';
  end if;

  if p_zone_source_id is null or p_zone_destination_id is null or p_zone_source_id = p_zone_destination_id then
    raise exception 'ZONES_INVALIDES';
  end if;
  if p_quantite_base is null or p_quantite_base <= 0 then
    raise exception 'QUANTITE_INVALIDE';
  end if;

  perform 1 from inventaire_quarts where id = p_quart_id and site = p_site;
  if not found then raise exception 'QUART_INVALIDE'; end if;
  perform 1 from inventaire_zone_produit where id = p_produit_id and site = p_site and actif = true;
  if not found then raise exception 'PRODUIT_INVALIDE'; end if;
  perform 1 from inventaire_zones where id = p_zone_source_id and site = p_site;
  if not found then raise exception 'ZONE_SOURCE_INVALIDE'; end if;
  perform 1 from inventaire_zones where id = p_zone_destination_id and site = p_site;
  if not found then raise exception 'ZONE_DESTINATION_INVALIDE'; end if;

  select * into v_releve
  from inventaire_stock_localise_releves
  where site = p_site and produit_id = p_produit_id and zone_id = p_zone_source_id
  order by releve_le desc
  limit 1
  for update;

  if not found then
    raise exception 'STOCK_SOURCE_NON_INITIALISE';
  end if;

  select coalesce(sum(
    case
      when zone_destination_id = p_zone_source_id then quantite
      when zone_source_id = p_zone_source_id then -quantite
      else 0
    end
  ),0)
  into v_delta
  from inventaire_mouvements
  where site = p_site
    and produit_id = p_produit_id
    and type_mouvement = 'transfert'
    and cree_le > v_releve.releve_le
    and (statut_validation is null or statut_validation = 'valide')
    and (zone_source_id = p_zone_source_id or zone_destination_id = p_zone_source_id);

  v_stock := coalesce(v_releve.quantite_base,0) + coalesce(v_delta,0);

  if p_quantite_base > v_stock + 0.000001 then
    raise exception 'STOCK_SOURCE_INSUFFISANT:%', v_stock;
  end if;

  insert into inventaire_mouvements(
    site, quart_id, produit_id, type_mouvement, quantite, employee_id,
    justification, reason_code, statut_validation, valide_par, valide_le,
    zone_source_id, zone_destination_id, unite_saisie, quantite_saisie,
    facteur_conditionnement, idempotency_key
  ) values (
    p_site, p_quart_id, p_produit_id, 'transfert', p_quantite_base, auth.uid(),
    nullif(trim(p_justification),''), 'transfert_interne', 'valide', auth.uid(), now(),
    p_zone_source_id, p_zone_destination_id, p_unite_saisie,
    coalesce(p_quantite_saisie,p_quantite_base), coalesce(p_facteur_conditionnement,1), gen_random_uuid()
  ) returning id into v_mouvement_id;

  return query select v_mouvement_id, v_stock, v_stock - p_quantite_base;
end;
$$;

revoke all on function public.inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text) from public;
grant execute on function public.inventaire_enregistrer_transfert_localise(text,uuid,uuid,uuid,uuid,numeric,text,numeric,numeric,text) to authenticated;
