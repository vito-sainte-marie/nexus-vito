<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# decision-2 — GO suite FDJ carnets, lot maintenu ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (04/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO SUITE FDJ CARNETS
>
> Le verdict QUALIFIE_NEXUS_TEST de request-2 est accepté comme preuve de
> recette Test pour les correctifs déjà qualifiés. Ce GO autorise la
> poursuite du lot, PAS Production.

## Ce que la décision constate

`request-2.md` (commit `0149f2a`) rapporte une qualification navigateur
réelle sur `nexus-test` (commit servi confirmé, réconciliation vérifiée dans
la page, 6/6 écritures manager idempotentes), et une dette confirmée mais
non corrigée sur 3 chemins restants : les 2 écritures employé
(`creerActivationImplicite`, `executerActivationCarnetInterne`) et
`creerActivationReconstitueeCorrectionManager` (manager), qui mintaient une
`idempotency_key` fraîche à chaque appel plutôt que stable.

## Ce que la décision autorise (et uniquement cela)

1. Fermer la dette des 3 chemins : un jeton stable par jeu (même discipline
   que `jetonsRetourBloque`, déjà qualifié pour les 6 écritures manager),
   conservé tant que l'écriture n'a pas réussi, supprimé après succès —
   jamais de deuxième source de vérité, ledger `fdj_stock_movements`
   append-only inchangé ;
2. Ajouter les tests causaux utiles (retry après perte de réponse, double
   clic, intention distincte, concurrence/rejeu) ;
3. Qualifier sur `nexus-test` si ce canal le permet réellement, sans
   fabriquer de doublons inutiles ;
4. Préparer (sans forcément exécuter) les 3 contrôles Production READ-ONLY
   d'impact historique déjà documentés dans
   `audit-production-lecture-seule-1.sql` — exécution strictement réservée
   à un canal disposant réellement d'un accès Supabase Production, en
   lecture seule, sinon `NOT_APPLICABLE`, jamais fabriquée ;
5. Conserver `spec-point-zero-inventaire-fdj.md` comme spécification
   uniquement — ne pas l'exécuter ;
6. Publier une nouvelle demande canonique avec SHA exact, preuves mesurées,
   état de la réconciliation, dettes résiduelles et verdict proposé ;
7. STOP pour nouvel arbitrage humain avant tout geste Production.

## Ce qu'elle n'autorise pas

- Aucune fusion vers `production`, aucun déploiement Production, aucune
  migration Production, aucune écriture/réparation Production, aucune gate
  Pages Production, aucun Point Zéro réel.
- Le traitement de l'écart de migration `20261004130000` sur `production`
  reste hors de ce geste.
- Ce GO ne vaut à aucun moment autorisation Production : c'est une
  poursuite de lot Test/Handoff.

Le lot reste ouvert (`closes: false`) : il se refermera sur une décision
ultérieure, après lecture des preuves de cette suite.
