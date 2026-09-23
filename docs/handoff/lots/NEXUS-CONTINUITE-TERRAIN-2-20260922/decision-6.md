---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 6
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-7.md
---
# Décision — arbitrage de la question ouverte au §6 de `request-7.md`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-7.md`.

## Motif

Le diagnostic de `request-7.md` est retenu tel quel : 19 échecs nouveaux, tous imputables au seul
commit `290a217f` (portage mécanique de 7 fichiers de la chaîne build/config), la liste `CONNUS`
(7 échecs) restant intacte et non touchée. Ce n'est pas de la dette mécanique : `nexus-auth.js`
porte deux lignées de développement divergentes depuis un fork ancien — le refactor build/config du
rail (`NEXUS_CFG` fail closed, `NexusPage`/`NexusBuild`) d'un côté, les fonctions métier de la
candidate (`nexusEstManager`, `nexusFuseauValide`, bloc `NEXUS-FUSEAU-METIER`, développées entre le
16 et le 20/09 pour la continuité terrain) de l'autre. Le portage du 22/09 a traité le fichier comme
un simple maillon de chaîne build/config et l'a remplacé en bloc, effaçant la seconde lignée — dont
aucune autre copie n'existe sur le rail (confirmé : zéro occurrence de `nexusEstManager` et
`nexusFuseauValide` sur `handoff-continuite-20260920`).

## Arbitrage de la question posée

**Aucune nouvelle règle métier n'est nécessaire pour trancher ce point.** La règle d'architecture
progressive et la priorité de continuité terrain, déjà établies pour ce lot, suffisent : elles
interdisent d'écraser un comportement applicatif éprouvé pour homogénéiser une chaîne de build. Le
choix n'est donc pas entre deux politiques métier concurrentes — c'est une correction de portage :
le portage du 22/09 a transporté plus que ce que son propre message annonçait (« mécanique »).

## Correctif autorisé

Préparer, en préparation/Test uniquement, la correction minimale de la candidate #65 :
1. conserver le `nexus-auth.js` fonctionnel de la lignée `fe36a8e` (fonctions métier de continuité
   terrain intactes) comme base ;
2. ne transporter depuis le rail, dans `nexus-auth.js`, que les éléments réellement nécessaires à
   la chaîne build/config (garde `NEXUS_CFG`, `NexusPage`/`NexusBuild`) — jamais un remplacement en
   bloc du fichier ;
3. pour les 6 autres fichiers du portage (`_headers`, `nexus-bandeau-environnement.js`,
   `nexus-page.js`, `outils/build.sh`, `outils/generer-config.js`, `outils/poser-build-id.js`),
   aucun changement de portée par cette décision : rien dans `request-7.md` n'indique qu'ils
   portent une régression fonctionnelle.

## Preuves exigées avant toute suite

1. Preuve par diff que les fonctions/contrôles d'accès, le fuseau métier, le pointage et l'accès
   hors service ne régressent pas après la fusion.
2. Suite candidate rejouée : retour à **217/224**, exactement les 7 échecs `CONNUS`, sans aucune
   modification de la liste `CONNUS` pour masquer un rouge.
3. Seulement après CI verte sur ces deux points : reprise de la preuve séparée d'identité de
   preview et du `nexus-config.js` réellement servi, ciblant exclusivement Supabase Test — condition
   cumulative déjà posée par `decision-3.md`/`decision-4.md`, inchangée par cette décision.

## Transport — même limite technique que `decision-5.md`

Écriture directe sur `rebuild/carburants-65-20260922` et sur `.github/workflows/*.yml` restent hors
de portée de cet agent dans ce canal, quelle que soit la branche. Cette décision autorise le contenu
du correctif, pas un moyen de le transporter que ce canal n'a pas. Conformément à `decision-4.md`,
aucune sollicitation de Frédéric n'est due pour ce seul blocage de transport.

## Conditions d'arrêt (STOP)

Retour par nouveau `request-N.md` canonique — pas d'exécution silencieuse au-delà — si : la
conservation de `nexus-auth.js` de la lignée `fe36a8e` crée une incompatibilité réelle avec
`build.sh`/`generer-config.js` ; une règle d'autorisation doit être modifiée pour que la fusion
fonctionne ; ou un risque matériel subsiste après la préparation du correctif.

## Interdits absolus

Aucun changement `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot. La candidate n'est
toujours pas déclarée prête.
