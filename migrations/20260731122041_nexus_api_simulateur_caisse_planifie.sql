-- ============================================================
-- Simulateur de caisse — tâche planifiée automatique (pg_cron)
-- Génère une vente de test, la fait transiter par le pipeline complet
-- (RAW → normalisation) exactement comme le ferait un vrai connecteur,
-- afin de valider toute la chaîne avant l'arrivée du connecteur Decenium.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.nexus_simulate_cash_sale(p_site text default 'vito-sainte-marie')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_employee record;
  v_external_id text := 'sim_' || replace(gen_random_uuid()::text, '-', '');
  v_now timestamptz := now();
  v_quantity numeric := 1 + floor(random() * 3);
  v_unit_ht numeric;
  v_unit_ttc numeric;
  v_purchase_ht numeric;
  v_total_ttc numeric;
  v_payload jsonb;
  v_raw_id uuid;
  v_normalized_id uuid;
  v_sync_id uuid;
begin
  select id, article, code_barres, categorie, coalesce(prix_vente, 5) as prix_vente, coalesce(prix_achat, 2.5) as prix_achat, coalesce(tva, 8.5) as tva
    into v_product
    from public.products
    where site = p_site
    order by random()
    limit 1;

  select id into v_employee
    from public.employees
    where site_id = p_site and actif = true
    order by random()
    limit 1;

  v_unit_ttc := round(v_product.prix_vente::numeric, 2);
  v_unit_ht := round(v_unit_ttc / (1 + coalesce(v_product.tva, 8.5) / 100.0), 2);
  v_purchase_ht := round(coalesce(v_product.prix_achat, v_unit_ht * 0.5)::numeric, 2);
  v_total_ttc := round(v_unit_ttc * v_quantity, 2);

  v_payload := jsonb_build_object(
    'id', v_external_id,
    'created_at', v_now,
    'updated_at', v_now,
    'status', 'completed',
    'ticket_id', 'sim_tk_' || to_char(v_now, 'YYYYMMDDHH24MISS'),
    'register_id', 'simulateur-01',
    'employee_id', v_employee.id,
    'shift_id', 'sim_shift_' || to_char(v_now, 'YYYYMMDD'),
    'sold_at', v_now,
    'product_id', v_product.id,
    'barcode', v_product.code_barres,
    'category', v_product.categorie,
    'quantity', v_quantity,
    'unit_sale_price_ht', v_unit_ht,
    'unit_sale_price_ttc', v_unit_ttc,
    'unit_purchase_price_ht', v_purchase_ht,
    'cost_method', 'dernier_achat',
    'currency', 'EUR',
    'vat_rate', v_product.tva,
    'discount_ttc', 0,
    'total_ttc', v_total_ttc
  );

  insert into public.synchronization_history (site, source, domaine, statut, dernier_curseur)
    values (p_site, 'simulateur', 'sales', 'en_cours', v_external_id)
    returning id into v_sync_id;

  insert into public.raw_sales (site, source, external_id, external_updated_at, payload)
    values (p_site, 'simulateur', v_external_id, v_now, v_payload)
    on conflict (site, source, external_id, external_updated_at) do nothing
    returning id into v_raw_id;

  if v_raw_id is null then
    update public.synchronization_history
      set statut = 'echec', termine_le = now(), nb_erreurs = 1,
          message = 'Conflit d''idempotence sur external_id — vente non réinsérée.'
      where id = v_sync_id;
    return null;
  end if;

  insert into public.normalization_state (raw_table, raw_id, statut, normalise_le)
    values ('raw_sales', v_raw_id, 'en_attente', null);

  begin
    insert into public.normalized_sales (
      raw_sale_id, site, ticket_id, register_id, employee_id, shift_id, sold_at,
      product_id, category, quantity, unit_sale_price_ht, unit_sale_price_ttc,
      unit_purchase_price_ht, cost_method, margin_amount_ht, margin_rate,
      currency, vat_rate, discount_ttc, total_ttc, status
    ) values (
      v_raw_id, p_site, v_payload->>'ticket_id', v_payload->>'register_id', v_employee.id, v_payload->>'shift_id', v_now,
      v_product.id, v_product.categorie, v_quantity, v_unit_ht, v_unit_ttc,
      v_purchase_ht, 'dernier_achat',
      round((v_unit_ht - v_purchase_ht) * v_quantity, 2),
      case when v_unit_ht * v_quantity <> 0 then round(((v_unit_ht - v_purchase_ht) * v_quantity) / (v_unit_ht * v_quantity), 4) else null end,
      'EUR', v_product.tva, 0, v_total_ttc, 'completed'
    ) returning id into v_normalized_id;

    update public.normalization_state set statut = 'normalise', normalise_le = now()
      where raw_table = 'raw_sales' and raw_id = v_raw_id;

    update public.synchronization_history
      set statut = 'succes', termine_le = now(), nb_recus = 1
      where id = v_sync_id;

    update public.integration_status
      set derniere_sync_le = now(), derniere_sync_statut = 'succes', maj_le = now()
      where site = p_site and source_code = 'simulateur';

  exception when others then
    update public.normalization_state set statut = 'echec', erreur = sqlerrm
      where raw_table = 'raw_sales' and raw_id = v_raw_id;
    insert into public.integration_errors (site, source, raw_table, raw_id, code, message)
      values (p_site, 'simulateur', 'raw_sales', v_raw_id, 'INTERNAL_ERROR', sqlerrm);
    update public.synchronization_history
      set statut = 'echec_partiel', termine_le = now(), nb_recus = 1, nb_erreurs = 1, message = sqlerrm
      where id = v_sync_id;
  end;

  return v_normalized_id;
end;
$$;

comment on function public.nexus_simulate_cash_sale is 'Simulateur de caisse : génère une vente de test et la fait transiter par tout le pipeline RAW→normalisation, exactement comme un vrai connecteur. À désactiver/remplacer une fois le connecteur Decenium réel en service.';

-- Source "simulateur" ajoutée au catalogue des intégrations
insert into public.integration_sources (code, nom, type, description) values
  ('simulateur', 'Simulateur de caisse NEXUS', 'caisse', 'Connecteur de test interne — génère des ventes fictives pour valider toute la chaîne avant l''arrivée du connecteur Decenium réel.')
on conflict (code) do nothing;

insert into public.integration_status (site, source_code, statut, message) values
  ('vito-sainte-marie', 'simulateur', 'connecte', 'Simulateur actif — génère des ventes de test toutes les 15 minutes.')
on conflict (site, source_code) do update set statut = excluded.statut, message = excluded.message, maj_le = now();

-- Planification automatique : toutes les 15 minutes
select cron.schedule(
  'nexus-simulateur-caisse',
  '*/15 * * * *',
  $$select public.nexus_simulate_cash_sale('vito-sainte-marie');$$
);
