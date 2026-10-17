---
protocol: nexus-handoff/2
kind: request
lot_id: JOURNAL-PISTE-20261017
seq: 3
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
  - id: arbitrage-humain
    classe: HUMAN
    valeur: Frédéric, arbitrage sur request-2 : STOP_REQUIRED legitime conserve ; corrections et preuves avant GO d'execution ; principe d'architecture valide ; ni migration ni GRANT autorises
  - id: preuve-jetable-109-ok
    classe: VERIFIED
    valeur: preuve-journal-piste-rls-test.sql rejouee sur base jetable locale isolee : 109 OK 0 KO sur la migration finale ; 106 OK 3 KO (A1,C6,P6) sur la migration de request-2
  - id: mesure-test-lecture-seule
    classe: VERIFIED
    valeur: Test udljdqxerrbbbajxubfn, select de catalogue : pg_cron 1.6.4 ; 2 jobs existants user postgres ; current_employee_* secdef search_path=public EXECUTE anon+authenticated ; TEMP accorde a authenticated
  - id: sql-final
    classe: VERIFIED
    valeur: commit local e8c9bd04 (wt-cause) ; migration et preuve integrees au corps ; non executees sur Test
---
# JOURNAL PISTE — Revue de sécurité, preuves complémentaires et SQL corrigé (TEST exclusivement, rien exécuté sur Test)

Suite de l'arbitrage humain de Frédéric sur request-2 (`5fb448ab`). Le STOP_REQUIRED `SECRET_PERMISSION_SURFACE_SECURITE` est **légitime et conservé dans l'historique** du Handoff. Décision humaine : « corrections et preuves complémentaires avant GO d'exécution » ; principe de l'architecture validé (trois tables dédiées, lecture réservée aux managers/gérants du site, aucune écriture directe client, écritures par fonctions privilégiées, contrôle automatique du relevé manquant, conservation des configurations historiques). **Ni application de la migration, ni nouveau GRANT, ni job planifié, ni fusion, ni Production n'est demandé ici.** Aucun SQL d'écriture n'a été exécuté sur Test ; seules des lectures de catalogue l'ont été (§4). Les preuves ont été jouées sur une **base jetable locale** (conteneur Postgres isolé), jamais sur Test. Les privilèges de `nexus_ci_recette` ne sont pas touchés.

## Preuve des conditions de decision-1

1. **Aucun SQL exécuté avant nouvel arbitrage** — tenue : sur Test, uniquement des `select` de catalogue (extensions, `cron.job`, `pg_proc`, privilèges). Aucun DDL, GRANT, job.
2. **Contenu exigé (SQL exact, RLS, grants, fonctions, planification, preuves rejouables)** — présent : migration finale complète (§A), preuve complète (§B), diff explicite par rapport à request-2 (§C).
3. **Site dérivé de l'appelant** — maintenu et renforcé (helpers propres au lot, voir §1).
4. **Test exclusivement, sans fusion ni Production** — tenue.
5. **Échelle physique** — inchangée : « +1 correspond à un litre » (Frédéric, 17/10/2026) ; le litrage Verify/pupitre reste la référence.

## 1. Revue de sécurité des fonctions SECURITY DEFINER (point 1)

