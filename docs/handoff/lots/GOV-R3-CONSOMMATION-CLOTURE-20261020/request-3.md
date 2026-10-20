---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R3-CONSOMMATION-CLOTURE-20261020
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: code-o3
    classe: VERIFIED
    valeur: e6255fde
  - id: banc-g1-g10
    classe: VERIFIED
    valeur: 10/10
---
# GOV-R3-CONSOMMATION-CLOTURE-20261020 : résultats G1–G10 et passage de `verifier` (condition 7 de la decision-1)

**Nature :** rapport de résultats, en exécution de la condition 7 de la decision-1 (APPROVED_WITH_CONDITIONS, closes: false, `1c020c21`). Aucun workflow, hook, permission, secret, identité, connecteur, armement ni Production n'est touché.

## Constat

- **Outil écrit :** `outils/consommer-clotures-ci.js`, commit `e6255fde`, poussé sur le rail. Non câblé : aucun appelant, aucun déclencheur.
- **G1–G10 :** écrites et constatées rouges (outil absent) au commit `05553ad9`, puis **10/10 vertes** au commit `e6255fde` (`node test_consommation_cloture_ci_20261020.js`).
- **`handoff.js verifier` :** vert au commit `e6255fde` (77 lots, 18 avertissements, 13 dérogations, tous préexistants).
- **Non-régression voisine :** `test_provenance_falsification_20261020.js` 16/16.

## Preuve des conditions de decision-1

1. G1–G10 rouges avant l'implémentation : tenu (`05553ad9`).
2. Mode par défaut sans écriture, `--appliquer` obligatoire : tenu (G9 : rapport sans écriture ; G1/G10 : mutation sous `--appliquer`).
3. API inaccessible, provenance non concordante, empreinte divergente, ambiguïté : arrêt sans modification : tenu (G2, G3, G4, G8).
4. Aucun workflow, hook, permission, secret, identité, connecteur, branche protégée ni écriture distante modifié : tenu ; `handoff.js` inchangé ; l'outil ne pousse jamais (G10).
5. Ne consomme que les clôtures satisfaisant intégralement les gardes, sans jugement de fond : tenu (G5 : `closes:false` sans effet, condition ou palier → `CLOTURE_NON_NUE` ; G6 : hors demande active ; G7 : idempotence).
6. Journal des transitions et tout déclencheur autonome hors du lot : tenu, non entrepris.

## Limites dites d'emblée

- Le banc remplace `gh` par un `gh` factice et sert l'API par un serveur local : le garde de provenance existant de `handoff.js` (`verifierGithubActionsRelay`) n'a donc pas été éprouvé ici contre l'API réelle. En usage réel, l'outil appelle le vrai `gh`.
- La concordance de la source ne prouve ni l'identité de l'émetteur ni l'immutabilité absolue du commentaire (limite déjà portée par `verifier-source-decision.js`).
- L'outil commite localement le registre après `consommer --cloture` ; `consommer` peut publier une demande de `en-attente/` (comportement existant de `handoff.js`).

## Demande

Constater que les conditions 1 à 6 sont tenues. Si l'arbitre l'estime, clore le lot (`closes: true`) : l'outil O3 est livré, non câblé. Le câblage (appelant de session, vigie R4) et le journal des transitions restent des lots distincts qui exigeront leur propre arbitrage.
