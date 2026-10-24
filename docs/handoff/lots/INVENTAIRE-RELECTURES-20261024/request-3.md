---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-RELECTURES-20261024
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=ee426fe4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# INVENTAIRE-RELECTURES-20261024 : mesure « après » consignée, demande de clôture

## Preuve des conditions de decision-2
Code : PR #157 en brouillon vers `production`, commit `4454a943`, **non fusionnée** (GO de Frédéric requis). Aucune lecture ni écriture de la Production.

1. **Mesure « après » comparable, faite par Claude Guardian sur Test** (Employé Test B, première ouverture du quart du soir, build `4454a94` servie sur `9e33b64c.nexus-test-ddf.pages.dev`), contre la mesure « avant » (`ee426fe`, même parcours) :

   | | Avant | Après |
   |---|---|---|
   | Écran prêt, première ouverture du soir | 3,7 s | 3,8 s |
   | Requêtes | 42 | 32 |
   | Vagues | 10 | 10 |
   | `shifts` | lu 2 fois (533 puis 975 ms) | lu 1 fois |
   | `sites` | lu 2 fois (649 puis 975 ms) | lu 1 fois |
   | Préparation de la sélection | 2 fois (1,76 puis 2,34 s) | 1 fois |
   | Quart déjà ouvert, écran prêt | 2,7 s et 1,9 s | 2,0 s et 1,8 s |
   | Quart déjà ouvert, requêtes | 29 | 27 |

2. **Objectif de 3 s : non atteint à la première ouverture (3,8 s), tenu quart ouvert (moins de 2 s).** Les doublons supprimés étaient en parallèle, donc hors du chemin critique : dix requêtes de moins, mais pas de temps gagné à la première ouverture. Je ne présente pas ce lot comme un gain de temps pour cette ouverture.
3. **Poste dominant restant, à traiter dans un lot séparé** (comme le prévoit decision-2) : la chaîne d'initialisation du quart. `inventaire_quarts`, `inventaire_quart_employes` et `inventaire_plans_comptage` sont lus 4 fois chacun, en séquence. Ce lot viendra après « Jaugeage Carburant ». La préparation de la sélection, citée en decision-1, n'est plus lue qu'une fois.
4. **Nettoyage Test, identifiants exacts et dépendances vérifiés, Production jamais touchée** (simulation avec rollback, puis exécution, puis relecture) :
   - mesure « avant » : quart `ecc4c248-…`, plan `bc2a1c50-…` et ses 6 lignes, lien `inventaire_quart_employes` (cascade) ; script `outils/nettoyage-quart-soir-mesure-avant-20261024.sh` (`ec074b7b`) ;
   - mesure « après » : quart `80e30149-…` (créé 22:50:12 UTC), plan `738c27db-…` et ses 6 lignes, lien ; script `outils/nettoyage-quart-soir-mesure-apres-20261024.sh` (`d056aaae`) ;
   - service de Guardian `50175943-…` : script `outils/nettoyage-service-soir-guardian-20261024.sh` (`97f71a62`), exécuté après la mesure.
   Relecture : 0 quart, 0 plan, 0 service sur `nexus-station-test` pour le 24/10.

## À arbitrer
1. Ce lot se clôt-il maintenant sur la mesure consignée, objectif de 3 s non atteint à la première ouverture, comme decision-2 le permet ?
2. Ensuite, dans cet ordre : « Jaugeage Carburant » (lot séparé), puis la chaîne d'initialisation du quart (lot séparé).

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric. Le GO de la PR #157 reste à sa main.
