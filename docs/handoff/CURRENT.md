<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CHAINE-INITIALISATION-20261027/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CHAINE-INITIALISATION-20261027
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: pr-brouillon
    classe: VERIFIED
    valeur: 161
  - id: commit-lot
    classe: VERIFIED
    valeur: d341ee4133982006e1b0689c4e533527170aee37
---
# INVENTAIRE-CHAINE-INITIALISATION-20261027 : demande de clôture

## Ce qui est fait
Deux corrections de lecture seule, une épreuve, aucune écriture ni calcul modifié, sur la branche du lot `inventaire-chaine-initialisation-20261027` (d341ee41, CI verte, mêmes quatre échecs inventaire connus avant et après).
1. Les réglages, les seuils et le plan existant du quart sont lus ensemble ; les réglages ne sont attendus qu'à la génération du plan.
2. La lecture `inventaire_zones` part avant l'attente du fuseau.
3. Épreuve `test_inventaire_chaine_init_20261028.js` : empreinte figée du calcul du quart (`quartDuMoment`, `quartConfigureDuMoment`, `seuilDeBascule`, `quartDepuisMinutes`), ordre de l'initialisation, trois mutations qui font rougir l'épreuve.

PR en brouillon vers `production` : #161. Consigne de Frédéric : **fusion après la recette de la semaine prochaine, pas avant**. Aucune fusion, aucun déploiement.

## Mesures (Supabase Test, Employé Test B, aperçus de branche)
| Mesure | Résultat |
|---|---|
| « Avant » (b66b3d65, 28/10 ~8 h 20) | première du jour 2 647 ms, suivante 2 115 ms |
| « Après » correction n°1 (014a0fe7, 29/10 ~13 h 20) | première du jour 3 189 ms, suivantes 2 733 ms puis 2 366 ms : écart non conclusif, matin contre après-midi |
| A/B alternées (A B A B A B, 29/10 ~16 h), passages 2 et 3 | départ 2 383 ms, lot 2 400 ms |

**Conclusion : aucun gain mesurable.** Le plan démarre environ 100 ms plus tôt, mais la variation du chemin des missions (600 à 1 200 ms) l'absorbe ; la latence médiane d'une requête est de 152 à 215 ms des deux côtés. Les corrections sont justes et sans effet négatif.

## Trois postes coûteux, pour un lot de performance après la recette
1. `genererOuChargerMissions` : 600 à 1 200 ms, en séquence après `obtenirOuCreerQuartEmploye`.
2. Pré-chaîne : environ 1 s avant le premier appel inventaire (session, service, site, réglages, fuseau, quart).
3. Environ 250 ms entre la fin des missions et `renderAccueil`, non ventilés.

## Preuve des conditions de decision-1
1. **Mesurer avant et après** : fait, avec une alternance A/B pour neutraliser la variation du réseau (tableau ci-dessus). Résultat : aucun gain mesurable.
2. **Préserver strictement les calculs métier** : l'empreinte figée de `quartDuMoment`, `quartConfigureDuMoment`, `seuilDeBascule` et `quartDepuisMinutes` est inchangée ; trois mutations (quart2 en quart1, lecture des zones retirée, écriture du quart avant le calcul) font rougir l'épreuve. Le diff contre `f00eda7a` ne contient que les deux corrections, l'épreuve, et aucune instrumentation.
3. **Aucune lecture ni écriture de la Production, aucune fusion, aucun déploiement sans GO** : mesures sur Test seulement ; la PR #161 est en brouillon ; rien n'est fusionné ni déployé.
4. **Défauts de la boucle traités dans un lot d'outillage ultérieur, sans élargir de permission** : consignés dans la request-2, aucune permission demandée ni modifiée.

## Hors lot, notés
Ouvrir `NEXUS-Prise-De-Poste-v1` directement avec le service de la veille encore ouvert affiche « Un quart est déjà ouvert… ». Les trois défauts de la boucle de la request-2 restent pour le lot d'outillage.

## À arbitrer
Clôturer ce lot avec ce qui est fait, sans gain de temps revendiqué. Ensuite, par ordre de Frédéric : ouverture du lot « Jaugeage Carburant », livraison à fusionner avant le lundi 2 novembre sur son GO.

BRANCHE_DU_LOT: inventaire-chaine-initialisation-20261027

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
