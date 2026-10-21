---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-PHOTO-20261021
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6320757292
---
# Décision sur request-2.md — NEEDS_EVIDENCE

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39632935071), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6320757292. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-PHOTO-20261021`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `e675c007b63127ccc837458984b3fb6304762406`, `HEAD` = `e675c007b63127ccc837458984b3fb6304762406`, SHA du run `e675c007b63127ccc837458984b3fb6304762406`, tête du rail `e675c007b63127ccc837458984b3fb6304762406`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : HOLD — preuve de recette incomplète.**

La fusion et le déploiement Production sont attribués à des gestes explicitement approuvés puis exécutés par Frédéric ; conformément à `MOUVEMENT_REF_ATTRIBUE`, ils ne constituent pas un STOP.

En revanche, `decision-1.md` exigeait une recette iPhone couvrant notamment le repli natif, l’upload redimensionné, la restauration d’état et le lien profond. `request-2.md` établit la caméra en page et l’enregistrement des jaugeages, mais ne consigne pas ces quatre contrôles ; elle indique même que les dimensions de la photo ne sont pas vérifiées. La clôture requiert donc cette preuve précise, sans remettre en cause les preuves déjà valides.

RAIL_LU: e675c007b63127ccc837458984b3fb6304762406

NEXT_ACTION_CONTRACT
DECISION: NEEDS_EVIDENCE
CLOSES: false
LOT: JAUGEAGE-PHOTO-20261021
REQUEST: request-2.md
HEAD: e675c007b63127ccc837458984b3fb6304762406
LEASE: aucun
GATE_STATE: G3, Tests verts et Production déployée au build cdfee414 ; preuve de recette de clôture incomplète
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: Consigner la preuve de recette iPhone couvrant le repli natif, l’upload effectivement redimensionné avec dimensions mesurées, la restauration d’état et le lien profond, comme exigé par decision-1.md
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Déposer une demande complémentaire consignant les quatre contrôles manquants de la recette iPhone.
