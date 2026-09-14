# Re-mesure finale avant la gate Production — requêtes prêtes, non exécutées

Ce document consolide, en un seul endroit, les requêtes **strictement
`SELECT`** à rejouer immédiatement avant de soumettre la release à Frédéric.
Il ne remplace aucune mesure déjà faite (`mesures-production-lecture-seule-1.md`,
`mesures-advisor-production-lecture-seule-1.md`) : il fixe ce qu'il faut
rejouer, parce que ces deux mesures sont temporelles et se périment.

Aucune requête de ce fichier n'a été exécutée dans cette session : ce canal
était écrit à une date où aucun accès Production n'existait. Depuis, les
mesures en lecture seule passent par le connecteur Supabase, sur autorisation
explicite de Frédéric Bragance et **sans jamais écrire** — voir
`preuve-re-mesure-finale-1.md` pour l'exécution du 10/09/2026. Chaque requête est
dérivée du contenu exact des migrations concernées — jamais supposée.

## 1. Référentiel Advisor (condition #5 du manifeste)

Rejouer `comparaison-seed-referentiel-advisor.sql` (même répertoire) contre
Production. Zéro ligne `ECRASEE` attendu (dernière mesure : 09/09/2026, 0/37).
Une ligne `ECRASEE` bloque l'application sans réserve — chaque champ
divergent doit être examiné avant de confirmer.

## 2. Cohérence `site`/`site_id` (condition implicite de #3, déjà appliquée par la migration elle-même — mesure de vérification)

```sql
select count(*) as shifts_site_divergent
  from public.shifts where site_id is distinct from site;

select count(*) as mission_catalog_site_divergent
  from public.mission_catalog where site is distinct from site_id;
```

Ces deux nombres seront ramenés à zéro PAR la migration #3 elle-même (elle
répare avant de contraindre) — cette requête sert à documenter l'ampleur
réelle juste avant l'exécution, pas à décider d'appliquer ou non #3.

## 3. Résolution du fuseau par site (condition implicite de #4)

**Corrigé le 10/09/2026 — la requête d'origine ne pouvait pas s'exécuter.**
Elle lisait `s.timezone`, colonne que la migration #4 *ajoute* : avant
application, `column s.timezone does not exist`. Une requête de pré-mesure ne
peut pas interroger l'état d'après. Elle demande donc maintenant ce que la
migration *résoudra*, à partir de ce qui existe déjà :

```sql
select s.site_id,
       (select 1 from information_schema.columns
         where table_schema='public' and table_name='sites' and column_name='timezone') is not null
         as colonne_timezone_deja_presente,
       c.fuseau_horaire as fuseau_station_config,
       (c.fuseau_horaire is not null
        and exists (select 1 from pg_timezone_names where name = c.fuseau_horaire)) as sera_repris_automatiquement,
       (s.site_id in ('vito-sainte-marie','nexus-station-test','site-fantome-test'))
         as couvert_par_decision_explicite
  from public.sites s
  left join public.station_config c on c.site = s.site_id
 order by s.site_id;
```

`colonne_timezone_deja_presente` doit rendre **false** : si elle rend `true`,
la migration #4 a déjà été appliquée et ce document ne mesure plus l'avant.

Un site où `sera_repris_automatiquement` est faux ET `fuseau_actuel` est nul
recevra une décision explicite (étape 4 de la migration #4) — vérifier
qu'aucun nouveau site n'a été créé depuis la dernière mesure sans que cette
ligne ne le couvre.

## 4. Reprise des services ouverts (condition #6 du manifeste)

Reproduit exactement le CTE `a_reprendre` de
`20260905170000_reprise_et_unicite_shifts_en_cours.sql`, en lecture seule :

```sql
with fuseau as (
  -- Pré-image de `sites.timezone`, que la migration #4 n'a pas encore posée :
  -- exactement ce qu'elle y écrira (station_config si le fuseau est valide,
  -- sinon la décision explicite portée par la migration pour les trois sites
  -- connus). Rejouer le CTE tel quel échouerait — `s.timezone` n'existe pas.
  select s.site_id,
         coalesce(
           (select c.fuseau_horaire from public.station_config c
             where c.site = s.site_id and c.fuseau_horaire is not null
               and exists (select 1 from pg_timezone_names where name = c.fuseau_horaire)),
           case when s.site_id in ('vito-sainte-marie','nexus-station-test','site-fantome-test')
                then 'America/Martinique' end) as tz
    from public.sites s),
a_reprendre as (
  select sh.id, sh.employee_id, sh.heure_debut,
         (sh.heure_debut at time zone f.tz)::date as jour_station
  from public.shifts sh
  join public.employees e on e.id = sh.employee_id
  join public.sites s on s.site_id = e.site_id
  join fuseau f on f.site_id = s.site_id
  where sh.statut = 'en_cours'
    and (
      (sh.heure_debut at time zone f.tz)::date
        < (now() at time zone f.tz)::date
      or sh.id <> (
        select sh2.id from public.shifts sh2
        where sh2.employee_id = sh.employee_id and sh2.statut = 'en_cours'
        order by sh2.heure_debut desc limit 1
      )
    )
)
select count(*) as services_qui_seraient_clos_sans_pointage from a_reprendre;

select count(*) as services_en_cours_total
  from public.shifts where statut = 'en_cours';
```

**Critère de fenêtre (déjà posé par `plan-reparation-rollback-1.md`)** :
documenter `services_en_cours_total` et expliquer tout écart de plus d'un
facteur 2 avec la mesure de référence du 08/09/2026 (16). Ne pas exécuter #6
sans cette explication.

## 5. Absence d'écriture concurrente au moment précis (heuristique, pas une garantie)

```sql
select pid, state, query_start, left(query, 120) as debut_requete
  from pg_stat_activity
 where datname = current_database()
   and state <> 'idle'
   and query ilike any (array['%insert into public.shifts%', '%update public.shifts%',
                               '%insert into public.mission_catalog%', '%update public.mission_catalog%']);
```

Une ligne retournée signale une écriture en vol sur les tables touchées par
#3 ou #6 — reporter l'exécution de quelques secondes plutôt que de risquer un
verrou ou une donnée écrite entre la mesure et l'application.

## 6. Migration 21 — confirmation que rien n'a changé

```sql
select to_regclass('public.nexus_live_events') is not null as table_existe_deja_en_production;
```

Si cette requête retourne `true` sans qu'aucune migration Production dédiée
n'ait été ajoutée entre-temps, **arrêter** : cela signifierait qu'une
écriture hors migration a créé la table en Production, ce qui contredit tout
ce lot — remonter par Handoff avant de poursuivre.

## Ce que ce document ne fait pas

Il n'exécute rien. Il ne remplace pas le jugement sur la fenêtre de
déploiement (activité métier réelle, pas seulement un nombre). Il ne mesure
pas PREPROD ni la répétition Test (voir `plan-repetition-preprod-test-1.md`).
