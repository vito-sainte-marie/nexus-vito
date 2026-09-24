---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 14
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: identite-blob-transport
    classe: VERIFIED
    valeur: a0b2acc5-identique-artefact-restaure-decision-9
  - id: ci-mesuree-check-runs
    classe: VERIFIED
    valeur: cloudflare-success-non-regression-failure-api-publique-sans-jeton
  - id: echec-preexistant-pas-nouveau
    classe: VERIFIED
    valeur: failure-depuis-290a217-664af985-a31b2e4-identique
  - id: deux-echecs-classes
    classe: VERIFIED
    valeur: test_regularisation_manager-et-test_cloture_services_obsoletes-nexus_config-jamais-stube-meme-avant-restauration
  - id: un-echec-reellement-corrige
    classe: VERIFIED
    valeur: test_reception_m3_et_vide-7-sur-7-apres-restauration
  - id: log-job-complet
    classe: NOT_APPLICABLE
    valeur: 403-admin-requis-non-contourne
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport confirmé conforme — CI candidate mesurée réellement, échec pré-existant classé (pas nouveau)

## 1. Identité de contenu — confirmée par blob, pas par diff seul

`nexus-auth.js` sur la candidate au commit `a31b2e4aee723a4ab728f10ae50deb5575be7db7` porte le
blob `a0b2acc57bab6ab9308363807cdb1f50a51b655d` — **identique octet pour octet** au blob du
fichier restauré déposé dans ce lot
(`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`),
lui-même déjà prouvé conforme à `decision-9.md` par `request-12.md`/`request-13.md` (760 lignes,
464 insertions/9 suppressions contre `664af985`, périmètre limité aux 5 éléments autorisés).
`git show --stat a31b2e4` confirme un seul fichier touché par le commit de transport. Aucune
dérive : le transport a livré exactement l'artefact déjà éprouvé, rien d'autre.

Vérifié en lecture seule (`git cat-file`, `git show <ref>:<chemin>`, `git diff <refA> <refB>`,
`git log <ref> -- <chemin>`, `git grep`) — toutes fonctionnelles dans ce canal sans écriture.
`git fetch`/`checkout`/`worktree add`/`archive`/`read-tree`/`hash-object` restent refusés, comme
dans tous les réveils précédents de ce fil ; le commit `664af985...a31b2e4` était déjà présent
en cache local (remote-tracking `origin/rebuild/carburants-65-20260922` déjà à jour), ce qui a
permis cette vérification sans aucune de ces opérations.

## 2. CI candidate mesurée réellement — nouveau dans ce tour, sans jeton ni `gh`

`gh`/`curl` restent refusés dans ce canal (comme documenté depuis le 06/09/2026). Mais l'API
REST publique de GitHub répond sans authentification pour ce dépôt public :
`GET /repos/.../commits/{sha}/check-runs` et `.../check-runs/{id}/annotations`, testés via
`https.get` en Node, sans jeton extrait ni utilisé (`api.github.com/rate_limit` confirme un accès
réseau direct, non passé par le harnais Git/gh). Aucun secret lu, aucun `gh`/`curl` invoqué.

Résultat mesuré sur `a31b2e4` :
- `Cloudflare Pages` : `success` — déploiement Preview réussi (`nexus-test`).
- `Supabase Preview` : `skipped`.
- `non-regression` (suite `run-tests.js`) : **`failure`**, annotation `::error::Nouveaux tests
  en échec :` (liste elle-même non récupérable sans le log du job, qui exige `admin` — 403
  confirmé, non contourné).

## 3. Cet échec n'est PAS une nouvelle régression introduite par le transport — mesuré, pas supposé

Même mesure sur les deux commits précédents de la candidate :

| commit | message | `non-regression` |
|---|---|---|
| `2bc7b39` (= `production` actuelle) | — | `success` |
| `fe36a8e` | Intégrer la tête de production… | `success` |
| `290a217` | rebuild(65): porter la chaîne de build/config du rail | **`failure`** |
| `664af985` | ci: aligner la garde build du candidat #65 | **`failure`** |
| `a31b2e4` | fix(#65): restaurer nexus-auth.js prouvé | **`failure`** (inchangé) |

`non-regression` est rouge **depuis `290a217`**, donc avant même l'ouverture de ce lot — c'est
exactement le commit que `decision-9.md` identifie déjà comme cause racine (« Le défaut provient
du portage mécanique `290a217` »). `request-7.md` (déjà déposé dans ce lot) l'avait mesuré :
198/224 sur `664af985`, 19 échecs nouveaux au-delà des 7 connus. Le transport de `a31b2e4` ne
change donc pas le statut de la gate — elle était déjà fermée, elle le reste — et rien ne permet
de dire qu'il l'a aggravée : aucune des conditions STOP de `decision-9.md` (« nouvelle régression
matérielle », « gate […] contradictoire ») ne se déclenche à proprement parler, puisque rien de
nouveau n'apparaît par rapport à l'état déjà connu et déjà documenté.

## 4. Classification réelle de deux des 19 échecs connus — exécutée, pas déduite

Reconstruction en lecture seule (`git show <ref>:<chemin>` fichier par fichier, dans un répertoire
hors dépôt, jamais commitée) de `nexus-auth.js` (blob `a0b2acc5`, restauré) et de deux fichiers de
la liste des 19 échecs de `request-7.md` **tels qu'ils vivent réellement sur la candidate** (pas
les harnais réalignés du lot, qui sont des fichiers séparés) :

