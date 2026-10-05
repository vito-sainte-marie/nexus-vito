---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 7
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-7.md
---
# decision-7 — GO préparation/qualification du correctif FDJ reconstruit contre le code réel de Production

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le lot reste ouvert : cette décision accepte le diagnostic de `request-7.md`
(STOP sans fusion était la bonne réponse — `production` porte déjà sa
propre bascule RPC indépendante issue de PR #62) et autorise une nouvelle
séquence de préparation/qualification, strictement non-fusionnante. Elle se
referme sur l'arbitrage qui suivra le rapport attendu en réponse (candidat
minimal reconstruit, matrice 9/9, verdict de readiness).

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (2026-10-05). Verbatim :

> ARBITRAGE HUMAIN — GO REQUEST-7 FDJ CARNETS
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-7.md
> Décision humaine explicite de Frédéric : « Go request 7 ».
>
> Le diagnostic de request-7 est accepté : ne pas cherry-pick aveuglément
> 7e41b3b/b445860 sur Production. La suite doit être reconstruite contre le
> code RÉEL actuellement présent sur production, en préservant PR #62.
>
> AUTORISATION LIMITÉE À LA PRÉPARATION/QUALIFICATION — PAS DE FUSION
> PRODUCTION DANS CE GESTE
>
> 1. Déposer/consommer la décision canonique en réponse à request-7.md via
>    outils/handoff.js, verdict APPROVED_WITH_CONDITIONS, closes=false.
>
> 2. Revalider au démarrage le HEAD exact de production. Si différent de
>    30544c9af7ebf83d8ec1ba3882418252380036f1, recalculer le diagnostic
>    contre le nouveau HEAD et signaler toute conséquence.
>
> 3. Construire un correctif FDJ MINIMAL basé sur le code réel de
>    production :
>    a) nexus-fdj-moteur.js : corriger uniquement le routage ledger
>       'correction' déjà démontré compatible ;
>    b) NEXUS-FDJ-v1.html et NEXUS-FDJ-Manager-v1.html : conserver
>       intégralement l'architecture RPC issue de PR #62 et modifier
>       uniquement la gestion des idempotency_key afin qu'une même
>       intention/retry réutilise le même jeton jusqu'au succès, tandis
>       qu'une nouvelle intention obtient un nouveau jeton.
>    Ne réintroduire aucun ancien .insert() direct.
>
> 4. Couvrir explicitement les chemins concernés, y compris les 6
>    écritures manager déjà RPC et les 3 chemins dont la clé fraîche a été
>    identifiée. Produire une matrice 9/9 indiquant pour chacun : RPC réel,
>    cycle du jeton, retry, succès/reset, nouvelle intention.
>
> 5. Ajouter/adapter des tests causaux contre CETTE implémentation
>    Production, avec mutation négative si proportionnée. Vérifier qu'ils
>    échouent si la stabilisation est retirée.
>
> 6. Qualifier sur nexus-test/CI autant que le canal le permet. Ne pas
>    fabriquer de doublons inutiles. Toute limite navigateur doit rester
>    explicite.
>
> 7. Préparer un diff/branche/PR candidat minimal dont la base est le HEAD
>    Production réellement vérifié. Exclure strictement :
>    - migrations Test-only 20261004200000 / 20261004200100 ;
>    - Handoff/gouvernance hors nécessité de preuve ;
>    - Point Zéro ;
>    - 20261004130000 / ANON5 ;
>    - tout changement étranger au lot.
>
> 8. Publier une nouvelle request canonique avec : base Production exacte,
>    SHA candidat, liste exhaustive des fichiers/hunks, tests/CI/run IDs,
>    matrice 9/9, preuve qu'aucun travail PR #62 n'est supprimé, état du
>    transport et verdict PRET_OU_NON_PRET_POUR_FUSION_PRODUCTION.
>
> 9. STOP et attendre un nouvel arbitrage humain. Ne pas fusionner dans ce
>    geste.
>
> INTERDICTIONS : aucune fusion Production, aucun déploiement Production,
> aucune migration Production, aucune écriture/réparation de données
> Production, aucun Point Zéro, aucun traitement de 20261004130000.
>
> Objectif : transformer la divergence détectée par request-7 en un
> candidat FDJ propre, minimal et réellement basé sur Production, sans
> contourner la garde qui vient de fonctionner.

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` ;
2. Revalider le HEAD réel de `production` avant tout code ;
3. Reconstruire, contre le code réel de `production`, un correctif minimal :
   routage ledger `correction` dans `nexus-fdj-moteur.js`, et un cycle de
   jeton stable par intention superposé à l'architecture RPC déjà en place
   (PR #62), sans réintroduire d'`.insert()` direct ;
4. Produire la matrice 9/9 (6 écritures manager + 3 chemins à clé fraîche) ;
5. Ajouter des tests causaux avec mutation négative contre cette
   implémentation réelle ;
6. Qualifier dans la limite du canal, en signalant explicitement toute
   limite navigateur ;
7. Préparer un diff/branche candidat minimal, base = HEAD Production
   réellement vérifié, avec les exclusions listées au point 7 du verbatim ;
8. Publier une nouvelle request canonique avec le verdict de readiness ;
9. STOP — aucun nouvel arbitrage de fusion n'est pris par ce geste.

## Ce qu'elle n'autorise pas

Aucune fusion Production, aucun déploiement Production, aucune migration
Production, aucune écriture/réparation de données Production, aucun Point
Zéro, aucun traitement de l'écart `20261004130000`, aucun secret
créé/lu/exposé.
