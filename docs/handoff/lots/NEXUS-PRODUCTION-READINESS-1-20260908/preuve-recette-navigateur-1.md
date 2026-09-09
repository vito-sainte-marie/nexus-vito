# Preuve — recette navigateur EXÉCUTÉE sur NEXUS Test

**Lot** NEXUS-PRODUCTION-READINESS-1-20260908 · **Release** 2026.09.1
**Run** `34378108761`, push sur `config-par-environnement`, 09/09/2026.
**Commit jugé** `ea59a4331dbf2009ab14baac4fef2f00fd2fa1cc`.

## Ce que ce document corrige d'abord : elle n'avait jamais tourné

Les étapes Test — semis Carburants, publication du journal Live, installation
de Playwright, recette navigateur — sont conditionnées à
`github.ref == 'refs/heads/config-par-environnement'`. Une **pull request**
présente `refs/pull/N/merge` : sur tous les runs de PR, ces cinq étapes étaient
`skipped`, et le workflow était vert quand même.

Un workflow vert dont les étapes Test sont sautées ne prouve rien. La preuve UI
était réputée manquante depuis CARB-004 ; elle l'était en effet, mais pas pour
la raison qu'on croyait — le mécanisme existait et ne s'exécutait pas.

## La version jugée est bien celle qui est servie

> `Version servie confirmée : ea59a4331dbf2009ab14baac4fef2f00fd2fa1cc`

Cloudflare déploie de façon asynchrone. Sans cette attente, la recette
prouverait la version PRÉCÉDENTE — ce que `decision-2.md` du lot CARB-004
interdit explicitement. Le contrôle a joué.

## Ce qui est prouvé

| Point | Verdict |
|---|---|
| UI Carburants (CARB-004) | **satisfaite** |
| Accès Live REFUSÉ au manager | **satisfaite** |
| Accès Live ACCORDÉ au Créateur | **satisfaite** |
| Cohérence question/bouton dans Live | **arbitrage annoncé, bouton présent** |

Valeurs réellement lues à l'écran, sur la base réelle :

```
Commande recommandée : 23 000 L de SP95 + 13 000 L de GO
optimiseur brut : {"sp95":23350,"go":12650} = 36000
après arrondi   : {"sp95":23000,"go":13000} = 36000 L
reliquat        : 1000 L crédités au GO
                  motif SP95 : « Capacité disponible à la livraison
                  insuffisante pour un compartiment de plus. »
```

CARB-004 avait vécu un lot entier en étant **mort à l'écran** : le moteur était
prouvé, l'écran ne l'était pas. Ce n'est plus le cas, et le reliquat est
attribué au bon carburant avec un motif nommé — pas un zéro fabriqué.

Les deux points Live comptent doublement : ils vérifient une **séparation
d'autorisation** entre deux comptes de PIN distincts, ce qu'un secret partagé
entre profils rendait impossible à prouver avant le 08/09.

## PIN

Saisis par personne. Injectés au runner depuis des secrets GitHub dédiés par
profil, masqués dans le journal (`***`), jamais lus ni conservés par Claude.

## Ce que cette preuve NE couvre PAS

- Aucun compte **Employé** n'est exercé : `NEXUS_TEST_EMPLOYEE_A_PIN` et
  `NEXUS_TEST_EMPLOYEE_B_PIN` existent mais aucun scénario ne les utilise. Or
  c'est le parcours employé qui décide de l'adoption. La prise de poste après
  un quart laissé ouvert n'est éprouvée qu'en SQL
  (`verifier-prise-de-poste-apres-migrations.sql`), jamais à l'écran.
- Aucune opération Production n'est autorisée par cette preuve.
