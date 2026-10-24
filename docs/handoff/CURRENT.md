<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/CATEGORIES-FIL-20261024/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: CATEGORIES-FIL-20261024
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# CATEGORIES-FIL-20261024 : preuve des conditions de decision-1

## Preuve des conditions de decision-1
Code : branche `categories-fil-parametrage-20261023`, commit `395400b5785559484ea8eaf5e7c07b436376a1d5` (sur `origin/production`, poussé). Détail : `docs/executions-lot-CATEGORIES-FIL-20261024.md`.

1. **Liste en dur remplacée par le paramétrage** : `CATEGORIES_FIL` et `categorieDuFil` retirés ; le fil lit `produitsZone`, produits actifs de la zone piste du site courant. Écailles reste un produit de Glaçons.
2. **Script sur Test, rollback vérifié, borné aux deux produits** : simulation du 24/10 : les deux produits sont déjà en `boutique`, UPDATE 0, ROLLBACK. `--executer` non utilisé : il n'avait rien à trouver.
3. **Correction de la request-1** : elle disait que le script n'avait pas été exécuté. Le script, non ; mais le 23/10 vers 14:00 j'ai déplacé « Huile moteur recette » et « Lave-glace recette » en zone boutique sur Test par une requête SQL équivalente. La simulation à 0 ligne prouve le bornage et l'état de Test.
4. **Trois épreuves vertes** : produit désactivé absent ; produit actif de la zone piste présent (Écailles sous Glaçons) ; autre site sans écailles. Mutations vérifiées (filtre de zone retiré, liste de noms revenue).
5. **Suite complète** : 299/306, les 7 mêmes échecs que sur `origin/production` nue ; aucun nouveau.
6. **Aucune liste métier équivalente** : C1, F7 et I3 la cherchent et rougissent si elle revient. Règles PROD-002 et PROD-003 ajoutées à `RULES.json`.
7. **Aucune fusion, promotion ni écriture Production.**

## Constat à arbitrer (lecture seule Production)
La zone piste de Production contient aussi 16 huiles et 9 lave-glace/liquides de refroidissement actifs. Avec ce code, le fil de Production les comptera tant qu'ils restent en piste. Les déplacer en boutique est une écriture Production, réservée au GO de Frédéric. Faut-il la demander avant la PR vers `production` ?
Suite annoncée : suivi de l'Inventaire, puis audit du langage.
