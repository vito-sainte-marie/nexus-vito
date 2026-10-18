<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE5-20261018/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE5-20261018
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
---
# SÉCURITÉ SECURITY DEFINER — Étape 5 : report en PRODUCTION des étapes 2 et 3 (17 `search_path`, 8 `REVOKE` de fonctions de trigger), avec migration de dépôt

Suite des étapes 1 à 4 (closes, **sur Test seulement**). Cette demande propose le report en **Production** de ce qui a été fait sur Test. **Aucun SQL d'écriture n'a été exécuté pour cette demande** ; seules des lectures de catalogue (SELECT, lecture seule) sur Production et sur le dépôt ont servi aux mesures. Rien n'est appliqué avant une décision matérialisée **et** un GO d'exécution distinct de Frédéric. Ni fusion, ni déploiement de l'application, ni modification de `claude.yml` ou des permissions GitHub, ni privilèges de `nexus_ci_recette`, ni GRANT.

## Constat mesuré (Production, lecture seule)

**Étape 1 (2 REVOKE anon) : déjà satisfaite en Production, rien à reporter.**
- `run_scheduled_inventory_reviews()` : ACL `{postgres}` seulement.
- `nexus_garde_regularisation_reception()` : ACL `{postgres,service_role}` (fermée à `anon` **et** à `authenticated`, fermeture jouée hors bande, voir `revoke-20261001160000`). Sur Test elle reste ouverte à `authenticated` : **cette ouverture-là n'est pas reportée** (Test est plus ouvert que Production).

