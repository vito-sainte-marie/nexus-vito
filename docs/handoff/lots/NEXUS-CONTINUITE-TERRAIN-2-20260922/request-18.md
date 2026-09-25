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
  - id: reconciliation-lignee
    classe: VERIFIED
    valeur: decision-11 canonicalisee via handoff.js decision, identique a ab20a85, consommee
  - id: dry-run-baseline
    classe: VERIFIED
    valeur: test_reconstruire_baseline_candidat_20260924.js 10/10 rejoue sur ce HEAD, memes SHA production/65/62
  - id: regression-globale
    classe: VERIFIED
    valeur: node run-tests.js, 0 regression, memes 9 echecs connus
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 1 finding preexistant ARCH-002, verifier-apprentissage conforme, guardian-qa 0 finding
  - id: mecanisme-ci-ephemere
    classe: DECLARED
    valeur: conception documentee mecanisme-baseline-ci-ephemere-1.md, non appliquee, non prouvee
  - id: execution-reelle-65
    classe: NOT_APPLICABLE
    valeur: aucune ressource jetable ni acces workflows depuis ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Reprise de chaîne — réconciliation de lignée + mécanisme baseline #65 prouvé, blocage réel identifié

Répond au réveil de reprise du 25/09/2026 (« REPRISE DE CHAÎNE au dernier point valide, sans
recommencer les diagnostics déjà acquis »). Cette demande couvre les objectifs 1, 2 et 5 (partiel)
de ce réveil ; l'objectif 3 est traité par une proposition de conception (§3, non appliquée,
`mecanisme-baseline-ci-ephemere-1.md`) faute de permission d'édition `.github/workflows/`.

## 1. Divergence de lignée — classifiée, réconciliée par l'outil, pas par cherry-pick brut

Deux sessions Claude non fusionnées (`claude/issue-28-20260924-2147` et `claude/issue-28-20260924-2209`)
avaient chacune matérialisé, sans se voir, leur propre `decision-11.md` en réponse à
`request-17.md` — un vrai cas de synchronisation de lignée, pas un désaccord de fond :

- **`-2147` (21:50–22:01 UTC)** : `decision-11.md` « baseline Test reproductible » + outillage réel
  (`outils/reconstruire-baseline-candidat.sh`), baseline machine-readable, `request-18.md` local
  concluant « mécanisme minimal 65/62 prêt, STOP ressource Supabase jetable ».
- **`-2209` (22:14–22:18 UTC)** : `decision-11.md` « baseline Supabase jetable » indépendante, puis
  `request-18.md` local concluant à tort « hors de portée » — ce checkout ne voyait pas les
  artefacts déjà produits par `-2147` (branches Git isolées entre sessions).

