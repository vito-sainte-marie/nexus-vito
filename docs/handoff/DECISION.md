<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 5
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-5.md
---
# decision-5 — GO request-5 : qualification finale avant gate, lot maintenu ouvert

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (05/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO REQUEST-5 FDJ CARNETS
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-5.md
> Décision humaine explicite de Frédéric : « Go request 5 ».
>
> Ce GO autorise la poursuite de la qualification pré-Production du lot FDJ
> Carnets, mais N'AUTORISE AUCUN geste Production.
>
> OBJECTIF DE CE CYCLE
> Réduire les vrais bloqueurs restant avant une éventuelle gate Production,
> sans transformer des éléments post-déploiement ou hors lot en faux
> prérequis.
>
> 1. PREUVE NAVIGATEUR DES 3 CHEMINS
> Compléter, si techniquement possible sur nexus-test, une preuve
> navigateur dédiée de la stabilisation des 3 chemins :
> jetonsActivationImplicite, jetonsActivationCarnet,
> jetonsCorrectionManager. Prouver qu'un retry d'une même intention
> réutilise la même idempotency_key et qu'une nouvelle intention obtient
> une nouvelle clé. Éviter les doublons/données inutiles. Si une preuve
> navigateur fidèle est techniquement disproportionnée ou impossible,
> documenter précisément pourquoi et conserver la preuve Node causale sans
> prétendre l'avoir remplacée.
>
> 2. AUDIT PRODUCTION STRICTEMENT READ-ONLY
> Les 3 requêtes de audit-production-lecture-seule-1.sql peuvent être
> exécutées UNIQUEMENT si ce canal possède réellement un accès Production
> et uniquement en SELECT. Aucun INSERT/UPDATE/DELETE/RPC mutateur, aucune
> réparation, publier les résultats exacts et leur interprétation ; sans
> accès réel : NOT_APPLICABLE, ne rien simuler.
>
> 3. POINT ZERO
> Ne PAS exécuter le Point Zéro. Le Point Zéro est un geste opérationnel
> post-déploiement et ne doit pas être présenté comme un prérequis
> technique à la promotion du correctif FDJ. Conserver seulement sa
> spécification et ses préconditions.
>
> 4. ECART 20261004130000
> Ne PAS traiter l'écart de migration 20261004130000 dans ce lot. Vérifier
> seulement qu'il n'introduit pas une dépendance technique directe
> empêchant le correctif FDJ Carnets d'être promu. S'il est indépendant, le
> classer explicitement comme dette globale Production hors lot, et non
> comme bloqueur FDJ artificiel.
>
> 5. READINESS
> Rejouer les contrôles proportionnés et établir une matrice claire :
> bloqueurs réels propres au lot FDJ, limites acceptées, dettes hors lot,
> opérations post-déploiement, gate humaine Production. Publier
> request-6.md avec SHA exacts, tests/CI/run IDs disponibles, preuves
> navigateur éventuelles, résultats SELECT éventuels et verdict explicite
> PRET_OU_NON_PRET_POUR_GATE_PRODUCTION.
>
> STOP obligatoire avant toute fusion, déploiement, migration ou écriture
> Production.
>
> INTERDICTIONS ABSOLUES
> Aucune fusion vers production, aucun déploiement Production, aucune
> migration Production, aucune écriture/réparation Production, aucune gate
> Pages Production, aucun Point Zéro réel, aucun traitement de
> 20261004130000.
>
> Ce GO request-5 est un GO de qualification finale avant gate, pas un GO
> Production.

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` — le lot reste ouvert ;
2. Tenter la preuve navigateur dédiée des 3 chemins à clé fraîche sur
   `nexus-test`, si et seulement si le canal dispose réellement des moyens
   techniques (URL, PIN, réseau) ; sinon documenter précisément la
   limite, sans la dissimuler ni fabriquer un remplacement ;
3. Exécuter les 3 `SELECT` de `audit-production-lecture-seule-1.sql`
   uniquement si une variable d'environnement Supabase/Production réelle
   existe dans ce canal ; sinon `NOT_APPLICABLE`, rien de simulé ;
4. Ne pas exécuter le Point Zéro — conserver sa spécification ;
5. Vérifier uniquement l'absence de dépendance technique directe de
   l'écart de migration `20261004130000` envers le correctif FDJ, sans le
   traiter ;
6. Rejouer les contrôles proportionnés et publier `request-6.md` avec une
   matrice de readiness et un verdict explicite
   `PRET_OU_NON_PRET_POUR_GATE_PRODUCTION`.

## Ce qu'elle n'autorise pas

Aucune fusion vers `production`, aucun déploiement Production, aucune
migration Production, aucune écriture/réparation Production, aucune gate
Pages Production, aucun Point Zéro réel, aucun traitement de l'écart
`20261004130000`. Ce GO n'est pas un GO Production.

Le lot reste ouvert (`closes: false`) : il se refermera sur un arbitrage
ultérieur, après lecture de la matrice de readiness et du verdict proposé
par `request-6.md`.
