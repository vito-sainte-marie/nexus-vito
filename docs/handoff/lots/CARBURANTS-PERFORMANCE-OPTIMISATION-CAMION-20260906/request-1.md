---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a512f65 production=501c0c7
  - id: reconciliation-migrations
    classe: VERIFIED
    valeur: zero ecart dans les deux sens, comportement inchange
  - id: diagnostic-avant-modification
    classe: VERIFIED
    valeur: 36000 atteint par l optimiseur, 1000 L perdus a l arrondi
  - id: cas-de-reference
    classe: VERIFIED
    valeur: 35000 devient 36000 quand sur et absorbable
  - id: trois-refus-motives
    classe: VERIFIED
    valeur: capacite, non absorbable chiffre, rotation inconnue
  - id: gardes-reutilisees
    classe: VERIFIED
    valeur: meme SEUIL_AUTONOMIE que completerVersCamionPlein
  - id: retrocompatibilite
    classe: VERIFIED
    valeur: aucune recuperation hors mode camion complet
  - id: suite
    classe: VERIFIED
    valeur: 194/203
  - id: baseline-corrigee
    classe: VERIFIED
    valeur: section refs protegees mise a jour
  - id: preuve-ui
    classe: HUMAN
    valeur: non apportee, requiert une session navigateur
  - id: couche-p0
    classe: HUMAN
    valeur: passage de reliquatArrondi non verifie
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# CARB-004 — optimisation camion, et remise en ordre du rail Test

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'un camion parte plein quand c'est sûr, sans jamais forcer un volume non absorbable. |
| `gain_attendu` | **Marge** — 1 000 L par livraison récupérés dans le cas de référence, sans relâcher aucune garde. Et **fiabilité** : le dépôt reproduit à nouveau Test. |
| `contrats_touches` | `construireEvaluationGlobale` (moteur de commande) · registre des migrations |
| `guardians_requis` | Architecture · Business Rules · QA / Regression |
| `preuves_exigees` | diagnostic avant modification · cas de référence · 3 refus motivés · réconciliation dans les deux sens |
| `definition_de_termine` | Les quatre points de la consigne exécutés dans l'ordre. **Atteinte.** |

## 1. Réconciliation des migrations — faite

La correction du fuseau existait en deux exemplaires divergents :
`20260906113147` appliquée à Test **sans fichier**, posée par `apply_migration`
qui horodate lui-même la version ; `20260906120000` versionnée **sans être
appliquée**.

Le fichier manquant est reconstitué **depuis
`schema_migrations.statements`, sans rien reformuler** — un fichier de
réconciliation qui « améliorerait » ce qui a été appliqué ne réconcilierait
rien. Et `20260906120000` est appliquée.

```
appliquée SANS fichier : (aucune)
fichier NON appliqué   : (aucune)
comportement           : veille-station false, jour-station true — inchangé
immuabilité production : 240 migrations contrôlées, intactes
```

## 2. `decision-4.md` — consommée

Commit `452eef8`, lot `CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906`.

## 3. CARB-004 — le plafond n'était pas une garde métier

### Diagnostic, produit AVANT toute modification

```
AVANT arrondi  : sp95=28761  go=7239  total=36000
APRES arrondi  : sp95=28000  go=7000  total=35000
PERDU par l'arrondi : 1000 L
```

`optimiserCommandeMultiCarburant` **atteint réellement le maximum camion**.
C'est l'arrondi au millier inférieur, appliqué carburant par carburant, qui
rabote chacun. Et le filet de rattrapage existant ne regardait que le
`minimum_camion_litres` : au-dessus du minimum, le reliquat disparaissait en
silence.

Le complément d'un compartiment était pourtant, dans ce cas, à la fois
physiquement sûr (8 000 ≤ 28 000) et absorbable (5,7 j ≤ 20 j).

**Le « plafond à 35 000 L » n'existait nulle part comme règle. C'était un
effet d'arrondi.**

### Correction — les gardes sont réutilisées, pas réécrites

