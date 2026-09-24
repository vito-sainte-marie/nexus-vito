---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 15
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: transport-diff-scope
    classe: VERIFIED
    valeur: exactement-2-fichiers-test_regularisation_manager-et-test_cloture_services_obsoletes-rien-dautre
  - id: blobs-identiques
    classe: VERIFIED
    valeur: 81ed59e4cca129e85776f3a2887420d5ef38875d-et-6fa892184879ee0d7319ab8713fab36f5922f0fd-conformes
  - id: harnais-executes-reels
    classe: VERIFIED
    valeur: 24-sur-24-plus-14-sur-14-38-sur-38-arbre-candidate-reel-61-ecrans-html-inclus
  - id: suite-complete-candidate
    classe: NOT_APPLICABLE
    valeur: 224-fichiers-test-recenses-reconstruction-hors-de-portee-du-canal-meme-obstacle-que-request-14
  - id: ci-mesuree-1ba8b88
    classe: VERIFIED
    valeur: cloudflare-success-supabase-skipped-non-regression-failure-annotations-identiques-au-parent-a31b2e4
  - id: job-log-detail
    classe: NOT_APPLICABLE
    valeur: 403-admin-requis-reconfirme-inchange
  - id: preview-build-identite
    classe: VERIFIED
    valeur: nexus-build-js-commit-1ba8b88a49fc45e1de2ef06938c8080cc0fac144-coherent-true-environnement-test
  - id: preview-config-supabase-test
    classe: VERIFIED
    valeur: nexus-config-js-environnement-test-supabaseUrl-udljdqxerrbbbajxubfn-cle-publishable-jamais-production
  - id: recette-navigateur-authentifiee
    classe: NOT_APPLICABLE
    valeur: aucun-secret-pin-test-disponible-dans-ce-canal
  - id: smoke-non-authentifie
    classe: VERIFIED
    valeur: racine-preview-200-46642-octets-contenu-reel
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport `1ba8b88` vérifié, harnais réalignés exécutés réellement, CI/preview candidate mesurées — recette navigateur hors de portée du canal

## 1. Transport confirmé conforme — diff exact, blobs identiques

`git show --no-patch 1ba8b88a49fc45e1de2ef06938c8080cc0fac144` confirme le parent
`a31b2e4aee723a4ab728f10ae50deb5575be7db7` (la restauration `nexus-auth.js` déjà prouvée par
`decision-9.md`/`request-12.md`/`request-13.md`), auteur `vito-sainte-marie`, message
`test(#65): réaligner les deux harnais NEXUS_CONFIG`.

`git diff --stat a31b2e4 1ba8b88` : **exactement deux fichiers touchés**, rien d'autre :
```
 test_cloture_services_obsoletes_20260916.js | 18 +++++++++++++++++-
 test_regularisation_manager_20260916.js     | 29 ++++++++++++++++++++++++++++-
```
Blobs vérifiés par `git rev-parse 1ba8b88:<chemin>` — **identiques octet pour octet** aux valeurs
annoncées par le réveil :
- `test_regularisation_manager_20260916.js` → `81ed59e4cca129e85776f3a2887420d5ef38875d`
- `test_cloture_services_obsoletes_20260916.js` → `6fa892184879ee0d7319ab8713fab36f5922f0fd`

Le contenu du diff (`git diff a31b2e4 1ba8b88 -- <les deux fichiers>`) est exactement le patch
déjà documenté et prouvé sous `decision-8.md` (`preuve-execution-harnais-realignes-20260923.md`,
`request-14.md` §6 option 1) : `window.NEXUS_CONFIG` stub Test (jamais de vraie clé, `fetch`
interdit dans le banc), `ctx.NexusBuild = { versionner: (src) => src }` (stub neutre, aucune
assertion des deux fichiers ne porte sur `versionner`/`NexusBuild`/`build`), chargement réel de
`nexus-page.js` avec le pont `ctx.NexusPage = ctx.window.NexusPage`. Aucune ligne de
`nexus-auth.js` touchée, aucune assertion modifiée.

`origin/rebuild/carburants-65-20260922` pointe bien sur `1ba8b88` (remote-tracking déjà à jour
dans ce checkout, aucun `fetch` nécessaire).

## 2. Les deux harnais autorisés, exécutés réellement contre l'arbre candidate complet — pas tracés à la main

