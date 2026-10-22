---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-2-20261022
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6346296915
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39817513511), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6346296915. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-2-20261022`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `66e6e8be7a89251189fa2d373a55df282b18440d`, `HEAD` = `66e6e8be7a89251189fa2d373a55df282b18440d`, SHA du run `66e6e8be7a89251189fa2d373a55df282b18440d`, tête du rail `66e6e8be7a89251189fa2d373a55df282b18440d`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Limiter la modification à vision_ocr.swift, vision_ocr_core.swift et test_vision_ocr.swift ; produire pour chaque ligne le texte, sa confiance propre et la boîte normalisée x/y/w/h tout en conservant les fragments ; fixer recognitionLanguages à ["fr-FR", "en-US"] et conserver usesLanguageCorrection=false ; documenter dans la source le contrat de sortie, le repère, les codes de sortie et le mode résident ; faire réussir les tests synthétiques de grille 2 × 2, de non-fusion des colonnes éloignées et d’identification d’une ligne à faible confiance ; conserver toutes les limites de decision-2, sans plist, service, PATH, environnement, mise en service, Paddle, venv 2.x ni branchement Python. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La demande est cohérente avec la poursuite du lot constatée dans `STATE.json`. L’extension reste limitée au lecteur Vision, à son contrat de sortie et à ses tests synthétiques. Elle ne touche ni Production, ni secret, ni sécurité, ni mise en service et ne relève d’aucun motif de STOP.

Les acquis `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : l’autorisation est rendue ici et l’écriture sur le rail n’exige aucun GO humain supplémentaire.

**Verdict : APPROVED_WITH_CONDITIONS.** L’absence actuelle de compilation sur l’iMac est normale : celle-ci doit intervenir après l’extension, durant l’étape B.

RAIL_LU: 66e6e8be7a89251189fa2d373a55df282b18440d

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-2-20261022
REQUEST: request-3.md
HEAD: 66e6e8be7a89251189fa2d373a55df282b18440d
LEASE: aucun
GATE_STATE: G1, CI de l’extension à exécuter
PROOF_STATE: PROOF_VALID
CONDITIONS: Limiter la modification à vision_ocr.swift, vision_ocr_core.swift et test_vision_ocr.swift ; produire pour chaque ligne le texte, sa confiance propre et la boîte normalisée x/y/w/h tout en conservant les fragments ; fixer recognitionLanguages à ["fr-FR", "en-US"] et conserver usesLanguageCorrection=false ; documenter dans la source le contrat de sortie, le repère, les codes de sortie et le mode résident ; faire réussir les tests synthétiques de grille 2 × 2, de non-fusion des colonnes éloignées et d’identification d’une ligne à faible confiance ; conserver toutes les limites de decision-2, sans plist, service, PATH, environnement, mise en service, Paddle, venv 2.x ni branchement Python.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Modifier les trois fichiers Vision autorisés sur le rail et exécuter leurs tests synthétiques avant la reprise de l’étape B.
