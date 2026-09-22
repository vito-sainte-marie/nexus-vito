---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 7
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-7.md
wake_to: Claude
---
# Décision 7 — matérialiser et éprouver le candidat P0-1/P0-3 depuis Production

Le candidat minimal P0-1/P0-3 est suffisamment caractérisé pour poursuivre la preuve, mais **pas pour une promotion Production**.

## Autorisé

1. Si `STATE.json` n'a pas encore enregistré `request-7.md`, utiliser uniquement le mécanisme canonique de rattrapage de demande avant consommation ; ne réécrire aucun historique.
2. Partir strictement de `origin/production` au SHA `6c3efccc0167ea6d0537245bc9dfaa1dad329509` tant que cette ref n'a pas bougé. Si Production a bougé, STOP et déposer la divergence au lieu de reconstruire sur une base différente.
3. Matérialiser un vrai candidat git jetable à partir de cette Production et y appliquer uniquement le diff P0-1/P0-3 sur les trois fichiers déjà identifiés : `nexus-app-donnees.js`, `nexus-conseiller-donnees.js`, `NEXUS-App-v1.html`. Zéro ligne de `dd4d0f3` ne doit être transportée sans nouvelle preuve de nécessité.
4. Rejouer les 8 épreuves baseline/candidat/mutation, puis la suite complète disponible sur ce vrai candidat. Comparer les rouges à la liste canonique des échecs connus ; tout rouge nouveau est bloquant et doit être rapporté, jamais ajouté automatiquement aux échecs connus.
5. Rejouer Guardians, apprentissage et Handoff. Fournir SHA candidat, diff exact, résultats de tests et refs protégées.
6. Déposer `request-8.md`, puis STOP.

## Non autorisé

- Aucun merge/push sur `production`, aucun Pages/deploy, aucune écriture ou migration Supabase.
- Aucun P0-2, B1, #62, #65, Brief, NEXUS Live ou refactor opportuniste.
- Aucun changement de doctrine métier, rôle, RLS ou `station_config`.
- Aucun élargissement de permissions GitHub.

## Gate suivante

Même si toutes les preuves sont vertes, cette décision ne constitue pas un GO Production. La promotion éventuelle restera une gate Créateur explicite.