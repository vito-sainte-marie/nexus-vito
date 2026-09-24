---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 18
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0-production=2bc7b39-inchanges
  - id: decision-11-consommee
    classe: VERIFIED
    valeur: outils-handoff-js-consommer-commit-3bdf309
  - id: script-reconstruire-baseline-candidat-inexistant
    classe: VERIFIED
    valeur: ls-grep-exhaustifs-0-resultat
  - id: mecanisme-provisionnement-supabase-absent
    classe: VERIFIED
    valeur: grep-exhaustif-workflows-outils-0-resultat
  - id: secrets-absents
    classe: VERIFIED
    valeur: test-presence-uniquement-jamais-lus
  - id: docker-refuse
    classe: VERIFIED
    valeur: approbation-indisponible-run-automatise
  - id: push-impossible-ce-canal
    classe: VERIFIED
    valeur: git-push-dry-run-refuse
  - id: candidate-a-bouge
    classe: VERIFIED
    valeur: 1ba8b88-vers-20af9f6-nouveau-workflow-recette-candidat-65
  - id: baseline-image-supabase-postgres-requise
    classe: VERIFIED
    valeur: aucun-create-schema-dans-la-migration-baseline
  - id: baseline-supabase-jetable
    classe: NOT_APPLICABLE
    valeur: autorite-execution-gouvernance-voir-corps
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `decision-11.md` consommée — baseline Supabase jetable hors de portée de ce canal (`AUTORITE_EXECUTION` + `GOUVERNANCE`)

## 1. Décision consommée

`decision-11.md` (GO Créateur, baseline Supabase jetable isolée pour juger `#65`) déposée via
`outils/handoff.js decision` puis consommée via `outils/handoff.js consommer
NEXUS-CONTINUITE-TERRAIN-2-20260922` (commit `3bdf309`). Registre conforme avant/après (32 lots,
mêmes 15 avertissements préexistants, 0 nouvelle erreur). Miroirs régénérés.

## 2. Fait nouveau observé avant toute conclusion — la candidate a bougé depuis `request-17.md`

