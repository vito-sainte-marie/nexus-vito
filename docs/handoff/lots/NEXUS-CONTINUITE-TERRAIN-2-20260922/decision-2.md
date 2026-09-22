---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 2
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision — poursuite technique de request-2.md, aucun nouvel arbitrage de fond

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

## Motif

`decision-1.md` avait déjà posé les termes : les §2 et §3 de `request-1.md` sont **déclarés**,
pas soumis, et avancent dans ce même lot sans nouvel arbitrage intermédiaire. `request-2.md` est
le compte rendu de ce travail déclaré (§2.1 — étude d'isolation Test des candidats web, ajout
prouvé de `urlTestDeBranche()`) : il ne pose aucune question de fond nouvelle et n'appelle donc
aucune décision métier. Cette décision ne fait que consigner, via l'outillage canonique, que la
poursuite est techniquement approuvée — elle n'invente aucune règle métier et ne rouvre aucun
point déjà tranché par `decision-1.md`.

L'absence d'accès Cloudflare/Supabase Test depuis ce canal GitHub Issue, documentée de façon
constante dans ce lot et dans l'ensemble de l'issue depuis le 06/09/2026, reste une contrainte
structurelle du canal — pas un motif pour élever une gate humaine.

## Conditions

- aucune règle métier nouvelle n'est posée par cette décision ;
- le portage des fichiers de configuration vers les branches candidates (`rebuild/fdj-62-20260922`,
  `rebuild/carburants-65-20260922`) reste différé tant qu'un accès Cloudflare humain n'a pas
  observé ce qui y est réellement construit et servi ;
- aucune preuve Supabase Test/Production ne doit être fabriquée pour combler l'absence d'accès de
  ce canal ; toute preuve manquante par construction doit être déclarée `NOT_APPLICABLE`, jamais
  simulée ;
- le classement des gates en attente (§6) et l'état Git de #62/#65 se limitent aux preuves
  Git/GitHub réellement disponibles depuis ce canal.

## Invariants

Aucun `main`, aucune `production`, aucun déploiement, aucune écriture Supabase Production, aucune
modification RLS/rôle/secret, aucun nouveau rôle, aucune règle métier/UX nouvelle.