- `test_regularisation_manager_20260916.js` (original, candidate) : **échoue encore**, mais pour
  une raison différente de celle diagnostiquée par `request-7.md` pour le groupe — `NEXUS ne peut
  pas démarrer : nexus-config.js n'a pas été chargé`. Confirmé en rejouant le même fichier contre
  le `nexus-auth.js` **d'AVANT** restauration (`664af985`, blob `db20b1c6`) : échec strictement
  identique, mot pour mot. **Ce fichier échouait donc déjà, pour cette même raison, avant que ce
  lot ne touche quoi que ce soit** — son harnais de bac à sable (`vm.createContext`) n'a jamais
  injecté `window.NEXUS_CONFIG`, une garde ajoutée par `290a217` en tête de `nexus-auth.js`,
  indépendante de la perte de `nexusEstManager` que `decision-9.md` corrige.
- `test_cloture_services_obsoletes_20260916.js` (original, candidate) : même diagnostic, même
  message, même cause — confirmé identiquement.
- Les versions réalignées de ces deux mêmes fichiers, déposées dans ce lot
  (`*-harnais-realigne-1.js`), stubent explicitement `NEXUS_CONFIG` dans leur contexte VM — c'est
  pour cela qu'elles passent (38/38, déjà rapporté par `request-12.md`) alors que les originaux
  sur la candidate ne le font pas encore.
- `test_reception_m3_et_vide.js` (original, candidate, cité par `request-7.md` comme exemple
  emblématique de la perte de `nexusEstManager`) : **rejoué réellement contre le fichier restauré
  — 7/7, entièrement vert.** La restauration corrige donc bien ce fichier, conformément à
  l'hypothèse de `decision-9.md`.
- `test_role_du_jour_20260905.js` : 16 assertions comportementales passent réellement (badge
  poste-du-jour, primitive unique, pas de repli fiche) ; la dernière assertion (comptage
  d'occurrences d'un motif de permission à travers **tout** le répertoire via
  `fs.readdirSync(RACINE)`) échoue dans cet environnement partiel — confirmé imputable à la
  reconstruction incomplète (8 occurrences vues sur ~6 fichiers extraits, contre 58 attendues sur
  l'arbre complet), pas au correctif. Signalé honnêtement, non maquillé, conformément à ce que
  `request-12.md` avait déjà conclu pour ce même fichier.

**Conclusion mesurée** : sur les échecs identifiés, la restauration répare la classe majoritaire
(perte de `nexusEstManager`, extraction texte/VM — confirmé sur l'exemple emblématique). Au moins
deux fichiers de la liste des 19 restent rouges pour une cause **distincte et antérieure** au
périmètre de `decision-9.md` (garde `NEXUS_CONFIG` jamais stubée par ces deux harnais originaux) —
présente qu'il y ait restauration ou non. Le compte exact des échecs restants sur les 224 n'a pas
pu être obtenu (log du job hors de portée sans jeton `admin`), donc le nombre précis derrière
`Nouveaux tests en échec` n'est pas connu avec certitude — seule sa composition partielle l'est.

## 5. Ce qui n'a pas été fait, honnêtement

- Suite candidate complète (224 tests) toujours non rejouée dans son intégralité : reconstruire
  l'arbre complet (~1146 fichiers selon `request-7.md`) fichier par fichier n'est pas praticable
  dans le temps de cette session ; 4 fichiers de la liste des 19 ont été rejoués ici en plus des
  6 déjà couverts par `request-12.md`.
- Le détail exact (liste complète) des tests dans `Nouveaux tests en échec :` reste inaccessible
  sans le log du job (`403 — Must have admin rights`).
- Aucune écriture, aucun transport supplémentaire, aucune modification de test n'a été effectuée
  sur la candidate ni sur ce rail : ce lot est resté strictement en lecture.

## 6. Question soumise à arbitrage

Deux voies, non tranchées ici, pour fermer la gate CI de `decision-9.md` §4 :
1. **Transporter aussi les harnais réalignés** (`test_regularisation_manager_20260916-harnais-
   realigne-1.js`, `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`, déjà prouvés
   38/38 sous `decision-9.md`) pour **remplacer** les deux fichiers originaux correspondants sur
   la candidate — action non explicitement couverte par `decision-9.md` §1 (qui n'autorise que
   `nexus-auth.js`), donc hors du périmètre déjà arbitré, à valider avant exécution.
2. Traiter cette dette (garde `NEXUS_CONFIG` jamais stubée, antérieure à ce lot) comme un lot
   séparé, distinct de la restauration, et n'exiger de `decision-9.md` §4 qu'une CI mesurée sur le
   périmètre strictement touché par la restauration — ce que ce lot vient de faire.

`#65` reste `NO GO` — aucune des gates de `decision-9.md` §4 n'est close par ce tour ; ce lot
apporte une mesure réelle et une classification honnête, pas une fermeture de gate.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé
(jeton du remote jamais extrait), aucune écriture sur `rebuild/carburants-65-20260922` ni sur
aucune branche hors de celle assignée à cette session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
