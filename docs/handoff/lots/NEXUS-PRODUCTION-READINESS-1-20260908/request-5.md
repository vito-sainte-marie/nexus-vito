---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 5
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: bug-trousseau-corrige
    classe: VERIFIED
    valeur: reconstruire-base-test.sh et repeter-lot-production-readiness-test.sh, NEXUS_TEST_DB_URL verifiee avant trousseau, 7/7 tests dont mutation negative sur le fichier pre-correctif reel
  - id: regression-suite
    classe: VERIFIED
    valeur: 232/241, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 1 finding connu NexusStock ARCH-002, guardian-qa 0 finding, apprentissage conforme 20 regles
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 29 lots, 10 avertissements preexistants, 0 nouvelle erreur
  - id: secrets-canal-absents
    classe: VERIFIED
    valeur: SUPABASE_TEST_DB_URL_WRITE NEXUS_TEST_DB_URL_WRITE NEXUS_TEST_DB_URL NEXUS_TEST_MANAGER_PIN NEXUS_TEST_CREATEUR_PIN tous absents verifie par test booleen sans lecture de valeur
  - id: patch-workflow-propose
    classe: DECLARED
    valeur: patch minimal exact documente dans request-5.md borne workflow_dispatch input explicite et config-par-environnement non applique faute de permission edition workflows
  - id: execution-reelle-clean-slate
    classe: NOT_APPLICABLE
    valeur: necessite edition et declenchement du workflow hors de portee de ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete aucun merge aucun deploiement
---
# request-5 — Répétition clean-slate Test : mécanisme corrigé, câblage CI restant

## Constat de départ (HEAD `73e69cdd8ef60b6aa571974706e3bb61bc66a5e4`)

Comme signalé dans le réveil : le run CI `34345673245` est vert, mais les
étapes connexion/semis/Playwright/recette Test y sont `skipped` (ce run n'a
pas eu lieu sur `config-par-environnement`) — ce vert n'est donc pas une
preuve de répétition clean-slate. La tentative de répétition manuelle
précédente s'était arrêtée à l'étape [1/4] pour une raison réseau (IPv6),
déjà corrigée sur ce HEAD par le commit `73e69cd` (direct d'abord, pooler
IPv4 en repli). L'état Test rapporté restait à 129/261 migrations rejouées,
sans dégât — le garde-fou "capture avant écriture" a tenu.

## Ce que ce lot a trouvé et corrigé (Test-only, outillage, Q76)

En vérifiant que `outils/repeter-lot-production-readiness-test.sh` serait
réellement exécutable depuis un runner CI une fois câblé — pas seulement
« prêt sur le papier » — un second bug réel, distinct de l'IPv6, a été
trouvé dans **les deux scripts** :

