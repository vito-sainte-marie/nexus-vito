---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# decision-1 — GO recette FDJ carnets (nexus-test), lot maintenu ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (04/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO RECETTE FDJ CARNETS
>
> Autorisation accordée UNIQUEMENT pour poursuivre la qualification/recette
> du candidat FDJ Carnets sur nexus-test et produire les preuves Handoff
> correspondantes.

## Ce que la décision constate

`request-1.md` (commit `53d7cb6`) rapporte une correction prouvée en local
(21/21 réconciliation, 11/11 idempotence, mutations négatives réellement
rejouées, 294/303 régression globale, 35/35 FDJ) mais une qualification
`nexus-test` **non exécutée** par séquence : le code corrigé n'était, au
moment du dépôt, pas encore servi par le rail (`attendreVersionServie`
aurait détecté une version antérieure).

Vérifié avant cette décision : le commit `7e41b3b` (reconstruction fichier
par fichier du candidat sur le rail courant, sans fusion de la branche
divergente) est déjà intégré à `handoff-continuite-20260920` — il est
l'ancêtre direct du commit de dépôt `53d7cb6`. L'étape 1 du verdict de
`request-1.md` (« GO pour rapatrier 7e41b3b ») est donc déjà satisfaite ;
il ne reste que la qualification elle-même.

## Ce que la décision autorise (et uniquement cela)

1. Qualifier sur `nexus-test` la correction de réconciliation et
   l'idempotence des écritures carnets ;
2. Vérifier les 9 chemins d'écriture, en particulier le comportement réel
   retry/double-clic et les 3 chemins à clé `idempotency_key` fraîche à
   chaque appel (§8 de `request-1.md`) ;
3. Ne masquer aucune divergence constatée pendant la recette ;
4. Conserver `spec-point-zero-inventaire-fdj.md` comme spécification
   uniquement — ne pas l'exécuter (aucune migration, aucune donnée créée) ;
5. Publier une nouvelle demande canonique avec SHA exact, run IDs, preuves
   de recette réelles, anomalies/blocages résiduels et verdict proposé.

## Ce qu'elle n'autorise pas

- Aucune fusion vers `production`, aucun déploiement Production, aucune
  migration Production, aucune écriture/réparation Production, aucune gate
  Pages Production.
- Le traitement de l'écart de migration `20261004130000` sur `production`
  reste hors de ce geste.
- Les éventuels contrôles Production restent lecture seule, et uniquement
  si le canal dispose réellement des accès — sinon ils restent `NOT_APPLICABLE`,
  pas fabriqués.
- Ce GO ne vaut à aucun moment autorisation Production : c'est un GO
  recette `nexus-test`.

Le lot reste ouvert (`closes: false`) : il se refermera sur une décision
ultérieure, après lecture des preuves de recette.
