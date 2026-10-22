<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-SAISIE-DIRECTE-20261022/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=ccedfa83
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 160-fichiers
---
# LOT : JAUGEAGE-SAISIE-DIRECTE-20261022 — deux exécutions du même lot : désigner la PR #148 et retirer la branche du réveil

## Constat
decision-1 (APPROVED) a été exécutée **deux fois**, sans que l'une sache l'autre :
- **PR brouillon #148** (`jaug-saisie-directe`, vers `production`, base `ccedfa83`), session interactive de Claude : implémentation (commit `c3eda0c2`), 22 contrôles avec mutations qui mordent, **recette Test au format téléphone faite, photo → enregistrement en 31,4 s**, données de recette supprimées, corps de PR à jour.
- **Branche `lot-jaugeage-saisie-directe-20261022`** (commit `6c20b192`), réveil autonome (request-2) : implémentation équivalente, 14 tests, **PR non ouverte** faute d'autorisation `gh`.

decision-2 (APPROVED_WITH_CONDITIONS) ordonne à `github-actions-claude` d'ouvrir une PR brouillon depuis la seconde branche. Au prochain réveil, une **seconde PR brouillon** du même lot serait ouverte, en doublon de #148.

## Demande
1. Désigner **#148** comme PR canonique du lot (elle porte déjà la recette chronométrée que les conditions de decision-2 exigent).
2. Dire que la branche `lot-jaugeage-saisie-directe-20261022` n'est **pas** à ouvrir en PR : l'exécutant suivant ne crée rien, et la branche reste en l'état (non supprimée) comme trace.
3. Les conditions de decision-2 (brouillon seulement, aucune fusion/déploiement/promotion, recette consignée avant tout passage en Production) sont satisfaites par #148 : brouillon, rien fusionné, recette consignée dans son corps.

## Preuve des conditions de decision-2
- *Ouvrir uniquement une PR brouillon vers production* — SATISFAITE par la PR #148 (brouillon, base `production`) : https://github.com/vito-sainte-marie/nexus-vito/pull/148 (`isDraft: true`, état OPEN, vérifié par `gh pr list`). Aucune seconde PR n'a été ouverte.
- *Aucune fusion, aucun déploiement, aucune promotion* — SATISFAITE : #148 non fusionnée, rien déployé, Production et Supabase Production non touchés.
- *Consigner la recette iPhone chronométrée sur l'aperçu Test avant tout passage en Production* — CONSIGNÉE EN PARTIE : recette au format téléphone (viewport 375x812) sur Test, photo → enregistrement en 31,4 s, dans le corps de #148. Elle n'a pas été faite sur un iPhone réel par un pompiste sans aide : cela reste un geste humain, à faire avant toute demande de passage en Production.

## Pourquoi pas l'inverse
La branche du réveil n'a pas de recette navigateur et couvre moins de cas (fusion tardive : 4 mutations contre 9 contrôles E4 ici). Garder deux candidats obligerait à en arbitrer un par différences de code, sans gain.

## Reste humain / sous GO
Aucune fusion ni déploiement sans le GO explicite de Frédéric. La recette par un pompiste sans aide sur iPhone reste un geste humain. JAUGEAGE-OCR-2 sera déposée séparément après ce lot.

## Contraintes dites sans fard
- Le lot est à `closes: false` : #148 doit être fusionnée (GO) avant clôture.
- La fusion tardive n'a pas été rejouée en navigateur ; elle est couverte par les épreuves, pas par la recette.
- Trois images de recette restent dans le stockage Test.
