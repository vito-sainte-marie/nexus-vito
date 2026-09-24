---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: reconciliation-verifiee-independamment
    classe: VERIFIED
    valeur: plan-reconstruit-par-script-execute-non-relu-sur-confiance
  - id: harnais-1-vert
    classe: VERIFIED
    valeur: test_regularisation_manager_20260916-harnais-realigne-1-24-sur-24
  - id: harnais-2-vert
    classe: VERIFIED
    valeur: test_cloture_services_obsoletes_20260916-harnais-realigne-1-14-sur-14
  - id: regression-adjacente
    classe: VERIFIED
    valeur: 3-fichiers-8-sur-8-37-sur-37-6-sur-6
  - id: constat-acces-regle-preexistant
    classe: VERIFIED
    valeur: test_pointage_interrupteur_global-echoue-identique-avant-apres-deja-exclu-request-11
  - id: constat-recensement-role-partiel
    classe: DECLARED
    valeur: delta-plus-1-coherent-total-global-59-non-verifiable-arbre-complet-hors-de-portee-canal
  - id: transport-candidate
    classe: NOT_APPLICABLE
    valeur: git-worktree-add-refuse-retestee-explicitement-cette-session
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-candidate-ni-rail-preuve-persistee-pour-transport
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Vérification indépendante de `request-11.md` — plan reconstruit et rejoué, transport toujours hors de portée

Réveil demandant de poursuivre `NEXUS-CONTINUITE-TERRAIN-2-20260922` après matérialisation de
`decision-9.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-11.md`) :
matérialiser la décision Handoff technique, appliquer le plus petit plan prouvé sur
`rebuild/carburants-65-20260922` si et seulement s'il reste une restauration exacte, rejouer les
harnais et la non-régression sans masquer d'échec.

## 0. Ce qui a réellement changé par rapport à `request-11.md`

`request-11.md` avait vérifié les faits statiques (Git) indépendamment mais n'avait **pas rejoué** les
38 assertions métier une seconde fois — la session d'origine avait déjà construit et prouvé le fichier
fusionné, puis supprimé sa zone de travail avant dépôt. Cette session est allée plus loin : elle a
**reconstruit elle-même** le fichier fusionné par script (jamais à la main), à partir des mêmes trois
sources nommées par `request-11.md` §4, puis l'a réellement exécuté. Ce n'est donc pas une simple
relecture de la preuve : c'est une seconde preuve indépendante, produite par un mécanisme différent.

## 1. Construction — traçable, vérifiable ligne à ligne

Script `construire-merge.js` (non conservé, zone jetable) : base = `nexus-auth.js` actuel de la
candidate (305 lignes) ; insertion de `nexusEstManager` (production lignes 324-331) ; consolidation des
deux prédicats de rôle en ligne (`nexusPointageArriveeManquant`, `nexusPriseDePosteManquante`) ; retrait
de l'ancien commentaire S-4 devenu obsolète (candidate 182-208, décrivait le `nexusServiceCourant`
remplacé) au profit d'une note courte et exacte ; insertion d'un seul bloc contigu (production lignes
350-869 : cycle de vie pilote + commentaire S-4/fuseau à jour + bloc fuseau + `nexusServiceCourant`).
Chaque substitution vérifie d'abord la présence du motif exact avant de le remplacer — le script
échoue plutôt que de construire à l'aveugle si un motif attendu est absent.

