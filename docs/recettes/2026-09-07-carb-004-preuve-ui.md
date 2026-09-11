# CARB-004 / Q65 — preuve navigateur sur NEXUS Test

**Date** : 07/09/2026
**Lot** : `CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906`
**Exigée par** : `decision-2.md` §D, puis `decision-3.md` points 4 et 5
**Environnement** : NEXUS Test (`nexus-test-ddf.pages.dev`, Supabase `udljdqxerrbbbajxubfn`)
**Production** : `NOT_APPLICABLE` — aucune requête, aucun déploiement, aucun merge

---

## 1. Identité de la version prouvée

L'écran interrogé sert bien la version corrigée, vérifié deux fois plutôt qu'une :

```
pied de page écran : NEXUS test · commit 39d6b4d · génération f42b3adc03a5 · construit le 2026-09-07T14:44:43Z
```

et l'actif JavaScript réellement servi a été retéléchargé puis comparé au fichier
canonique — **identique octet pour octet**, et il contient bien le correctif :

```
curl .../nexus-carburant-commande-moteur.js  ->  114 869 octets
diff avec le HEAD canonique                   ->  aucune différence
occurrence du correctif Q65                   ->  1
```

Console de l'écran, au chargement : les cinq couches P0 se déclarent installées
(`NEXUS Carburants P0 installé`, `… P0 Performance`, `… P0 Réception`,
`… P0 Journal`, `… P0 UI`). La preuve porte donc bien sur la chaîne complète,
pas sur le moteur seul.

## 2. Ce qu'il a fallu découvrir avant de pouvoir prouver quoi que ce soit

La première tentative n'a rien prouvé : l'écran répondait
« Prochaine commande : données insuffisantes pour une recommandation
aujourd'hui ». Vérification en base, plutôt que déduction depuis l'écran :

```
relevés de jaugeage : 0    quarts avec litrage : 0    commandes : 0
cuves configurées   : oui  config commande     : oui
```

**La base Test n'avait jamais contenu la moindre donnée carburant.** Le moteur
refusait de recommander — comportement correct, et exactement l'ADN NEXUS :
« si une donnée n'existe pas encore, NEXUS le dit clairement ». Mais aucune
recette Carburants n'était possible dans cet état.

Second écart découvert au passage : **les cuves de la station Test ne sont pas
celles de ViTO.**

| | Test | ViTO (cas d'origine de l'audit CARB-004) |
|---|---|---|
| sp95 | 23 750 L | 28 761 L |
| go | 14 250 + 7 600 = 21 850 L | 19 019 + 9 534 = 28 553 L |

Les valeurs du test unitaire ne s'y transposent donc pas : il a fallu calculer
un scénario propre à la géométrie des cuves Test.

## 3. Comment le scénario a été construit — et ce qui a été refusé

Un banc hors ligne a balayé jaugeages et consommations plausibles **en passant
par le vrai moteur**, jamais par une réimplémentation. Deux erreurs de méthode
sont survenues et sont consignées ici plutôt que tues :

1. **Premier balayage : 0 résultat, et ce zéro ne voulait rien dire.** Le faux
   `console` du banc n'avait pas de `.info` ; chaque évaluation levait une
   exception avalée par un `catch` silencieux. Corrigé, puis diagnostiqué sur un
   cas unique avant d'élargir quoi que ce soit.
2. **Deuxième balayage : 914 résultats, dont le premier recommandait 25 000 L de
   sp95 dans une cuve limitée à 23 750 L.** `capaciteDisponibleLivraison` vaut
   `limite − stockPrevuLivraison` : quand le stock projeté est négatif (station
   à sec avant le camion), la capacité calculée dépasse la limite physique.
   Comportement **pré-existant, étranger à CARB-004**, consigné comme dette au
   §6. Un filtre de plausibilité physique a été ajouté ; il ne restait alors
   **plus aucune** combinaison, ce qui a révélé que les paliers de stock balayés
   étaient tous trop bas. Relancé avec des stocks réalistes : 195 combinaisons
   physiquement cohérentes.

Le scénario retenu est stable — il donne le même résultat pour les trois dates
de commande candidates (07, 08, 09/09), ce n'est donc pas une fixture sur le fil
du rasoir.

## 4. Preuve négative puis positive, avant écriture en base

Sur le scénario retenu, contre le moteur réel :

