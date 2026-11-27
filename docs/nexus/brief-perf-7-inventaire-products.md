# Brief perf-7 — inventaire des lectures de `products` (option c)

Consigne 7217202873 (issue #409) : calculer `products` côté base, d'abord sur Test, inventaire avant tout.
Ce document précède la migration. Rien n'est appliqué en base par cette PR (brouillon, base `production`).

## Ce que le lot change, et ce qu'il laisse

| Lecteur | Champs lus | Filtres | Ordre | Agrégation dans le navigateur | Décision |
|---|---|---|---|---|---|
| `chargerCandidatsStock` (nexus-conseiller-donnees.js) | article, quantite, prix_vente, periode_debut, periode_fin | site | article | `NexusStock.calculerAnalyseStock` : somme des quantités par article, somme sur la fenêtre entre deux relevés, premier prix non nul, présence de ventes | **Passe par la base** (`products_ventes_stock`) |
| `chargerProduitsBrut` / `chargerProducts` (Brief, Cockpit, Accueil) | categorie, article, ca, marge, quantite, periode_debut, periode_fin | site, hors `produits_appel` | periode_debut desc, article | Indice, tendances, marge : lignes brutes exigées par `NexusIndice`, `NexusMarge` | Garde sa lecture brute |
| Marge+ (`nexus-risques-donnees.js` 565 et 583) | periode_debut, periode_fin / ca, marge | site, catégorie, période | periode_debut desc | somme ca et marge par catégorie et période | Garde sa lecture (jeu déjà filtré par période, petit) |
| Analyse de marge par période (`nexus-rapport-donnees.js` 91 et 137) | ca / ca, marge | site, periode_debut, periode_fin | aucun | sommes | Garde sa lecture (déjà filtré) |
| Rapport direction (`nexus-rapport-direction-donnees.js` 47 et 169) | categorie, article, ca, marge, périodes | site | periode_debut | agrégations par catégorie et période | Garde sa lecture (lignes brutes) |
| Candidats Produits / Constat Tempo (`chargerConstatTempo`, 211) | categorie, article, ca, périodes | site | aucun | regroupements par article | Garde sa lecture (ca, catégorie exigés) |
| Réappro stock, inventaires réassort, politique tarifaire, accueil (`nexus-app-donnees.js` 177) | code_barres, quantite, périodes, ca | site, période | divers | divers | Hors Brief, inchangés |
| `nexus-import-donnees.js` (123, 166) | écritures | | | | Écriture : jamais touché |

Seul le premier lecteur est migré : c'est le seul dont la totalité du besoin se réduit à (article, période, quantité, prix) et que le calcul
consomme sans autre champ. Les autres exigent des lignes brutes (`ca`, `marge`, `categorie`, `code_barres`) ; la consigne les laisse sur leur lecture actuelle.

## Équivalence

La fonction regroupe par (article, periode_debut, periode_fin), somme `quantite` (numeric, somme exacte) et rend le premier `prix_vente` non nul.
`calculerAnalyseStock` n'est pas modifiée. Ses quatre usages de `ventes` sont conservés par ce regroupement :
prix de vente (premier non nul), quantité totale (somme), ventes entre deux relevés (somme sur des périodes entières), présence de ventes.

Écart documenté : si un article porte plusieurs prix non nuls distincts, l'ancien « premier en ordre de stockage » était non déterministe ;
la fonction prend le plus petit `id`. Identique dès que le prix est unique par article.

Preuve : `test_products_ventes_stock_equivalence_20261127.js` (jeu fictif, comparaison ligne à ligne de `calculerAnalyseStock` brut contre agrégé,
repli, journal, contrat de la migration). Guardian rejouera la parité sur Test avec des requêtes SQL.

## Sécurité et rollback

`security invoker` (la RLS de l'appelant s'applique), `search_path` vide, `p_site` obligatoire et filtré explicitement, aucune écriture,
`revoke` pour `public` et `anon`, `grant execute` à `authenticated` seul. Aucun index ajouté : `idx_products_lookup (site, categorie, article, periode_debut)` existe.
Le plan `explain` ne peut être produit que sur Test, une fois la migration appliquée par Guardian.
Rollback : `drop function public.products_ventes_stock(text);`. Le front retombe seul sur la lecture brute si la fonction est absente ou refusée
(journal `[diag perf] ventes stock : …` avec `?diag=perf`).
