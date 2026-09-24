---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 17
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
    valeur: main=5b047e0 production=2bc7b39 inchanges
  - id: decision-10-consommee
    classe: VERIFIED
    valeur: outils-handoff-js-consommer-commit-ce27a56
  - id: voie-recette-navigateur-identifiee
    classe: VERIFIED
    valeur: tests-yml-NEXUS_REF_EST_LE_RAIL-secrets-deja-provisionnes
  - id: push-impossible-ce-canal
    classe: VERIFIED
    valeur: api-github-permissions-push-false-pull-false
  - id: isolation-test-candidat-toujours-ouverte
    classe: VERIFIED
    valeur: classement-gates-etat-git-62-65-1-md-inchange
  - id: recette-navigateur-authentifiee
    classe: NOT_APPLICABLE
    valeur: aucun-secret-pin-lu-ni-execute-voie-existante-hors-de-portee
  - id: dossier-gate-production
    classe: NOT_APPLICABLE
    valeur: gates-65-non-toutes-closes-non-prepare
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `decision-10.md` consommée — recette navigateur toujours hors de portée de ce canal, gestes suivants non déclenchés

## 1. Décision consommée

`decision-10.md` (GO Créateur, réponse aux trois questions de `request-16.md` §8) consommée via
`outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-2-20260922` (commit `ce27a56`). Registre
conforme avant/après (32 lots, mêmes avertissements préexistants, 0 nouvelle erreur). Miroirs
régénérés.

## 2. Voie d'exécution autorisée pour la recette navigateur — recherchée, identifiée, non atteignable

Recherche faite dans l'infrastructure existante, sans lire ni exposer aucune valeur de PIN :

- `.github/workflows/tests.yml` (rail canonique) provisionne déjà les quatre secrets Test
  (`NEXUS_TEST_MANAGER_PIN`, `NEXUS_TEST_CREATEUR_PIN`, `NEXUS_TEST_EMPLOYEE_A_PIN`,
  `NEXUS_TEST_EMPLOYEE_B_PIN`) et exécute la recette navigateur (`outils/recette-navigateur-
  test.js`) automatiquement à chaque push — **mais seulement** quand `env.NEXUS_REF_EST_LE_RAIL ==
  '1'`, c'est-à-dire uniquement sur un push dont le ref est exactement `refs/heads/handoff-
  continuite-20260920` (le rail déclaré au registre). Cette voie existe déjà, ne demande aucun
  nouveau secret ni aucune modification de sécurité — c'est la voie prévue par construction.
- Vérifié pour la première fois par preuve API, pas par supposition : `GET /repos/.../` avec le
  jeton de cette session renvoie `"permissions":{"admin":false,"maintain":false,"push":false,
  "triage":false,"pull":false}`. Ce canal ne peut donc matériellement **pas** pousser sur
  `handoff-continuite-20260920` — confirmation plus précise que les sessions précédentes, qui
  concluaient au même blocage par l'échec d'une commande `git push`/`gh` nécessitant une
  approbation humaine indisponible.
- Même si ce push était possible, il ne suffirait pas pour `#65` : la recette qu'il déclencherait
  jugerait le **rail**, qui ne porte pas la restauration `#65` (celle-ci vit sur le candidat
  `rebuild/carburants-65-20260922`/commit `1ba8b88`). `classement-gates-etat-git-62-65-1.md` §2/§3
  a déjà établi que ce candidat reste structurellement injugeable par une recette Test réelle tant
  que son `nexus-auth.js` code Supabase Production en dur et que l'isolation Test des branches
  candidates (`urlTestDeBranche()`, étudiée dans `etude-isolation-test-candidats-web-1.md`) n'a pas
  été portée — portage lui-même conditionné par `decision-2.md` de ce lot à une observation
  Cloudflare humaine préalable, non faite à ce jour.

**Conclusion** : la voie existe dans l'infrastructure, ne nécessite aucune nouvelle modification de
sécurité/secrets, mais s'applique au rail — pas au candidat `#65` — et ce canal n'a de toute façon
pas les droits pour l'emprunter. Aucune exécution n'a donc été tentée ; aucun secret n'a été lu,
demandé, copié ni exposé.

## 3. Geste minimal requis (pas un nouveau mécanisme)

Deux gestes distincts, tous deux hors de portée de ce canal :

1. **Isolation Test du candidat** (préalable, déjà scopé) : observation humaine du contenu réellement
   servi par Cloudflare Pages sur `rebuild/carburants-65-20260922` (tableau de bord Cloudflare),
   puis, si cette observation confirme l'absence de risque Production, portage des 4 fichiers de la
   chaîne de build déjà identifiés (`nexus-auth.js` refonte, `outils/build.sh`,
   `outils/generer-config.js`, `nexus-bandeau-environnement.js`) avec `urlTestDeBranche(
   'rebuild/carburants-65-20260922')`.
2. **Déclenchement CI sur ce candidat isolé**, par une session/un compte disposant de droits
   d'écriture sur ce dépôt — aucun nouveau secret à créer, les quatre PIN existent déjà.

Aucun des deux gestes n'implique de créer, lire ou faire tourner un secret ; les deux nécessitent
des droits (push/déploiement, accès Cloudflare) que ce canal n'a pas.

## 4. Gates `#65` — état, pas toutes closes

D'après `classement-gates-etat-git-62-65-1.md` §2, inchangé par cette session : attribution CI
fermée sur son point précis (§1 ci-dessus) ; recette navigateur toujours ouverte (§2/§3) ;
isolation Supabase Test des candidats toujours ouverte ; preuve de création réelle de la migration
`#65` toujours ouverte ; dérive de schéma Supabase Test toujours ouverte, séquencée après
l'isolation. **Le dossier de gate Production n'est donc pas préparé** — la condition explicite
« si toutes les gates `#65` deviennent closes » n'est pas remplie. Le lot racine distinct pour la
dette de classification d'accès n'est pas non plus ouvert : il est séquencé après le verdict
complet de `#65`, qui reste incomplet.

## Ce que cette session ne fait pas

Ne pousse rien vers `handoff-continuite-20260920` ni vers aucune branche candidate. Ne lit, ne
demande ni n'expose aucune valeur de PIN/secret. Ne déclenche aucun workflow. Ne masque, ne
supprime ni ne rend verte aucune dette. Ne rouvre aucune décision déjà rendue.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase, aucune promotion
Production, aucun secret lu ou exposé, aucune nouvelle règle métier/UX/rôle/RLS/sécurité, aucune
baisse de gate. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique.