Une phase de **récupération du reliquat d'arrondi**, après l'arrondi et avant
le plafond camion. Elle réutilise le plafond de capacité déjà arrondi au
millier inférieur, et `SEUIL_AUTONOMIE_MAX_JOURS_COMPLETION` — **le même
seuil** que `completerVersCamionPlein`. Elle ne dépasse jamais ce que
l'optimiseur avait jugé nécessaire, ni le maximum camion.

**Une différence assumée** avec `completerVersCamionPlein` : quand une donnée
d'absorption manque, celui-ci autorise la capacité seule ; cette phase-ci **ne
complète pas**. La décision est explicite — « le moteur n'invente pas de ventes
futures ». Une récupération d'arrondi est un gain marginal : elle ne justifie
pas d'être permissive sur une donnée absente.

### Les quatre cas exigés

| Cas | Résultat |
|---|---|
| **référence** — compartiment sûr et absorbable | 35 000 → **36 000 L** |
| physiquement impossible | reste sous la cible, motif nommant la capacité |
| possible mais **non absorbable** | refus, motif **chiffré** en jours de stock |
| rotation inconnue | rien n'est inventé, motif d'incertitude |

Détail utile : dans le cas de référence, le compartiment va au **go**, pas au
carburant prioritaire — `sp95` est premier dans l'ordre mais sa capacité
arrondie (28 000) interdit un pas de plus. La priorité oriente, elle ne force
pas.

Aucun site codé en dur ; la cible vient de `config.maximum_camion_litres`.
Rétrocompatibilité stricte hors mode camion complet.

## 4. Baseline documentaire — corrigée en dernier

La section « Refs protégées » affirmait `main` **et** `production` à
`501c0c7`. C'est désormais faux pour `main`, qui porte le canal `@claude` et la
sécurisation de son déclencheur. Ces commits ne touchent **aucun code métier,
aucune migration, aucune policy** : le gel métier reste exact, c'était sa
formulation qui ne l'était plus.

## Preuves

- Réconciliation vérifiée **dans les deux sens** : zéro écart.
- Diagnostic CARB-004 reproduit numériquement avant modification.
- `test_carburant_commande_reliquat_arrondi_20260906.js` — **9 vérifications**.
- Suite `194/203`, mêmes 9 échecs historiques. Simulations carburant et Paye au vert.
- Garde de portée : 209 `SAFE`, 0 `VULNERABLE`, 0 `UNKNOWN`.
- `production` : `501c0c7`, intacte. Aucune écriture Production.

## Risques / anomalies

1. **Une de mes trois mutations n'est pas observable.** La borne sur
   `optim.total` est couverte par les plafonds de capacité et d'autonomie : la
   retirer ne change aucun résultat mesuré. Je l'ai gardée comme garantie par
   construction et **le test le dit**, plutôt que de fabriquer une détection.
   J'avais d'abord cru la détecter — le test échouait en réalité dans les deux
   cas, ce qui n'est pas une détection mais un test cassé.
2. **Preuve UI/navigateur non apportée** — `decision-4` la réclamait déjà pour
   `request-3`. Elle reste due.
3. **`nexus-carburants-p0-fixes.js`** enveloppe le moteur ; je n'ai pas vérifié
   que la nouvelle sortie `reliquatArrondi` y transite intacte.
4. Deux migrations idempotentes font désormais la même chose ; c'est le prix
   assumé d'une réconciliation qui ne réécrit pas l'histoire.

## Questions pour arbitrage

**Q64 — La preuve UI est-elle exigée pour clore Carburants Performance ?**
Recommandation : **oui**, et elle demande une session navigateur avec PIN. Le
moteur est prouvé, l'écran ne l'est pas.

**Q65 — Faut-il vérifier le passage de `reliquatArrondi` dans la couche P0 ?**
Recommandation : **oui, avant clôture** — c'est exactement le défaut du Brief
en A3, où un enrobage silencieux avalait un argument.

**Q66 — Garder une borne non observable ?** Recommandation : **oui**, mais
documentée comme telle. Une garantie par construction vaut mieux qu'un test
qui prétend la vérifier.

## Action attendue de ChatGPT

Arbitrer Q64, Q65, Q66 pour le `LOT_ID`
**CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906**. **Aucune autorisation
Production ; la classe D reste fermée.**
