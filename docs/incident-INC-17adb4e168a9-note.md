# INC-17adb4e168a9 — request-3 réécrite après publication (PRISE-DE-POSTE-UN-ECRAN-20261025)

Ouvert le 2026-10-26. Deuxième occurrence après `3e2dcc4b` (request-2 de CATEGORIES-FIL-20261024 restaurée). Journal : `docs/learning/INCIDENTS.jsonl`, qui n'a pas de champ de note ; cette note le complète.

## Ce qui s'est passé
- `41294ef5` a publié request-3. L'arbitre l'a lue (run 40250249618, issue #28) et a rendu BLOCKED / OWNER_NEXT Frédéric (fusion de #158 réservée).
- `033ad017` a ensuite modifié request-3 (classe de preuve MEASURED remplacée par VERIFIED). Un échange publié a donc été réécrit : l'arbitre a jugé un texte que le rail ne porte plus.
- Décision : on ne revient pas en arrière. `033ad017` reste ; la réponse de l'arbitre reste attachée à `41294ef5`.

## Cause
`outils/handoff.js demande` acceptait n'importe quelle classe de preuve. MEASURED est hors vocabulaire (`VERIFIED|DECLARED|HUMAN|NOT_APPLICABLE`) ; l'erreur n'a été vue qu'après publication, d'où la réécriture.

## Correction
`631f5d00` : `demande` refuse une classe hors vocabulaire avant toute écriture (`REFUS PREUVE_CLASSE_HORS_VOCABULAIRE`), avec épreuve et mutation (`test_demande_classe_preuve_20261026.js`).

## Seconde anomalie : `--preuve-action 72216ec1`
La preuve de l'action de decision-2 cite `72216ec1`, qui est la fiche d'incident INC-74839140d278, et non l'action elle-même : `246b5765`, sur la branche du lot `prise-de-poste-un-ecran-20261025`. L'outil a accepté un SHA du rail sans pouvoir dire qu'il ne désigne pas l'action.

## Lot d'outillage proposé (non ouvert)
`--preuve-action` n'accepte qu'un commit **de la branche du lot**, vérifié sur `origin` (`git merge-base --is-ancestor <sha> origin/<branche-du-lot>` et absence du sha sur le seul rail), sinon REFUS avant écriture. Garde + mutation, comme pour la classe de preuve. À soumettre à l'arbitrage avant toute ouverture.
