---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 8
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-8.md
---
# decision-8 — GO transport/qualification du candidat FDJ reconstruit (request-8), toujours sans fusion Production

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le lot reste ouvert : cette décision accepte le constat de `request-8.md`
(candidat minimal reconstruit contre le code réel de `production`, prouvé
par exécution réelle, matrice 9/9 verte, mais `NON_PRET_POUR_FUSION_PRODUCTION`
faute de qualification nexus-test/CI réelle) et autorise une nouvelle
séquence strictement non-fusionnante : transport effectif du candidat sous
forme de branche/PR minimale basée sur le HEAD Production réellement
vérifié, exécution des gates déterministes disponibles, et vérification
d'absence de contamination du diff.

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (2026-10-05). Verbatim :

> GO TRANSPORT / QUALIFICATION REQUEST-8 — FDJ CARNETS
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-8.md
> Décision humaine explicite de Frédéric : « GO transport request-8 ».
>
> État canonique vérifié avant ce GO :
> - rail handoff-continuite-20260920 = a1ce903c3e777e51fb1f01781b79ab9bfaedb824 ;
> - STATE.json blob = 2b2202646f63d55a12ac77bcf9d65af80a5d1317 ;
> - lot = ATTENTE_DECISION, request-8.md active ;
> - decision-7 = d959d8be213b32de9b182614a80dfbfb7addead4, consommée ;
> - production = 30544c9af7ebf83d8ec1ba3882418252380036f1, inchangée.
>
> Important : le candidat/request-8 EST désormais transporté sur le rail
> canonique. Ne pas refaire ni dupliquer ce transport.
>
> AUTORISATION LIMITÉE
> 1. Déposer/consommer la décision canonique en réponse à request-8.md, closes=false.
> 2. Revalider que les artefacts du candidat minimal sont présents et cohérents
>    sur le rail a1ce903..., notamment les snapshots/diffs et la matrice 9/9.
> 3. Matérialiser, si le protocole le permet, une branche/PR candidate MINIMALE
>    basée sur le HEAD production réellement vérifié, contenant uniquement :
>    - correction ledger de nexus-fdj-moteur.js ;
>    - stabilisation des idempotency_key dans NEXUS-FDJ-v1.html et
>      NEXUS-FDJ-Manager-v1.html ;
>    en préservant strictement l'architecture RPC de PR #62.
> 4. Exécuter les gates CI/guardians et la qualification nexus-test disponible.
>    Si une recette navigateur nexus-test est techniquement disponible,
>    l'exécuter et documenter les preuves ; sinon classer explicitement la
>    limite, sans simulation.
> 5. Vérifier que le diff candidat vers production n'introduit aucun
>    fichier/hunk étranger, aucune ancienne écriture .insert() directe, aucune
>    migration Test-only et aucun artefact Handoff/gouvernance.
> 6. Publier la request suivante avec SHA base Production, SHA candidat/branche/PR
>    éventuelle, diff exhaustif, run IDs, résultats CI/guardians/recette, matrice
>    9/9 et verdict clair PRET ou NON_PRET POUR FUSION PRODUCTION.
> 7. STOP et attendre un nouvel arbitrage humain.
>
> INTERDICTIONS ABSOLUES DANS CE GESTE :
> - aucune fusion vers production ;
> - aucun déploiement Production ;
> - aucune migration Production ;
> - aucune écriture/réparation de données Production ;
> - aucun Point Zéro ;
> - aucun traitement de 20261004130000 / ANON5.
>
> Tout mouvement inattendu de production, conflit, contamination du diff ou
> nouvel échec CI => STOP et rapport canonique.

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` ;
2. Revalider les artefacts déjà présents du candidat minimal (diffs,
   snapshots, matrice 9/9) par exécution réelle, pas par confiance ;
3. Matérialiser, si l'outillage de ce canal le permet réellement, une
   branche/PR candidate minimale basée sur le HEAD `production` revalidé,
   limitée aux 3 fichiers déjà cités (ledger + idempotency_key), PR #62
   strictement préservée ;
4. Exécuter les gates déterministes (suite complète, Guardians, Handoff)
   et la qualification nexus-test/CI dans la limite réelle de ce canal,
   sans simulation d'une capacité absente ;
5. Vérifier l'absence de contamination du diff (fichier étranger,
   `.insert()` réintroduit, migration Test-only, artefact Handoff/gouvernance) ;
6. Publier une nouvelle request canonique avec le verdict de readiness
   (PRET ou NON_PRET POUR FUSION PRODUCTION) ;
7. STOP — aucun arbitrage de fusion n'est pris par ce geste.

## Ce qu'elle n'autorise pas

Aucune fusion Production, aucun déploiement Production, aucune migration
Production, aucune écriture/réparation de données Production, aucun Point
Zéro, aucun traitement de l'écart `20261004130000`/ANON5, aucun secret
créé/lu/exposé.
