---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 3
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
wake_to: Claude
---
# decision-3 — GO request-3 : transport Handoff autorisé, lot maintenu ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (04/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO REQUEST-3 FDJ CARNETS
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-3.md
> Décision humaine explicite de Frédéric : « Go request 3 ».
>
> Autorisation : poursuivre le traitement Handoff de request-3 et sécuriser
> son transport/intégration sur le rail canonique. Ce GO NE VAUT PAS
> autorisation Production.

## Ce que la décision constate

`request-3.md` (commit `c001e94`) rapporte la fermeture de la dette des 3
derniers chemins à clé fraîche (`jetonsActivationImplicite`,
`jetonsActivationCarnet`, `jetonsCorrectionManager`), 12/12 tests causaux
avec mutation négative réellement rejouée, une qualification réelle sur
`nexus-test` via l'alias Cloudflare Pages de la branche de travail
(commit servi `9000daf`, réconciliation et 6/6 idempotence serveur
confirmées), et une limite assumée : pas de preuve navigateur dédiée de la
stabilisation des 3 chemins eux-mêmes (preuve Node rigoureuse à la place).

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` — le lot reste ouvert ;
2. Vérifier le transport de `claude/issue-28-20261004-2206` vers
   `handoff-continuite-20260920` et le prouver par SHA exact ;
3. Intégrer au rail uniquement les changements du lot FDJ Carnets et les
   preuves Handoff nécessaires — aucun commit étranger, aucune régression
   ANON5, aucun écrasement d'historique ;
4. Exécuter les CI/Guardians proportionnés sur le rail transporté et publier
   les résultats ;
5. Conserver explicitement la limite connue (preuve navigateur absente pour
   les 3 chemins) sans la masquer ;
6. Les 3 SELECT Production restent READ-ONLY et uniquement si le canal
   dispose réellement de l'accès ; sinon `NOT_APPLICABLE` ;
7. `spec-point-zero-inventaire-fdj.md` reste spécification uniquement — ne
   pas l'exécuter ;
8. Publier une nouvelle demande canonique avec l'état de transport, les
   preuves, les blocages résiduels et un verdict proposé ;
9. STOP avant tout geste Production, attendre un nouvel arbitrage humain.

## Ce qu'elle n'autorise pas

- Aucune fusion/déploiement/migration/écriture/réparation Production, aucune
  gate Pages Production, aucun Point Zéro réel, aucun traitement de l'écart
  de migration `20261004130000`.
- Ce GO autorise request-3 et son transport Handoff uniquement — il n'est
  pas un GO Production.

Le lot reste ouvert (`closes: false`) : il se refermera sur une décision
ultérieure, après lecture des preuves du transport et de la suite demandée.
