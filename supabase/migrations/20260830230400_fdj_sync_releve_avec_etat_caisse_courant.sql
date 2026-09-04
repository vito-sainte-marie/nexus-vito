-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830230400 · fdj_sync_releve_avec_etat_caisse_courant
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.fdj_synchroniser_releves_courants(p_site text)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_count integer := 0;
  v_si jsonb; v_ap jsonb; v_sf jsonb; v_ventes jsonb;
  v_lots numeric; v_tirages numeric; v_version integer; v_prev record;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if not exists (select 1 from employees e where e.id=auth.uid() and e.site_id=p_site and e.role in ('manager','gerant')) then
    raise exception 'Accès manager requis';
  end if;

  for r in
    select s.*, c.caisse_reelle,c.caisse_attendue,c.ecart,c.regularisations,c.ventes_grattage_valeur,c.updated_at
    from fdj_shifts s join fdj_cash_controls c on c.shift_id=s.id
    where s.site=p_site and s.statut='valide' and s.date >= current_date - interval '45 days'
      and exists (select 1 from fdj_releves_cloture x where x.shift_id=s.id)
  loop
    select * into v_prev from fdj_releves_cloture x where x.shift_id=r.id order by version_num desc limit 1;
    if v_prev.ecart is not distinct from r.ecart
       and v_prev.caisse_attendue is not distinct from r.caisse_attendue
       and v_prev.caisse_reelle is not distinct from r.caisse_reelle
       and v_prev.ventes_grattage_valeur is not distinct from r.ventes_grattage_valeur then
      continue;
    end if;

    select coalesce(jsonb_object_agg(game_id,stock_initial),'{}'::jsonb),
           coalesce(jsonb_object_agg(game_id,appro),'{}'::jsonb),
           coalesce(jsonb_object_agg(game_id,stock_final),'{}'::jsonb),
           coalesce(jsonb_object_agg(game_id,jsonb_build_object('qte',ventes_qte,'valeur',ventes_valeur)),'{}'::jsonb)
      into v_si,v_ap,v_sf,v_ventes
    from fdj_shift_counts where shift_id=r.id;

    select max(lots_payes_grattage) filter (where type_rapport='journalier'),
           max(caisse_tirages) filter (where type_rapport='temps_reel')
      into v_lots,v_tirages from fdj_reports where shift_id=r.id;

    select coalesce(max(version_num),0)+1 into v_version from fdj_releves_cloture where shift_id=r.id;

    insert into fdj_releves_cloture(
      site,shift_id,date,quart,employee_id,version_num,type_version,cree_par,
      stock_initial_par_jeu,appro_par_jeu,stock_final_par_jeu,ventes_par_jeu,
      ventes_grattage_valeur,lots_payes_grattage,caisse_tirages,regularisations,
      caisse_attendue,caisse_reelle,ecart,anomalie_chaine,statut,motif_regularisation,
      diff_vs_precedent,signature,caractere)
    values(
      p_site,r.id,r.date,r.quart,r.employee_id,v_version,'regularisation_manager',auth.uid(),
      v_si,v_ap,v_sf,v_ventes,r.ventes_grattage_valeur,v_lots,v_tirages,r.regularisations,
      r.caisse_attendue,r.caisse_reelle,r.ecart,coalesce(v_prev.anomalie_chaine,'{}'::jsonb),
      'regularise','Synchronisation avec l’état courant du contrôle FDJ',
      jsonb_build_object('ecart',jsonb_build_object('avant',v_prev.ecart,'apres',r.ecart),'caisse_attendue',jsonb_build_object('avant',v_prev.caisse_attendue,'apres',r.caisse_attendue),'caisse_reelle',jsonb_build_object('avant',v_prev.caisse_reelle,'apres',r.caisse_reelle)),
      jsonb_build_object('utilisateur_id',auth.uid(),'nom','NEXUS','role','system','date_heure',now(),'version_donnees',v_version,'quart_id',r.id,'message_confirmation','Relevé synchronisé avec le contrôle FDJ courant.'),
      'definitif');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