`outils/reconstruire-base-test.sh` (appelé par le script de répétition à
l'étape [2/4]) et `outils/repeter-lot-production-readiness-test.sh`
lui-même exigeaient tous les deux, **inconditionnellement**, le trousseau
macOS (`security find-generic-password`) **avant même de regarder** si
`NEXUS_TEST_DB_URL` était déjà fournie par l'appelant. Sur un runner GitHub
Actions (Linux, sans la commande `security`), les deux auraient donc échoué
systématiquement à la résolution du mot de passe — **y compris quand une
connexion valide était déjà disponible**. Autrement dit : même après avoir
câblé le secret Test existant dans un futur step CI, le mécanisme lui-même
aurait bloqué avant la première ligne utile.

**Corrigé** (commit sur cette branche, aucun secret créé/rotationné) : dans
les deux scripts, la vérification de `NEXUS_TEST_DB_URL` passe maintenant
**avant** toute exigence de trousseau ; le trousseau (et son repli portable
`NEXUS_TEST_DB_PASSWORD`) ne sont requis que si aucune URL n'est déjà
fournie. `PRODUCTION` reste refusée avant toute tentative de connexion,
inchangé.

**Preuves réellement exécutées** (pas tracées à la main — `node` fonctionne
dans ce canal) :
- `node test_reconstruction_sans_trousseau_20260909.js` (nouveau) — 7/7,
  dont une épreuve de syntaxe bash réelle (`bash -n`) sur les deux scripts
  et une **mutation négative réelle** : le texte du bug d'origine, rejoué
  contre `git show 73e69cd:outils/reconstruire-base-test.sh`, a d'abord été
  confirmé fautif (`iUrl(2721) > iKeychain(1298)` sur le fichier AVANT
  correction) avant d'écrire le correctif — pas une hypothèse.
- `node test_connexion_test_repli_20260909.js` — 6/6 (inchangé, toujours
  vert après le correctif).
- `node test_repetition_preserve_journal_20260909.js` — 10/10 (inchangé).
- `node run-tests.js` — 232/241, les 9 échecs strictement identiques à la
  liste historique tolérée par la CI, 0 régression.
- `node outils/guardians-router.js` — 1 finding, la collision `NexusStock`
  déjà connue et tracée (`ARCH-002`), non liée à ce lot.
- `node outils/guardian-qa.js` — 0 finding. `node outils/verifier-apprentissage.js` — conforme, 20 règles.
- `node outils/handoff.js verifier` — conforme (29 lots, 10 avertissements
  préexistants, 0 nouvelle erreur).

## Ce que ce canal ne peut toujours pas faire — confirmé, pas supposé

`SUPABASE_TEST_DB_URL_WRITE`, `NEXUS_TEST_DB_URL_WRITE`, `NEXUS_TEST_DB_URL`,
`NEXUS_TEST_MANAGER_PIN`, `NEXUS_TEST_CREATEUR_PIN` : **absents** de
l'environnement de cette session (vérifié par test booléen de présence,
sans jamais lire ni afficher de valeur). Conforme à ce que
`.github/workflows/claude.yml` documente lui-même. Ce canal ne peut donc ni
déclencher une exécution réelle du secret Test, ni la simuler sans la
fabriquer — ce que je n'ai pas fait.

Je n'ai pas non plus la permission d'éditer `.github/workflows/*.yml` dans
ce canal (restriction d'outil, indépendante de toute autorisation
Orchestrator/Frédéric).

## Le patch minimal exact à appliquer au workflow

Borné à `workflow_dispatch`, `config-par-environnement`, avec un input
explicite (pas déclenché par un dispatch « vide », pour qu'une répétition
destructrice ne soit jamais accidentelle) et un garde Production hérité du
script lui-même (`PROD_REF` codé en dur, comparé avant toute connexion).
Aucun nouveau secret : réutilise `SUPABASE_TEST_DB_URL_WRITE`, déjà
consommé par l'étape « Préparer la connexion PostgreSQL Test en écriture »,
en transmettant le `PGPASSWORD` déjà résolu et déjà masqué par cette même
étape — jamais une seconde lecture du secret, jamais une valeur nouvelle en
clair.

### 1) Ajouter un input à `workflow_dispatch` (fichier `.github/workflows/tests.yml`, autour de la ligne 46)

Remplacer :

```yaml
on:
  push:
    branches: ['**']
  pull_request:
  workflow_dispatch:
```

par :

```yaml
on:
  push:
    branches: ['**']
  pull_request:
  workflow_dispatch:
    inputs:
      repetition_test:
        description: >-
          Taper "oui" pour lancer la répétition clean-slate PREPROD-équivalente
          sur nexus-test (détruit puis reconstruit son schéma public à partir
          des migrations versionnées). Laisser vide pour une exécution normale
          de la suite — cette case ne déclenche RIEN par défaut.
        required: false
        default: ''
```

### 2) Insérer une nouvelle étape (fichier `.github/workflows/tests.yml`, juste avant `- name: Semer le scénario Carburants sur Supabase Test`, actuellement ligne 375)

Insérer, entre la fin de l'étape « Préparer la connexion PostgreSQL Test en
écriture » et le commentaire qui précède « Semer le scénario Carburants » :

