-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831215225 · journaliser_ecarts_reception_mesures
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create unique index if not exists uq_reception_anomalie_mesuree
on public.carburant_reception_anomalies (visite_id, type, carburant)
where type = 'jaugeage_vs_prevu';

create or replace function public.nexus_journaliser_anomalie_reception_mesuree()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'a_rapprocher' then
    insert into public.carburant_reception_anomalies (
      visite_id, site, type, carburant, details, statut
    ) values (
      new.visite_id,
      new.site,
      'jaugeage_vs_prevu',
      new.carburant,
      jsonb_build_object(
        'quantite_bl_l', new.quantite_bl_l,
        'quantite_compartiments_l', new.quantite_compartiments_l,
        'quantite_mesuree_l', new.quantite_mesuree_l,
        'ecart_l', new.delta_l,
        'ecart_ratio', new.delta_ratio,
        'qualification_source', new.statut,
        'source_detection', 'rapprochement_reception_automatique',
        'cause_etablie', false
      ),
      'informative'
    )
    on conflict (visite_id, type, carburant) where type = 'jaugeage_vs_prevu'
    do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.nexus_journaliser_anomalie_reception_mesuree() from public;

create trigger trg_journaliser_anomalie_reception_mesuree
after insert or update of statut, quantite_bl_l, quantite_compartiments_l, quantite_mesuree_l, delta_l, delta_ratio
on public.carburant_reception_visite_lignes
for each row
execute function public.nexus_journaliser_anomalie_reception_mesuree();
