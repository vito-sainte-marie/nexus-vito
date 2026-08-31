-- NEXUS Carburants — P0 : journaliser automatiquement les écarts mesurés de réception.
--
-- Objectif : lorsqu'une ligne de réception est qualifiée `a_rapprocher`, conserver
-- l'écart dans le journal d'anomalies sans modifier les litres source et sans
-- inventer de cause. Migration idempotente et alignée sur l'état appliqué en base.

create unique index if not exists uq_reception_anomalie_mesuree
  on public.carburant_reception_anomalies (visite_id, type, carburant)
  where type = 'jaugeage_vs_prevu';

create or replace function public.nexus_journaliser_anomalie_reception_mesuree()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

drop trigger if exists trg_journaliser_anomalie_reception_mesuree
  on public.carburant_reception_visite_lignes;

create trigger trg_journaliser_anomalie_reception_mesuree
after insert or update of statut, quantite_bl_l, quantite_compartiments_l,
  quantite_mesuree_l, delta_l, delta_ratio
on public.carburant_reception_visite_lignes
for each row
execute function public.nexus_journaliser_anomalie_reception_mesuree();

-- Reprise idempotente des écarts déjà qualifiés avant l'installation du trigger.
insert into public.carburant_reception_anomalies (
  visite_id, site, type, carburant, details, statut
)
select
  l.visite_id,
  l.site,
  'jaugeage_vs_prevu',
  l.carburant,
  jsonb_build_object(
    'quantite_bl_l', l.quantite_bl_l,
    'quantite_compartiments_l', l.quantite_compartiments_l,
    'quantite_mesuree_l', l.quantite_mesuree_l,
    'ecart_l', l.delta_l,
    'ecart_ratio', l.delta_ratio,
    'qualification_source', l.statut,
    'source_detection', 'rapprochement_reception_automatique',
    'cause_etablie', false
  ),
  'informative'
from public.carburant_reception_visite_lignes l
where l.statut = 'a_rapprocher'
on conflict (visite_id, type, carburant) where type = 'jaugeage_vs_prevu'
do nothing;