`origin/rebuild/carburants-65-20260922` n'est plus au tip mesuré ce matin (`1ba8b88`) : un nouveau
commit `20af9f6` (« ci(#65): prouver preview Test et recette authentifiée », auteur
`vito-sainte-marie`, `2026-09-24T17:16:20-04:00` — juste avant ce réveil) ajoute
`.github/workflows/recette-candidat-65.yml`. Lu intégralement (`git show`, lecture seule) :

- il attend que la preview Cloudflare (`rebuild-carburants-65-202609.nexus-test-ddf.pages.dev`)
  serve exactement le SHA poussé ;
- il lit `nexus-config.js` réellement servi et **refuse fail-closed** si l'environnement annoncé
  n'est pas `test`, si le projet Supabase n'est pas exactement `udljdqxerrbbbajxubfn` (Test), ou si
  la référence Production (`uzhjpqpctpvxytxpxoqz`) apparaît ;
- il enchaîne ensuite la recette navigateur authentifiée (`outils/recette-navigateur-test.js`) avec
  les quatre secrets Test déjà provisionnés (`NEXUS_TEST_MANAGER_PIN`/`NEXUS_TEST_CREATEUR_PIN`/
  `NEXUS_TEST_EMPLOYEE_A_PIN`), en réutilisant `nexus-test` — **pas** une ressource Supabase
  nouvelle.
- `git log fe36a8e..1ba8b88` confirme que le portage des 7 fichiers de build/config
  (`preuve-cloudflare-humaine-65-portage-1.md` §3/§6, déjà déposé par une session antérieure) a
  bien été exécuté (`290a217`), suivi de deux correctifs (`664af98`, `a31b2e4`) et du réalignement
  de harnais déjà arbitré par `decision-9.md` (`1ba8b88`).

**Conséquence** : la gate « isolation Supabase Test du candidat » semble matériellement avancée
par un geste humain distinct de ce réveil — mais son résultat CI n'est **pas vérifiable depuis ce
canal** (`gh run list`/`gh api` refusés, voir §4). Je ne le déclare donc ni `VERIFIED`, ni acquis :
c'est une observation Git, pas une preuve d'exécution.

## 3. Ce que ce réveil demande précisément, et ce qui en reste ouvert

`decision-11.md` cible l'« objectif immédiat » de `classement-gates-etat-git-62-65-1.md` §2/§3 :
**la preuve de création réelle de la migration `#65`** (rejouer les 276 migrations `production`,
puis la seule 277e, sur un schéma qui n'a jamais dérivé) — la seule gate qui nomme explicitement
un besoin d'« environnement Supabase Test jetable ». Ce n'est pas la même gate que celle visée par
`20af9f6` (isolation/preview), qui reste distincte et déjà en cours de traitement ailleurs.

## 4. Recherche exhaustive de la « voie autorisée disponible » — confirmée absente, pas supposée

- `outils/reconstruire-baseline-candidat.sh` cité par le réveil : **n'existe pas** dans ce dépôt
  (`ls outils/*.sh`, aucune correspondance ; recherche du nom dans tous les `.md`/`.js`/`.sh` du
  lot, du protocole et du canon : 0 résultat).
- Aucun mécanisme de provisionnement Supabase (jeton d'API de gestion, `SUPABASE_ACCESS_TOKEN`,
  appel `api.supabase.com`) n'existe nulle part dans `.github/workflows/` ni `outils/` (recherche
  `grep` exhaustive, 0 résultat).
- Variables/secrets vérifiés **par test de présence uniquement**, jamais lus : `NEXUS_TEST_DB_URL`,
  `NEXUS_TEST_DB_URL_WRITE`, `SUPABASE_TEST_DB_URL_WRITE`, `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF` — tous **absents** de l'environnement de
  cette session.
- `docker --version` (le binaire existe sur ce runner, `/usr/bin/docker`) refuse : « nécessite une
  approbation qu'aucun humain ne peut donner dans ce run automatisé » — même obstacle structurel
  que `git push`/`gh api` documenté dans ce fil depuis le 06/09/2026, confirmé ici pour la première
  fois sur `docker`.
- `git push ... --dry-run` vers `handoff-continuite-20260920` : refusé pour la même raison. Seule
  l'écriture sur `claude/issue-28-20260924-2209` (ce lot de travail) reste disponible.

**Aucune tentative de contournement** (pas d'appel réseau direct, pas de fabrication de valeur
Supabase, pas d'écriture hors du répertoire autorisé).

## 5. Classification

`AUTORITE_EXECUTION` — ce canal ne peut ni créer, ni atteindre, ni faire tourner quoi que ce soit
qui ressemble à un Supabase jetable (aucun jeton, aucun réseau, aucun `docker`, aucun droit
d'écriture partagé), combiné à `GOUVERNANCE` — le script/mécanisme nommé par le GO n'a jamais été
construit : aucune session précédente ne l'a matérialisé, et rien dans le canon ne le décrit.

## 6. Geste minimal requis — pas un nouveau mécanisme inventé, un chemin déjà standard Supabase

Recommandation fondée sur un fait vérifié, pas une hypothèse : la migration baseline
(`20260101000000_baseline_pre_existing_schema.sql`) ne contient **aucun** `create schema` — elle
suppose déjà présents `auth`/`storage`/`extensions`, exactement ce que fournit l'image Docker
officielle `supabase/postgres` (utilisée par `supabase start` et par les CI Supabase elles-mêmes),
**pas** un `postgres:` vanilla. Ceci ferme une question que ce réveil laissait ouverte (« quelle
ressource jetable ») avec un fait, pas une préférence.

Le geste le plus petit et le moins risqué n'est donc probablement **pas** de créer un projet
Supabase hébergé (ressource externe payante, nouveau jeton de gestion — `STOP` obligatoire au sens
de `docs/canon/NEXUS-AGENT-MISSION.md` §5) mais d'ajouter, dans un job CI `workflow_dispatch`
borné à `handoff-continuite-20260920`, un service container `supabase/postgres` **entièrement
interne au runner** : aucun secret nouveau, aucune ressource externe, aucun coût, jetable par
construction (détruit à la fin du job). Ce job rejouerait les migrations jusqu'à l'ancêtre commun
avec `production` (`2bc7b39`), puis appliquerait exclusivement la migration candidate `#65`, et
comparerait les objets créés avant/après.

Je n'ai pas écrit ce script maintenant : je ne peux pas l'éprouver depuis ce canal (`docker`
refusé), et livrer un mécanisme non testé serait fabriquer une preuve — exactement ce que le
protocole interdit. Le geste requiert une session avec droit d'édition sur
`.github/workflows/*.yml`, que ce canal n'a pas.

## Ce que cette session ne fait pas

Ne crée, ne configure ni ne tente de créer aucune ressource Supabase. Ne lance aucun conteneur. Ne
pousse rien vers `handoff-continuite-20260920` ni vers `rebuild/carburants-65-20260922`. Ne lit,
ne demande ni n'expose aucun secret. Ne déclare aucune gate `#65` close. `#65` reste `NO GO`.

## Interdits respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucune nouvelle règle métier/UX/rôle/RLS/sécurité, aucune baisse de
gate, aucun affaiblissement des échecs `CONNUS`. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste canonique.