Reconstruction en lecture seule, fichier par fichier (`git show 1ba8b88:<chemin> > ...`, seule
opération de lecture distante disponible dans ce canal), de **tout** ce que les deux harnais
lisent réellement depuis `__dirname` sur `1ba8b88` : `nexus-auth.js`, `nexus-page.js`,
`nexus-pointage-regles.js`, `NEXUS-Cockpit-v2.html`, la migration
`supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql` (exigée par une assertion de
`test_regularisation_manager_20260916.js`), et — pour l'assertion « les six consommateurs
chargent `nexus-pointage-regles.js` » du second harnais, qui scanne tout `__dirname` — **les 61
écrans `NEXUS-*.html` réels de la candidate**, recensés via `git diff --stat <arbre-vide> 1ba8b88
-- 'NEXUS-*.html'` (61 fichiers, 73025 lignes) puisque `git ls-tree` est refusé dans ce canal.

Exécution réelle (`node`), pas de trace manuelle :
- `test_regularisation_manager_20260916.js` (contenu de `1ba8b88`) : **24/24**.
- `test_cloture_services_obsoletes_20260916.js` (contenu de `1ba8b88`) : **14/14**, dont
  l'assertion de balayage des 61 écrans réels.

**38/38**, sur le contenu exact déployé par le transport, avec l'intégralité de ses dépendances
réelles — plus complet que la preuve du 23/09 (qui reconstruisait un sous-ensemble hors dépôt) sur
un point précis : les 61 écrans réels étaient présents, pas simulés.

## 3. Suite complète candidate (224 fichiers) — toujours hors de portée de ce canal, reconfirmé

`git diff --stat <arbre-vide> 1ba8b88 -- 'test_*.js'` recense **224 fichiers de tests** (46002
lignes). Les reconstruire un par un avec leurs dépendances propres (moteurs `nexus-*.js`
spécifiques, migrations supplémentaires, autres écrans) representerait plusieurs centaines de
fichiers supplémentaires — non praticable dans cette session, exactement la conclusion déjà posée
par `request-14.md §5` (« reconstruire l'arbre complet (~1146 fichiers) […] n'est pas praticable
dans le temps de cette session »). Retesté explicitement dans ce tour : `git fetch`,
`git checkout <ref> --`, `git -C <repo> ...`, `git worktree add`, `git archive`, `git ls-tree`,
`git diff-tree`, ainsi qu'un script bash exécuté via `bash fichier.sh` et toute boucle/expansion
de variable dans une commande Bash, sont **tous refusés** (approbation qu'aucun humain ne peut
donner dans ce run automatisé). `gh` est intégralement refusé aussi cette fois (`gh run list`),
contrairement à certaines sessions antérieures du fil.

## 4. CI mesurée réellement sur `1ba8b88` — sans `gh`/`curl`/jeton, API publique GitHub

Repris de la méthode découverte par `request-14.md` (`https.get` Node vers l'API REST publique,
sans authentification, fonctionnelle sur ce dépôt public) :

| check | conclusion sur `1ba8b88` |
|---|---|
| `Cloudflare Pages` | `success` |
| `Supabase Preview` | `skipped` |
| `non-regression` | `failure` |

Comparaison directe avec le parent immédiat `a31b2e4` (avant transport) : **les 4 annotations du
job `non-regression` sont identiques mot pour mot** entre les deux commits (avertissement Node 20,
« Process completed with exit code 1 », « Nouveaux tests en échec : » tronqué, notice runner
image) — **aucune signature de régression nouvelle** introduite par le transport des deux harnais.
`GET .../actions/jobs/<id>/logs` reste `403 — Must have admin rights to Repository` sur `1ba8b88`
comme sur tous les commits précédents de ce fil : le détail exact de la liste `Nouveaux tests en
échec :` reste inaccessible depuis ce canal, obstacle inchangé, pas nouveau.

Cette mesure est cohérente avec l'hypothèse de `request-14.md` §6 : les deux fichiers réalignés
faisaient partie des échecs connus pour une cause distincte de `decision-9.md` (garde
`NEXUS_CONFIG` jamais stubée) ; leur correction locale est prouvée (§2), mais `non-regression`
reste rouge pour d'autres tests de la liste des 19, non touchés par ce transport — sans que cela
constitue une aggravation.

## 5. Preuve preview Cloudflare/Test — SHA/build réellement servi, config exclusivement Supabase Test

