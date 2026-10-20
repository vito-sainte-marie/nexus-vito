---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
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
---
# GOV-R2-EMPREINTE-DECISION-20261020 : preuves rouge→vert du vérificateur de source (decision-2)

**Domaine :** gouvernance. **Préparé par :** Claude Code. **Nature :** dépôt de preuves ; demande de clôture du lot si l'arbitre les juge suffisantes.

## Ce qui a été fait (tout dans `outils/`, rien câblé)

- `a387354c` : `outils/test_verification_source_decision_20261020.js`, épreuves F1 à F8 (11 cas avec F4b, F5b, F7b), vues **ROUGES** avant tout code : 0/11, exit 1, cause `MODULE_NOT_FOUND` (vérificateur absent).
- `9e07cc72` : `outils/verifier-source-decision.js`, épreuves **VERTES** 11/11.
- Écart découvert à la lecture du vrai commentaire (`issuecomment-6296095776`, auteur `github-actions[bot]`) : il enveloppe le verdict d'un en-tête « Réponse de l'arbitre (…) » et d'un marqueur final `<!-- nexus-arbitrage: … -->`. La version `9e07cc72` rendait donc `DECISION_ALTEREE` à tort sur la decision-2 réelle (faux positif, constaté, pas une garde trouée).
- Correctif (dernier commit du rail) : seuls cet en-tête et ce marqueur, de forme exacte, sont retirés avant comparaison ; épreuves F9 (forme réelle acceptée) et F9b (tout autre ajout reste une altération) ajoutées : 13/13 vertes. Ces deux épreuves ont été écrites après le vert initial, rouge constaté sur le commentaire réel et non sur un jeu écrit d'avance : dit ici pour ne pas le présenter autrement.
- Contrôle réel : `verifierSource` sur `decision-2.md` avec le vrai commentaire lu par l'API → `ok`, sha256 du corps `80987d53…4a65`.

## Preuve des conditions de decision-2

1. **F1 à F8 avant le vérificateur, rouge puis vert conservés.** Respectée (`a387354c` rouge, `9e07cc72` vert, correctif F9 ensuite).
2. **Modifications limitées à `outils/`.** Respectée : seuls deux fichiers d'`outils/` (plus, sur le rail, le dossier du lot).
3. **Vérification liée au commentaire et au run désignés.** Respectée par le pointeur `provenance.reference` (commentaire 6296095776) ; le run 39459485862 est cité dans le commentaire. Le vérificateur ne vérifie pas encore le run lui-même : limite.
4. **Corps canonique et champs DECISION, CLOSES, LOT, REQUEST comparés.** Respectée (F1, F4, F5).
5. **Échec explicite sans consommation si source absente, inadmissible, hors lot ou injoignable.** Respectée (F2, F3, F4, F6) : l'outil ne consomme rien.
6. **Concordance ≠ identité ni immutabilité.** Dit dans chaque résultat de l'outil.
7. **Aucun workflow, secret, permission, identité, connecteur, armement ; O1/O2 non câblées.** Respectée.

## Limites

- Un job `claude.yml` partage `github-actions[bot]` : risque résiduel non résolu, renvoyé à la voie B.
- Le commentaire GitHub reste modifiable après coup ; le vérificateur lit l'état courant.
- Rien n'est câblé : la consommation automatique des clôtures (note de Frédéric) n'est pas réalisée ; options O1/O2 exigeraient un arbitrage Frédéric, O3 est la seule hors workflow.

## Décision demandée

Dire si ces preuves suffisent à clore R2 (`closes: true`) ou quelle suite en R3 (appel du vérificateur par un outil, sans workflow).
