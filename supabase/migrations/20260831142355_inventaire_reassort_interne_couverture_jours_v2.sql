-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831142355 · inventaire_reassort_interne_couverture_jours_v2
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_reassort_interne_regles
  add column if not exists mode_calcul text not null default 'quantite_fixe',
  add column if not exists couverture_cible_jours numeric;

alter table public.inventaire_reassort_interne_regles
  drop constraint if exists inventaire_reassort_interne_regles_mode_calcul_check;
alter table public.inventaire_reassort_interne_regles
  add constraint inventaire_reassort_interne_regles_mode_calcul_check
  check (mode_calcul in ('quantite_fixe','couverture_jours'));

alter table public.inventaire_reassort_interne_regles
  drop constraint if exists inventaire_reassort_interne_regles_couverture_cible_jours_check;
alter table public.inventaire_reassort_interne_regles
  add constraint inventaire_reassort_interne_regles_couverture_cible_jours_check
  check (couverture_cible_jours is null or couverture_cible_jours > 0);

insert into public.inventaire_reassort_interne_regles
(site,categorie_id,produit_id,zone_source_id,zone_destination_id,seuil_destination,cible_destination,actif,mode_calcul,couverture_cible_jours,updated_at)
select
  'vito-sainte-marie', c.id, null, zb.id, zt.id, 0, 0, true, 'couverture_jours', 1.5, now()
from public.inventaire_categories c
join public.inventaire_zones zb on zb.site='vito-sainte-marie' and zb.code='bureau'
join public.inventaire_zones zt on zt.site='vito-sainte-marie' and zt.code='boutique'
where c.site='vito-sainte-marie' and lower(c.nom)='cigarettes'
  and not exists (
    select 1 from public.inventaire_reassort_interne_regles r
    where r.site='vito-sainte-marie' and r.categorie_id=c.id and r.produit_id is null
  );

update public.inventaire_reassort_interne_regles r
set mode_calcul='couverture_jours', couverture_cible_jours=1.5, seuil_destination=0, cible_destination=0, updated_at=now()
from public.inventaire_categories c
where r.site='vito-sainte-marie' and r.categorie_id=c.id and r.produit_id is null
  and c.site='vito-sainte-marie' and lower(c.nom)='cigarettes';
