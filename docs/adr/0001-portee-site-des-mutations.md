# ADR-0001 — Toute mutation d'une donnée à portée site contrôle l'acteur **et** la portée

**État** : PROPOSÉE — en attente d'arbitrage
**Date** : 06/09/2026
**Lot** : `SITE-EXPLICITE-1-MUTATION-SITE-GUARD-20260906`

## Contexte

Trois fois pendant la campagne, le même défaut a été trouvé, écrit trois fois
de la même manière :

| Table | Policy | Ce qu'elle contrôlait | Ce qu'elle oubliait |
|---|---|---|---|
| `mission_progress` | `employee_own_progress_update` | l'auteur | le site |
| `apprentissage_snapshots` | `employee_own_snapshot_update` | l'auteur | le site |
| `advisor_rules` | `manager_update_advisor_rules` | le rôle | le site |

Les deux dernières ont été **prouvées par comportement** : une ligne
correctement créée a réellement changé de commerce.

Ce n'est pas une série d'oublis isolés, c'est un **motif** : *on contrôle qui
agit, on oublie où la donnée atterrit.*

## Décision

> Toute mutation d'une donnée à portée site doit contrôler à la fois l'acteur
> autorisé et la **cohérence de portée métier** de la nouvelle ligne. Lorsque
> la donnée est globale, locale, ou porte une identité plus précise — service,
> employé, caisse, inventaire, livraison — la policy doit préserver
> explicitement cette portée et ne jamais la déduire d'un rôle seul.

Trois corollaires, tirés de ce que la campagne a montré :

1. **Un rôle n'est pas une portée.** « Être manager » ne dit pas *de quel
   commerce*. `advisor_rules` en est la démonstration.
2. **Une donnée globale n'est pas une donnée sans site**, c'est une donnée
   dont la portée est *tous les sites*. Elle ne devient pas locale par une
   mise à jour.
3. **Une portée plus précise que le site prime sur le site.** Quand une ligne
   est rattachée à un service, vérifier le site du compte ne suffit pas :
   `mission_progress` acceptait une progression rattachée au service d'autrui.

## Ce que cette ADR n'impose pas

Elle ne prescrit **pas** une formule unique. Trois policies écrites à
l'identique auraient reproduit le défaut de `mission_progress` — la
généralisation est ici l'ennemi. Le contrat se décide **table par table**,
d'après ses écrivains légitimes et sa notion de portée.

Elle ne prescrit pas non plus un mécanisme : policy, `with check`, trigger ou
contrainte, selon ce que la portée exige. `advisor_rules` a demandé les deux —
une policy pour *qui*, un trigger pour l'immuabilité de la portée, parce
qu'un `with check` ne voit pas l'ancienne ligne.

## Incarnation vérifiable

- `supabase/migrations/20260906020000_garde_ecriture_site.sql` — écriture ;
- `supabase/migrations/20260906040000_garde_mutation_site.sql` — mutation ;
- `test_garde_ecriture_site_20260906.js` — 9 vérifications ;
- `test_garde_mutation_site_20260906.js` — 8 vérifications, dont une qui exige
  que les contrats **ne soient pas identiques** ;
- **à venir** : garde statique CI vérifiant que toute policy de mutation sur
  une table à portée site contrôle cette portée, avec `UNKNOWN/REVIEW` quand
  elle ne sait pas conclure. C'est cette garde qui rendra l'ADR opposable
  plutôt que déclarative.

## Conséquences

Positives : le motif est nommé, donc repérable ; une quatrième occurrence
devient détectable au lieu d'être découverte par hasard.

Négatives, et à assumer : chaque table demande une analyse propre, ce qui coûte
plus qu'une règle uniforme. Et tant que la garde statique n'existe pas, cette
ADR **repose sur la vigilance** — c'est-à-dire sur exactement ce que le
Governance Core dit de ne pas faire.

## Statut des occurrences

| Occurrence | État |
|---|---|
| `mission_progress` | **corrigée** — lot 2B-SECURITY-WRITE-GUARD |
| `apprentissage_snapshots` | **corrigée** — ce lot |
| `advisor_rules` UPDATE + DELETE | **corrigée** — ce lot |
| `advisor_rules` INSERT | **ouverte** — hors périmètre, signalée |
| `apprentissage_snapshots` INSERT | **ouverte** — hors périmètre, signalée |
