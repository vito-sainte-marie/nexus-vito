-- Brief perf 8 : lecture des deux derniers relevés de stock par (article, catégorie).
--
-- POURQUOI. Le Conseiller lisait toute la table stock_releves pour ne garder,
-- par article, que les deux relevés les plus récents (nexus-stock.js,
-- calculerAnalyseStock : dernier et avantDernier). Cette fonction rend ces
-- lignes-là côté base, filtrées sur le site.
--
-- ÉQUIVALENCE. Le filtre estProduitNonRayon ne dépend que de (article,
-- catégorie). Les deux plus récents par (article, catégorie) forment donc un
-- sur-ensemble des deux plus récents relevés « rayon » de l'article : le
-- navigateur applique le même filtre et le même tri, et retrouve le même
-- résultat. estProduitNonRayon reste dans le navigateur.
--
-- LIMITE CONNUE. nbReleves (nexus-stock.js) compte les relevés reçus : il vaut
-- au plus 2 par (article, catégorie) avec cette fonction. Aucun écran ne le lit.
-- Toutes les autres valeurs de calculerAnalyseStock sont identiques.
--
-- DÉPARTAGE. Ordre : releve_le, importe_le, id (le dernier importé gagne).
-- Il ne change aucune valeur affichée aujourd'hui (mesure Guardian).
--
-- SÉCURITÉ. security invoker (la RLS de l'appelant s'applique), search_path
-- vide, p_site obligatoire et filtré explicitement, aucune écriture.
-- revoke public ET anon (revoke from public ne ferme pas anon), grant
-- execute à authenticated seulement.
--
-- PAGINATION. PostgREST plafonne à 1000 lignes : l'ordre de sortie est total
-- (releve_le, importe_le, id) pour que fetchAllRowsParallele pagine sans trou.
--
-- INDEX. idx_stock_releves_lookup (site, article, releve_le) existe déjà.
--
-- ROLLBACK :
--   drop function public.stock_releves_derniers(text);
-- (le front retombe seul sur la lecture brute.)

create or replace function public.stock_releves_derniers(p_site text)
returns table (
  article text,
  categorie text,
  quantite_theorique numeric,
  releve_le timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_site is null or btrim(p_site) = '' then
    raise exception 'valeur_invalide : p_site est obligatoire' using errcode = 'P0001';
  end if;

  return query
  select t.article, t.categorie, t.quantite_theorique, t.releve_le
  from (
    select r.article, r.categorie, r.quantite_theorique, r.releve_le, r.importe_le, r.id,
           row_number() over (
             partition by r.article, r.categorie
             order by r.releve_le desc, r.importe_le desc, r.id desc
           ) as rn
    from public.stock_releves r
    where r.site = p_site
  ) t
  where t.rn <= 2
  order by t.releve_le, t.importe_le, t.id;
end;
$$;

revoke all on function public.stock_releves_derniers(text) from public;
revoke all on function public.stock_releves_derniers(text) from anon;
grant execute on function public.stock_releves_derniers(text) to authenticated;
