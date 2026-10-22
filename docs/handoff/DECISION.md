<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-2-20261022/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-2-20261022
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6345231209
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39809677373), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6345231209. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-2-20261022`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `19b8082cd1abbc2044921ea6ce6b22e774a01fd3`, `HEAD` = `19b8082cd1abbc2044921ea6ce6b22e774a01fd3`, SHA du run `19b8082cd1abbc2044921ea6ce6b22e774a01fd3`, tête du rail `19b8082cd1abbc2044921ea6ce6b22e774a01fd3`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Vision couvre toutes les images, y compris les bons scannés, et les PDF restent sur ocrmypdf ; aucun ajout de Paddle ou de venv 2.x sans preuve comparative et nouvelle demande ; l’étape A reste sans action sur l’iMac et comporte des tests synthétiques représentatifs des deux usages ; la latence de 4 min 30 est diagnostiquée avant correction ; les quinze photos réelles avec provenance et sans donnée personnelle sont obligatoires avant calibration ; PermissionError et PATH sont seulement consignés dans ce lot ; la bascule du plist et toute mise en service D restent exclues jusqu’à une nouvelle demande étayée par les essais iMac, les mesures, la calibration et la preuve de retour arrière. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

L’option C est retenue : Apple Vision devient le moteur des images, y compris les bons scannés ; `ocrmypdf` reste réservé aux PDF. Paddle et le venv 2.x ne sont pas ajoutés tant qu’une preuve comparative ne démontre pas que Vision est insuffisant pour une classe d’images.

L’ordre A → B → C est approuvé. La mise en service D n’est pas autorisée par cette décision : elle devra être arbitrée après les essais iMac, les quinze photos réelles avec provenance et sans donnée personnelle, la calibration, la mesure des temps et la preuve de retour arrière. Cela évite de préjuger d’un éventuel `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`.

Traitement des défauts annexes :
- rotation du journal et diagnostic des 4 min 30 : dans ce lot ;
- `PermissionError` et absence d’`ocrmypdf` dans le PATH launchd : consignation et diagnostic ici, correction dans un lot séparé, sans modification de `.env` ou du PATH dans le présent périmètre ;
- l’indisponibilité PDF devra être résolue avant toute mise en service globale.

Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : aucun GO humain supplémentaire n’est requis pour le code, les tests ou les pushs sur le rail.

RAIL_LU: 19b8082cd1abbc2044921ea6ce6b22e774a01fd3
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-2-20261022
REQUEST: request-1.md
HEAD: 19b8082cd1abbc2044921ea6ce6b22e774a01fd3
LEASE: aucun
GATE_STATE: G0, CI non mesurée
PROOF_STATE: PROOF_VALID
CONDITIONS: Vision couvre toutes les images, y compris les bons scannés, et les PDF restent sur ocrmypdf ; aucun ajout de Paddle ou de venv 2.x sans preuve comparative et nouvelle demande ; l’étape A reste sans action sur l’iMac et comporte des tests synthétiques représentatifs des deux usages ; la latence de 4 min 30 est diagnostiquée avant correction ; les quinze photos réelles avec provenance et sans donnée personnelle sont obligatoires avant calibration ; PermissionError et PATH sont seulement consignés dans ce lot ; la bascule du plist et toute mise en service D restent exclues jusqu’à une nouvelle demande étayée par les essais iMac, les mesures, la calibration et la preuve de retour arrière.
BLOCKER: aucun pour l’étape A
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Versionner la source Swift du lecteur Vision avec son SHA-256 et ses premiers tests synthétiques, sans intervenir sur l’iMac.
