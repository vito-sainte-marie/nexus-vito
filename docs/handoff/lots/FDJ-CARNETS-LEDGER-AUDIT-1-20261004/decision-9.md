---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 9
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-9.md
---
# decision-9 — GO extension du lot à la réconciliation canonique FDJ ; correctif local et tests seulement

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 05/10/2026, en réponse à
`request-9.md` et à la mission « NEXUS — FDJ CARNETS — RÉCONCILIATION CANONIQUE
ET SOURCE UNIQUE DE VÉRITÉ ». Verbatim :

> GO étendre le lot, fais le correctif local et les tests

## Ce que la décision autorise

- Étendre le périmètre du lot FDJ-CARNETS-LEDGER-AUDIT-1-20261004 à la
  réconciliation canonique du stock FDJ : ledger et moteur uniques, date
  effective métier, transfert bureau→caisse adossé à l'activation, anomalie
  explicite en cas d'ambiguïté, « Vérifié » distinguant détectée / examinée /
  résolue, même moteur pour Manager et Employé.
- Base de code : le candidat-8 (snapshots `candidate-*` de ce lot), posé sur
  `production` = `30544c9af7ebf83d8ec1ba3882418252380036f1`.
- Écrire le correctif **localement** (branche de travail `claude/*`, migration
  nouvelle en fichier seulement) et ses tests A à G, avec mutations négatives.
- Rendre compte par `request-10.md`.

## Ce qu'elle n'autorise pas

- Aucune migration appliquée, ni sur Test ni en Production.
- Aucune fusion, aucun déploiement, aucune gate Pages, aucune écriture
  Production, aucune réparation de données.
- Aucun élargissement de `nexus_ci_recette`, aucun force ni skip.
- Chacun de ces gestes exigera un GO séparé, au SHA rapporté par
  `request-10.md` ; si le SHA bouge, le GO tombe.
