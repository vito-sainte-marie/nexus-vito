---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-8.md
---
# Décision — arbitrage des éléments techniques déterministes de `request-8.md`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-8.md`.

## Motif

`request-8.md` exécute correctement `decision-6.md` sur ses trois premiers points (réconciliation de
`request-7.md`, matérialisation de `decision-6.md`, correctif isolé à un seul hunk) et applique de
bonne foi la condition d'arrêt de `decision-6.md` (« retour par nouveau `request-N.md` [...] si [...]
un risque matériel subsiste après la préparation du correctif ») sur les deux points restants, plutôt
que de déclarer un succès non acquis. Les deux points relèvent de registres différents : l'un est
une maintenance de harnais de test déterministe, l'autre reste une question de fait non observable
depuis ce canal. Ils sont donc tranchés séparément ci-dessous — aucun des deux n'introduit de
nouvelle règle métier, d'accès, de rôle ou de RLS.

## Point 1 — les deux adaptations de harnais `NEXUS_CONFIG` : approuvées comme maintenance de test

`test_cloture_services_obsoletes_20260916.js` et `test_regularisation_manager_20260916.js` chargent
`nexus-auth.js` en entier via `vm.runInContext` avec un `ctx.window` antérieur à l'existence de la
précondition fail-closed `NEXUS_CFG` (introduite par le correctif de `decision-6.md`, elle-même
copiée du rail : `window.NEXUS_CONFIG` doit porter `supabaseUrl`, `supabaseCle` et `environnement`,
tous trois véridiques, sinon `throw new Error(...)`).

Le patch proposé au §4 de `preuve-diff-nexus-auth-corrige-65-20260923.md` ajoute exactement :
```js
NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.supabase.co', supabaseCle: 'anon-test' }
```
Vérifié : les trois champs exigés par la garde sont présents et véridiques, aucun champ n'est vide
ni falsifié pour contourner le `if (!NEXUS_CFG || !NEXUS_CFG.supabaseUrl || ...)`, et la garde
elle-même n'est ni retirée ni monkey-patchée — le harnais apprend la précondition, il ne la
désarme pas. C'est le même principe que celui déjà appliqué par `test_securite_lot_isolation_20260904.js`
sur le rail, cité comme précédent dans `request-8.md`. **Approuvé comme maintenance de test pure**,
au sens strict posé par le réveil : aucune règle d'autorisation nouvelle, aucun champ non exigé par
la garde, aucune valeur destinée à masquer un échec plutôt qu'à satisfaire la précondition.

Condition : le patch déposé doit être *identique* à celui cité (mêmes trois champs, valeurs de
portée Test uniquement — jamais une URL/clé réelle) ; toute divergence n'est plus couverte par cette
décision et doit revenir par un nouveau `request-N.md`.

## Point 2 — normalisation pathname/Cloudflare : NON tranché, gate factuelle conservée

**Aucune décision n'est rendue sur ce point.** `request-8.md` signale, sans la résoudre, une question
de fait : est-ce que le déploiement Cloudflare Pages de la candidate #65 retire l'extension `.html`
des URL, comme celui qui avait déjà causé une boucle de redirection le 04/09/2026 avant l'existence
de `NexusPage` ? Cette information n'est observable que depuis le tableau de bord Cloudflare Pages de
la candidate — ce canal ne peut ni l'observer ni la supposer, dans un sens comme dans l'autre.

Le correctif local proposé (normaliser `.html` des deux côtés de la comparaison dans
`nexusCategorieAcces`) **n'est pas autorisé par cette décision**, même à titre préventif : c'est une
modification de la logique d'accès, et `decision-6.md` limite déjà le transport « aux éléments
réellement nécessaires à la chaîne build/config » — l'étendre à une correction défensive du code
d'accès, sans preuve qu'elle est nécessaire, romprait cette limite et transformerait une question de
configuration en règle d'accès nouvelle, ce que ce lot interdit explicitement.

Ce point reste donc une **gate factuelle ouverte**, à lever par observation (quiconque a accès au
tableau de bord Cloudflare Pages de la candidate, ou par une preuve de comportement réel après
déploiement), pas par arbitrage. Le lot reste ouvert (`closes: false`) tant que ce point n'est pas
levé.

## Périmètre autorisé par cette décision

1. Déposer, dans le même commit que le correctif source déjà préparé, les deux patchs de harnais de
   test identifiés au §4 de `preuve-diff-nexus-auth-corrige-65-20260923.md` — texte exact, aucune
   variante.
2. Rejouer `node run-tests.js` sur l'arbre candidate ainsi corrigé et rapporter le résultat exact
   (retour à 217/224 attendu, avec la liste `CONNUS` inchangée).
3. Reprendre ensuite, seulement si (2) est vert, l'item 5 déjà posé par `decision-3.md`/`decision-4.md`/
   `decision-6.md` (preuve d'identité de preview / `nexus-config.js` réellement servi, Supabase Test).

Ce périmètre reste soumis à la même limite de transport que `decision-5.md`/`decision-6.md` : écriture
sur `rebuild/carburants-65-20260922` et sur `.github/workflows/*.yml` hors de portée de cet agent
dans ce canal, quelle que soit la branche. Aucune sollicitation de Frédéric n'est due pour ce seul
blocage de transport (déjà arbitré par `decision-4.md`).

## Conditions d'arrêt (STOP), inchangées et complétées

Retour par nouveau `request-N.md` canonique — pas d'exécution silencieuse au-delà — si : le patch de
harnais déposé diverge de celui cité au point 1 ; la suite candidate rejouée ne revient pas
exactement à 217/224 avec les 7 `CONNUS` inchangés ; ou la question Cloudflare du point 2 devient
observable et révèle un risque réel sur `NEXUS-Pointage-v1.html`/`NEXUS-Prise-De-Poste-v1.html`.

## Interdits absolus

Aucun changement `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot. La candidate n'est toujours
pas déclarée prête.