| | total | sp95 | go | reliquat |
|---|---|---|---|---|
| **sans le correctif Q65** | **35 000 L** | 22 000 | 13 000 | 0 — go refusé : « Rotation prévisionnelle inconnue » |
| **avec le correctif** | **36 000 L** | 22 000 | 14 000 | 1 000 L sur go |

Le motif du refus sous mutation — « rotation prévisionnelle inconnue » — est la
signature exacte du bug corrigé : la lecture de `stockPrevuLivraisonL` à la
racine de l'évaluation, où `evaluerCarburant` ne le pose jamais.

## 5. Preuve UI réelle, sur l'écran, après alimentation de la base

Données semées par [`outils/recette-carburants-test.sql`](../../outils/recette-carburants-test.sql)
(29 quarts sur 14 jours + 1 jaugeage d'ouverture ; la ligne du 05/09 quart 2,
qui appartient à la recette NEXUS Verify, a été préservée intacte).

Écran `NEXUS-Carburants-Pilotage-v1.html`, connecté en Manager Test :

> **Commande recommandée : 23 000 L de SP95 + 13 000 L de GO**
> À commander mardi 8 sept. avant 11:00 · Livraison prévue mercredi 9 sept.
> Camion complété vers 36 000 L (go, sp95), au prorata de la consommation,
> sans dépasser la capacité disponible ni un stock immobilisé disproportionné.
>
> **Total 36 000 L**

Et l'objet réellement produit par la chaîne, lu dans la page plutôt que déduit
de l'affichage :

```json
{
  "optimiseurBrut": { "volumesRetenus": { "sp95": 23606, "go": 12394 }, "total": 36000 },
  "volumes":        { "sp95": 23000, "go": 13000 },
  "total":          36000,
  "reliquatArrondi": {
    "recupereL": 1000,
    "parCarburant": { "go": 1000 },
    "motifs": { "sp95": "Capacité disponible à la livraison insuffisante pour un compartiment de plus." }
  },
  "etats": { "sp95": "securite", "go": "a_anticiper" }
}
```

Lecture ligne à ligne :

- l'optimiseur atteint **36 000 L** (23 606 + 12 394) — le maximum camion n'a
  jamais été le problème ;
- l'arrondi rabote le go à 12 000 et plafonne le sp95 à 23 000 (sa capacité
  disponible, 23 606 L, arrondie au millier inférieur) : **35 000 L** ;
- la récupération du reliquat rend **1 000 L au go** → 13 000 L ;
- le sp95 est refusé **avec un motif nommant la capacité**, pas par un silence ;
- total final **36 000 L**, affiché tel quel à l'écran.

C'est le cas CARB-004 complet, de bout en bout, à travers P0, sur l'écran réel.

## 6. Dette ouverte par cette recette

**Capacité disponible surestimée quand le stock projeté est négatif.**
`capaciteDisponibleLivraison(limite, stockPrevu) = limite − stockPrevu` : si
`stockPrevu < 0`, le résultat dépasse la limite de remplissage de la cuve et le
moteur peut recommander un volume que la cuve ne peut pas recevoir. Observé sur
914 combinaisons du balayage (ex. sp95 : 25 000 L recommandés pour une limite de
23 750 L). Ce n'est **pas** une régression du lot : le comportement précède
CARB-004. Aucune correction n'est faite ici — le périmètre du lot est la
récupération du reliquat, et corriger au passage une garde de capacité sans
arbitrage serait exactement l'élargissement que le Handoff interdit.

## 7. Limites honnêtes

1. La recette porte sur la station Test, dont les cuves diffèrent de ViTO. Le
   mécanisme prouvé est le même ; les volumes ne sont pas ceux du terrain.
2. Le PIN de recette n'a pas été lu ni conservé : il a été saisi par Frédéric.
   Le secret GitHub `NEXUS_TEST_PIN` reste, par construction, illisible hors
   d'un run Actions — aucune session locale ne peut l'obtenir.
3. La recette n'est pas encore automatisée. `outils/recette-navigateur-test.js`
   n'existe pas sur la branche canonique (il fait partie du rapatriement
   `NEXUS-ORCHESTRATION-REPAIR-1`, toujours en attente d'arbitrage) et n'est de
   toute façon qu'un vérificateur de préconditions attendant les noms
   `NEXUS_TEST_PIN_MANAGER`/`NEXUS_TEST_PIN_EMPLOYE`, absents du dépôt.
