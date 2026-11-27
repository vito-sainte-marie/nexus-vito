# Brief perf 8 : `stock_releves_derniers(p_site)`

## Pourquoi
Le Conseiller lisait toute la table `stock_releves` pour ne garder, par article,
que les deux relevés les plus récents. La fonction rend ces lignes côté base,
filtrées sur le site. L'option (c) (`products_ventes_stock`, PR #412) est
abandonnée. Le nettoyage de `products_ventes_stock` sur Test (présente sur Test
seulement) fera l'objet d'un fichier à part ; cette migration n'y touche pas.

## Contrat
- `stock_releves_derniers(p_site text)` : `security invoker`, `search_path` vide,
  `p_site` obligatoire (erreur P0001 sinon), lecture seule.
- Rend `(article, categorie, quantite_theorique, releve_le)` : les deux plus
  récents relevés par (article, catégorie).
- Départage : `releve_le`, `importe_le`, `id` (le dernier importé gagne).
- Ordre de sortie total (`releve_le`, `importe_le`, `id`) pour la pagination
  par `fetchAllRowsParallele` (plafond PostgREST de 1000 lignes).
- `revoke` public et anon, `grant execute` à `authenticated` seulement.
- `estProduitNonRayon` reste dans le navigateur.

## Équivalence
Le filtre ne dépend que de (article, catégorie) : les deux plus récents par
(article, catégorie) forment un sur-ensemble des deux plus récents relevés
« rayon » de l'article. Le navigateur applique le même filtre et le même tri.
Épreuve : `test_stock_releves_derniers_equivalence_20261127.js` (égalités,
changement de catégorie, catégorie hors rayon, un seul relevé, autre site).

Seule différence : `nbReleves` (relevés reçus), au plus 2 par catégorie avec la
fonction. Aucun écran ne le lit.

## Repli
Si la fonction est absente, refusée ou échoue, `chargerRelevesStock` relit
`stock_releves` en brut. Le repli n'est journalisé que sous `?diag=perf`.

## Retour arrière
```sql
drop function public.stock_releves_derniers(text);
```
Le front retombe seul sur la lecture brute.

## Requête de parité pour Guardian (Test, lecture seule)
Pour un site `:site`, comparer les deux derniers relevés « rayon » par article
entre la table brute et la fonction ; le résultat attendu est zéro ligne.
```sql
with brut as (
  select article, quantite_theorique, releve_le,
         row_number() over (partition by article order by releve_le desc, importe_le desc, id desc) rn
  from public.stock_releves
  where site = :site
    and lower(coalesce(article,'')) not like '%acompte%'
    and not (lower(coalesce(categorie,'')) like '%carte%' and (lower(coalesce(categorie,'')) like '%prépayé%' or lower(coalesce(categorie,'')) like '%prepaye%'))
    and lower(coalesce(categorie,'')) not like '%transcash%'
    and lower(coalesce(categorie,'')) not like '%pcs%'
), fn as (
  select article, quantite_theorique, releve_le,
         row_number() over (partition by article order by releve_le desc) rn
  from public.stock_releves_derniers(:site)
  where lower(coalesce(article,'')) not like '%acompte%'
    and not (lower(coalesce(categorie,'')) like '%carte%' and (lower(coalesce(categorie,'')) like '%prépayé%' or lower(coalesce(categorie,'')) like '%prepaye%'))
    and lower(coalesce(categorie,'')) not like '%transcash%'
    and lower(coalesce(categorie,'')) not like '%pcs%'
)
select 'brut_sans_fn' src, b.article, b.rn from brut b
 where b.rn <= 2 and not exists (select 1 from fn f where f.article = b.article and f.quantite_theorique is not distinct from b.quantite_theorique and f.releve_le = b.releve_le)
```
