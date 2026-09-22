<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 1
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision — B1 : accès du remplaçant manager

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le point 1 de `request-1.md` (la seule question soumise à un geste humain) est tranché.
Les §2 et §3 restent déclarés, pas soumis, et continuent d'avancer dans ce même lot sans
nouvel arbitrage. Le lot reste donc ouvert.

## Décision métier — rôles et accès pendant l'absence de Frédéric

- Audrey et Lydie sont les remplaçantes manager légitimes.
- Audrey est la remplaçante opérationnelle prioritaire actuellement. Frédéric confirme, le
  22/09/2026, qu'elle se connecte normalement à NEXUS — la preuve d'aboutissement demandée par
  `request-1.md` (`auth.users.last_sign_in_at` du compte retenu à la date du jour) est donc déjà
  acquise, constatée par Frédéric et non par une requête que Claude aurait exécutée.
- Yannick est gérante ; ses droits actuels sont conservés tels quels.
- Angélique ne reçoit aucune promotion manager. Son rôle préférentiel reste renfort, avec
  polyvalence opérationnelle renfort/caissière/pompiste.
- Principe général pour les employés terrain, à conserver au-delà de ce lot : rôle préférentiel
  ≠ rôle opérationnel du quart ≠ autorité manager/gérant. Ce sont trois notions distinctes, et
  aucune des deux premières n'emporte la troisième.

## Ce que cette décision NE fait PAS

Comptes et droits en base restent inchangés : Audrey et Lydie portaient déjà les droits manager
nécessaires, la question n'était pas un déficit de privilège mais une absence de connexion,
désormais levée pour Audrey. Aucun changement RLS, aucun changement de rôle, aucun secret n'est
requis pour clore ce point — conformément à la demande, aucune écriture de ce type n'a été
fabriquée pour produire une preuve supplémentaire.

## Pourquoi `closes: false`

`request-1.md` ne soumettait que ce point à un arbitrage ; ses §2 (isolation Test des candidats
web) et §3 (dette de dérive Supabase Test) sont déjà déclarés comme travail ordinaire à mener
sans autorisation intermédiaire dans ce même lot. Fermer le lot ici arrêterait ce travail sans
raison.

## Invariants

Aucun `main`, aucune `production`, aucun déploiement, aucune écriture Supabase Production,
aucune modification RLS/rôle/secret.
