---
protocol: nexus-handoff/2
kind: decision
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision — option 3 approuvée avec conditions ; traitement du rouge CI et transport canonique

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-1.md`.

Frédéric a donné le GO explicite (« Go request 1 ») le 05/10/2026, sur la base
du constat mesuré par `request-1.md` : rail `handoff-continuite-20260920` à
`3761220c5d17b2d30806de41b3b3f3b165ed690b`, Production à
`c259476fa51e46f3b30fdd93918f2f78b88aec04`, CI `37356858235` rouge sur la
garde d'immuabilité des migrations (Production porte 292 migrations, le rail
n'en porte pas 2, ajoutées hors rail par les PR #75/#76), candidat
`a70e7de3918724147ca6912ccd0c216a81fb20de` bloqué par ce rouge.

## Arbitrage — le principe de request-1 est approuvé avec conditions

1. `origin/production` est l'autorité du code applicatif réellement servi,
   des migrations applicatives et des tests applicatifs de référence.
2. `handoff-continuite-20260920` reste l'autorité du protocole/registre
   Handoff.
3. Un lot futur ne doit jamais transporter implicitement du code divergent
   depuis le rail vers Production : base Production explicite, merge-base
   mesuré, fichiers applicatifs divergents déclarés ; divergence non vide
   ⇒ reconstruction contre Production ou arbitrage nominatif.
4. Les migrations déjà présentes/appliquées en Production ne doivent PAS être
   supprimées, réécrites ni neutralisées pour rendre la CI verte.

## Traitement du rouge CI `37356858235`

La garde d'immuabilité (`test_migrations_immuables_20260905.js`) ne doit pas
être contournée. Elle confondait « absence sur le rail protocolaire » et
« disparition de Production » : sous l'ancien modèle, où chaque branche était
censée mirer l'intégralité de l'applicatif, une migration de Production
absente du système de fichiers local ne pouvait signifier qu'une suppression.
Ce n'est plus vrai pour un rail qui a sciemment cessé de prétendre à cette
autorité (condition 1 ci-dessus).

La correction attendue porte sur la garde ou sa référence de comparaison,
afin que l'immuabilité des migrations Production soit vérifiée contre
l'autorité Production appropriée — pas en recopiant du code applicatif ou
des migrations Production dans le rail pour satisfaire artificiellement le
test, et pas en supprimant ou neutralisant une migration déjà appliquée. Si
un manifeste/empreinte/registre de références Production doit vivre sur le
rail pour rendre cette preuve déterministe, seul cet artefact de gouvernance
peut être créé.

La CI complète doit être rejouée, et une preuve causale doit démontrer que
la garde corrigée échoue réellement quand une migration existante de
Production disparaît ou que son empreinte change — tout en ne traitant plus
l'absence d'une migration sur le rail protocolaire comme une suppression
Production.

## Transport canonique

Repartir de l'état canonique réel du rail et transporter, par le protocole
`handoff.js` exclusivement (décisions/demandes/consommation, jamais une
écriture à la main dans `lots/`) :

1. `decision-10.md` du lot `FDJ-CARNETS-LEDGER-AUDIT-1-20261004` et sa
   consommation ;
2. `GOUVERNANCE-REFERENCE-CODE-20261005/request-1.md` et sa décision (la
   présente).

Sans importer d'applicatif étranger depuis une branche Claude. `STATE.json`,
les miroirs et `verifier` doivent être revalidés après transport.

## Retour attendu

Publier la request suivante avec : le SHA du rail, le SHA de Production de
référence, les résultats CI et les identifiants de run, la définition exacte
des deux autorités telle qu'appliquée, et tout blocage restant. **STOP**
après cette qualification et cette publication — aucun autre geste.

## Interdictions

Aucune fusion Production, aucun déploiement Production, aucune
migration/écriture/réparation Production, aucune mutation Test, aucun
traitement des 20 migrations rail-only au-delà de ce qui est strictement
nécessaire à la gouvernance et explicitement non applicatif. Tout nouveau
rouge inexpliqué ou toute divergence inattendue impose un **STOP**.
