-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831014759 · nexus_stock_etat_v2_semantique_temporelle
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace view public.nexus_stock_etat_v2 as
select
  e.*,
  e.stock_reel as stock_reel_observe,
  e.stock_reel_le as stock_reel_observe_le,
  case
    when e.stock_reel_le is not null and e.stock_theorique_le is not null
      then abs(extract(epoch from (e.stock_reel_le - e.stock_theorique_le)))::bigint
    else null
  end as delta_t_secondes,
  case
    when e.stock_reel is not null
     and e.stock_theorique is not null
     and e.stock_reel_le is not null
     and e.stock_theorique_le is not null
     and abs(extract(epoch from (e.stock_reel_le - e.stock_theorique_le))) <= 900
      then true
    else false
  end as comparaison_fiable,
  e.ecart_reel_theorique as ecart_brut_non_aligne,
  case
    when e.stock_reel is not null
     and e.stock_theorique is not null
     and e.stock_reel_le is not null
     and e.stock_theorique_le is not null
     and abs(extract(epoch from (e.stock_reel_le - e.stock_theorique_le))) <= 900
      then e.ecart_reel_theorique
    else null
  end as ecart_reference,
  case
    when e.stock_reel_le is not null
      then greatest(0, extract(epoch from (now() - e.stock_reel_le)))::bigint
    else null
  end as age_stock_reel_secondes,
  case
    when e.stock_reference_nature = 'reel' and e.stock_reel_le >= now() - interval '15 minutes' then 'haute'
    when e.stock_reference_nature = 'reel' and e.stock_reel_le >= now() - interval '24 hours' then 'moyenne'
    when e.stock_reference_nature = 'reel' then 'ancienne'
    when e.stock_reference_nature = 'theorique' and e.stock_theorique is not null then 'theorique'
    else 'insuffisante'
  end as stock_reference_confiance,
  case
    when e.stock_reference_nature = 'reel' and e.stock_reel_le >= now() - interval '15 minutes' then 'observe_recent'
    when e.stock_reference_nature = 'reel' and e.stock_reel_le >= now() - interval '24 hours' then 'observe_du_jour'
    when e.stock_reference_nature = 'reel' then 'observe_ancien'
    when e.stock_reference_nature = 'theorique' and e.stock_theorique is not null then 'theorique_seul'
    else 'indisponible'
  end as stock_reference_statut,
  case
    when e.stock_reference_nature = 'reel' then e.stock_reel_le
    when e.stock_reference_nature = 'theorique' then e.stock_theorique_le
    else null
  end as stock_reference_le
from public.nexus_stock_etat e;

comment on view public.nexus_stock_etat_v2 is
'NEXUS Stock Engine V2. Sépare observation physique et stock théorique, conserve les deux sources, interdit l''interprétation d''un écart non aligné dans le temps comme écart fiable. Un import ne remplace jamais un stock réel.';
