# GOV-R2 : mesure du mécanisme de consommation (condition 1 de decision-1)

Mesure en lecture seule, faite le 20/10/2026 sur le rail (`1d8ab67f`) : historique git de `docs/handoff/STATE.json` depuis le 08/10, `outils/relancer-claude-ci.js`, `tests.yml` (étapes de matérialisation et de boucle), variables du dépôt.

## 1. Chiffres

- Lots passés à `DECISION_CONSOMMEE` depuis le 08/10 : **39** (la matrice E10 disait 29 ; l'écart vient du périmètre de comptage, pas d'une erreur de mécanisme).
- Commits de consommation ou de prise en charge sur STATE.json : `vito-sainte-marie` 52, `claude[bot]` 14, `Claude Code` 2, `github-actions[bot]` 1.
- Décisions déposées depuis le 08/10 : 57 par `github-actions[bot]` (matérialisation CI), 28 par `vito-sainte-marie`.
- Le seul commit de consommation de `github-actions[bot]` est `36b78ecc` (09/10, lot d'épreuve EPREUVE-STADE-A-MATERIALISATION, run 38003329890) : un essai du stade (a), jamais reproduit.

## 2. Attribution du mécanisme

La CI ne consomme pas : `tests.yml` le déclare (« La CI ne consomme PAS »), y compris pour `closes: true`, par condition d'un avis antérieur (ARMEMENT-ARBITRAGE-AUTONOME-1-20261008/decision-1.md:54). Les consommations viennent de deux canaux :

1. **Boucle autonome → `claude.yml`** : après dépôt d'une décision, l'étape « Boucle autonome » de `tests.yml` (variable `NEXUS_BOUCLE_AUTONOME=arme` depuis le 10/10) appelle `relancer-claude-ci.js`, qui émet un `repository_dispatch` `nexus-boucle-claude` ; `claude.yml` (branche par défaut) relance Claude, qui consomme et pousse sous `claude[bot]`. 14 commits.
2. **Sessions Claude Code locales** sous le compte partagé `vito-sainte-marie` (ou geste direct de Frédéric) : 52 commits. L'auteur git ne distingue pas les deux.

## 3. Pourquoi la clôture R1 n'a pas été consommée automatiquement

`relancer-claude-ci.js` rend `RIEN_A_FAIRE` (« la décision clôt le lot ») pour toute décision `closes: true` sans arrêt humain (lignes 113 et 153). La decision-3 de R1 (`closes: false`, 11:07Z) a donc relancé Claude, qui l'a consommée (`3ccaea41`, `claude[bot]`) ; la decision-4 (`closes: true`, 11:36Z) n'a relancé personne. Le jeton du workflow ne relance pas la CI non plus. La clôture a été consommée à la main (`88550540`, `39318f56`).

Conséquence pour la conception : le trou est le cas `closes: true` ; il est voulu par la garde actuelle, pas accidentel.

## 4. Limites (condition 3)

- Une empreinte prouve qu'un texte n'a pas changé depuis un point de référence ; elle ne prouve pas l'identité de l'émetteur.
- `claude.yml` et le relais partagent le jeton `github-actions[bot]` : plusieurs jobs peuvent poster sous ce nom. Risque résiduel explicite, non résolu par R2.
- L'auteur des commits `vito-sainte-marie` ne distingue pas Frédéric d'une session Claude Code.
