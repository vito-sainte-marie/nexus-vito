-- Brief perf-7 (option c, #409) : agrégation des ventes `products` côté base, pour chargerCandidatsStock.
-- LECTURE SEULE. Aucun calcul nouveau : même grain que ce que consomme NexusStock.calculerAnalyseStock
-- (article, periode_debut, periode_fin), quantités déjà sommées, premier prix de vente non nul de la ligne.
-- security invoker : la RLS de `products` s'applique à l'appelant ; le filtre de site est écrit en toutes lettres.
-- search_path vide : tout est qualifié. Aucune écriture, aucun octroi sur la table.
-- Index : idx_products_lookup (site, categorie, article, periode_debut) existe déjà ; aucun index ajouté.
--
-- Écart assumé et documenté : quand un même article porte plusieurs prix de vente non nuls,
-- l'ancien code prenait « la première ligne rencontrée » (ordre de stockage, non défini). Ici : plus petit id.
-- Sans effet quand le prix est unique par article ; voir docs/nexus/brief-perf-7-inventaire-products.md.
--
-- ROLLBACK (aucune donnée touchée) :  drop function public.products_ventes_stock(text);

create or replace function public.products_ventes_stock(p_site text)
returns table (article text, periode_debut date, periode_fin date, quantite numeric, prix_vente numeric)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_site is null or btrim(p_site) = '' then
    raise exception 'valeur_invalide : p_site est obligatoire' using errcode = 'P0001';
  end if;
  return query
    select p.article, p.periode_debut, p.periode_fin,
           coalesce(sum(p.quantite), 0)::numeric,
           (array_agg(p.prix_vente order by p.id) filter (where p.prix_vente is not null and p.prix_vente <> 0))[1]
    from public.products p
    where p.site = p_site
    group by p.article, p.periode_debut, p.periode_fin
    order by p.article, p.periode_debut, p.periode_fin;
end;
$$;

revoke all on function public.products_ventes_stock(text) from public;
revoke all on function public.products_ventes_stock(text) from anon;
grant execute on function public.products_ventes_stock(text) to authenticated;