```yaml
      # Destructrice par construction (drop schema public cascade) : bornée à
      # un déclenchement manuel EXPLICITE (l'input doit valoir "oui", un
      # dispatch "vide" ne fait rien) et à la seule branche canonique. Le
      # script refuse par lui-même toute référence au projet de Production
      # (PROD_REF codé en dur, comparé avant toute tentative de connexion) :
      # cette étape ne peut donc pas être détournée vers Production même en
      # cas d'erreur d'aiguillage. Réutilise le mot de passe déjà résolu et
      # déjà masqué par l'étape précédente — jamais une seconde lecture du
      # secret, jamais de nouvelle valeur en clair.
      - name: Répétition clean-slate PREPROD-équivalente sur nexus-test (déclenchement manuel)
        if: github.ref == 'refs/heads/config-par-environnement' && github.event_name == 'workflow_dispatch' && github.event.inputs.repetition_test == 'oui' && env.NEXUS_SEMIS_DISPONIBLE == '1'
        shell: bash
        run: |
          set -euo pipefail
          NEXUS_TEST_DB_PASSWORD="$PGPASSWORD" outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn
```

### Pourquoi cet emplacement et pas un job séparé

Les variables `PGHOST`/`PGPASSWORD`/`PGDATABASE`/`PGUSER`/`PGSSLMODE` sont
déjà résolues et masquées par l'étape précédente (« Préparer la connexion
PostgreSQL Test en écriture ») et persistent pour toute la suite du job via
`$GITHUB_ENV`. Un job séparé devrait dupliquer cette résolution — un second
risque d'écart, exactement le genre de duplication que ce dépôt évite
ailleurs (cf. `ARCH-002`, la collision `NexusStock`). En réutilisant
`$PGPASSWORD` déjà exporté, la nouvelle étape ne lit le secret qu'une seule
fois, au même endroit que tout le reste de la suite.

Après cette étape, le pipeline existant continue sans modification :
« Semer le scénario Carburants » réensemence le scénario métier (le
réensemencement interne du script de répétition ne couvre que
sites/station_config/employees/journal Live, pas `audits_caisse`),
« Publier le journal NEXUS Live », « Installer Playwright » et « Recette
navigateur NEXUS Test » s'exécutent déjà inconditionnellement sur
`config-par-environnement` — ils constituent la preuve de bout en bout déjà
prévue par `decision-4.md`, sans qu'il soit nécessaire de les dupliquer ou
de les modifier.

### Garde Production — triple, pas simple

1. Le workflow entier ne s'exécute sur du contenu Test que si
   `github.ref == 'refs/heads/config-par-environnement'` (jamais `main`).
2. L'étape ne s'active que sur `workflow_dispatch` avec l'input explicite
   `repetition_test == 'oui'` — jamais sur un `push`/`pull_request`.
3. Le script lui-même refuse toute référence au `PROD_REF` codé en dur
   (`uzhjpqpctpvxytxpxoqz`) avant toute tentative de connexion — la
   référence passée en argument (`udljdqxerrbbbajxubfn`) est écrite en
   clair dans le patch, jamais déduite ni interpolée depuis une variable
   modifiable par un déclencheur externe.

## Ce qui reste à faire, honnêtement

1. Une session/humain avec droit d'édition sur `.github/workflows/*.yml`
   doit appliquer ce patch sur `config-par-environnement`.
2. Un déclenchement `workflow_dispatch` avec `repetition_test: oui` doit
   ensuite être lancé pour obtenir la première exécution réelle — cette
   session ne peut ni éditer le workflow ni le déclencher utilement (le
   déclencher sans le patch reproduirait seulement `34345673245`).
3. Après ce run, vérifier explicitement : reconstruction complète (238
   migrations, comme `ead824c` l'a déjà prouvé en local), réensemencement,
   4 comptes de recette et leur rattachement, conservation du journal Live
   (`actor_role='human'` compris), suite complète, Guardians, recette
   navigateur réelle — tous déjà couverts par les assertions statiques et
   dynamiques existantes (`test_repetition_preserve_journal_20260909.js`,
   `test_reconstruction_sans_trousseau_20260909.js`, la suite du script
   lui-même à l'étape [4/4]), mais non encore observés en conditions
   réelles sur `nexus-test`.
4. Les re-mesures Production SELECT-only (`re-mesure-finale-gate-1.md`) et
   la gate finale Frédéric restent, comme convenu, hors de ce lot tant que
   ce point 3 n'est pas acquis.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production, aucun déploiement réel, aucun rollback Production, aucune
donnée personnelle Production, aucune nouvelle ressource facturable, aucun
secret créé/rotationné/exposé (valeur jamais lue ni affichée), aucun
fichier `.github/workflows/*` créé ou modifié par cette session. Migration
21 reste exclue de la release Production, inchangée par ce lot.