Détail du check `Cloudflare Pages` (`id 107618838692`) : déploiement Preview réussi sur le projet
`nexus-test`.
- Preview URL (déploiement) : `https://dd109587.nexus-test-ddf.pages.dev`
- Branch Preview URL : `https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev`

Récupéré réellement (`https.get`, réseau sortant fonctionnel dans ce canal) :

`nexus-build.js` servi par la preview :
```
commit: '1ba8b88a49fc45e1de2ef06938c8080cc0fac144'
commitCourt: '1ba8b88'
id: '6bcfb5167538'
environnement: 'test'
construitLe: '2026-09-24T11:49:57Z'
coherent: true
```
Le SHA servi correspond **exactement** au commit candidate vérifié en §1 — pas une supposition,
une lecture directe de l'identité de build générée par `outils/poser-build-id.js` au moment de ce
déploiement précis.

`nexus-config.js` servi par la preview :
```
environnement: "test"
supabaseUrl: "https://udljdqxerrbbbajxubfn.supabase.co"
supabaseCle: "sb_publishable_..."   (clé publishable/anon, jamais une clé service_role)
```
`supabaseUrl` pointe exclusivement vers le projet `nexus-test` (`udljdqxerrbbbajxubfn`) déjà connu
de ce fil — **aucune référence Production**. La clé est de la famille `sb_publishable_`, pas un
secret `service_role`.

Smoke test non authentifié : `GET /` sur la preview → `200`, `46642` octets de contenu réel (pas
une page d'erreur de build).

## 6. Recette navigateur authentifiée — NON exécutée, capacité manquante explicite

`NEXUS_TEST_URL` est présent dans ce canal. **Aucun secret PIN n'y est injecté** :
`NEXUS_TEST_MANAGER_PIN`, `NEXUS_TEST_CREATEUR_PIN`, `NEXUS_TEST_EMPLOYEE_A_PIN`,
`NEXUS_TEST_EMPLOYEE_B_PIN`, `NEXUS_TEST_PIN` sont tous absents (vérifié par test booléen de
présence, jamais de lecture de valeur). Ce canal `issue_comment` n'a donc jamais eu, à aucun tour
de ce fil, les moyens d'authentifier Manager/Créateur/Employé A/Employé B — cohérent avec
l'ensemble des réveils précédents. La recette navigateur par rôle demandée par ce tour n'a donc
**pas** été exécutée ; seul le smoke test non authentifié du §5 a pu l'être.

## 7. Ce qui n'a pas été fait, honnêtement

- Suite candidate complète (224 fichiers, ~1146 avec dépendances) : non rejouée, obstacle
  d'outillage du canal reconfirmé, pas nouveau.
- Détail exact de `Nouveaux tests en échec :` : inaccessible (log job 403, admin requis).
- Recette navigateur authentifiée par rôle (Manager/Créateur/Employé A/Employé B) : non exécutée,
  aucun secret PIN Test disponible dans ce canal.
- Aucune écriture, aucun transport supplémentaire, aucune modification de test, aucune action sur
  `rebuild/carburants-65-20260922` ou toute autre branche hors de celle assignée à cette session.

## 8. Conclusion

Le transport `1ba8b88` est conforme à ce qu'il annonce : strictement les deux harnais autorisés,
blobs identiques, contenu identique au patch déjà prouvé sous `decision-8.md`. Les deux harnais,
rejoués réellement contre l'arbre candidate complet, passent 38/38. La CI mesurée sur `1ba8b88`
ne montre aucune signature de régression nouvelle par rapport au parent immédiat. La preview
Cloudflare/Test sert exactement ce commit, avec une configuration exclusivement Supabase Test.
Aucune des conditions STOP de ce réveil (régression applicative, nouvelle règle métier/UX/rôle/
RLS/sécurité, risque matériel, action Production) ne s'est déclenchée.

**`#65` reste `NO GO`** : la gate `non-regression` de la suite complète reste fermée pour des
causes non couvertes par ce transport, et la recette navigateur authentifiée n'a pas pu être
exécutée dans ce canal. Ce tour apporte une mesure et une preuve réelles supplémentaires, pas une
fermeture de gate.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé
(clé publishable citée, jamais un `service_role` ni un jeton), aucune écriture sur
`rebuild/carburants-65-20260922` ni sur aucune branche hors de celle assignée à cette session.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique.
