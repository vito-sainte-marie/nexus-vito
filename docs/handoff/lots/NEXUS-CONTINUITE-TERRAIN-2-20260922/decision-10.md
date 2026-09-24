---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 10
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-14.md
---
# Décision — Phase 0 : transport des harnais autorisé, frontière d'autorité documentée une seule fois

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Réponse au programme de stabilisation transmis par le Créateur (issue #28, commentaire du
24/09/2026) pour sa **Phase 0 — terminer #65 proprement**, et à la question posée par
`request-14.md` §6.

## 1. Question `request-14.md` §6 tranchée : voie 1, transport autorisé — sans réouvrir `decision-9.md`

Le Créateur autorise le transport des deux harnais réalignés
(`test_regularisation_manager_20260916-harnais-realigne-1.js`,
`test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`, déjà prouvés 38/38 sous
`decision-9.md`, déjà présents sur ce rail) pour **remplacer** les deux fichiers originaux
correspondants sur la candidate `rebuild/carburants-65-20260922`. Ce remplacement est un
correctif réel de harnais (stub `NEXUS_CONFIG` manquant, garde ajoutée par `290a217`,
indépendante de la perte de `nexusEstManager`) — pas une gate rendue artificiellement verte.

`decision-9.md` n'est pas rouverte : son périmètre applicatif (`nexus-auth.js`, 5 éléments)
reste exactement celui déjà arbitré et déjà transporté (`a31b2e4`). La dette identifiée par
`request-14.md` §4 (garde `NEXUS_CONFIG` jamais stubée par les harnais originaux, antérieure à
ce lot) reste qualifiée dette historique indépendante et isolée — le transport des harnais la
répare à sa source (le test), il ne l'escamote pas en modifiant l'application.

## 2. Frontière d'autorité Git — documentée une seule fois, pas re-testée à chaque réveil

Ce canal (`issue_comment` → `claude/issue-28-*`) n'a et n'a jamais eu, depuis le 06/09/2026,
la capacité d'écrire sur une branche autre que la sienne. `request-4.md` et `request-13.md` de
ce même lot ont déjà testé et documenté, séparément, six formes distinctes d'écriture refusées
(`fetch`, `ls-remote`, `worktree add`, `checkout -b … origin/…`, `push --dry-run`,
`hash-object`), plus le choix délibéré de ne pas contourner via l'API REST Contents avec le
jeton d'installation déjà présent dans l'URL du remote. Cette session **n'a pas retesté** ces
méthodes — conformément à l'instruction explicite du Créateur de ne plus retenter depuis ce
canal des méthodes déjà prouvées impossibles.

Cette frontière est consolidée dans
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/frontiere-autorite-transport-1.md`,
déposé dans ce même tour : elle synthétise les preuves déjà produites (ne les refait pas) et
sert de référence unique pour tout réveil futur de ce lot, afin qu'aucune nouvelle boucle
request/repair identique ne soit nécessaire pour re-établir ce même constat.

## 3. Transport lui-même — hors de ce canal, à l'Orchestrator/connecteur GitHub

Les deux artefacts à transporter sont déjà prêts sur le rail canonique, à l'emplacement
suivant :
- `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js`
- `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`

À appliquer, par une autorité Git capable d'écrire `rebuild/carburants-65-20260922`, en
remplacement exact de :
- `test_regularisation_manager_20260916.js`
- `test_cloture_services_obsoletes_20260916.js`

Aucun autre fichier de la candidate n'est concerné par ce geste.

## 4. Gates #65 inchangées

`#65` reste `NO GO`. Après le transport des harnais (hors de ce canal), les preuves encore
dues restent : delta propre du transport (vérifié par blob, comme déjà fait pour
`nexus-auth.js`), CI candidate mesurée sur le nouveau commit, `nexus-config.js` réellement
servi ciblant exclusivement Supabase Test, puis recette navigateur. STOP avant Production —
GO Créateur requis, invariant inchangé.

## 5. Phase 1 non engagée

Conformément au programme du Créateur (« Après verdict #65, ouvrir un lot infrastructure
dédié »), la Phase 1 (baseline reproductible) n'est pas engagée dans ce tour : le verdict #65
n'est pas encore rendu.

## Interdits

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé,
aucune écriture sur `rebuild/carburants-65-20260922` ni sur aucune branche hors de celle
assignée à cette session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail
canonique.