Résultat : **763 lignes**, `node --check` passe. Diff mesuré contre le `nexus-auth.js` actuel de la
candidate : **454 insertions, 12 suppressions** (légère différence avec les 466/9 de `request-11.md`,
imputable au choix assumé de retirer l'ancien commentaire obsolète plutôt que de le laisser décrire une
fonction qui n'existe plus à cet endroit — voir §0 de `request-11.md` sur ce même principe).

## 2. Preuve — les deux harnais nommés, réellement rejoués

- `test_regularisation_manager_20260916-harnais-realigne-1.js` → **24/24**.
- `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` → **14/14**.

Identique, assertion par assertion, à ce que `request-11.md` §5.3 rapportait — confirmé par une
construction indépendante, pas relu sur la confiance de la première.

## 3. Non-régression — trois tests adjacents supplémentaires, tous verts

Recherchés sur la candidate (`origin/rebuild/carburants-65-20260922`) parmi les fichiers référençant
`nexus-auth.js`, au-delà des deux harnais nommés :

- `test_service_courant_unique_20260905.js` → **8/8**.
- `test_pointage_depart_sans_pause_20260911.js` → **37/37**.
- `test_rattachement_service_inventaire_20260905.js` → **6/6**.

## 4. Deux constats honnêtes — ni masqués, ni corrigés silencieusement

**`test_pointage_interrupteur_global.js` échoue.** Vérifié qu'il échoue **identiquement, avant et
après** application du plan (rejoué contre le `nexus-auth.js` actuel de la candidate, sans le plan, puis
contre le fichier reconstruit — même échec, même ligne). La cause : ce test attend le bloc
`/* NEXUS-ACCES-REGLE:DEBUT */` (classification d'accès consultation/opérationnel/publique/séquence),
que `request-11.md` §4 nomme et **exclut explicitement** de ce plan (« cinquante écrans », changement de
navigation, hors périmètre). Ce n'est donc pas une régression de ce plan — c'est la confirmation d'un
écart déjà nommé et déjà exclu par écrit. Rien n'a été fait pour le faire passer : ce serait exactement
l'élargissement de périmètre que `request-11.md` §4 refuse.

**`test_role_du_jour_20260905.js` porte un recensement sur l'arbre complet, non vérifiable depuis ce
canal.** Il compte, sur *tous* les fichiers `.js`/`.html` de la candidate, les points de décision de
rôle (`role==='manager'`/`nexusEstManager(`) et attend un total figé (documenté dans le test lui-même :
59, dont « +3 points de décision introduits par le volet D du 16/09 — nexus-auth.js : régularisation
manager ; Cockpit : deux gardes d'affichage »). Rejoué sur le sous-ensemble de fichiers disponibles dans
cette zone jetable (8 fichiers, faute d'un accès complet à l'arbre — `git worktree add` refusé,
retesté explicitement ci-dessous), le compte partiel passe de **9 à 10** après le plan — un delta de
**+1**, localisé uniquement à `nexus-auth.js` (2 → 3), et qui correspond exactement au point que le
commentaire du test attribue à `nexus-auth.js` pour ce même volet D. Le total global figé (59) n'a donc
**ni été confirmé ni infirmé** — seule une session avec l'arbre complet de la candidate peut le faire.
Ceci reste une preuve partielle honnête, pas un vert ni un rouge global.

Aucun des deux ne révèle une règle métier/UX/rôle/RLS nouvelle exigée par le plan — la condition STOP du
réveil n'est donc pas atteinte.

## 5. Transport — retesté explicitement, toujours refusé

`git worktree add --detach ... origin/rebuild/carburants-65-20260922` → refusé (approbation requise,
indisponible dans ce run automatisé). Confirmation directe, pas une supposition héritée de
`request-11.md` §8. Le fichier fusionné et son diff exact sont donc **persistés dans ce lot** :
`nexus-auth-restaure-65-20260924.js` (763 lignes), `diff-nexus-auth-restaure-65-20260924.patch` —
prêts à être portés sur `rebuild/carburants-65-20260922` par une session disposant d'un accès réel en
écriture à cette branche.

## 6. Preview/recette #65 — non entamée, conditions inchangées

Conformément au mandat du réveil, la preview/recette #65 n'a pas été entamée : elle reste conditionnée à
une CI candidate verte **après intégration réelle** du plan, et à une preuve séparée que le
`nexus-config.js` réellement servi cible exclusivement Supabase Test — aucune des deux n'est atteignable
tant que le fichier n'est pas intégré sur `rebuild/carburants-65-20260922`.

## Pour intégrer depuis une session outillée (écriture réelle sur `rebuild/carburants-65-20260922`)

```
git fetch origin rebuild/carburants-65-20260922
git worktree add ../nexus-candidate-65 origin/rebuild/carburants-65-20260922
cp docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js \
   ../nexus-candidate-65/nexus-auth.js
cd ../nexus-candidate-65
node --check nexus-auth.js
node test_regularisation_manager_20260916.js   # adapter le nom si déplacé/renommé sur la candidate
node test_cloture_services_obsoletes_20260916.js
node run-tests.js   # suite complète candidate — seule exécution qui vérifie le total figé de
                     # test_role_du_jour_20260905.js sur l'arbre réel
git add nexus-auth.js
git commit -m "fix(auth): restaurer nexusEstManager, cycle pilote et fuseau du site (cause racine 290a217)"
git push origin HEAD:rebuild/carburants-65-20260922
```

## Guardians

- **Architecture & Cohérence** : un seul fichier applicatif concerné par le plan lui-même
  (`nexus-auth.js`), blocs copiés tels quels depuis une source déjà validée ; aucune candidate ni aucun
  rail modifiés par cette session — zone jetable entièrement retirée avant ce dépôt.
- **Security & Isolation** : aucun secret, aucune opération réseau/Supabase (le banc de test lève sur
  tout `fetch`) ; aucune écriture distante tentée au-delà des lectures `git show` déjà utilisées par la
  session d'origine.
- **Business Rules** : aucune règle métier nouvelle ; le seul écart connu (`NEXUS-ACCES-REGLE`) reste
  nommé et exclu, pas contourné.
- **QA/Regression** : seconde preuve indépendante par reconstruction (pas une relecture) — 24/24 + 14/14
  identiques, plus 8/8 + 37/37 + 6/6 de régression adjacente, plus deux constats honnêtes documentés
  plutôt que masqués.
- **Bible/Philosophie** : préférence donnée à nommer précisément ce qui reste non vérifiable (§4) plutôt
  qu'à extrapoler un total global non mesuré ; aucun doublon concurrent (travail de `request-11.md`
  vérifié une seconde fois par une méthode différente, pas dupliqué à l'identique) ; aucune écriture
  fabriquée sur la candidate sans accès réel.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucun
secret/PIN/service_role, aucune règle métier/UX/RLS/rôle ajoutée, **aucune écriture sur la candidate ni
sur le rail** — zone jetable uniquement, retirée avant ce dépôt. Gates identité Test / Cloudflare de
`decision-7.md`/`decision-8.md` inchangées, non retouchées ici.