**Aucune des deux n'avait été canonicalisée** sur `handoff-continuite-20260920` (vérifié :
`STATE.json.derniere_decision = decision-10.md` avant ce lot) — donc aucune violation d'append-only
à corriger, seulement un transport de lignée. La lignée `-2147` est la plus substantielle (déposée
en premier, suivie d'un travail réel) : elle est rapatriée ici via `node outils/handoff.js decision`
(contenu identique octet pour octet à `ab20a85`, pas une réécriture), puis consommée. La lignée
`-2209` reste un artefact orphelin non canonicalisé, sans action requise — son intention (GO pour
une ressource jetable isolée) n'est pas contredite par cette réconciliation, seulement son
diagnostic d'impossibilité, devenu obsolète.

## 2. HEAD canonique unique — établi

`handoff-continuite-20260920` porte maintenant : `docs/canon/NEXUS-AGENT-MISSION.md` (déjà présent,
1319b22, inchangé), `decision-11.md` consommée, `outils/reconstruire-baseline-candidat.sh` +
`test_reconstruire_baseline_candidat_20260924.js`, `baseline-programme-stabilisation-1.json/.md`.
Rien d'évolué plus récemment n'a été écrasé : aucune autre branche n'a avancé sur ce lot entre
`178f265` et ce dépôt.

## 3. Preuve DRY_RUN rejouée fraîchement sur ce HEAD (pas seulement citée)

`node test_reconstruire_baseline_candidat_20260924.js` : **10/10**, exécuté dans cette session
contre les refs réelles actuellement présentes (`origin/production` = `2bc7b39d`, `#65`
`reception-regularisation-20260919` = `fe36a8eb`, `#62` `fdj-vague1-cycle-caisse-20260916` =
`fe4e9a2b` — mêmes SHA que la mesure du 24/09, aucune de ces branches n'a bougé). Delta confirmé :
`#65` = exactement 1 migration d'ajout pur, `#62` = exactement 12. Toutes les gardes de refus
(PRODUCTION, Test historique, branche introuvable, non-ancêtre, delta impur) revérifiées une par
une. `node run-tests.js` : aucune régression (mêmes 9 échecs connus). `outils/guardians-router.js` :
1 finding, la collision `NexusStock` déjà tracée `ARCH-002`, sans rapport avec ce lot.
`outils/verifier-apprentissage.js` : conforme (21 règles). `outils/guardian-qa.js` : 0 finding
(275 épreuves analysées).

## 4. Objectif 3 (workflow CI minimal) — conception proposée, non appliquée, non prouvée

`mecanisme-baseline-ci-ephemere-1.md` (nouveau, ce lot) documente un fait technique nouveau, vérifié
dans cette session : `outils/reconstruire-base-test.sh` accorde des privilèges aux rôles `anon`,
`authenticated`, `service_role` — posés par la plateforme Supabase à la création d'un projet, pas
par les migrations versionnées. Un service container `postgres:` nu de GitHub Actions ne les
possède pas ; la reconstruction y échouerait avant la première migration. C'est la raison technique
exacte, jusqu'ici seulement pressentie, du besoin d'un « projet Supabase » plutôt que d'une simple
base Postgres.

Piste proposée : la pile locale de la CLI Supabase (`supabase/setup-cli`, action publique gratuite),
qui démarre via Docker un environnement Postgres+Auth+Storage éphémère avec ces rôles déjà en
place — sans compte, sans secret, sans coût au-delà des minutes CI déjà consommées. Patch YAML exact
documenté §3 du fichier annexe. **Non appliqué** : ce canal (`issue_comment`) n'a pas la permission
d'éditer `.github/workflows/*.yml` (restriction d'outil constante depuis le 06/09/2026). **Non
prouvé** : reproduire un run GitHub Actions complet dans ce sandbox pour une conception qui devra
de toute façon être validée sur le runner cible ne produirait pas une preuve représentative — je ne
l'ai donc pas fabriquée.

## 5. Classification de l'état actuel

- **Réconciliation de lignée (objectif 1)** : `RESOLU`.
- **Registre/Handoff (objectif 2)** : `RESOLU` — `node outils/handoff.js verifier` conforme
  (32 lots, 15 avertissements, 11 dérogations, tous préexistants, 0 nouvelle erreur).
- **Mécanisme de reconstruction (objectif 4, partiel — la moitié « Production + delta ») : `PROUVE
  EN DRY_RUN`, exécution réelle non faite.
- **Exécution réelle + recette candidate (objectifs 4 suite, 5, 6)** : `BLOQUE_CAUSE_RACINE =
  AUTORITE_EXECUTION`. Deux gestes distincts, aucun des deux possible depuis ce canal : (a) éditer
  `.github/workflows/*.yml` pour câbler le job proposé §4, action réservée à une session/humain
  disposant de ce droit ; (b) fournir la ressource jetable elle-même (projet Supabase existant, ou
  validation de la piste CLI locale) et l'accès réseau correspondant. Ce n'est ni un défaut du
  candidat `#65` (delta pur, 1 migration, `production` ancêtre direct — confirmé §3), ni de
  l'environnement de ce dépôt, ni du harnais de test existant : c'est strictement l'autorité
  d'exécution de ce canal GitHub Issue qui s'arrête à la frontière déjà documentée depuis le
  06/09/2026 (aucun secret Supabase, aucune écriture `.github/workflows/`).

`#65` reste `NO GO` — rien dans cette reprise n'autorise une promotion Production. Pas de dossier de
gate Créateur préparé : les preuves de reconstruction réelle + recette candidate manquent encore.

## Ce que cette demande ne fait pas

Aucun changement `main`/`production`, aucune opération Supabase (aucun accès depuis ce canal),
aucune création de ressource, aucune modification de règle métier/UX/rôle/RLS/sécurité, aucun
fichier `.github/workflows/*` créé ou modifié, aucun secret créé/lu/exposé, aucun affaiblissement de
gate ou de test `CONNU`.
