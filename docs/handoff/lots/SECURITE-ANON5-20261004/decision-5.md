---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-ANON5-20261004
seq: 5
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-5.md
---
# decision-5 — GO clôture anon5

`APPROVED`, `closes: true`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO clôture anon5

## Ce que la décision constate et autorise

La clôture du lot SECURITE-ANON5-20261004, demandée par `request-5.md`
(bb497ae), dans l'état qu'elle rapporte :

- migration `20261004130000` appliquée en Production (decision-1, registre 295) ;
- candidat 7b96872 rapatrié dans le rail par f481cec (decision-4), CI rail
  37217693921 verte, 62/62 étapes ;
- fusion vers `production` non faite (request-3, request-4).

## Ce qu'elle n'autorise pas

- Aucune fusion vers `production`, aucune écriture Production, aucune gate Pages.
- L'écart entre le registre Production (295) et la branche `production`, qui
  ne porte pas le fichier `20261004130000`, n'est pas résolu par cette
  clôture : il relève de la réconciliation générale rail → `production`, qui
  exigera ses propres GO.
