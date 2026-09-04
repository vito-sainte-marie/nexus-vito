-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831131315 · inventaire_facteur_conditionnement_decenium
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_zone_produit
  add column if not exists facteur_conditionnement integer,
  add column if not exists conditionnement_source text;

alter table public.inventaire_zone_produit
  drop constraint if exists inventaire_zone_produit_facteur_conditionnement_check;
alter table public.inventaire_zone_produit
  add constraint inventaire_zone_produit_facteur_conditionnement_check
  check (facteur_conditionnement is null or facteur_conditionnement > 0);

with latest as (
  select distinct on (site, code_barres)
    site, code_barres, article,
    ((regexp_match(article, '(?:^|[[:space:]_-])([0-9]{1,3})[[:space:]]*P[[:space:]]*$','i'))[1])::integer as facteur
  from public.products
  where code_barres is not null
    and trim(code_barres) <> ''
    and article ~* '(?:^|[[:space:]_-])[0-9]{1,3}[[:space:]]*P[[:space:]]*$'
  order by site, code_barres, periode_fin desc nulls last, imported_at desc nulls last
)
update public.inventaire_zone_produit p
set facteur_conditionnement = l.facteur,
    conditionnement_source = 'designation_decenium'
from latest l
where l.site=p.site
  and trim(l.code_barres)=trim(p.code_barres)
  and l.facteur > 0;

comment on column public.inventaire_zone_produit.facteur_conditionnement is 'Nombre d unités de base par conditionnement. Peut être dérivé du suffixe Decenium -10P/-8P/-5P via code-barres.';
comment on column public.inventaire_zone_produit.conditionnement_source is 'Origine du facteur de conditionnement, ex. designation_decenium.';
