<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-RELECTURES-20261024/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-RELECTURES-20261024
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
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
# INVENTAIRE-RELECTURES-20261024 : moins de lectures en double à l'ouverture de l'Inventaire, et « Disponibles » ouvert quand le obligatoire est fait

## Contexte
Le Lot 3 du parcours pompiste (`PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023`) a ramené la première ouverture de l'Inventaire à **5,0 s contre 3 s visées**. La cible n'est pas atteinte. Sa section F.4 nommait ce lot de suite : les lectures qui restent en double, mesurées par Claude Guardian avant et après, puis le dépliage de « Disponibles ». Le fil (`CATEGORIES-FIL-20261024`) est clos et #156 est fusionnée dans `production` (`ee426fe4`) ; ce lot part de cette tête.

## Ce que montre la lecture du code (aucune ligne écrite)
1. **Sélection lue deux fois sur la voie des missions.** `chargerContexteGeneration` (`nexus-inventaire-missions-donnees.js`, l. 39) lit `chargerIngredientsSelection` ; `reevaluerMissionsNonAffectees` (l. 84-87) rappelle `chargerContexteGeneration` et relit tout. Le plan, lui, passe par `chargerOuGenererPlan`, déjà mémoïsé (`memoPlans`), mais appelle aussi `chargerIngredientsSelection` (`nexus-inventaire-plan-donnees.js`, l. 191) sans mémo : trois appels possibles pour une même clé (site, date). C'est la lecture de 1,9 s puis 2,7 s relevée au Lot 3.
2. **`sites` ×2.** Deux lecteurs du fuseau, chacun avec son propre cache : `nexusFuseauSite` (`nexus-auth.js`, l. 830) et `NexusStation.fuseauDeLaStation` (`nexus-station.js`, l. 99).
3. **`shifts` ×2, `station_config` ×3.** Les lectures de `nexus-auth.js` (service courant, l. 853 ; pointage, l. 405), de `NEXUS-App-v1.html` (l. 1901 et 1916, deux colonnes de la même ligne) et de l'écran (`NEXUS-Inventaire-v1.html`, l. 1243 et 1375, deux colonnes de la même ligne) sont les candidates. **Je ne sais pas encore lesquelles se cumulent à l'ouverture** : c'est la mesure de Guardian qui le dira, et je ne regrouperai que ce qu'elle montre.
4. **« Disponibles » ne se déplie que s'il n'existe aucune mission obligatoire** pour le rôle (`NEXUS-Missions-v1.html`, l. 2206 : `obligatoires.length === 0`). Quand les deux obligatoires du jour sont soldées, le bloc reste replié et la page paraît vide (Lot 3, section D, point 31). La condition dépend du catalogue, pas de l'avancement.

## Ce que le lot fera (après décision de l'arbitre : le code n'est pas écrit)
1. Mémoïser par (site, date) la lecture des ingrédients de la sélection, pour que missions, réévaluation et plan partagent une seule lecture, sans changer ce qui est calculé.
2. Faire partager au fuseau du site une seule lecture ; regrouper les lectures de `station_config` et `shifts` **seulement si la mesure les montre cumulées**.
3. Déplier « Disponibles » une fois quand toutes les missions obligatoires du jour sont validées (ou qu'il n'y en a pas), comme aujourd'hui pour « aucune obligatoire » ; l'employé garde la main pour replier.
4. Épreuves : un seul appel de lecture pour une génération suivie d'une réévaluation (faux client qui compte) ; dépliage vu avec obligatoires soldées, non déplié avec une obligatoire restante ; mutation vérifiée pour chacune.
5. Mesure : Claude Guardian, même compte, même quart, avant et après, sur Test. Je dirai si 3 s sont atteintes ; sinon je donnerai le chiffre et la lecture restante.

## À arbitrer
1. Le périmètre convient-il, avec les regroupements `station_config` et `shifts` conditionnés à la mesure ?
2. Si 3 s ne sont pas atteintes après ces lectures, le lot se clôt-il sur le chiffre mesuré, ou faut-il un lot suivant sur le calcul de la sélection elle-même ?
3. Ordre confirmé après ce lot : audit du langage (propositions seulement), sous réserve de `PRIORITES_PORTEFEUILLE`.

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
