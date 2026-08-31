-- NEXUS Carburants — réparation historique P0 exécutée le 31/08/2026.
--
-- Contexte : l'ancien pont Réception -> carburant_releves avait remplacé le
-- relevé d'ouverture par le jaugeage post-livraison sur trois dates.
-- Les versions d'origine étaient intactes dans carburant_releve_versions.
--
-- Ce script ne supprime aucune version : il crée une nouvelle version de
-- restauration et remet la ligne matérialisée carburant_releves sur la
-- dernière version antérieure qui n'est PAS d'origine reception_livraison.
-- Le garde-fou 20260831233500_preserver_releve_ouverture_lors_reception.sql
-- empêche ensuite la récidive.

with candidates as (
  select
    r.id as releve_id,
    r.site,
    r.date,
    r.version_num as version_courante,
    v.version_num as version_source,
    v.stock_reel_go_cuve1,
    v.stock_reel_go_cuve2,
    v.stock_reel_sp95,
    v.stock_reel_gnr,
    v.livraison_go,
    v.livraison_sp95,
    v.livraison_gnr,
    v.mouvement_go,
    v.mouvement_sp95,
    v.mouvement_gnr,
    v.motif_mouvement,
    v.commentaire,
    v.auteur,
    v.origine,
    v.mesure_le
  from public.carburant_releves r
  join lateral (
    select rv.*
    from public.carburant_releve_versions rv
    where rv.site = r.site
      and rv.date = r.date
      and rv.origine <> 'reception_livraison'
    order by rv.version_num desc
    limit 1
  ) v on true
  where r.origine = 'reception_livraison'
), inserted as (
  insert into public.carburant_releve_versions (
    site,date,version_num,type_version,
    stock_reel_go_cuve1,stock_reel_go_cuve2,stock_reel_sp95,stock_reel_gnr,
    livraison_go,livraison_sp95,livraison_gnr,
    mouvement_go,mouvement_sp95,mouvement_gnr,
    motif_mouvement,commentaire,motif_correction,diff_vs_precedent,
    auteur,origine,visite_reception_id,mesure_le
  )
  select
    c.site,c.date,c.version_courante + 1,'correction_manager',
    c.stock_reel_go_cuve1,c.stock_reel_go_cuve2,c.stock_reel_sp95,c.stock_reel_gnr,
    c.livraison_go,c.livraison_sp95,c.livraison_gnr,
    c.mouvement_go,c.mouvement_sp95,c.mouvement_gnr,
    c.motif_mouvement,c.commentaire,
    'Restauration P0 : le relevé d''ouverture reste l''ancre ; la réception postérieure reste une preuve séparée.',
    jsonb_build_object(
      'restauration_convention_ouverture', true,
      'version_source', c.version_source,
      'version_reception_remplacee', c.version_courante
    ),
    c.auteur,c.origine,null,c.mesure_le
  from candidates c
  returning site,date,version_num
)
update public.carburant_releves r
set
  version_num = i.version_num,
  stock_reel_go_cuve1 = c.stock_reel_go_cuve1,
  stock_reel_go_cuve2 = c.stock_reel_go_cuve2,
  stock_reel_sp95 = c.stock_reel_sp95,
  stock_reel_gnr = c.stock_reel_gnr,
  livraison_go = c.livraison_go,
  livraison_sp95 = c.livraison_sp95,
  livraison_gnr = c.livraison_gnr,
  mouvement_go = c.mouvement_go,
  mouvement_sp95 = c.mouvement_sp95,
  mouvement_gnr = c.mouvement_gnr,
  motif_mouvement = c.motif_mouvement,
  commentaire = c.commentaire,
  saisi_par = c.auteur,
  origine = c.origine,
  mesure_le = c.mesure_le,
  controle_statut = 'en_attente'
from candidates c
join inserted i on i.site=c.site and i.date=c.date
where r.id=c.releve_id;
