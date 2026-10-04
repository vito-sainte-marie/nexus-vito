---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 4
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-4.md
---
# Décision — `request-4.md` : option A approuvée

## Verdict

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO decision-4 : option A

## Ce que l'option A autorise (`request-4.md`)

1. Une lecture seule de Production (`uzhjpqpctpvxytxpxoqz`), enveloppée dans `begin read only … rollback`. L'identité sera constatée par `current_user`. La lecture porte sur :
   - l'existence de `public.fdj_corriger_caisse_employe(uuid,numeric,text,text)` ;
   - `has_function_privilege` pour `anon`, `authenticated` et `service_role` ;
   - le `proacl` de cette fonction.
2. Le rapport du résultat dans `request-5.md`. Si la fonction est ouverte, ce rapport présentera les options de fermeture côté Production, et chacune exigera ses propres GO.

## Ce qu'elle n'autorise pas

- Aucune écriture, aucun grant ni revoke, aucune migration, fusion ou déploiement en Production.
- Aucune écriture sur Test.
- Aucune modification de la Phase C : le constat §5 de `request-3.md` reste ouvert.
- Aucun élargissement de `nexus_ci_recette`.

## Suite

Le résultat sera rapporté par `request-5.md`.
