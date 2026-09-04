-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830231059 · fdj_releve_auto_sync_apres_cash_control
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.fdj_sync_releve_apres_cash_control()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_shift record;
  v_prev record;
  v_si jsonb;
  v_ap jsonb;
  v_sf jsonb;
  v_ventes jsonb;
  v_lots numeric;
  v_tirages numeric;
  v_version integer;
begin
  select * into v_shift from fdj_shifts where id = new.shift_id;
  if not found or v_shift.statut <> 'valide' then return new; end if;

  select * into v_prev
  from fdj_releves_cloture
  where shift_id = new.shift_id
  order by version_num desc
  limit 1;

  if not found then return new; end if;

  if v_prev.ecart is not distinct from new.ecart
     and v_prev.caisse_attendue is not distinct from new.caisse_attendue
     and v_prev.caisse_reelle is not distinct from new.caisse_reelle
     and v_prev.ventes_grattage_valeur is not distinct from new.ventes_grattage_valeur
     and v_prev.regularisations is not distinct from new.regularisations then
    return new;
  end if;

  select
    coalesce(jsonb_object_agg(game_id, stock_initial), '{}'::jsonb),
    coalesce(jsonb_object_agg(game_id, appro), '{}'::jsonb),
    coalesce(jsonb_object_agg(game_id, stock_final), '{}'::jsonb),
    coalesce(jsonb_object_agg(game_id, jsonb_build_object('qte', ventes_qte, 'valeur', ventes_valeur)), '{}'::jsonb)
  into v_si, v_ap, v_sf, v_ventes
  from fdj_shift_counts
  where shift_id = new.shift_id;

  select
    max(lots_payes_grattage) filter (where type_rapport='journalier'),
    max(caisse_tirages) filter (where type_rapport='temps_reel')
  into v_lots, v_tirages
  from fdj_reports
  where shift_id = new.shift_id;

  select coalesce(max(version_num),0) + 1
  into v_version
  from fdj_releves_cloture
  where shift_id = new.shift_id;

  insert into fdj_releves_cloture(
    site, shift_id, date, quart, employee_id, version_num, type_version, cree_par,
    stock_initial_par_jeu, appro_par_jeu, stock_final_par_jeu, ventes_par_jeu,
    ventes_grattage_valeur, lots_payes_grattage, caisse_tirages, regularisations,
    caisse_attendue, caisse_reelle, ecart, anomalie_chaine, statut,
    motif_regularisation, diff_vs_precedent, signature, caractere
  ) values (
    v_shift.site, v_shift.id, v_shift.date, v_shift.quart, v_shift.employee_id,
    v_version, 'regularisation_manager', auth.uid(),
    v_si, v_ap, v_sf, v_ventes,
    new.ventes_grattage_valeur, v_lots, v_tirages, new.regularisations,
    new.caisse_attendue, new.caisse_reelle, new.ecart,
    coalesce(v_prev.anomalie_chaine, '{}'::jsonb),
    'regularise',
    'Synchronisation automatique après mise à jour du contrôle FDJ',
    jsonb_build_object(
      'ecart', jsonb_build_object('avant', v_prev.ecart, 'apres', new.ecart),
      'caisse_attendue', jsonb_build_object('avant', v_prev.caisse_attendue, 'apres', new.caisse_attendue),
      'caisse_reelle', jsonb_build_object('avant', v_prev.caisse_reelle, 'apres', new.caisse_reelle)
    ),
    jsonb_build_object(
      'utilisateur_id', auth.uid(),
      'nom', 'NEXUS',
      'role', 'system',
      'date_heure', now(),
      'version_donnees', v_version,
      'quart_id', v_shift.id,
      'message_confirmation', 'Relevé synchronisé automatiquement avec le contrôle FDJ courant.'
    ),
    'definitif'
  );

  return new;
end;
$$;

drop trigger if exists trg_fdj_sync_releve_apres_cash_control on public.fdj_cash_controls;
create trigger trg_fdj_sync_releve_apres_cash_control
after update of caisse_reelle, caisse_attendue, ecart, ventes_grattage_valeur, regularisations
on public.fdj_cash_controls
for each row
when (
  old.caisse_reelle is distinct from new.caisse_reelle
  or old.caisse_attendue is distinct from new.caisse_attendue
  or old.ecart is distinct from new.ecart
  or old.ventes_grattage_valeur is distinct from new.ventes_grattage_valeur
  or old.regularisations is distinct from new.regularisations
)
execute function public.fdj_sync_releve_apres_cash_control();
