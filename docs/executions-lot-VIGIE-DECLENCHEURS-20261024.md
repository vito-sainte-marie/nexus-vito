# Exécution de decision-1 — déclencheurs de la vigie (VIGIE-DECLENCHEURS-20261024)

Décision : `decision-1.md` (arbitre ChatGPT, APPROVED_WITH_CONDITIONS, closes:false). Prise en charge `1776bf48`. Action : PR #155 (`908856cc`) sur `main`, épreuve `f90738b2`, decision-1 consommée `27371ee8`.
La PR #155 a été fusionnée dans `main` sur le GO de Frédéric (`f56edb0d`).

## A. Preuve 1 — lancement manuel
- Run **#18** de « Vigie de clôture », événement `workflow_dispatch`, branche `main`, `f56edb0d`, 2026-10-24 12:16 UTC : **success** (id 40093262162).
- Étapes : « Chercher une clôture en attente » success ; « Surveiller la CI du rail » success. Silencieuses : rail vert (`27371ee8`).
- Les trois runs précédents (#15 à #17) étaient tous `schedule`, espacés de 1 h 30 à 6 h.

## B. Preuve 2 — déclenchement par `workflow_run`
- Dépôt `40d12018` sur le rail (le présent document, preuve 1) → « Tests » : **success** (id 40093369238).
- Run **#19** de « Vigie de clôture », événement `workflow_run`, 2026-10-24 12:21 UTC : **success** (id 40093602554). Il a démarré à la fin de « Tests », sans lancement manuel ni cron.
- Étapes : « Chercher une clôture en attente » success ; « Surveiller la CI du rail » success. Silencieuses : rail vert.
- Le run est rattaché à `main` (`f56edb0d`), comme tout `workflow_run` ; il surveille bien le rail (checkout de `handoff-continuite-20260920`).

## C. Conditions de l'arbitre
Changement limité à `vigie-cloture.yml` ; exactement trois déclencheurs ; permissions inchangées ; épreuve et mutations (11/11) : tenues, voir PR #155.
Première vigie réelle de VIGIE-CI-RAIL-20261024, report de sa clôture : le run #18 (manuel) et le run #19 (`workflow_run`) la fournissent.
