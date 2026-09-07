---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ORCHESTRATION-GUARDIANS-1-20260907
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---
# Décision — Guardians backend : promotion différée, NexusStock isolé, portée Security conservée

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: true`.

Le périmètre démontré par `request-1.md` (rapatriement sélectif de 4 fichiers, calibration du Guardian Security 13 findings → 1 finding réel, 13/13 + 10/10 tests ciblés, 7/7 mutations détectées, régression 200/209 avec les 9 échecs historiques inchangés, aucun accès Production) est accepté tel quel. Ce lot est clos ; les prolongements identifiés ci-dessous appartiennent à des lots séparés.

## Q73 — blocage CI de `guardians-router.js`

NON à une garde bloquante tant que la collision d'identité globale `NexusStock` (`nexus-stock.js` vs `nexus-stock-moteur.js`, déjà notée par l'audit Guardian Architecture du 06/09/2026) subsiste : la rendre bloquante aujourd'hui reviendrait à bloquer la CI sur une dette déjà connue et déjà classée, pas sur une régression nouvelle.

Après résolution canonique de cette dette dans le lot `NexusStock` (Q74) : un premier verdict propre du routeur + une mutation négative réelle + une régression sans nouvel échec suffisent à promouvoir la garde en bloquant, **sans nouvel arbitrage produit**, à condition que la doctrine, le scope et l'environnement Guardian n'aient pas changé entre-temps. Si l'un de ces trois change, un nouvel arbitrage reste requis.

## Q74 — lot déterministe distinct `NexusStock`

OUI. Un futur lot dédié doit : déterminer le propriétaire logique unique de la vérité `NexusStock` (lequel de `nexus-stock.js` / `nexus-stock-moteur.js` est vivant, lequel est mort) ; supprimer ou renommer la collision sans introduire de logique métier parallèle ; prouver l'ensemble des consommateurs réels (pages `<script src>`) et l'absence de régression sur chacun. Aucun cherry-pick ni renommage aveugle. **Ce lot Guardians ne corrige pas NexusStock** — la correction est explicitement hors périmètre ici.

## Q75 — portée du Guardian Security

Conserver la portée actuelle (détection de secret littéral dans les fichiers changés du diff). Aucun scan systématique de l'ensemble du dépôt dans ce lot. Toute extension de portée doit d'abord être mesurée, puis justifiée par la preuve d'un trou réel (un cas concret non couvert), avec une calibration anti-faux-positifs équivalente à celle qui a fait passer le signal de 13 findings à 1 finding réel.

La réduction 13 → 1 est actée comme une **amélioration du signal** (élimination de faux positifs), pas comme un affaiblissement du contrôle — le finding réel restant (la collision `NexusStock`) demeure identifié et tracé, il n'a pas disparu du radar, il est simplement redirigé vers son propre lot (Q74).

## Disposition ORCH-002

`ORCH-002` est considéré réalisé dans son périmètre propre et passe à `TERMINE` après consommation canonique de cette décision. La dette `NexusStock` est matérialisée au Backlog comme futur lot, à prioriser selon l'impact démontré (aucune urgence artificielle créée par cette clôture).

## Invariants

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucun secret dans dépôt/navigateur/logs, aucun élargissement opportuniste du scope Security au-delà de Q75, aucune correction de `NexusStock` matérialisée dans ce lot.
