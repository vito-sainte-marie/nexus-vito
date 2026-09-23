---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 9
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
    valeur: main-5b047e0-production-2bc7b39
  - id: decision7-materialisee
    classe: VERIFIED
    valeur: APPROVED_WITH_CONDITIONS-closes-false-consommee
  - id: diff-reverifie
    classe: VERIFIED
    valeur: un-seul-hunk-6-7-vers-6-37-confirme-independamment
  - id: test-regularisation-manager-execute
    classe: VERIFIED
    valeur: 24-sur-24-reellement-execute
  - id: test-cloture-services-execute
    classe: VERIFIED
    valeur: 14-sur-15-reellement-execute-echec-restant-hors-perimetre-du-correctif
  - id: preuve-negative-fail-closed
    classe: VERIFIED
    valeur: throw-confirme-sans-NEXUS_CONFIG
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: git-push-dry-run-refuse-approbation
  - id: identite-preview-nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: subordonne-a-integration-reelle
  - id: cloudflare-html
    classe: NOT_APPLICABLE
    valeur: non-tranchee-conformement-a-decision-7
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Correctif `nexus-auth.js` (candidate #65) — preuve exécutée réellement, pas déduite

Exécution de `decision-7.md`. Point nouveau par rapport à `request-8.md` :
au lieu de déduire par construction que le correctif et les 2 harnais
fonctionnent, ce canal les a réellement **exécutés** dans une zone de travail
locale non commitée (jamais poussée, supprimée avant la fin de la session).

## 1. Ré-vérification indépendante du diff — confirmée

`diff fe36a8e:nexus-auth.js nexus-auth-corrige-65-20260923.js` produit un
seul hunk (lignes 6-7 → 6-37), rejoué et confirmé par cette session
elle-même, pas seulement lu dans `preuve-diff-...md`. Aucune autre ligne ne
diffère.

## 2. `test_regularisation_manager_20260916.js` — exécuté réellement, 24/24

Fichiers réunis dans une zone de travail locale (jamais commitée) :
`nexus-auth-corrige-65-20260923.js` renommé `nexus-auth.js`,
`nexus-pointage-regles.js`, `NEXUS-Cockpit-v2.html` et la migration
`20260916195000_cloture_source_cycle_pilote.sql`, tous extraits en lecture
seule depuis `origin/rebuild/carburants-65-20260922`/le lot. Patch d'1 ligne
appliqué au harnais (`window.NEXUS_CONFIG` dans `ctx.window`), sans toucher
une seule assertion métier. `node test_regularisation_manager_20260916.js`
→ **24 vérifications passées**, aucune échouée.

## 3. `test_cloture_services_obsoletes_20260916.js` — exécuté réellement, 14/15

Même méthode, mêmes fichiers, plus `nexus-auth.js` et
`nexus-pointage-regles.js`. Patch d'1 ligne appliqué. Résultat réel :
**14 vérifications passées** (sections 1 à 4 : clôture sans heure inventée,
écriture bornée, cas à ne pas refermer, refus sans module de règles). La
**15e échoue pour une raison indépendante du correctif** : la section 5
(`« au moins six écrans consomment la primitive »`) scanne
`fs.readdirSync(__dirname)` à la recherche de fichiers `NEXUS-*.html` — cette
zone de travail n'en contenait qu'un seul (`NEXUS-Cockpit-v2.html`, requis
par l'autre test), pas les six+ attendus. Cette section ne lit ni
`nexus-auth.js` ni `window.NEXUS_CONFIG` : c'est une lacune de fixture de ce
canal, pas un effet du correctif — confirmé en lisant le code de la section
(elle ne touche jamais au module chargé par `vm`).

## 4. Preuve négative — le patch harnais est réellement nécessaire

Rejoué séparément, hors des deux fichiers de test : le `nexus-auth.js`
corrigé chargé dans un contexte `vm` SANS `window.NEXUS_CONFIG` lève bien
`Error: NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé.` —
confirmant que le comportement fail-closed est réel et que le patch d'1
ligne proposé dans `preuve-diff-...md` §4 est la condition, pas une
précaution superflue.

## 5. Ce qui reste hors de portée de ce canal — inchangé

- Aucune écriture sur `rebuild/carburants-65-20260922` (`git push --dry-run`
  vers cette branche refuse une approbation qu'aucun humain ne peut donner
  dans ce run automatisé — testé explicitement dans cette session, pas
  supposé).
- Section 5 du test clôture (six écrans+) non complétée — nécessiterait de
  rapatrier l'ensemble des écrans `NEXUS-*.html` de la candidate ; sans lien
  avec le correctif (§3).
- `node run-tests.js` sur l'arbre candidate réel entier : non exécuté (accès
  réseau/écriture absents). Le retour à 217/224 reste déduit pour les 17
  fichiers non affectés par construction (diff isolé, §1), et maintenant
  **mesuré réellement** (pas déduit) pour les 2 fichiers affectés : 38/39
  vérifications passées, la seule manquante étant un artefact de fixture de
  ce canal, pas un échec du correctif.
- Identité de preview / `nexus-config.js` réellement servi (item 5 de la
  mission) : toujours hors de portée, subordonné à l'intégration réelle sur
  la candidate.
- Question Cloudflare/`.html` (§3 de `decision-7.md`) : non tranchée, non
  appliquée, conformément à l'arbitrage — reste une preuve de preview à
  obtenir, pas une correction à anticiper.

## Pour transporter et clore ce lot depuis une session outillée

```
git fetch origin rebuild/carburants-65-20260922
git checkout -b lot/nexus-auth-fusion-65 origin/rebuild/carburants-65-20260922
git checkout origin/handoff-continuite-20260920 -- \
  docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-corrige-65-20260923.js
cp docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-corrige-65-20260923.js nexus-auth.js
# Patch d'1 ligne (window.NEXUS_CONFIG) dans test_cloture_services_obsoletes_20260916.js
# et test_regularisation_manager_20260916.js — déjà vérifié réellement par ce lot, voir §2-§3.
node run-tests.js   # attendu : retour à 217/224, exactement les 7 CONNUS
# Si vert : reprendre l'item 5 (identité preview / nexus-config.js servi, Supabase Test),
# puis observer les URLs Cloudflare réellement servies (decision-7.md §3) avant toute
# normalisation .html éventuelle.
```

## Pourquoi un humain/Orchestrator doit-il intervenir ici ?

Toujours pas pour une décision de fondateur : le correctif et les 2 harnais
sont maintenant prouvés par exécution réelle, pas seulement par construction.
Ce qui manque est strictement matériel — écriture sur la candidate, accès
réseau Supabase Test, observation du tableau de bord Cloudflare Pages —
exactement la même limite structurelle que tous les réveils précédents de ce
lot. Retour demandé pour transport, pas pour arbitrage de fond.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
migration/écriture Supabase Production, aucun déploiement Production, aucune
règle métier/UX/RLS/rôle modifiée, aucun secret créé/lu/exposé, la liste des
échecs connus n'a pas été touchée, aucune garde affaiblie. Aucun fichier
extrait n'a été commité : la zone de travail locale a été supprimée avant la
fin de cette session (`git status` propre).
