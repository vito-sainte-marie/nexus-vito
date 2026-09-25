# Mécanisme CI proposé pour exécuter la baseline éphémère #65/#62 — conception, non appliqué

Répond à `decision-11.md` §4/§5 et à l'objectif 3 du réveil de reprise (25/09/2026) : « le plus
petit workflow déterministe permettant d'exécuter la baseline éphémère dans GitHub Actions avec
une image/service Supabase/Postgres appropriée, uniquement si cela n'exige ni nouveau coût ni
secret/sécurité ». Ce document est une **proposition**, pas une preuve : ce canal (`issue_comment`)
n'a pas la permission d'éditer `.github/workflows/*.yml` (restriction d'outil constante depuis le
06/09/2026, indépendante de toute autorisation Frédéric), et cette conception n'a donc pas pu être
testée en conditions CI réelles.

## 1. Pourquoi un service `postgres:` nu ne suffit pas — fait nouveau, vérifié dans cette session

`outils/reconstruire-base-test.sh` (inchangé, orchestré par `outils/reconstruire-baseline-candidat.sh`)
exécute, avant de rejouer les migrations :

```sql
grant usage on schema public to anon, authenticated, service_role;
...
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
```

Les rôles `anon`, `authenticated`, `service_role` — et le schéma `auth` (les migrations portent des
clés étrangères vers `auth.users`, ex. `employees_id_fkey`) — sont posés par la **plateforme**
Supabase à la création d'un projet, pas par les migrations versionnées de ce dépôt. Un simple
service container `postgres:16` de GitHub Actions ne les possède pas : la reconstruction échouerait
dès la remise à zéro du schéma, avant même la première migration. C'est le fait technique exact qui
explique — sans le contredire — pourquoi les lignées précédentes (`decision-11.md` §4,
`baseline-programme-stabilisation-1.json`) concluaient qu'un **projet Supabase** (au sens : une
instance qui possède déjà ces rôles/schémas) est nécessaire, pas seulement « une base Postgres ».

## 2. Piste retenue : la pile locale de la CLI Supabase, pas un projet hébergé

La CLI officielle `supabase` (`supabase/setup-cli`, action GitHub publique, gratuite, aucun compte
requis) démarre via Docker Compose une pile **entièrement locale et éphémère** — Postgres, Auth,
Storage, Kong — avec les rôles et schémas Supabase déjà en place, sans jamais contacter
supabase.com et sans identifiants. C'est structurellement différent d'un « nouveau projet Supabase
jetable » au sens où `decision-11.md`/`request-18.md` (lignée -2147) l'entendaient : aucune
ressource externe payante, aucun compte, aucun secret GitHub à créer — uniquement des conteneurs
Docker éphémères dans le runner, détruits en fin de job.

Coût : nul au-delà des minutes CI déjà consommées par ce workflow. Secret : aucun — l'URL de
connexion locale (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`, port par défaut de la
CLI) n'a rien de confidentiel : elle n'existe que le temps du job, sur une machine jetable, jamais
exposée au réseau externe.

## 3. Patch minimal proposé (à appliquer par une session avec droit d'édition sur `.github/workflows/`)

```yaml
  baseline-candidat-65:
    if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/handoff-continuite-20260920'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - name: Démarrer la pile Supabase locale (Docker, éphémère, aucun compte, aucun secret)
        run: |
          mkdir -p /tmp/supabase-local && cd /tmp/supabase-local
          supabase init
          supabase start
      - name: Résoudre NEXUS_TEST_DB_URL (local, jetable, non confidentiel)
        run: |
          cd /tmp/supabase-local
          echo "NEXUS_TEST_DB_URL=$(supabase status -o json | jq -r '.DB_URL')" >> "$GITHUB_ENV"
      - name: Reconstruire baseline #65 (Production + delta) sur la pile locale
        run: outils/reconstruire-baseline-candidat.sh reception-regularisation-20260919 supabase-cli-local-ephemere
      - name: Arrêter la pile (nettoyage, toujours exécuté)
        if: always()
        run: cd /tmp/supabase-local && supabase stop --no-backup
```

`supabase-cli-local-ephemere` n'est qu'une étiquette passée au script (ni `PROD_REF`
`uzhjpqpctpvxytxpxoqz`, ni `TEST_HISTORIQUE_REF` `udljdqxerrbbbajxubfn`) — les deux gardes de refus
du script restent actives et fail-closed sans modification.

## 4. Limites honnêtes de cette proposition

- **Non testée** : ce canal ne peut ni éditer le workflow ni, de façon fiable, reproduire un
  environnement CI GitHub Actions identique dans ce sandbox (Docker y est présent, mais y installer
  et lancer la CLI Supabase pour une preuve ponctuelle consommerait un temps et une bande passante
  disproportionnés pour une conception qui doit de toute façon être validée sur le vrai runner cible
  avant confiance — proposer une preuve locale non représentative serait pire que ne pas en avoir).
- **Fidélité Production non garantie à 100 %** : la pile locale de la CLI Supabase peut différer de
  la version exacte de Postgres/extensions utilisée par le projet Production réel
  (`uzhjpqpctpvxytxpxoqz`). C'est un écart mesurable (`supabase --version`, version Postgres locale
  vs Production) à consigner dans le retour de la première exécution réelle, pas à supposer nul.
- **N'élimine pas le besoin de la recette candidate** : reconstruire la baseline n'est que la moitié
  du mécanisme demandé par `decision-11.md` §4 (reconstruction + application migration + preuve +
  recette candidate). La recette navigateur authentifiée reste, elle, hors de portée de ce canal
  pour d'autres raisons déjà tracées (`etude-isolation-test-candidats-web-1.md`).

## 5. Ce que ce document ne fait pas

N'édite aucun fichier `.github/workflows/*.yml` (hors permission de ce canal). Ne crée, ne lit ni
n'expose aucun secret. N'exécute rien contre Production, le Test historique, ni aucune ressource
facturable. Ne referme pas la gate `#65` : `#65` reste `NO GO` jusqu'à exécution réelle et preuve.