Constat **mesuré** (jetable et catalogue de Test, lecture) : `current_employee_role()` et `current_employee_site_id()` — réutilisés par request-2 — sont `SECURITY DEFINER`, propriétaire `postgres`, `search_path=public`, **EXECUTE accordé à `anon` et `authenticated`**, et lisent `employees` **sans qualification de schéma**. Avec `search_path=public`, `pg_temp` est cherché **en premier** pour les relations : tout rôle disposant du privilège TEMP (`authenticated` l'a sur Test, mesuré) peut faire `create temp table employees(...)` avec son propre `id`/`role`/`site_id` et **usurper** l'identité vue par ces helpers. Avec request-2, la RLS de lecture et les fonctions d'écriture dépendaient de ces helpers : un pompiste pouvait donc se faire passer pour manager d'un autre site pour **lire** les alertes (cas A1 : « autorise » sur request-2).

Faiblesses relevées et corrigées dans le SQL final :
- **F-1 (usurpation par table temporaire)** : deux helpers propres au lot, `piste_site_appelant()` / `piste_role_appelant()`, qui lisent `public.employees` **qualifié**, avec `search_path = pg_catalog, public, pg_temp` (pg_temp en dernier), `revoke all … from public, anon, authenticated`. Toutes les fonctions du lot passent par eux.
- **F-2 (search_path)** : toutes les fonctions du lot (SECURITY DEFINER ou non, y compris triggers) passent à `pg_catalog, public, pg_temp`.
- **F-3 (verdict inconcluant)** : en request-2, un verdict « non contrôlé » ou « impossible » (donnée manquante, relevés contradictoires, configuration changée) **résolvait** l'alerte. Désormais seul un verdict concluant (`conforme|tolere|anomalie`) ouvre ou résout (cas C6).
- **Signalement hors périmètre, non corrigé ici** : les helpers partagés `current_employee_*` restent exposés à la même usurpation pour **tout autre usage existant** (Test, et à mesurer en lecture seule en Production). Les corriger touche une surface partagée : **hors lot, à arbitrer séparément**. Le lot n'en dépend plus.

Droits d'exécution et dépendances (tout `revoke all … from public, anon, authenticated` puis `grant execute` ciblé) :

| Fonction | Rôle | EXECUTE client | Dépend de |
|---|---|---|---|
| `piste_site_appelant`, `piste_role_appelant` | identité | aucun (appelées depuis des fonctions du même propriétaire) | `auth.uid()`, `public.employees` |
| `piste_manager_du_site(text)` | RLS lecture | `authenticated` (pas de capacité d'écriture) | helpers ci-dessus |
| `enregistrer_config_piste`, `qualifier_alerte_piste`, `evaluer_controles_piste` | écritures contrôlées | `authenticated`, contrôle manager/gérant du site de l'appelant, fail-closed si `auth.uid()` nul | helpers, tables du lot |
| `piste_evaluer_site(text,date)`, `evaluer_tous_sites_piste()`, `piste_poser_alerte`, `piste_releve_final`, `piste_comparer`, triggers | internes | **aucun** | `calculer_horaires_quart`, tables du lot |

## 2. Preuve de refus pour anon, pompistes et managers d'autres stations (point 2)

Jouée sur base jetable, transaction annulée, **109 cas OK, 0 KO** (§B). Acteurs : manager et gérant du site A (`preuve-a`), pompiste du site A, manager du site B (`preuve-b`), `anon`. Refus prouvés : SELECT, INSERT, UPDATE, DELETE, TRUNCATE sur les trois tables, appel des trois fonctions d'écriture et des fonctions internes, pour `anon`, pompiste et manager d'un autre site ; cas A1–A4 : **même avec une table temporaire `employees` usurpatrice**, un pompiste ou un manager du site B ne lit, n'enregistre ni ne qualifie rien sur le site A ; A5–A6 : helpers d'identité non exécutables par un client ni par `anon`. Postconditions catalogue (P1–P7) : aucun grant `anon`/PUBLIC, aucun droit `authenticated` autre que SELECT, RLS active sur les 3 tables, aucune fonction SECURITY DEFINER sans `search_path`, `pg_temp` dernier dans toutes les fonctions du lot, aucun EXECUTE `anon` ni `authenticated` sur les helpers d'identité.

**Les épreuves mordent** (rejouées contre la migration de request-2) : 106 OK / 3 KO — A1 (« autorise » au lieu de « refuse »), C6 (alerte résolue à tort) et P6 (14 fonctions avec `pg_temp` non dernier). Sur la migration finale : 109/109. Limite honnête : A2–A4 ne se distinguent pas entre request-2 et la version finale sur cette base (le refus venait d'un autre garde-fou) ; elles restent des cas de non-régression, pas de preuve de la correction — seuls A1, C6 et P6 le démontrent. Les mutations plus fines (retirer chaque `revoke`, rouvrir un `grant`) n'ont pas été rejouées une à une dans ce lot ; à ajouter si l'arbitre le juge nécessaire.

## 3. Autorisation d'un manager et d'un gérant du bon site (point 3)

Cas L (lecture), W/E (écriture) et Q (qualification) : le manager `a1` et le gérant `a2` du site A lisent les trois tables de **leur** site, enregistrent une configuration (version incrémentée, `avant` conservé, auteur posé par le serveur), qualifient une alerte (choix fermé ; une correction est une **nouvelle** ligne `remplace_id`) et déclenchent `evaluer_controles_piste()` pour leur seul site. Les mêmes actes visant le site B sont refusés. Aucun UPDATE/DELETE possible par un client.

## 4. pg_cron : planification, rôle d'exécution, absence d'accès client (point 4)

**Mesuré en lecture seule sur Test** : `pg_cron 1.6.4` installé ; deux jobs existants (`nexus-simulateur-caisse`, `nexus-inventaire-reviews`), tous deux `*/15 * * * *`, **utilisateur `postgres`**, actifs. Le job du lot serait `nexus-journal-piste`, `*/5 * * * *`, planifié par le rôle qui exécute la migration (le même `postgres`, comme les jobs existants), commande `select public.evaluer_tous_sites_piste();`, précédé d'un `unschedule` du même nom (idempotence, rejouable). `evaluer_tous_sites_piste()` et `piste_evaluer_site()` ne sont exécutables par **aucun** rôle client (cas P5, A5/A6 et refus des fonctions internes) ; un client ne peut pas non plus lire ni modifier `cron.job` (schéma `cron` non accordé à `authenticated`/`anon`, à confirmer par la postcondition ci-dessous). Postconditions proposées après exécution (non exécutées) : un seul job nommé `nexus-journal-piste`, `username=postgres`, `active=true` ; zéro EXECUTE client sur les fonctions internes ; `has_schema_privilege('authenticated','cron','usage')` faux.

## 5. Scénarios de modification de configuration entre deux relevés (point 5)

Chaque relevé porte une **photographie immuable** de la configuration courante à son insertion (`config_snapshot`, posée par le serveur, non modifiable). Prouvés (C1–C7) :
- **C1/C2** config stable, 12 L d'écart → alerte ouverte ; rejeu idempotent (une seule ligne).
- **C3/C3b** une version ultérieure de la configuration n'altère ni le verdict ni les photographies déjà posées (la version 1 est conservée).
- **C4/C4b** disposition des pompes modifiée entre les deux relevés → aucune alerte et verdict **« impossible »**, jamais « conforme ».
- **C5** seuil relevé 10 → 20 L, écart 15 L → toléré, pas d'alerte (la comparaison utilise la photographie, pas la configuration courante).
- **C6** relevés finaux contradictoires → alerte laissée ouverte (correction F-3).
- **C7** relevé sans photographie → « non contrôlé ».
Pas de dates d'effet futures : la version courante est la plus récente.

## 6. Limites de la preuve RLS actuelle et stratégie de test (point 6)

Limites : la base jetable **n'est pas Test**. Écarts connus : `auth.uid()` y lit `request.jwt.claim.sub` (ancien format) — le harnais pose les deux formats ; `nexus_ci_recette` et les rôles Supabase complets sont absents ; `calculer_horaires_quart` y est une version **réduite** (quart1/quart2) et sensible à une table temporaire `station_config` (impact limité au site de l'appelant, aucune écriture) ; les 22 migrations sans fichier et les triggers non liés au lot ne sont pas rejoués ; le comportement de PostgREST/JWT réel n'est pas exercé. Une recette locale **ne vaut donc pas preuve de compatibilité complète avec Test**.

Stratégie sans élargir les permissions de la CI distante : (a) la **preuve §B reste la même** et tourne dans un conteneur Postgres jetable en CI (aucun accès à Test, aucun secret) ; (b) après un éventuel GO, la même preuve est rejouée **sur Test en transaction annulée**, via `execute_sql`, par le rôle déjà autorisé, **avant** (échec propre : tables absentes) et **après** l'application, avec les postconditions catalogue (P1–P7, job cron) ; (c) les écarts de fidélité ci-dessus sont listés dans l'en-tête de la preuve pour que tout KO soit lu avec eux. Aucun GRANT supplémentaire à `nexus_ci_recette`, aucun nouveau secret.

## 7. Diff explicite par rapport à request-2 (point 7)

Synthèse : (1) deux helpers d'identité propres au lot ; (2) `search_path = pg_catalog, public, pg_temp` sur toutes les fonctions ; (3) `piste_manager_du_site`, `enregistrer_config_piste`, `evaluer_controles_piste` passent par les nouveaux helpers ; (4) `piste_evaluer_site` : seul un verdict concluant ouvre ou résout. Aucun changement de tables, de colonnes, de grants de tables, de RLS ni de planification.

### 7.1 Diff de la migration (`diff -u` request-2 → finale)

```diff
--- request-2-migration.sql	2026-10-17 18:22:15
+++ wt-cause/supabase/migrations/20261017140000_journal_piste_config_alertes_qualifications.sql	2026-10-17 18:24:22
@@ -6,7 +6,7 @@
 --   • le site n'est JAMAIS un paramètre qui fait autorité : les deux fonctions
 --     appelables par un utilisateur (`enregistrer_config_piste`,
 --     `qualifier_alerte_piste`) et `evaluer_controles_piste()` le déduisent de
---     l'identité de l'appelant (current_employee_site_id()). Les seules
+--     l'identité de l'appelant (piste_site_appelant()). Les seules
 --     fonctions qui reçoivent un site en paramètre (`piste_evaluer_site`,
 --     `evaluer_tous_sites_piste`) ne sont exécutables par NI anon NI
 --     authenticated : seul le propriétaire (tâche planifiée) les appelle.
@@ -25,15 +25,39 @@
 -- ---------------------------------------------------------------------
 -- 1. Habilitation unique (réutilise les helpers existants, fail-closed)
 -- ---------------------------------------------------------------------
+-- Identité de l'appelant : helpers PROPRES au lot. Les helpers partagés
+-- current_employee_role()/current_employee_site_id() lisent `employees` non
+-- qualifié avec search_path = public : pg_temp est alors cherché en premier et
+-- une table temporaire `employees` créée par l'appelant usurpe son rôle (mesuré
+-- sur la base jetable, voir request-3). Ici : tout est qualifié, pg_temp en dernier.
+create or replace function public.piste_site_appelant()
+ returns text
+ language sql
+ stable security definer
+ set search_path to pg_catalog, public, pg_temp
+as $$
+  select e.site_id from public.employees e where e.id = auth.uid();
+$$;
+create or replace function public.piste_role_appelant()
+ returns text
+ language sql
+ stable security definer
+ set search_path to pg_catalog, public, pg_temp
+as $$
+  select e.role from public.employees e where e.id = auth.uid();
+$$;
+revoke all on function public.piste_site_appelant() from public, anon, authenticated;
+revoke all on function public.piste_role_appelant() from public, anon, authenticated;
+
 create or replace function public.piste_manager_du_site(p_site text)
  returns boolean
  language sql
  stable security definer
- set search_path to 'public'
+ set search_path to pg_catalog, public, pg_temp
 as $$
   select p_site is not null
-     and p_site = public.current_employee_site_id()
-     and public.current_employee_role() = any (array['manager', 'gerant']);
+     and p_site = public.piste_site_appelant()
+     and public.piste_role_appelant() = any (array['manager', 'gerant']);
 $$;
 comment on function public.piste_manager_du_site(text) is
   'Vrai seulement si l''appelant est manager ou gérant ET que p_site est SON site. Sert à la RLS de lecture ; ne confère aucune autorité sur un autre site.';
@@ -98,7 +122,7 @@
 
 -- Le site d'une qualification est hérité de l'alerte, jamais fourni.
 create or replace function public.piste_qualification_heriter_site()
- returns trigger language plpgsql security definer set search_path to 'public'
+ returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   select a.site into new.site from public.carburant_index_alertes a where a.id = new.alerte_id;
@@ -114,7 +138,7 @@
 -- change ni son identité ni son constat d'origine (statut/clôture/niveau/constat
 -- à jour seulement, par les fonctions).
 create or replace function public.piste_interdire_modification()
- returns trigger language plpgsql set search_path to 'public'
+ returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   raise exception 'APPEND_ONLY % %', tg_table_name, tg_op using errcode = 'P0001';
@@ -127,7 +151,7 @@
   for each row execute function public.piste_interdire_modification();
 
 create or replace function public.piste_alerte_garde_identite()
- returns trigger language plpgsql set search_path to 'public'
+ returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   if tg_op = 'DELETE' then raise exception 'APPEND_ONLY carburant_index_alertes DELETE' using errcode = 'P0001'; end if;
@@ -172,7 +196,7 @@
   'Photographie immuable de la configuration piste courante {version, config} au moment de l''insertion du relevé. Posée par le serveur (un client ne peut pas la fournir) ; NULL = relevé antérieur à la configuration versionnée (jamais comparé).';
 
 create or replace function public.piste_releve_photographier()
- returns trigger language plpgsql security definer set search_path to 'public'
+ returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   new.config_snapshot := (
@@ -187,7 +211,7 @@
   for each row execute function public.piste_releve_photographier();
 
 create or replace function public.piste_releve_snapshot_immuable()
- returns trigger language plpgsql set search_path to 'public'
+ returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   if new.config_snapshot is distinct from old.config_snapshot then
@@ -207,10 +231,10 @@
  returns integer
  language plpgsql
  security definer
- set search_path to 'public'
+ set search_path to pg_catalog, public, pg_temp
 as $$
 declare
-  v_site text := public.current_employee_site_id();
+  v_site text := public.piste_site_appelant();
   v_avant jsonb;
   v_version integer;
 begin
@@ -250,7 +274,7 @@
  returns uuid
  language plpgsql
  security definer
- set search_path to 'public'
+ set search_path to pg_catalog, public, pg_temp
 as $$
 declare
   v_alerte public.carburant_index_alertes%rowtype;
@@ -291,7 +315,7 @@
 -- Relevé final d'un moment : {etat: aucun|conflit|ok, snapshot, vals}.
 create or replace function public.piste_releve_final(p_site text, p_date date, p_moment text)
  returns jsonb
- language plpgsql stable set search_path to 'public'
+ language plpgsql stable set search_path to pg_catalog, public, pg_temp
 as $$
 declare
   v_n int; v_distincts int; v_snap jsonb; v_vals jsonb;
@@ -316,7 +340,7 @@
 -- Retourne {etat, raison, lignes[]} avec etat in conforme|tolere|anomalie|non_controle|impossible.
 create or replace function public.piste_comparer(p_a jsonb, p_b jsonb)
  returns jsonb
- language plpgsql immutable set search_path to 'public'
+ language plpgsql immutable set search_path to pg_catalog, public, pg_temp
 as $$
 declare
   v_cfg jsonb; v_echelle numeric; v_tol numeric; v_seuil numeric;
@@ -376,7 +400,7 @@
 create or replace function public.piste_poser_alerte(
   p_site text, p_type text, p_evenement text, p_niveau text, p_present boolean, p_constat jsonb, p_raison text)
  returns void
- language plpgsql security definer set search_path to 'public'
+ language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 begin
   if p_present then
@@ -401,7 +425,7 @@
 -- evaluer_controles_piste() qui impose le site de l'appelant.
 create or replace function public.piste_evaluer_site(p_site text, p_date date)
  returns void
- language plpgsql security definer set search_path to 'public'
+ language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 declare
   v_tz text; v_cfg jsonb; v_delai int; v_res jsonb; v_present boolean;
@@ -417,14 +441,20 @@
   v_a := public.piste_releve_final(p_site, p_date, 'fin_q1');
   v_b := public.piste_releve_final(p_site, p_date, 'debut_q2');
   v_res := public.piste_comparer(v_a, v_b);
-  v_present := v_res ->> 'etat' = 'anomalie';
-  perform public.piste_poser_alerte(p_site, 'passation', p_date::text, 'orange', v_present, v_res, 'Recalcul sur relevés finaux : plus d''écart.');
+  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
+  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
+  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
+    perform public.piste_poser_alerte(p_site, 'passation', p_date::text, 'orange', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
+  end if;
 
   v_a := public.piste_releve_final(p_site, p_date - 1, 'fin_q2');
   v_b := public.piste_releve_final(p_site, p_date, 'debut_q1');
   v_res := public.piste_comparer(v_a, v_b);
-  v_present := v_res ->> 'etat' = 'anomalie';
-  perform public.piste_poser_alerte(p_site, 'nuit', p_date::text, 'rouge', v_present, v_res, 'Recalcul sur relevés finaux : plus d''écart.');
+  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
+  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
+  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
+    perform public.piste_poser_alerte(p_site, 'nuit', p_date::text, 'rouge', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
+  end if;
 
   -- Relevé de fin manquant : fin de quart (calculer_horaires_quart, moteur unique)
   -- + délai de la configuration courante, au fuseau du site.
@@ -460,10 +490,10 @@
 -- Appel manager : site déduit de l'appelant, deux jours (aujourd'hui et hier, fuseau du site).
 create or replace function public.evaluer_controles_piste()
  returns void
- language plpgsql security definer set search_path to 'public'
+ language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 declare
-  v_site text := public.current_employee_site_id();
+  v_site text := public.piste_site_appelant();
   v_tz text; v_jour date;
 begin
   if auth.uid() is null or not public.piste_manager_du_site(v_site) then
@@ -484,7 +514,7 @@
 -- Tâche planifiée : tous les sites, indépendante de l'ouverture du Journal.
 create or replace function public.evaluer_tous_sites_piste()
  returns void
- language plpgsql security definer set search_path to 'public'
+ language plpgsql security definer set search_path to pg_catalog, public, pg_temp
 as $$
 declare
   r record; v_jour date;
```

### 7.2 Diff de la preuve (`diff -u` request-2 → finale)

```diff
--- req2-preuve.sql	2026-10-17 18:26:27
+++ wt-cause/supabase/preuves/preuve-journal-piste-rls-test.sql	2026-10-17 18:24:48
@@ -1,4 +1,3 @@
-
 -- =====================================================================
 -- Preuve rejouable — Journal Piste (TEST SEULEMENT)
 -- À jouer APRÈS la migration 20261017140000, en une transaction ANNULÉE
@@ -15,13 +14,13 @@
 -- Acteurs fictifs : deux sites, un manager par site, un gérant, un pompiste.
 -- (adapter les colonnes à employees si le schéma Test diffère ; c'est le seul
 -- point de la preuve qui dépend d'un fait à mesurer sur Test avant exécution.)
-insert into public.sites (site_id, timezone) values ('preuve-a', 'America/Martinique'), ('preuve-b', 'America/Martinique')
+insert into public.sites (site_id, nom_entreprise, timezone) values ('preuve-a', 'Preuve A', 'America/Martinique'), ('preuve-b', 'Preuve B', 'America/Martinique')
   on conflict do nothing;
-insert into public.employees (id, site, role, prenom, nom, actif) values
-  ('00000000-0000-0000-0000-0000000000a1', 'preuve-a', 'manager', 'MgrA', 'Preuve', true),
-  ('00000000-0000-0000-0000-0000000000a2', 'preuve-a', 'gerant',  'GerA', 'Preuve', true),
-  ('00000000-0000-0000-0000-0000000000a3', 'preuve-a', 'pompiste', 'PompA', 'Preuve', true),
-  ('00000000-0000-0000-0000-0000000000b1', 'preuve-b', 'manager', 'MgrB', 'Preuve', true);
+insert into public.employees (id, username, site_id, role, nom, actif) values
+  ('00000000-0000-0000-0000-0000000000a1', 'preuve-a1', 'preuve-a', 'manager', 'Preuve MgrA', true),
+  ('00000000-0000-0000-0000-0000000000a2', 'preuve-a2', 'preuve-a', 'gerant', 'Preuve GerA', true),
+  ('00000000-0000-0000-0000-0000000000a3', 'preuve-a3', 'preuve-a', 'pompiste', 'Preuve PompA', true),
+  ('00000000-0000-0000-0000-0000000000b1', 'preuve-b1', 'preuve-b', 'manager', 'Preuve MgrB', true);
 
 -- Une configuration et une alerte de preuve, posées en tant que propriétaire.
 insert into public.carburant_index_config (site, version, config) values
@@ -29,6 +28,10 @@
 insert into public.carburant_index_alertes (id, site, type, evenement, niveau, constat) values
   ('00000000-0000-0000-0000-00000000aaaa', 'preuve-a', 'passation', '2026-10-17', 'orange', '{}');
 
+-- Un relevé posé par le propriétaire : sans lui, S1 (UPDATE sur zéro ligne) « réussirait » à vide.
+insert into public.carburant_index_releves (id, site, date, moment, statut, auteur)
+  values ('00000000-0000-0000-0000-00000000bbbb', 'preuve-a', current_date, 'debut_q1', 'brouillon', '00000000-0000-0000-0000-0000000000a3');
+
 -- Helper : joue une instruction sous un rôle/identité, consigne OK si elle
 -- lève (refus attendu) ou si elle aboutit (autorisation attendue).
 create or replace function pg_temp.jouer(p_cas text, p_role text, p_uid text, p_sql text, p_attendu text)
@@ -37,6 +40,7 @@
 begin
   execute format('set local role %I', p_role);
   perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
+  perform set_config('request.jwt.claim.sub', p_uid, true); -- auth.uid() ancien format ET nouveau (le banc doit couvrir les deux)
   begin
     execute p_sql;
   exception when others then v_obtenu := 'refuse';
@@ -54,6 +58,7 @@
 begin
   execute format('set local role %I', p_role);
   perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
+  perform set_config('request.jwt.claim.sub', p_uid, true); -- auth.uid() ancien format ET nouveau (le banc doit couvrir les deux)
   begin
     select count(*) into v_n from public.carburant_index_alertes;
     v_obtenu := v_n::text;
@@ -148,6 +153,88 @@
 select pg_temp.jouer('S1 UPDATE config_snapshot d''un relevé (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
   $q$update public.carburant_index_releves set config_snapshot = '{"x":1}' where config_snapshot is null and false or id in (select id from public.carburant_index_releves limit 1)$q$, 'refuse');
 
+
+-- ---- USURPATION D'IDENTITÉ PAR TABLE TEMPORAIRE (revue SECURITY DEFINER) -------------
+-- Un pompiste crée pg_temp.employees se déclarant manager de son site, puis agit.
+-- Avant durcissement (helpers current_employee_* à search_path=public) : « autorise ».
+select pg_temp.jouer('A1 pompiste + temp employees lit les alertes', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
+  $q$create temp table employees (id uuid, role text, site_id text);
+     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
+     do $i$ begin if (select count(*) from public.carburant_index_alertes) = 0 then raise exception 'rien visible'; end if; end $i$$q$, 'refuse');
+select pg_temp.jouer('A2 pompiste + temp employees enregistre une config', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
+  $q$create temp table employees (id uuid, role text, site_id text);
+     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
+     select public.enregistrer_config_piste('{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}'::jsonb, 'usurpation')$q$, 'refuse');
+select pg_temp.jouer('A3 pompiste + temp employees qualifie une alerte', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
+  $q$create temp table employees (id uuid, role text, site_id text);
+     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
+     select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
+select pg_temp.jouer('A4 manager de B + temp employees lit le site A', 'authenticated', '00000000-0000-0000-0000-0000000000b1',
+  $q$create temp table employees (id uuid, role text, site_id text);
+     insert into employees values ('00000000-0000-0000-0000-0000000000b1', 'manager', 'preuve-a');
+     do $i$ begin if (select count(*) from public.carburant_index_alertes) = 0 then raise exception 'rien visible'; end if; end $i$$q$, 'refuse');
+select pg_temp.jouer('A5 helpers d''identité non exécutables par un client', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
+  $q$select public.piste_site_appelant()$q$, 'refuse');
+select pg_temp.jouer('A6 helpers d''identité non exécutables par anon', 'anon', '00000000-0000-0000-0000-000000000000',
+  $q$select public.piste_role_appelant()$q$, 'refuse');
+
+-- ---- CONFIGURATION MODIFIÉE ENTRE DEUX RELEVÉS (point 5) --------------------------------
+-- Site dédié « preuve-c » : une pompe, GO/SP ; deux relevés finaux fin_q1 -> debut_q2.
+insert into public.sites (site_id, nom_entreprise, timezone) values ('preuve-c', 'Preuve C', 'America/Martinique'), ('preuve-d', 'Preuve D', 'America/Martinique');
+create function pg_temp.cfg(p_site text, p_v int, p_seuil int, p_gauche text) returns void language sql as $f$
+  insert into public.carburant_index_config (site, version, config) values (p_site, p_v,
+    jsonb_build_object('litresParUnite',1,'toleranceL',9,'seuilL',p_seuil,'delaiReleveManquantMin',30,
+      'pompes', jsonb_build_object('1', jsonb_build_object('gauche',p_gauche,'droite',case p_gauche when 'GO' then 'SP' else 'GO' end,'enService',true)),
+      'chiffres','{}'::jsonb)) $f$;
+create function pg_temp.poser(p_site text, p_date date, p_moment text, p_val text, p_auteur uuid default '00000000-0000-0000-0000-0000000000a3') returns void language plpgsql as $f$
+declare v_id uuid; begin
+  insert into public.carburant_index_releves (site, date, moment, statut, auteur) values (p_site, p_date, p_moment, 'final', p_auteur) returning id into v_id;
+  insert into public.carburant_index_valeurs (releve_id, site, pompe, produit, valeur_sept_chiffres, valeur_decenium, troncature_sans_perte)
+    select v_id, p_site, 1, pr, p_val, right(p_val, 6), true from unnest(array['GO','SP']) pr;
+end $f$;
+create function pg_temp.constater(p_cas text, p_attendu text, p_sql text) returns void language plpgsql as $f$
+declare v text; begin execute p_sql into v; insert into resultats values (p_cas, p_attendu, coalesce(v, 'null')); end $f$;
+create function pg_temp.etat(p_site text, p_date text) returns text language sql as $f$
+  select coalesce((select statut from public.carburant_index_alertes where site = p_site and type = 'passation' and evenement = p_date), 'aucune') $f$;
+
+-- C1 : configuration inchangée, écart 12 L >= 10 => alerte ouverte (orange).
+select pg_temp.cfg('preuve-c', 1, 10, 'GO');
+select pg_temp.poser('preuve-c', '2026-10-10', 'fin_q1', '1000000');
+select pg_temp.poser('preuve-c', '2026-10-10', 'debut_q2', '1000012');
+select public.piste_evaluer_site('preuve-c', '2026-10-10');
+select pg_temp.constater('C1 config stable, 12 L => alerte ouverte', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
+-- C2 : idempotence (rejouer ne duplique pas).
+select public.piste_evaluer_site('preuve-c', '2026-10-10');
+select pg_temp.constater('C2 rejeu idempotent', '1', $q$select count(*)::text from public.carburant_index_alertes where site = 'preuve-c' and evenement = '2026-10-10'$q$);
+-- C3 : nouvelle version publiée APRÈS les deux relevés : leurs photographies ne bougent pas, verdict inchangé.
+select pg_temp.cfg('preuve-c', 2, 50, 'SP');
+select public.piste_evaluer_site('preuve-c', '2026-10-10');
+select pg_temp.constater('C3 version ultérieure : verdict inchangé', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
+select pg_temp.constater('C3b photographies conservées (version 1)', '1', $q$select string_agg(distinct (config_snapshot ->> 'version'), ',') from public.carburant_index_releves where site = 'preuve-c' and date = '2026-10-10'$q$);
+-- C4 : disposition modifiée ENTRE les deux relevés (v2 -> v3 inverse GO/SP) => comparaison impossible, aucune alerte.
+select pg_temp.poser('preuve-c', '2026-10-11', 'fin_q1', '1000000');
+select pg_temp.cfg('preuve-c', 3, 50, 'GO');
+select pg_temp.poser('preuve-c', '2026-10-11', 'debut_q2', '1000500');
+select public.piste_evaluer_site('preuve-c', '2026-10-11');
+select pg_temp.constater('C4 disposition changée entre deux relevés => pas d''alerte', 'aucune', $q$select pg_temp.etat('preuve-c','2026-10-11')$q$);
+select pg_temp.constater('C4b ... et le verdict est « impossible », pas « conforme »', 'impossible',
+  $q$select public.piste_comparer(public.piste_releve_final('preuve-c','2026-10-11','fin_q1'), public.piste_releve_final('preuve-c','2026-10-11','debut_q2')) ->> 'etat'$q$);
+-- C5 : seuil seul modifié entre deux relevés (disposition identique) : le seuil du relevé le plus récent s'applique.
+select pg_temp.poser('preuve-c', '2026-10-12', 'fin_q1', '1000000');
+select pg_temp.cfg('preuve-c', 4, 20, 'GO');
+select pg_temp.poser('preuve-c', '2026-10-12', 'debut_q2', '1000015');
+select public.piste_evaluer_site('preuve-c', '2026-10-12');
+select pg_temp.constater('C5 seuil relevé 10 -> 20, écart 15 L => toléré, pas d''alerte', 'aucune', $q$select pg_temp.etat('preuve-c','2026-10-12')$q$);
+-- C6 : relevés contradictoires APRÈS ouverture : l'alerte n'est PAS résolue par un verdict inconcluant.
+select pg_temp.poser('preuve-c', '2026-10-10', 'debut_q2', '1000013', '00000000-0000-0000-0000-0000000000a1');
+select public.piste_evaluer_site('preuve-c', '2026-10-10');
+select pg_temp.constater('C6 conflit de relevés : alerte laissée ouverte', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
+-- C7 : relevé antérieur à la configuration versionnée (aucune photographie) => non contrôlé, jamais conforme.
+select pg_temp.poser('preuve-d', '2026-10-10', 'fin_q1', '2000000');
+select pg_temp.poser('preuve-d', '2026-10-10', 'debut_q2', '2000000');
+select pg_temp.constater('C7 sans photographie => non_controle', 'non_controle',
+  $q$select public.piste_comparer(public.piste_releve_final('preuve-d','2026-10-10','fin_q1'), public.piste_releve_final('preuve-d','2026-10-10','debut_q2')) ->> 'etat'$q$);
+
 -- Postconditions de privilèges (mesurées, pas supposées).
 insert into resultats
 select 'P1 grants anon/PUBLIC sur les 3 tables', '0',
@@ -168,7 +255,7 @@
     where n.nspname = 'public' and p.prosecdef
       and p.proname in ('enregistrer_config_piste','qualifier_alerte_piste','evaluer_controles_piste','evaluer_tous_sites_piste',
                         'piste_evaluer_site','piste_poser_alerte','piste_manager_du_site','piste_releve_photographier',
-                        'piste_qualification_heriter_site')
+                        'piste_qualification_heriter_site','piste_site_appelant','piste_role_appelant')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))::text;
 insert into resultats
 select 'P5 EXECUTE anon sur les fonctions Journal Piste', '0',
@@ -176,6 +263,17 @@
     where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
       and has_function_privilege('anon', p.oid, 'execute'))::text;
 
+insert into resultats
+select 'P6 fonctions du lot dont pg_temp n''est pas le DERNIER du search_path', '0',
+  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
+    where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
+      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
+                       where c like 'search_path=%' and c like '%, pg_temp'))::text;
+insert into resultats
+select 'P7 EXECUTE authenticated sur les helpers d''identité', '0',
+  (select count(*) from pg_proc p where p.proname in ('piste_site_appelant','piste_role_appelant')
+      and has_function_privilege('authenticated', p.oid, 'execute'))::text;
+
 -- Verdict : tout écart attendu/obtenu fait échouer la preuve.
 select cas, attendu, obtenu, case when attendu = obtenu then 'OK' else 'KO' end as verdict from resultats order by cas;
 do $$ begin
```

## Ce qui n'est pas prouvé

- Rien n'a été exécuté sur Test (hors `select` de catalogue) : la migration finale et la preuve n'y ont jamais été jouées.
- Fidélité de la jetable limitée (§6). Pas de preuve avec un vrai JWT PostgREST. Pas de mutation une à une de chaque révocation. Aucun test navigateur ni iOS.
- Les helpers partagés `current_employee_*` restent vulnérables pour les autres usages (signalé §1, hors lot) ; leur état en Production n'a pas été mesuré dans cette demande.

## Décision demandée

Examiner la revue (§1–§6), le SQL final (§A) et la preuve (§B), et dire s'ils suffisent pour autoriser l'exécution **sur Test seulement**, ou lister les corrections. L'arbitrage final sur la surface de permissions Test reste **humain** (Frédéric) ; ceci est une préparation, pas une demande de GO automatique.

## §A. Migration finale — `supabase/migrations/20261017140000_journal_piste_config_alertes_qualifications.sql`

```sql
-- =====================================================================
-- 20261017140000 — Journal Piste : configuration, alertes, qualifications
-- (TEST SEULEMENT — NON APPLIQUÉE, en attente de l'arbitrage du SQL exact)
--
-- Lot JOURNAL-PISTE-20261017, request-2. Conditions de decision-1 respectées :
--   • le site n'est JAMAIS un paramètre qui fait autorité : les deux fonctions
--     appelables par un utilisateur (`enregistrer_config_piste`,
--     `qualifier_alerte_piste`) et `evaluer_controles_piste()` le déduisent de
--     l'identité de l'appelant (piste_site_appelant()). Les seules
--     fonctions qui reçoivent un site en paramètre (`piste_evaluer_site`,
--     `evaluer_tous_sites_piste`) ne sont exécutables par NI anon NI
--     authenticated : seul le propriétaire (tâche planifiée) les appelle.
--   • aucun UPDATE/DELETE/TRUNCATE pour un utilisateur, ni sur les trois tables
--     ni via la RLS : triggers d'immutabilité en plus des grants.
--   • fail-closed : donnée absente, photographie de configuration différente,
--     relevés finaux contradictoires, fuseau invalide => « non contrôlé » ou
--     « comparaison impossible », jamais « conforme ».
--   • aucun index n'est modifié, aucune vente n'est calculée.
-- Échelle : litresParUnite = 1 (« +1 correspond à un litre », Frédéric,
-- 17/10/2026, déclaration en chat) — consignée dans la configuration initiale.
-- =====================================================================
begin;
set local lock_timeout = '2s';

-- ---------------------------------------------------------------------
-- 1. Habilitation unique (réutilise les helpers existants, fail-closed)
-- ---------------------------------------------------------------------
-- Identité de l'appelant : helpers PROPRES au lot. Les helpers partagés
-- current_employee_role()/current_employee_site_id() lisent `employees` non
-- qualifié avec search_path = public : pg_temp est alors cherché en premier et
-- une table temporaire `employees` créée par l'appelant usurpe son rôle (mesuré
-- sur la base jetable, voir request-3). Ici : tout est qualifié, pg_temp en dernier.
create or replace function public.piste_site_appelant()
 returns text
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select e.site_id from public.employees e where e.id = auth.uid();
$$;
create or replace function public.piste_role_appelant()
 returns text
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select e.role from public.employees e where e.id = auth.uid();
$$;
revoke all on function public.piste_site_appelant() from public, anon, authenticated;
revoke all on function public.piste_role_appelant() from public, anon, authenticated;

create or replace function public.piste_manager_du_site(p_site text)
 returns boolean
 language sql
 stable security definer
 set search_path to pg_catalog, public, pg_temp
as $$
  select p_site is not null
     and p_site = public.piste_site_appelant()
     and public.piste_role_appelant() = any (array['manager', 'gerant']);
$$;
comment on function public.piste_manager_du_site(text) is
  'Vrai seulement si l''appelant est manager ou gérant ET que p_site est SON site. Sert à la RLS de lecture ; ne confère aucune autorité sur un autre site.';
revoke all on function public.piste_manager_du_site(text) from public, anon;
grant execute on function public.piste_manager_du_site(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. carburant_index_config : versions append-only
-- ---------------------------------------------------------------------
create table public.carburant_index_config (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  version integer not null check (version >= 1),
  config jsonb not null,
  avant jsonb,
  motif text,
  modifie_par uuid references public.employees(id),
  modifie_le timestamptz not null default now(),
  constraint carburant_index_config_site_version_key unique (site, version)
);
comment on table public.carburant_index_config is
  'Configuration des compteurs piste, une ligne par version (append-only). La version courante est la plus récente ; pas de date d''effet future. Écrite uniquement par enregistrer_config_piste().';

-- ---------------------------------------------------------------------
-- 3. carburant_index_alertes : une ligne par événement et par cause
-- ---------------------------------------------------------------------
create table public.carburant_index_alertes (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  type text not null check (type in ('passation', 'nuit', 'releve_manquant')),
  evenement text not null,
  niveau text not null check (niveau in ('orange', 'rouge')),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'resolue_auto', 'qualifiee')),
  constat jsonb not null,
  raison_cloture text,
  ouverte_le timestamptz not null default now(),
  cloturee_le timestamptz,
  constraint carburant_index_alertes_site_type_evenement_key unique (site, type, evenement)
);
comment on table public.carburant_index_alertes is
  'Une alerte par (site, type, événement) : l''évaluation est idempotente. Le constat liste les compteurs concernés ; jamais une alerte par compteur. Écrite uniquement par piste_evaluer_site() et qualifier_alerte_piste().';

-- ---------------------------------------------------------------------
-- 4. carburant_index_qualifications : append-only, correction = nouvelle ligne
-- ---------------------------------------------------------------------
create table public.carburant_index_qualifications (
  id uuid primary key default gen_random_uuid(),
  alerte_id uuid not null references public.carburant_index_alertes(id),
  site text not null,
  choix text not null check (choix in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue')),
  commentaire text,
  qualifie_par uuid not null references public.employees(id),
  qualifie_le timestamptz not null default now(),
  remplace_id uuid references public.carburant_index_qualifications(id)
);
create unique index carburant_index_qualifications_un_remplacement
  on public.carburant_index_qualifications (remplace_id) where remplace_id is not null;
create index idx_carburant_index_qualifications_alerte
  on public.carburant_index_qualifications (alerte_id, qualifie_le desc);
comment on table public.carburant_index_qualifications is
  'Décision humaine (manager/gérant) sur une alerte. « mouvement_confirme » = déclaration du manager, pas un fait vérifié. Append-only : corriger une qualification = en insérer une qui remplace la précédente. Ne modifie jamais un index.';

-- Le site d'une qualification est hérité de l'alerte, jamais fourni.
create or replace function public.piste_qualification_heriter_site()
 returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  select a.site into new.site from public.carburant_index_alertes a where a.id = new.alerte_id;
  if new.site is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  return new;
end;
$$;
revoke all on function public.piste_qualification_heriter_site() from public, anon, authenticated;
create trigger carburant_index_qualifications_site before insert on public.carburant_index_qualifications
  for each row execute function public.piste_qualification_heriter_site();

-- Immutabilité : config et qualifications ne changent jamais ; une alerte ne
-- change ni son identité ni son constat d'origine (statut/clôture/niveau/constat
-- à jour seulement, par les fonctions).
create or replace function public.piste_interdire_modification()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  raise exception 'APPEND_ONLY % %', tg_table_name, tg_op using errcode = 'P0001';
end;
$$;
revoke all on function public.piste_interdire_modification() from public, anon, authenticated;
create trigger carburant_index_config_immuable before update or delete on public.carburant_index_config
  for each row execute function public.piste_interdire_modification();
create trigger carburant_index_qualifications_immuable before update or delete on public.carburant_index_qualifications
  for each row execute function public.piste_interdire_modification();

create or replace function public.piste_alerte_garde_identite()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY carburant_index_alertes DELETE' using errcode = 'P0001'; end if;
  if new.id <> old.id or new.site <> old.site or new.type <> old.type
     or new.evenement <> old.evenement or new.ouverte_le <> old.ouverte_le then
    raise exception 'IDENTITE_ALERTE_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_alerte_garde_identite() from public, anon, authenticated;
create trigger carburant_index_alertes_identite before update or delete on public.carburant_index_alertes
  for each row execute function public.piste_alerte_garde_identite();

-- ---------------------------------------------------------------------
-- 5. RLS : lecture manager/gérant du site, aucune écriture directe
-- ---------------------------------------------------------------------
alter table public.carburant_index_config enable row level security;
alter table public.carburant_index_alertes enable row level security;
alter table public.carburant_index_qualifications enable row level security;

create policy select_carburant_index_config on public.carburant_index_config
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_alertes on public.carburant_index_alertes
  for select to authenticated using ((select public.piste_manager_du_site(site)));
create policy select_carburant_index_qualifications on public.carburant_index_qualifications
  for select to authenticated using ((select public.piste_manager_du_site(site)));
-- Volontairement aucune policy INSERT/UPDATE/DELETE : seules les fonctions
-- SECURITY DEFINER ci-dessous écrivent.

-- Fermeture explicite (default privileges Supabase : anon reçoit tout sur une table neuve).
revoke all on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications from public, anon, authenticated;
grant select on public.carburant_index_config, public.carburant_index_alertes,
  public.carburant_index_qualifications to authenticated;

-- ---------------------------------------------------------------------
-- 6. Photographie de configuration, posée par le serveur avec le relevé
-- ---------------------------------------------------------------------
alter table public.carburant_index_releves add column config_snapshot jsonb;
comment on column public.carburant_index_releves.config_snapshot is
  'Photographie immuable de la configuration piste courante {version, config} au moment de l''insertion du relevé. Posée par le serveur (un client ne peut pas la fournir) ; NULL = relevé antérieur à la configuration versionnée (jamais comparé).';

create or replace function public.piste_releve_photographier()
 returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  new.config_snapshot := (
    select jsonb_build_object('version', c.version, 'config', c.config)
      from public.carburant_index_config c
     where c.site = new.site order by c.version desc limit 1);
  return new;
end;
$$;
revoke all on function public.piste_releve_photographier() from public, anon, authenticated;
create trigger carburant_index_releves_photographie before insert on public.carburant_index_releves
  for each row execute function public.piste_releve_photographier();

create or replace function public.piste_releve_snapshot_immuable()
 returns trigger language plpgsql set search_path to pg_catalog, public, pg_temp
as $$
begin
  if new.config_snapshot is distinct from old.config_snapshot then
    raise exception 'SNAPSHOT_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.piste_releve_snapshot_immuable() from public, anon, authenticated;
create trigger carburant_index_releves_snapshot_immuable before update on public.carburant_index_releves
  for each row execute function public.piste_releve_snapshot_immuable();

-- ---------------------------------------------------------------------
-- 7. enregistrer_config_piste : site déduit de l'appelant
-- ---------------------------------------------------------------------
create or replace function public.enregistrer_config_piste(p_config jsonb, p_motif text default null)
 returns integer
 language plpgsql
 security definer
 set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_site text := public.piste_site_appelant();
  v_avant jsonb;
  v_version integer;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_config) <> 'object'
     or jsonb_typeof(p_config -> 'pompes') <> 'object'
     or jsonb_typeof(p_config -> 'chiffres') <> 'object'
     or coalesce((p_config ->> 'litresParUnite')::numeric, 0) <= 0
     or coalesce((p_config ->> 'toleranceL')::numeric, -1) < 0
     or coalesce((p_config ->> 'seuilL')::numeric, 0) <= coalesce((p_config ->> 'toleranceL')::numeric, 1e9)
     or coalesce((p_config ->> 'delaiReleveManquantMin')::int, 0) not between 1 and 240 then
    raise exception 'CONFIG_INVALIDE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('config_piste:' || v_site));
  select c.config, c.version into v_avant, v_version
    from public.carburant_index_config c where c.site = v_site order by c.version desc limit 1;

  insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
  values (v_site, coalesce(v_version, 0) + 1, p_config, v_avant, nullif(btrim(p_motif), ''), auth.uid())
  returning version into v_version;
  return v_version;
end;
$$;
comment on function public.enregistrer_config_piste(jsonb, text) is
  'Insère une nouvelle version de configuration pour LE SITE DE L''APPELANT (manager/gérant). Aucun paramètre site. Conserve l''avant et le motif.';
revoke all on function public.enregistrer_config_piste(jsonb, text) from public, anon;
grant execute on function public.enregistrer_config_piste(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
-- ---------------------------------------------------------------------
create or replace function public.qualifier_alerte_piste(
  p_alerte_id uuid, p_choix text, p_commentaire text default null, p_remplace_id uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_alerte public.carburant_index_alertes%rowtype;
  v_id uuid;
begin
  select * into v_alerte from public.carburant_index_alertes where id = p_alerte_id for update;
  if v_alerte.id is null then raise exception 'ALERTE_INTROUVABLE' using errcode = 'P0001'; end if;
  if auth.uid() is null or not public.piste_manager_du_site(v_alerte.site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  if p_choix is null or p_choix not in ('erreur_lecture', 'mouvement_confirme', 'cause_inconnue') then
    raise exception 'CHOIX_INVALIDE' using errcode = 'P0001';
  end if;
  if v_alerte.statut = 'resolue_auto' then
    raise exception 'ALERTE_DEJA_RESOLUE' using errcode = 'P0001';
  end if;
  if p_remplace_id is not null and not exists (
       select 1 from public.carburant_index_qualifications q
        where q.id = p_remplace_id and q.alerte_id = p_alerte_id) then
    raise exception 'REMPLACEMENT_INVALIDE' using errcode = 'P0001';
  end if;

  insert into public.carburant_index_qualifications (alerte_id, choix, commentaire, qualifie_par, remplace_id)
  values (p_alerte_id, p_choix, nullif(btrim(p_commentaire), ''), auth.uid(), p_remplace_id)
  returning id into v_id;
  update public.carburant_index_alertes set statut = 'qualifiee' where id = p_alerte_id;
  return v_id;
end;
$$;
comment on function public.qualifier_alerte_piste(uuid, text, text, uuid) is
  'Enregistre la décision du manager/gérant du site de l''alerte (append-only, correction = remplace_id). Le site n''est pas un paramètre. Ne modifie aucun index.';
revoke all on function public.qualifier_alerte_piste(uuid, text, text, uuid) from public, anon;
grant execute on function public.qualifier_alerte_piste(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Évaluation des contrôles (idempotente)
-- ---------------------------------------------------------------------
-- Relevé final d'un moment : {etat: aucun|conflit|ok, snapshot, vals}.
create or replace function public.piste_releve_final(p_site text, p_date date, p_moment text)
 returns jsonb
 language plpgsql stable set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_n int; v_distincts int; v_snap jsonb; v_vals jsonb;
begin
  with r as (
    select re.config_snapshot as snap,
           (select jsonb_object_agg(v.pompe || '-' || v.produit, v.valeur_sept_chiffres)
              from public.carburant_index_valeurs v where v.releve_id = re.id) as vals
      from public.carburant_index_releves re
     where re.site = p_site and re.date = p_date and re.moment = p_moment and re.statut = 'final')
  select count(*), count(distinct (coalesce(snap::text, '') || coalesce(vals::text, ''))),
         (array_agg(snap))[1], (array_agg(vals))[1]
    into v_n, v_distincts, v_snap, v_vals from r;
  if v_n = 0 then return jsonb_build_object('etat', 'aucun'); end if;
  if v_distincts > 1 then return jsonb_build_object('etat', 'conflit'); end if;
  return jsonb_build_object('etat', 'ok', 'snapshot', v_snap, 'vals', v_vals);
end;
$$;
revoke all on function public.piste_releve_final(text, date, text) from public, anon, authenticated;

-- Comparaison de deux relevés finaux (équivalent SQL de comparerPassation).
-- Retourne {etat, raison, lignes[]} avec etat in conforme|tolere|anomalie|non_controle|impossible.
create or replace function public.piste_comparer(p_a jsonb, p_b jsonb)
 returns jsonb
 language plpgsql immutable set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_cfg jsonb; v_echelle numeric; v_tol numeric; v_seuil numeric;
  v_p text; v_prod text; v_clef text; v_a text; v_b text; v_ecart numeric;
  v_lignes jsonb := '[]'::jsonb; v_manque boolean := false; v_anom boolean := false; v_tole boolean := false;
  v_etat text;
begin
  if p_a ->> 'etat' <> 'ok' or p_b ->> 'etat' <> 'ok' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', case when p_a ->> 'etat' = 'conflit' or p_b ->> 'etat' = 'conflit'
                     then 'Relevés finaux contradictoires pour un même moment.'
                     else 'Donnée manquante : un des deux relevés n''est pas enregistré dans NEXUS.' end,
      'lignes', v_lignes);
  end if;
  if p_a -> 'snapshot' is null or p_b -> 'snapshot' is null
     or jsonb_typeof(p_a -> 'snapshot') = 'null' or jsonb_typeof(p_b -> 'snapshot') = 'null' then
    return jsonb_build_object('etat', 'non_controle',
      'raison', 'Relevé antérieur à la configuration versionnée : configuration d''origine non photographiée.', 'lignes', v_lignes);
  end if;
  v_cfg := p_b -> 'snapshot' -> 'config';
  if (p_a -> 'snapshot' -> 'config' -> 'pompes', p_a -> 'snapshot' -> 'config' -> 'chiffres', p_a -> 'snapshot' -> 'config' -> 'litresParUnite')
     is distinct from (v_cfg -> 'pompes', v_cfg -> 'chiffres', v_cfg -> 'litresParUnite') then
    return jsonb_build_object('etat', 'impossible',
      'raison', 'Comparaison impossible : la configuration des compteurs a changé entre les deux relevés.', 'lignes', v_lignes);
  end if;
  v_echelle := (v_cfg ->> 'litresParUnite')::numeric;
  if v_echelle is null or v_echelle <= 0 then
    return jsonb_build_object('etat', 'impossible', 'raison', 'Comparaison impossible : unité de mesure non confirmée.', 'lignes', v_lignes);
  end if;
  v_tol := (v_cfg ->> 'toleranceL')::numeric; v_seuil := (v_cfg ->> 'seuilL')::numeric;

  for v_p in select jsonb_object_keys(v_cfg -> 'pompes') order by 1 loop
    if coalesce((v_cfg -> 'pompes' -> v_p ->> 'enService')::boolean, false) is not true then continue; end if;
    foreach v_prod in array array[v_cfg -> 'pompes' -> v_p ->> 'gauche', v_cfg -> 'pompes' -> v_p ->> 'droite'] loop
      v_clef := v_p || '-' || v_prod;
      v_a := p_a -> 'vals' ->> v_clef; v_b := p_b -> 'vals' ->> v_clef;
      if v_a is null or v_b is null or v_a !~ '^[0-9]+$' or v_b !~ '^[0-9]+$' then
        v_manque := true;
        v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'etat', 'non_controle');
        continue;
      end if;
      v_ecart := (v_b::numeric - v_a::numeric) * v_echelle;
      v_etat := case when abs(v_ecart) = 0 then 'conforme' when abs(v_ecart) >= v_seuil then 'anomalie' else 'tolere' end;
      if v_etat = 'anomalie' then v_anom := true; elsif v_etat = 'tolere' then v_tole := true; end if;
      v_lignes := v_lignes || jsonb_build_object('clef', v_clef, 'ecartL', v_ecart, 'etat', v_etat);
    end loop;
  end loop;
  if v_manque then
    return jsonb_build_object('etat', 'non_controle', 'raison', 'Donnée manquante : au moins un compteur n''a pas de valeur.', 'lignes', v_lignes);
  end if;
  return jsonb_build_object('etat', case when v_anom then 'anomalie' when v_tole then 'tolere' else 'conforme' end, 'lignes', v_lignes);
end;
$$;
revoke all on function public.piste_comparer(jsonb, jsonb) from public, anon, authenticated;

-- Ouvre, met à jour ou résout UNE alerte (idempotent sur la clé unique).
create or replace function public.piste_poser_alerte(
  p_site text, p_type text, p_evenement text, p_niveau text, p_present boolean, p_constat jsonb, p_raison text)
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
begin
  if p_present then
    insert into public.carburant_index_alertes (site, type, evenement, niveau, constat)
    values (p_site, p_type, p_evenement, p_niveau, p_constat)
    on conflict (site, type, evenement) do update
      set constat = excluded.constat, niveau = excluded.niveau,
          statut = case when carburant_index_alertes.statut = 'resolue_auto' then 'ouverte' else carburant_index_alertes.statut end,
          cloturee_le = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.cloturee_le end,
          raison_cloture = case when carburant_index_alertes.statut = 'resolue_auto' then null else carburant_index_alertes.raison_cloture end;
  else
    update public.carburant_index_alertes
       set statut = 'resolue_auto', cloturee_le = now(), raison_cloture = p_raison
     where site = p_site and type = p_type and evenement = p_evenement and statut in ('ouverte', 'qualifiee');
  end if;
end;
$$;
revoke all on function public.piste_poser_alerte(text, text, text, text, boolean, jsonb, text) from public, anon, authenticated;

-- Évalue un site pour une date de référence. Site en paramètre => NON exécutable
-- par un utilisateur ; appelée seulement par la tâche planifiée ou par
-- evaluer_controles_piste() qui impose le site de l'appelant.
create or replace function public.piste_evaluer_site(p_site text, p_date date)
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_tz text; v_cfg jsonb; v_delai int; v_res jsonb; v_present boolean;
  v_q text; v_moment text; v_deb time; v_fin time; v_echeance timestamptz; v_ev text;
  v_a jsonb; v_b jsonb;
begin
  select s.timezone into v_tz from public.sites s where s.site_id = p_site;
  if v_tz is null or btrim(v_tz) = '' or not exists (select 1 from pg_timezone_names where name = v_tz) then
    return; -- fail-closed : pas de fuseau, pas d'horloge, aucun verdict.
  end if;

  -- Passation (fin Q1 -> début Q2, orange) et nuit (fin Q2 de la veille -> début Q1, rouge).
  v_a := public.piste_releve_final(p_site, p_date, 'fin_q1');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q2');
  v_res := public.piste_comparer(v_a, v_b);
  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
    perform public.piste_poser_alerte(p_site, 'passation', p_date::text, 'orange', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
  end if;

  v_a := public.piste_releve_final(p_site, p_date - 1, 'fin_q2');
  v_b := public.piste_releve_final(p_site, p_date, 'debut_q1');
  v_res := public.piste_comparer(v_a, v_b);
  -- Seul un verdict CONCLUANT ouvre ou résout : « non contrôlé » / « impossible »
  -- (donnée manquante, relevés contradictoires, configuration changée) laisse l'alerte en l'état.
  if v_res ->> 'etat' in ('conforme', 'tolere', 'anomalie') then
    perform public.piste_poser_alerte(p_site, 'nuit', p_date::text, 'rouge', v_res ->> 'etat' = 'anomalie', v_res, 'Recalcul sur relevés finaux : plus d''écart.');
  end if;

  -- Relevé de fin manquant : fin de quart (calculer_horaires_quart, moteur unique)
  -- + délai de la configuration courante, au fuseau du site.
  select c.config into v_cfg from public.carburant_index_config c where c.site = p_site order by c.version desc limit 1;
  if v_cfg is null then return; end if;
  v_delai := (v_cfg ->> 'delaiReleveManquantMin')::int;
  if v_delai is null then return; end if;

  foreach v_q in array array['quart1', 'quart2'] loop
    v_moment := case v_q when 'quart1' then 'fin_q1' else 'fin_q2' end;
    select h.heure_debut, h.heure_fin into v_deb, v_fin from public.calculer_horaires_quart(p_site, v_q, p_date) h;
    if v_fin is null then continue; end if;
    if not exists (select 1 from public.shifts sh
                    where sh.site = p_site and sh.role = 'pompiste'
                      and sh.quart = case v_q when 'quart1' then 'matin' else 'soir' end
                      and (sh.heure_debut at time zone v_tz)::date = p_date) then
      continue; -- pas de pompiste ce quart-là : aucun relevé attendu.
    end if;
    v_echeance := ((p_date + case when v_fin <= v_deb then 1 else 0 end)::timestamp + v_fin) at time zone v_tz
                  + make_interval(mins => v_delai);
    v_ev := v_moment || ':' || p_date::text;
    v_present := now() >= v_echeance
                 and public.piste_releve_final(p_site, p_date, v_moment) ->> 'etat' = 'aucun';
    perform public.piste_poser_alerte(p_site, 'releve_manquant', v_ev, 'rouge', v_present,
      jsonb_build_object('moment', v_moment, 'quart', v_q, 'echeance', v_echeance,
                         'message', 'Relevé de fin non enregistré dans NEXUS'),
      'Relevé final enregistré.');
  end loop;
end;
$$;
revoke all on function public.piste_evaluer_site(text, date) from public, anon, authenticated;

-- Appel manager : site déduit de l'appelant, deux jours (aujourd'hui et hier, fuseau du site).
create or replace function public.evaluer_controles_piste()
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_site text := public.piste_site_appelant();
  v_tz text; v_jour date;
begin
  if auth.uid() is null or not public.piste_manager_du_site(v_site) then
    raise exception 'ROLE_NON_AUTORISE' using errcode = 'P0001';
  end if;
  select s.timezone into v_tz from public.sites s where s.site_id = v_site;
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then return; end if;
  v_jour := (now() at time zone v_tz)::date;
  perform public.piste_evaluer_site(v_site, v_jour);
  perform public.piste_evaluer_site(v_site, v_jour - 1);
end;
$$;
comment on function public.evaluer_controles_piste() is
  'Réévalue les contrôles du site de l''appelant (manager/gérant), sans paramètre. Idempotent.';
revoke all on function public.evaluer_controles_piste() from public, anon;
grant execute on function public.evaluer_controles_piste() to authenticated;

-- Tâche planifiée : tous les sites, indépendante de l'ouverture du Journal.
create or replace function public.evaluer_tous_sites_piste()
 returns void
 language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $$
declare
  r record; v_jour date;
begin
  for r in select distinct c.site, s.timezone from public.carburant_index_config c
             join public.sites s on s.site_id = c.site loop
    if r.timezone is null or not exists (select 1 from pg_timezone_names where name = r.timezone) then continue; end if;
    v_jour := (now() at time zone r.timezone)::date;
    perform public.piste_evaluer_site(r.site, v_jour);
    perform public.piste_evaluer_site(r.site, v_jour - 1);
  end loop;
end;
$$;
revoke all on function public.evaluer_tous_sites_piste() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Configuration initiale du site de Test + planification
-- ---------------------------------------------------------------------
insert into public.carburant_index_config (site, version, config, avant, motif, modifie_par)
select s.site_id, 1,
  jsonb_build_object(
    'litresParUnite', 1, 'toleranceL', 9, 'seuilL', 10, 'delaiReleveManquantMin', 30,
    'pompes', jsonb_build_object(
      '1', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '2', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true),
      '3', jsonb_build_object('gauche', 'GO', 'droite', 'SP', 'enService', true),
      '4', jsonb_build_object('gauche', 'SP', 'droite', 'GO', 'enService', true)),
    'chiffres', jsonb_build_object('mecanique', 7, 'decenium', 6),
    'ordreRecopie', jsonb_build_array('SP', 'GO'),
    'gnr', jsonb_build_object('enService', false, 'indexFige', '1191213'),
    'echelleConfirmee', jsonb_build_object('par', 'Frédéric Bragance', 'le', '2026-10-17',
                                            'mode', 'déclaration en chat : +1 correspond à un litre')),
  null, 'Configuration initiale (cahier des charges du 17/10/2026)', null
from public.sites s where s.site_id = 'vito-sainte-marie';

do $planif$
begin
  if exists (select 1 from cron.job where jobname = 'nexus-journal-piste') then
    perform cron.unschedule('nexus-journal-piste');
  end if;
  perform cron.schedule('nexus-journal-piste', '*/5 * * * *', 'select public.evaluer_tous_sites_piste();');
end
$planif$;

-- ---------------------------------------------------------------------
-- 11. Postconditions (la migration échoue, donc rien n'est appliqué, si elles ne tiennent pas)
-- ---------------------------------------------------------------------
do $ctrl$
begin
  if (select count(*) from pg_class where relname in
        ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
        and relrowsecurity) <> 3 then raise exception 'RLS absente'; end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_name in ('carburant_index_config', 'carburant_index_alertes', 'carburant_index_qualifications')
                and ((grantee = 'anon') or (grantee = 'authenticated' and privilege_type <> 'SELECT')
                     or grantee = 'PUBLIC')) then raise exception 'grant illicite'; end if;
  if has_function_privilege('anon', 'public.evaluer_controles_piste()', 'execute')
     or has_function_privilege('authenticated', 'public.piste_evaluer_site(text,date)', 'execute')
     or has_function_privilege('authenticated', 'public.evaluer_tous_sites_piste()', 'execute')
     or has_function_privilege('anon', 'public.enregistrer_config_piste(jsonb,text)', 'execute')
     or has_function_privilege('anon', 'public.qualifier_alerte_piste(uuid,text,text,uuid)', 'execute')
  then raise exception 'EXECUTE illicite'; end if;
end
$ctrl$;
commit;
```

## §B. Preuve rejouable — `supabase/preuves/preuve-journal-piste-rls-test.sql` (transaction annulée)

```sql
-- =====================================================================
-- Preuve rejouable — Journal Piste (TEST SEULEMENT)
-- À jouer APRÈS la migration 20261017140000, en une transaction ANNULÉE
-- (rollback final) : aucune donnée ne subsiste. Rejouable avant (les tables
-- n'existent pas : le bloc 0 le constate) et après.
-- Chaque cas affiche  CAS n | attendu | obtenu | OK/KO ; un KO fait échouer.
-- Les acteurs sont créés dans la transaction (employés fictifs, annulés).
-- =====================================================================
begin;
set local lock_timeout = '2s';
create temp table resultats (cas text, attendu text, obtenu text) on commit drop;
grant all on resultats to anon, authenticated;

-- Acteurs fictifs : deux sites, un manager par site, un gérant, un pompiste.
-- (adapter les colonnes à employees si le schéma Test diffère ; c'est le seul
-- point de la preuve qui dépend d'un fait à mesurer sur Test avant exécution.)
insert into public.sites (site_id, nom_entreprise, timezone) values ('preuve-a', 'Preuve A', 'America/Martinique'), ('preuve-b', 'Preuve B', 'America/Martinique')
  on conflict do nothing;
insert into public.employees (id, username, site_id, role, nom, actif) values
  ('00000000-0000-0000-0000-0000000000a1', 'preuve-a1', 'preuve-a', 'manager', 'Preuve MgrA', true),
  ('00000000-0000-0000-0000-0000000000a2', 'preuve-a2', 'preuve-a', 'gerant', 'Preuve GerA', true),
  ('00000000-0000-0000-0000-0000000000a3', 'preuve-a3', 'preuve-a', 'pompiste', 'Preuve PompA', true),
  ('00000000-0000-0000-0000-0000000000b1', 'preuve-b1', 'preuve-b', 'manager', 'Preuve MgrB', true);

-- Une configuration et une alerte de preuve, posées en tant que propriétaire.
insert into public.carburant_index_config (site, version, config) values
  ('preuve-a', 1, '{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}');
insert into public.carburant_index_alertes (id, site, type, evenement, niveau, constat) values
  ('00000000-0000-0000-0000-00000000aaaa', 'preuve-a', 'passation', '2026-10-17', 'orange', '{}');

-- Un relevé posé par le propriétaire : sans lui, S1 (UPDATE sur zéro ligne) « réussirait » à vide.
insert into public.carburant_index_releves (id, site, date, moment, statut, auteur)
  values ('00000000-0000-0000-0000-00000000bbbb', 'preuve-a', current_date, 'debut_q1', 'brouillon', '00000000-0000-0000-0000-0000000000a3');

-- Helper : joue une instruction sous un rôle/identité, consigne OK si elle
-- lève (refus attendu) ou si elle aboutit (autorisation attendue).
create or replace function pg_temp.jouer(p_cas text, p_role text, p_uid text, p_sql text, p_attendu text)
returns void language plpgsql as $$
declare v_obtenu text := 'autorise'; v_n bigint;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid, true); -- auth.uid() ancien format ET nouveau (le banc doit couvrir les deux)
  begin
    execute p_sql;
  exception when others then v_obtenu := 'refuse';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu, v_obtenu);
end $$;
grant execute on function pg_temp.jouer(text, text, text, text, text) to public;

-- ---- LECTURE (RLS) ------------------------------------------------
-- Compte visible par acteur (0 = rien de visible ; l'erreur compte comme refus).
create or replace function pg_temp.voir(p_cas text, p_role text, p_uid text, p_attendu_n bigint)
returns void language plpgsql as $$
declare v_n bigint; v_obtenu text;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid, true); -- auth.uid() ancien format ET nouveau (le banc doit couvrir les deux)
  begin
    select count(*) into v_n from public.carburant_index_alertes;
    v_obtenu := v_n::text;
  exception when others then v_obtenu := '0';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu_n::text, v_obtenu);
end $$;
select pg_temp.voir('L1 anon ne lit pas',                  'anon',          '00000000-0000-0000-0000-000000000000', 0);
select pg_temp.voir('L2 pompiste ne lit pas',              'authenticated', '00000000-0000-0000-0000-0000000000a3', 0);
select pg_temp.voir('L3 manager d''un autre site ne lit pas','authenticated', '00000000-0000-0000-0000-0000000000b1', 0);
select pg_temp.voir('L4 manager du site lit',              'authenticated', '00000000-0000-0000-0000-0000000000a1', 1);
select pg_temp.voir('L5 gérant du site lit',               'authenticated', '00000000-0000-0000-0000-0000000000a2', 1);

-- ---- ÉCRITURE DIRECTE : toujours refusée, pour tous les rôles clients ---------
do $$
declare r record; t text;
begin
  for r in select * from (values
      ('anon','00000000-0000-0000-0000-000000000000'),
      ('authenticated','00000000-0000-0000-0000-0000000000a3'),
      ('authenticated','00000000-0000-0000-0000-0000000000b1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a2')) v(role, uid) loop
    foreach t in array array['carburant_index_config','carburant_index_alertes','carburant_index_qualifications'] loop
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' INSERT '||t, r.role, r.uid,
        format('insert into public.%I (site) values (''preuve-a'')', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' UPDATE '||t, r.role, r.uid,
        format('update public.%I set site = site', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' DELETE '||t, r.role, r.uid,
        format('delete from public.%I', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' TRUNCATE '||t, r.role, r.uid,
        format('truncate public.%I', t), 'refuse');
    end loop;
  end loop;
end $$;

-- ---- FONCTIONS : refus et autorisations --------------------------------------
-- enregistrer_config_piste : site de l'appelant seulement
select pg_temp.jouer('F1 anon enregistre config', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.enregistrer_config_piste('{}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F2 pompiste enregistre config', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F3 manager config invalide refusée', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":0}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F4 manager du site enregistre config valide', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}'::jsonb, 'preuve')$q$, 'autorise');
-- La version posée par F4 doit porter le site de l'appelant (preuve-a), jamais un autre.
select pg_temp.jouer('F5 version posée sur le site de l''appelant', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$do $i$ begin if (select site from public.carburant_index_config order by modifie_le desc limit 1) <> 'preuve-a' then raise exception 'mauvais site'; end if; end $i$$q$, 'autorise');

-- qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
select pg_temp.jouer('Q1 anon qualifie', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q2 pompiste qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q3 manager d''un autre site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000b1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q4 choix hors liste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'au_hasard')$q$, 'refuse');
select pg_temp.jouer('Q5 manager du site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'erreur_lecture', 'preuve')$q$, 'autorise');
select pg_temp.jouer('Q6 gérant du site corrige (remplace)', 'authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue', 'correction',
       (select id from public.carburant_index_qualifications order by qualifie_le desc limit 1))$q$, 'autorise');

-- Fonctions à paramètre site : exécutables par personne côté client.
select pg_temp.jouer('E1 manager appelle piste_evaluer_site(site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-a', current_date)$q$, 'refuse');
select pg_temp.jouer('E2 manager appelle piste_evaluer_site(autre site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-b', current_date)$q$, 'refuse');
select pg_temp.jouer('E3 anon appelle evaluer_tous_sites_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E4 manager appelle evaluer_tous_sites_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E5 anon appelle evaluer_controles_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E6 pompiste appelle evaluer_controles_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E7 manager appelle evaluer_controles_piste (son site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_controles_piste()$q$, 'autorise');

-- Immuabilité même pour le propriétaire (triggers) : une version, une qualification, l'identité d'une alerte.
select pg_temp.jouer('I1 UPDATE config (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_config set motif = 'x'$q$, 'refuse');
select pg_temp.jouer('I2 DELETE qualification (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$delete from public.carburant_index_qualifications$q$, 'refuse');
select pg_temp.jouer('I3 changer le site d''une alerte (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_alertes set site = 'preuve-b'$q$, 'refuse');

-- Photographie : un client ne peut pas imposer ni modifier config_snapshot.
select pg_temp.jouer('S1 UPDATE config_snapshot d''un relevé (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_releves set config_snapshot = '{"x":1}' where config_snapshot is null and false or id in (select id from public.carburant_index_releves limit 1)$q$, 'refuse');


-- ---- USURPATION D'IDENTITÉ PAR TABLE TEMPORAIRE (revue SECURITY DEFINER) -------------
-- Un pompiste crée pg_temp.employees se déclarant manager de son site, puis agit.
-- Avant durcissement (helpers current_employee_* à search_path=public) : « autorise ».
select pg_temp.jouer('A1 pompiste + temp employees lit les alertes', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$create temp table employees (id uuid, role text, site_id text);
     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
     do $i$ begin if (select count(*) from public.carburant_index_alertes) = 0 then raise exception 'rien visible'; end if; end $i$$q$, 'refuse');
select pg_temp.jouer('A2 pompiste + temp employees enregistre une config', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$create temp table employees (id uuid, role text, site_id text);
     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
     select public.enregistrer_config_piste('{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}'::jsonb, 'usurpation')$q$, 'refuse');
select pg_temp.jouer('A3 pompiste + temp employees qualifie une alerte', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$create temp table employees (id uuid, role text, site_id text);
     insert into employees values ('00000000-0000-0000-0000-0000000000a3', 'manager', 'preuve-a');
     select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('A4 manager de B + temp employees lit le site A', 'authenticated', '00000000-0000-0000-0000-0000000000b1',
  $q$create temp table employees (id uuid, role text, site_id text);
     insert into employees values ('00000000-0000-0000-0000-0000000000b1', 'manager', 'preuve-a');
     do $i$ begin if (select count(*) from public.carburant_index_alertes) = 0 then raise exception 'rien visible'; end if; end $i$$q$, 'refuse');
select pg_temp.jouer('A5 helpers d''identité non exécutables par un client', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_site_appelant()$q$, 'refuse');
select pg_temp.jouer('A6 helpers d''identité non exécutables par anon', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.piste_role_appelant()$q$, 'refuse');

-- ---- CONFIGURATION MODIFIÉE ENTRE DEUX RELEVÉS (point 5) --------------------------------
-- Site dédié « preuve-c » : une pompe, GO/SP ; deux relevés finaux fin_q1 -> debut_q2.
insert into public.sites (site_id, nom_entreprise, timezone) values ('preuve-c', 'Preuve C', 'America/Martinique'), ('preuve-d', 'Preuve D', 'America/Martinique');
create function pg_temp.cfg(p_site text, p_v int, p_seuil int, p_gauche text) returns void language sql as $f$
  insert into public.carburant_index_config (site, version, config) values (p_site, p_v,
    jsonb_build_object('litresParUnite',1,'toleranceL',9,'seuilL',p_seuil,'delaiReleveManquantMin',30,
      'pompes', jsonb_build_object('1', jsonb_build_object('gauche',p_gauche,'droite',case p_gauche when 'GO' then 'SP' else 'GO' end,'enService',true)),
      'chiffres','{}'::jsonb)) $f$;
create function pg_temp.poser(p_site text, p_date date, p_moment text, p_val text, p_auteur uuid default '00000000-0000-0000-0000-0000000000a3') returns void language plpgsql as $f$
declare v_id uuid; begin
  insert into public.carburant_index_releves (site, date, moment, statut, auteur) values (p_site, p_date, p_moment, 'final', p_auteur) returning id into v_id;
  insert into public.carburant_index_valeurs (releve_id, site, pompe, produit, valeur_sept_chiffres, valeur_decenium, troncature_sans_perte)
    select v_id, p_site, 1, pr, p_val, right(p_val, 6), true from unnest(array['GO','SP']) pr;
end $f$;
create function pg_temp.constater(p_cas text, p_attendu text, p_sql text) returns void language plpgsql as $f$
declare v text; begin execute p_sql into v; insert into resultats values (p_cas, p_attendu, coalesce(v, 'null')); end $f$;
create function pg_temp.etat(p_site text, p_date text) returns text language sql as $f$
  select coalesce((select statut from public.carburant_index_alertes where site = p_site and type = 'passation' and evenement = p_date), 'aucune') $f$;

-- C1 : configuration inchangée, écart 12 L >= 10 => alerte ouverte (orange).
select pg_temp.cfg('preuve-c', 1, 10, 'GO');
select pg_temp.poser('preuve-c', '2026-10-10', 'fin_q1', '1000000');
select pg_temp.poser('preuve-c', '2026-10-10', 'debut_q2', '1000012');
select public.piste_evaluer_site('preuve-c', '2026-10-10');
select pg_temp.constater('C1 config stable, 12 L => alerte ouverte', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
-- C2 : idempotence (rejouer ne duplique pas).
select public.piste_evaluer_site('preuve-c', '2026-10-10');
select pg_temp.constater('C2 rejeu idempotent', '1', $q$select count(*)::text from public.carburant_index_alertes where site = 'preuve-c' and evenement = '2026-10-10'$q$);
-- C3 : nouvelle version publiée APRÈS les deux relevés : leurs photographies ne bougent pas, verdict inchangé.
select pg_temp.cfg('preuve-c', 2, 50, 'SP');
select public.piste_evaluer_site('preuve-c', '2026-10-10');
select pg_temp.constater('C3 version ultérieure : verdict inchangé', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
select pg_temp.constater('C3b photographies conservées (version 1)', '1', $q$select string_agg(distinct (config_snapshot ->> 'version'), ',') from public.carburant_index_releves where site = 'preuve-c' and date = '2026-10-10'$q$);
-- C4 : disposition modifiée ENTRE les deux relevés (v2 -> v3 inverse GO/SP) => comparaison impossible, aucune alerte.
select pg_temp.poser('preuve-c', '2026-10-11', 'fin_q1', '1000000');
select pg_temp.cfg('preuve-c', 3, 50, 'GO');
select pg_temp.poser('preuve-c', '2026-10-11', 'debut_q2', '1000500');
select public.piste_evaluer_site('preuve-c', '2026-10-11');
select pg_temp.constater('C4 disposition changée entre deux relevés => pas d''alerte', 'aucune', $q$select pg_temp.etat('preuve-c','2026-10-11')$q$);
select pg_temp.constater('C4b ... et le verdict est « impossible », pas « conforme »', 'impossible',
  $q$select public.piste_comparer(public.piste_releve_final('preuve-c','2026-10-11','fin_q1'), public.piste_releve_final('preuve-c','2026-10-11','debut_q2')) ->> 'etat'$q$);
-- C5 : seuil seul modifié entre deux relevés (disposition identique) : le seuil du relevé le plus récent s'applique.
select pg_temp.poser('preuve-c', '2026-10-12', 'fin_q1', '1000000');
select pg_temp.cfg('preuve-c', 4, 20, 'GO');
select pg_temp.poser('preuve-c', '2026-10-12', 'debut_q2', '1000015');
select public.piste_evaluer_site('preuve-c', '2026-10-12');
select pg_temp.constater('C5 seuil relevé 10 -> 20, écart 15 L => toléré, pas d''alerte', 'aucune', $q$select pg_temp.etat('preuve-c','2026-10-12')$q$);
-- C6 : relevés contradictoires APRÈS ouverture : l'alerte n'est PAS résolue par un verdict inconcluant.
select pg_temp.poser('preuve-c', '2026-10-10', 'debut_q2', '1000013', '00000000-0000-0000-0000-0000000000a1');
select public.piste_evaluer_site('preuve-c', '2026-10-10');
select pg_temp.constater('C6 conflit de relevés : alerte laissée ouverte', 'ouverte', $q$select pg_temp.etat('preuve-c','2026-10-10')$q$);
-- C7 : relevé antérieur à la configuration versionnée (aucune photographie) => non contrôlé, jamais conforme.
select pg_temp.poser('preuve-d', '2026-10-10', 'fin_q1', '2000000');
select pg_temp.poser('preuve-d', '2026-10-10', 'debut_q2', '2000000');
select pg_temp.constater('C7 sans photographie => non_controle', 'non_controle',
  $q$select public.piste_comparer(public.piste_releve_final('preuve-d','2026-10-10','fin_q1'), public.piste_releve_final('preuve-d','2026-10-10','debut_q2')) ->> 'etat'$q$);

-- Postconditions de privilèges (mesurées, pas supposées).
insert into resultats
select 'P1 grants anon/PUBLIC sur les 3 tables', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee in ('anon','PUBLIC'))::text;
insert into resultats
select 'P2 grants authenticated autres que SELECT', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee = 'authenticated' and privilege_type <> 'SELECT')::text;
insert into resultats
select 'P3 RLS active sur les 3 tables', '3',
  (select count(*) from pg_class where relname in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications') and relrowsecurity)::text;
insert into resultats
select 'P4 fonctions SECURITY DEFINER sans search_path fixé', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in ('enregistrer_config_piste','qualifier_alerte_piste','evaluer_controles_piste','evaluer_tous_sites_piste',
                        'piste_evaluer_site','piste_poser_alerte','piste_manager_du_site','piste_releve_photographier',
                        'piste_qualification_heriter_site','piste_site_appelant','piste_role_appelant')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))::text;
insert into resultats
select 'P5 EXECUTE anon sur les fonctions Journal Piste', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
      and has_function_privilege('anon', p.oid, 'execute'))::text;

insert into resultats
select 'P6 fonctions du lot dont pg_temp n''est pas le DERNIER du search_path', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                       where c like 'search_path=%' and c like '%, pg_temp'))::text;
insert into resultats
select 'P7 EXECUTE authenticated sur les helpers d''identité', '0',
  (select count(*) from pg_proc p where p.proname in ('piste_site_appelant','piste_role_appelant')
      and has_function_privilege('authenticated', p.oid, 'execute'))::text;

-- Verdict : tout écart attendu/obtenu fait échouer la preuve.
select cas, attendu, obtenu, case when attendu = obtenu then 'OK' else 'KO' end as verdict from resultats order by cas;
do $$ begin
  if exists (select 1 from resultats where attendu <> obtenu) then raise exception 'PREUVE KO — voir les lignes KO ci-dessus'; end if;
end $$;
rollback;
```
