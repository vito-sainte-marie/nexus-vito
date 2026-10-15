---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PROPRETE-1-20261014
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=50c634a8
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: doc-seule
    classe: VERIFIED
    valeur: aucune modification hors docs/handoff, lecture seule des refs
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni main ni production ni claude.yml ni secret ni permission ; aucune suppression
---
# Rendre NEXUS propre — cadrage et inventaire (lecture seule), aucune action demandée

Frédéric demande de « rendre NEXUS propre ». Cette demande ne propose **aucune exécution** : elle soumet un inventaire mesuré et une matrice d'autorité, pour que l'arbitre cadre le périmètre avant tout nettoyage. Mesures faites sur le rail à jour, par `git merge-base --is-ancestor` (un squash-merge y apparaît à tort comme « non intégré »).

## Inventaire (277 refs distantes)
- **150 intégrées** (ancêtres du rail, de `production` ou de `main`) : 69 `claude/*` sur le rail seul, 19 `claude/*` sur `production` seul, 62 autres.
- **128 non intégrées** : 115 `claude/*` et 13 autres. 36 sont déjà classées dans `docs/handoff/BRANCHES-CLASSEES.json` (17 SUPERSEDEE, 16 INTEGREE, 3 A_REPRENDRE) ; **92 ne sont pas classées**.
- Non classées hors `claude/*` (13) : claude-yml-alerte-refus-20261014, cloture-des-services, config-par-environnement, ecarts-kpi-hierarchie-20261014, ecarts-periode-mois-courant-20261014, epreuve-protection-main-20261010, feature/telegram-alertes-handoff-20261014, flake-outils-mutants-20261014, hotfix-roles-prise-de-poste-20260918, p1-executants-fermes, p2-coherence-cloture, paye-regles-smu-20261008, regularisation-differee-groupes-20261013.
- PR ouvertes : #124, #123 (chaîne P1/P2), #109 (vise `production`), #55, #54, #42 (anciennes), #30 (brouillon, à ne pas toucher).
- Lots : 57 audités par le skill `nexus-lot-reconciler`. Sur 7 anomalies, 3 sont des **faux positifs du skill** (les lots du 06/09 sont dans `artefacts_hors_registre`, rubrique que le skill ne lit pas) ; 4 sont de vrais écarts de vocabulaire (exécutant « Claude » et deux capacités absents de `CAPACITES-CANAL.json`, lots BOUCLE-AUTONOME-FAST-TRACK-PREPARATION-1 et FDJ-CONTINUITE-QUANTITE-ABSENTE), sans urgence.
- Divergence `main`/`production` : +309 / +29 depuis 501c0c74. Arbitrage de Frédéric (option 3) : documentation seule, aucun réalignement. **NEXUS ne peut donc pas être déclaré « propre » au sens du skill tant qu'elle subsiste.**

## Matrice d'autorité proposée
| Action | Qui peut |
|---|---|
| Classer les 92 branches dans BRANCHES-CLASSEES.json (doc, rail) | Claude, après décision de l'arbitre |
| Corriger le skill pour lire `artefacts_hors_registre` (doc, rail) | Claude, après décision |
| Supprimer une branche distante intégrée | Frédéric (GO distinct, liste nominative) |
| Supprimer une branche non intégrée | Frédéric seul, branche par branche |
| Fermer/fusionner une PR | Frédéric seul |
| Toucher `main`, `production`, `claude.yml`, secrets, permissions | Frédéric seul |

## Demande
1. Valider ce cadrage : première étape = classement documentaire des 92 branches non classées (aucune suppression).
2. Dire si la correction du skill (faux positifs) entre dans ce lot.
3. Confirmer que toute suppression ou fermeture reste hors lot, sur GO nominatif de Frédéric.

Demande la validation du cadrage ; ne demande pas la clôture (`closes: false`).
