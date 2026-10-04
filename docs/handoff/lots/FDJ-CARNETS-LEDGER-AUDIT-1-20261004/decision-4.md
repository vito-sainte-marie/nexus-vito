---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 4
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
---
# decision-4 — GO request-4 : transport consolidé, lot maintenu ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (04/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO REQUEST-4 FDJ CARNETS
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-4.md
> Décision humaine explicite de Frédéric : « Go request 4 ».
>
> Autorisation limitée au Handoff : accepter request-4 et terminer proprement
> l'intégration canonique des artefacts du lot sur handoff-continuite-20260920.
> Ce GO N'EST PAS un GO Production.

## Ce que la décision constate

`request-4.md` (commit `bf986cc`, déjà présent sur le rail canonique au
démarrage de cette session) rapportait que le transport de
`claude/issue-28-20261004-2206` et le dépôt/consommation de `decision-3.md`
avaient eu lieu, mais que ces deux derniers commits (`ab76ef6`, `d1768a0`)
ne résidaient encore que sur une branche de travail isolée
(`claude/issue-28-20261004-2314`), pas sur le rail canonique lui-même.

Constat vérifié au démarrage de **cette** session : `HEAD` du checkout de
travail est **déjà identique** à `origin/handoff-continuite-20260920`
(`bf986cc`), et cette valeur inclut déjà `ab76ef6` et `d1768a0` dans son
historique. L'intégration demandée au point 1 de `decision-3.md` a donc eu
lieu entre le dépôt de `request-4.md` et le démarrage de cette session —
par un mécanisme hors de ce canal (fast-forward/merge, comme pour le
transport précédent). `STATE.json` canonique reflète correctement
`DECISION_CONSOMMEE` pour `decision-3.md` avant toute action de cette
session.

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` — le lot reste ouvert ;
2. Vérifier que la branche de travail ne diverge pas du rail canonique
   avant toute écriture, et ne transporter que les artefacts Handoff du lot
   (decision/request/STATE/miroirs) — aucun commit étranger ;
3. Exécuter les CI/Guardians proportionnés sur le rail et publier les
   résultats mesurés (pas supposés) ;
4. Conserver explicitement, sans la masquer, la limite connue : la
   stabilisation des 3 chemins à clé fraîche (`jetonsActivationImplicite`,
   `jetonsActivationCarnet`, `jetonsCorrectionManager`) reste prouvée
   causalement en Node (mutation négative réellement rejouée) sans preuve
   navigateur dédiée de la mise en cache par les 3 fonctions appelantes
   elles-mêmes ;
5. Les 3 requêtes `SELECT` de `audit-production-lecture-seule-1.sql`
   restent `READ-ONLY` et réservées à l'Orchestrator — `NOT_APPLICABLE`
   depuis ce canal, qui ne dispose d'aucune variable Supabase/Production ;
6. `spec-point-zero-inventaire-fdj.md` reste spécification uniquement — ne
   pas l'exécuter ;
7. Publier une nouvelle demande canonique (`request-5.md`) indiquant
   précisément ce qui reste nécessaire avant toute éventuelle promotion
   Production, avec un verdict proposé — pas une clôture du lot ;
8. STOP avant tout geste Production, attendre un nouvel arbitrage humain.

## Ce qu'elle n'autorise pas

- Aucune fusion/déploiement/migration/écriture/réparation Production, aucune
  gate Pages Production, aucun Point Zéro réel, aucun traitement de l'écart
  de migration `20261004130000`.
- Ce GO autorise request-4 et la consolidation Handoff uniquement — il n'est
  pas un GO Production.

Le lot reste ouvert (`closes: false`) : il se refermera sur une décision
ultérieure, après lecture des preuves de la consolidation et de la suite
demandée.
