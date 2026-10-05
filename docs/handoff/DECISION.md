<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/decision-6.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 6
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
---
# decision-6 — GO FUSION FDJ vers Production, strictement limité à la fusion

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le lot reste ouvert : cette décision autorise une séquence de contrôles
pré-fusion suivie d'une fusion conditionnelle (« si et seulement si »), pas
un fait déjà accompli. Elle se referme sur l'arbitrage qui suivra le
rapport de `request-7.md` (fusion réalisée, ou STOP motivé).

Frédéric Bragance a rendu cet arbitrage dans l'issue #28 (05/10/2026). Verbatim :

> ARBITRAGE HUMAIN — GO FUSION FDJ VERS PRODUCTION
>
> Lot : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
> Réponse à : request-6.md
> Décision humaine explicite de Frédéric : « GO fusion FDJ vers Production ».
> Frédéric accepte la limite documentée de l'absence de preuve navigateur
> dédiée des 3 derniers chemins et prévoit les essais fonctionnels en
> conditions réelles après déploiement.
>
> État vérifié avant autorisation :
> - request-6.md est la demande active, ATTENTE_DECISION ;
> - rail handoff-continuite-20260920 = fc533fc726fcf972caba57c7e1e2eae0cb9afe95 ;
> - production = 30544c9af7ebf83d8ec1ba3882418252380036f1.
>
> AUTORISATION STRICTEMENT LIMITÉE
> 1. Déposer/consommer la décision canonique correspondant à ce GO en
>    réponse à request-6.md.
> 2. Préparer une promotion FDJ Carnets minimale vers production :
>    identifier exactement les commits/fichiers applicatifs du lot déjà
>    qualifiés, exclure les artefacts Test-only, Handoff-only, Point Zéro et
>    tout changement étranger.
> 3. Revalider le diff exact contre le HEAD Production
>    30544c9af7ebf83d8ec1ba3882418252380036f1 et les dépendances
>    nécessaires. Si Production a bougé ou si le diff contient un élément
>    non attribuable/ambigu, STOP sans fusion.
> 4. Exécuter les gates CI/guardians pré-fusion requises. Tout nouvel échec
>    ou divergence = STOP.
> 5. Si et seulement si le transport est propre et les gates requises sont
>    vertes, effectuer la FUSION du correctif FDJ Carnets vers la branche
>    production conformément au mécanisme normal du dépôt.
> 6. Après fusion, rapporter le SHA exact de production, PR/merge commit,
>    fichiers effectivement promus et état des workflows.
> 7. STOP IMMÉDIATEMENT APRÈS LA FUSION. Ne pas déployer, ne pas appliquer
>    de migration, ne pas exécuter de Point Zéro, ne pas faire
>    d'écriture/réparation de données Production.
>
> EXCLUSIONS
> - migrations Test-only 20261004200000 / 20261004200100 ;
> - Point Zéro Inventaire FDJ ;
> - écart 20261004130000 / lot SECURITE-ANON5 ;
> - toute migration ou réparation Production ;
> - toute gate/déploiement Pages Production.
>
> Ce GO autorise uniquement la fusion du correctif FDJ Carnets vers la
> branche production, sous réserve des contrôles pré-fusion ci-dessus. Il
> N'AUTORISE PAS le déploiement Production ni les migrations Production.

## Ce que la décision autorise (et uniquement cela)

1. Déposer/consommer cette décision canonique via `outils/handoff.js`,
   `closes: false` — le GO accepte explicitement la limite documentée en
   `request-6.md` (preuve navigateur des 3 chemins non réalisée) et ouvre
   le cycle de fusion conditionnelle ;
2. Identifier exactement les commits/fichiers applicatifs déjà qualifiés
   (`7e41b3b`, `b445860`), à l'exclusion des artefacts Handoff-only
   (`docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/*`) et de la
   spécification Point Zéro, jamais exécutée ;
3. Revalider le diff exact contre `production=30544c9…` avant toute
   fusion ; STOP sans fusion si Production a bougé ou si un élément du diff
   n'est pas attribuable sans ambiguïté au lot FDJ ;
4. Exécuter les gates CI/Guardians pré-fusion ;
5. Fusionner uniquement si 3 et 4 sont propres, par le mécanisme normal du
   dépôt.

## Constat consigné au moment de la consommation de cette décision

Le diff brut `production..rail` sur les fichiers partagés par le lot FDJ
(`NEXUS-FDJ-Manager-v1.html`, `NEXUS-FDJ-v1.html`,
`test_site_explicite_detecteur_20260905.js`,
`test_fdj_fiabilisation_etape5_idempotence.js`) est substantiellement plus
large que les deux commits applicatifs du lot (d'autres lots non qualifiés
ont modifié ces mêmes fichiers sur le rail depuis). Une fusion fichier
entier importerait du code étranger non qualifié — exactement ce que le
point 3 du GO interdit. La session qui consomme cette décision doit
vérifier, hunk par hunk, qu'un cherry-pick isolé de `7e41b3b`/`b445860`
s'applique sans ambiguïté sur `production`, et appliquer le STOP du point 3
si ce n'est pas le cas ou si elle ne peut pas le vérifier.

## Ce qu'elle n'autorise pas

Aucun déploiement Production, aucune migration Production, aucune
écriture/réparation de données Production, aucun Point Zéro réel, aucun
traitement de l'écart `20261004130000`, aucune gate/déploiement Pages
Production. Ce GO autorise la fusion du correctif FDJ Carnets vers
`production` — rien de plus.
