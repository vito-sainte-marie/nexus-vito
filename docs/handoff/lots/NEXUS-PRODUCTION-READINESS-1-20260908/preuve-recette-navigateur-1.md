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

## Le parcours employé — ajouté et exécuté le même jour

Run `34379171491`, commit `d16ccb4aeee557bef2bf3848aa7add77182b7edd`.

| Point | Verdict |
|---|---|
| Prise de poste employé | **satisfaite** |
| Prise de poste avec un quart DÉJÀ OUVERT | **satisfaite — le quart précédent s'est fermé seul** |

**Pourquoi le second point est le seul qui compte vraiment.** Frédéric,
09/09/2026 : « il ouvre un quart, commence la journée, parfois il ne fait rien
[…] et ne referme même pas le quart, car pour eux NEXUS ne fonctionne pas
correctement. » Le quart laissé ouvert est le comportement ORDINAIRE. Or la
release installe `shifts_un_seul_service_en_cours`, et
`NEXUS-Prise-De-Poste-v1.html` insère sans rattraper la moindre erreur
d'unicité : en cas de refus, l'employé lit « Un problème est survenu,
réessayez » — et réessayer échouerait toujours.

**La condition qui donne son sens à cette preuve** : `nexus-test` porte ses 266
migrations depuis le retour en `TEST_NORMAL` du 09/09 à 16:33, index d'unicité
et déclencheur de clôture compris. L'écran a donc été jugé sur le schéma
D'APRÈS la release, pas avant. Jugé avant, le scénario aurait passé sans rien
prouver.

Le verdict est rendu par une fonction pure (`verifierEmploye`), éprouvée par 7
épreuves sans navigateur — dont l'état conforme, sans lequel les autres ne
prouveraient rien, et le refus de conclure sur une observation manquante.

## Ce que cette preuve NE couvre PAS

- **Aucun second employé.** `NEXUS_TEST_EMPLOYEE_B_PIN` existe et dort : aucun
  scénario ne l'exerce, et l'injecter sans usage fabriquerait une preuve vide.
- **Le scénario s'arrête à la prise de poste.** Ce que Frédéric décrit ensuite
  — « parfois il ne fait rien, ni inventaire, ni missions » — n'est pas éprouvé
  : ni la validation d'une mission, ni un comptage d'inventaire, ni la clôture
  du quart par pointage de départ. C'est le prochain trou, et il est plus large
  que celui qui vient d'être comblé.
- Aucune opération Production n'est autorisée par cette preuve.
