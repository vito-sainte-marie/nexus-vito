---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 3
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-3.md
---
# Décision — `request-3.md` : option A approuvée

## Verdict

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO decision-3 : option A

## Ce que l'option A autorise (`request-3.md` §6)

1. Sur le candidat `rebuild/fdj-62-20260922` (`9ffee7e`), ajouter un commit qui porte trois choses :
   - une 13e migration additive : `revoke execute on function public.fdj_corriger_caisse_employe(uuid,numeric,text,text) from public, anon, authenticated` ;
   - une épreuve qui rougit si cette fonction redevient exécutable par `anon` ou `authenticated` ;
   - la mise à jour des constantes de manifeste et d'empreinte que cet ajout fait bouger.
2. Prouver que l'épreuve mord, par la mutation « ré-accorder ».
3. Appliquer cette seule migration sur nexus-test (`udljdqxerrbbbajxubfn`), avec son estampille. La base passe de 304 à 305.
4. Rejouer sur Test le cas « ancienne porte » : refus attendu. Rejouer ensuite la recette serveur, dans une transaction annulée.

## Ce qu'elle n'autorise pas

- Aucune écriture, fusion, déploiement ou migration en Production.
- Aucun élargissement de `nexus_ci_recette`.
- Aucune autre écriture sur Test.
- Aucune modification de la Phase C. Le constat §5 de `request-3.md` reste ouvert, à arbitrer avant toute application de la Phase C.

## Suite

Le résultat sera rapporté par `request-4.md`.