**Étape 2 (17 fonctions `search_path`)** : les 17 fonctions de la demande Test (liste ci-dessous) existent en Production, SECURITY DEFINER, propriétaire `postgres`, `search_path=public` (aucune n'a `pg_temp`), ACL ouverte à `anon` comme avant.

**Étape 3 (8 fonctions de trigger)** : les 8 sont encore exécutables par `PUBLIC`, `anon` et `authenticated` en Production. Les triggers qui les portent sont tous `tgenabled=O`.

**Étape 4** : `nexus_identifiant_de_connexion(text)` reste exécutable par `anon` (decision-1 humaine `799e0401`). Elle est **hors de tout REVOKE** ; seul son `search_path` est reporté.

**Registre et dépôt** : le registre Production compte 319 lignes, dernière version `20261017130000`. Dépôt : `origin/production` a 313 fichiers de migration, dernier `20261017130000_releves_piste_debut_q1_et_ecart_nuit.sql` ; le rail en a 314 (la politique d'upload `20261017120000`, exclue de Production). Les 22 migrations jouées hors bande restent un écart connu et **non traité ici**.

## Effet attendu

- `SET search_path = public, pg_temp` résout les mêmes noms dans le même ordre ; `pg_temp` passe de premier à dernier ; aucune des 17 n'utilise de table temporaire. Aucun changement de comportement ni de droits.
- Les 8 REVOKE ferment l'appel direct des fonctions de trigger pour `PUBLIC`, `anon`, `authenticated`. Le moteur vérifie EXECUTE à la **création** du trigger, pas à son déclenchement : les 9 triggers continuent de fonctionner (prouvé sur Test à l'étape 3, 6 épreuves).

## SQL proposé (NON exécuté)

Une migration de dépôt, `supabase/migrations/20261018200000_securite_definer_search_path_et_triggers_fermes.sql`, une seule transaction (sans `BEGIN/COMMIT` dans le fichier, comme les autres migrations ; à l'exécution, enveloppée par la procédure ci-dessous).

```sql
-- 17 × (étape 2)
alter function public.carburant_resoudre_prix_achat_snapshot() set search_path = public, pg_temp;
alter function public.current_employee_role() set search_path = public, pg_temp;
alter function public.current_employee_site_id() set search_path = public, pg_temp;
alter function public.est_pompiste_du_jour(text) set search_path = public, pg_temp;
alter function public.est_receptionniste_livraison_du_jour(text, date) set search_path = public, pg_temp;
alter function public.fdj_sync_releve_apres_cash_control() set search_path = public, pg_temp;
alter function public.fdj_tracer_correction_stock_initial() set search_path = public, pg_temp;
alter function public.flag_modification_apres_validation() set search_path = public, pg_temp;
alter function public.flag_mouvement_non_justifie() set search_path = public, pg_temp;
alter function public.je_suis_createur() set search_path = public, pg_temp;
alter function public.nexus_clients_ecriture_ok(text) set search_path = public, pg_temp;
alter function public.nexus_clients_lecture_ok(text) set search_path = public, pg_temp;
alter function public.nexus_forcer_site_unique() set search_path = public, pg_temp;
alter function public.nexus_identifiant_de_connexion(text) set search_path = public, pg_temp;
alter function public.nexus_inventaire_detecter_conditionnement() set search_path = public, pg_temp;
alter function public.nexus_site_de_reference(text, text) set search_path = public, pg_temp;
alter function public.nexus_site_supprimable() set search_path = public, pg_temp;

-- 8 × (étape 3) — jamais nexus_identifiant_de_connexion, jamais nexus_garde_regularisation_reception
revoke execute on function public.carburant_resoudre_prix_achat_snapshot() from public, anon, authenticated;
revoke execute on function public.fdj_sync_releve_apres_cash_control() from public, anon, authenticated;
revoke execute on function public.fdj_tracer_correction_stock_initial() from public, anon, authenticated;
revoke execute on function public.flag_modification_apres_validation() from public, anon, authenticated;
revoke execute on function public.flag_mouvement_non_justifie() from public, anon, authenticated;
revoke execute on function public.nexus_forcer_site_unique() from public, anon, authenticated;
revoke execute on function public.nexus_inventaire_detecter_conditionnement() from public, anon, authenticated;
revoke execute on function public.nexus_site_supprimable() from public, anon, authenticated;
```

Pas de `CREATE OR REPLACE`, pas de DROP, pas de GRANT, pas de DDL de table.

**Fichier de migration (dépôt)** : DDL pur, idempotent (`ALTER FUNCTION … SET` et `REVOKE` rejouables sans effet), **sans garde** ni `BEGIN/COMMIT` ni écriture au registre. Il peut donc être rejoué sur Test (déjà conforme) sans erreur et ne dépend d'aucun état de Production.

**Procédure d'application en Production** (GO d'exécution distinct ; chemin praticable : connecteur Supabase `execute_sql`, rôle `postgres` ; `apply_migration` est exclu car il horodate lui-même ; `db push` vise Test) : une transaction unique

```sql
begin;
  select pg_advisory_xact_lock(hashtext('securite_definer_etape5'));
  -- garde 1 : version absente du registre, sinon raise exception (pas de double application)
  -- garde 2 : les 17 existent, SECURITY DEFINER, proconfig exactement {search_path=public}
  --           (après application elles valent public, pg_temp : un second passage échoue ici)
  -- garde 3 : les 8 fonctions de trigger sont ouvertes à public/anon/authenticated
  -- garde 4 : nexus_identifiant_de_connexion garde EXECUTE anon ; la garde de régularisation reste fermée
  -- corps du fichier de migration, octet pour octet (vérifié par sha256 contre le fichier du dépôt)
  insert into supabase_migrations.schema_migrations(version, name)
  values ('20261018200000', 'securite_definer_search_path_et_triggers_fermes');
commit;
```

Le registre Production a pour colonnes `version` (clé primaire), `name`, `statements`, `created_by`, `idempotency_key` (unique), `rollback` ; les dernières lignes (`20261017130000`, `20261017120000`, `20261016230000`) ne portent que `version` et `name` : l'insertion fait de même. L'estampille inscrite est celle du **fichier**. Aucune instruction non transactionnelle.

**Cohérence registre / base / dépôt** : (a) la garde 1 et la clé primaire interdisent la double inscription ; (b) les gardes 2 et 3 interdisent la double application du DDL ; (c) DDL et inscription sont dans la même transaction, la base ne peut montrer l'un sans l'autre ; (d) après exécution, relecture : une seule ligne `20261018200000`, 320 lignes, les 25 fonctions conformes, et le fichier du dépôt porte la même version et le même nom. Les 22 migrations jouées hors bande ne sont pas touchées.

## Ordre dépôt / base (décision de Frédéric retenue : le dépôt d'abord)

Principe retenu par Frédéric : **migration préparée, contrôlée et intégrée au dépôt avant toute application en Production**, sous réserve qu'aucun mécanisme de déploiement automatique ne l'exécute à la fusion.

Mesuré sur le dépôt (`origin/main`, `origin/production`, rail) : aucun workflow ne référence `supabase/migrations`, `db push` ni un secret de base de Production ; les seuls accès base du CI sont des secrets **Test** (`SUPABASE_TEST_DB_URL_WRITE`) ; pas de `supabase/config.toml` ; le déploiement de `production` est un job GitHub Pages qui publie des fichiers sans build ni SQL. **Non vérifiable depuis le dépôt** : une éventuelle intégration GitHub côté tableau de bord Supabase (branche liée à `production`). Frédéric doit la constater (projet Production, Integrations) **avant toute fusion** ; si elle est active, la fusion est suspendue.

Séquence proposée, chaque étape avec son propre GO :
1. **Préparation** (GO du 18/10) : fichier de migration + re-mesure de l'empreinte (`MIGRATIONS_REELLES_NOMBRE`/`_EMPREINTE`, commit séparé) + épreuves de manifeste, sur une branche et une PR **brouillon**. Aucune fusion.
2. Contrôle : CI verte sur la PR ; constat humain de l'absence d'intégration Supabase automatique.
3. Fusion dans `main` (GO), puis promotion vers `production` par PR (ruleset : PR obligatoire, `non-regression` et `Construire et éprouver l'artefact`). La garde d'ordre #70 refuse tout déploiement applicatif portant des migrations non qualifiées : la migration sera qualifiée avant. Fusionner ne déploie pas ; le déploiement est un GO distinct.
4. **Application en Production** par la procédure ci-dessus (GO d'exécution distinct), fichier déjà présent dans le dépôt.

Aucune des 25 instructions n'exige de code applicatif nouveau : l'ordre « code d'abord » ne s'applique pas.

## Préconditions (à relire le jour de l'exécution)

1. Rail relu : une décision matérialisée **et** un GO d'exécution de Frédéric couvrent cette opération, rien de contraire.
2. Relevé préalable enregistré en Production : ACL (`has_function_privilege` pour `public`, `anon`, `authenticated`, `service_role`) et `proconfig` des 25 fonctions ; `tgenabled` des 9 triggers ; comptes « SECDEF ouvertes à anon » et « fermées aux deux rôles » ; `proconfig` de **toutes** les SECURITY DEFINER (pour comparaison) ; dernier passage du job `nexus-inventaire-reviews` (jobid 2) ; version max et nombre de lignes du registre (319 attendu, sinon relire).
3. Les 17 signatures sont SECURITY DEFINER, propriétaire `postgres`, et portent exactement `search_path=public` ; les 8 fonctions de trigger sont ouvertes à `PUBLIC/anon/authenticated`. La garde SQL de la transaction abandonne sinon.
4. Fenêtre hors pic (locks de catalogue très courts, mais pas pendant une clôture de caisse).

## Postconditions (épreuves)

1. Les 17 ont `search_path=public, pg_temp` ; aucune n'a plus `public` seul.
2. Les 8 fonctions de trigger : ACL `{postgres,service_role}`, EXECUTE faux pour `public`/`anon`/`authenticated`, vrai pour `service_role` ; SECURITY DEFINER et propriétaire inchangés.
3. `nexus_identifiant_de_connexion(text)` : EXECUTE `anon` **toujours vrai** ; appel sous `anon` d'un prénom connu et unique renvoie son `username` (bloc lecture seule annulé).
4. `nexus_garde_regularisation_reception()` et `run_scheduled_inventory_reviews()` inchangées (toujours fermées à `anon` et `authenticated`).
5. 9 triggers `tgenabled=O`.
6. Appel direct des 8 sous `anon` et sous `authenticated` : 16 refus `42501`.
7. Fonctionnel sous `authenticated` dans un bloc annulé (compte de test uniquement, rien conservé) : insertion `shifts` et `inventaire_mouvements` passent. Aucune écriture de donnée réelle.
8. Job `nexus-inventaire-reviews` (jobid 2) : un passage `succeeded` postérieur à l'opération.
9. Comptes : fonctions de trigger ouvertes à `anon` 8→0 ; fermées aux deux rôles +8 ; `proconfig` de toutes les autres SECURITY DEFINER identique avant/après ; registre = 320 lignes, version `20261018200000`.
10. Connexion réelle de l'application : à constater par Frédéric (l'écran de connexion appelle la fonction sous `anon`), sans que je saisisse ni PIN ni identifiants.

## Risques

- Très faible pour les `ALTER FUNCTION … SET` (aucune table temporaire, aucun droit touché).
- Faible pour les REVOKE : prouvés sur Test. Écart possible Production ↔ Test : un trigger ou un appel RPC direct côté application d'une des 8 fonctions (aucun indice au dépôt : `grep` de leurs noms dans `rpc(` donne zéro). Le job `pg_cron` tourne en `postgres`, non touché.
- Registre : une estampille erronée créerait une nouvelle divergence ; d'où la version du fichier, relue avant insertion.
- Risque résiduel inchangé : l'oracle prénom → identifiant (étape 4, accepté).

## Retour arrière

Même transaction possible en sens inverse, par fonction :

```sql
alter function public.<nom>(<arguments>) set search_path = public;
grant execute on function public.<nom>() to public, anon, authenticated;  -- 8 fonctions de trigger
delete from supabase_migrations.schema_migrations where version = '20261018200000';
```

À ne rejouer qu'en cas d'échec constaté, sous GO.

## Ce qui reste hors de cette demande

Les 24 autres fonctions `search_path=public` (non exposées à `anon`) ; la suppression de l'oracle de connexion ; les 22 migrations hors bande ; fusion et déploiement de la PR de migration ; l'ouverture de la garde de régularisation à `authenticated` (non reportée).

## Question d'arbitrage

Autorisez-vous le report en **Production** des 17 `ALTER FUNCTION … SET search_path = public, pg_temp` et des 8 `REVOKE EXECUTE … FROM public, anon, authenticated` des fonctions de trigger, dans une transaction unique avec inscription au registre de la version du fichier de migration, sous les préconditions et postconditions ci-dessus, `nexus_identifiant_de_connexion` exclue de tout REVOKE ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes`. Rien n'est appliqué avant une décision matérialisée et un GO d'exécution distinct.
