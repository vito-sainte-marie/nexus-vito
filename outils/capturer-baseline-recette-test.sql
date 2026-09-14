-- NEXUS — capture, EN LECTURE SEULE, la ligne de recette de nexus-test
-- (09/09/2026, lot NEXUS-PRODUCTION-READINESS-1-20260908, decision-4.md).
--
-- POURQUOI CE FICHIER EXISTE. outils/reconstruire-base-test.sh remet le
-- schéma `public` à zéro (drop schema public cascade) puis rejoue les
-- migrations versionnées. Aucune migration de ce dépôt n'insère la ligne
-- `nexus-station-test` de public.sites/public.station_config, ni les quatre
-- comptes de recette dans public.employees (manager-test, createur-test,
-- employe-test-a, employe-test-b) : ils ont été créés à la main, hors du
-- dépôt, un jour donné — une reconstruction les efface sans les recréer.
-- C'est le trou exact que decision-4.md demande de traiter explicitement.
--
-- `auth.users`, lui, vit dans un schéma distinct que la reconstruction NE
-- TOUCHE PAS (vérifié en lisant reconstruire-base-test.sh : il ne drop que
-- `public`, `supabase_migrations`, et les policies de `storage.objects`).
-- Les quatre comptes Supabase Auth et leurs UUID survivent donc à une
-- reconstruction. Capturer employees.id AVANT et le REJOUER tel quel APRÈS
-- reconstitue exactement la contrainte employees_id_fkey -> auth.users(id)
-- (baseline, ligne 1377) sans jamais avoir besoin de l'API d'administration
-- Supabase ni d'un nouveau secret service_role : aucune extension de
-- privilège, conforme à decision-4.md.
--
-- COLONNES DÉCOUVERTES DYNAMIQUEMENT (to_jsonb + jsonb_each_text), jamais
-- listées en dur. station_config seul a reçu plus de dix
-- `alter table ... add column` depuis sa création (raccourcis,
-- cuves_carburants, fuseau_horaire, reception_carburant_config,
-- carburant_commande_config, source_planning_officiel...). Une liste de
-- colonnes figée ici deviendrait une seconde vérité qui se périme au
-- premier ajout de colonne — exactement ce que
-- comparaison-seed-referentiel-advisor.sql (même lot) évite pour la même
-- raison, à l'inverse.
--
-- N'ÉCRIT RIEN : uniquement des SELECT. Aucune donnée personnelle : les
-- trois requêtes ne visent QUE la station de recette
-- (site_id/site = 'nexus-station-test', employees.compte_test = true).
--
-- USAGE — à exécuter AVANT reconstruire-base-test.sh, avec la MÊME
-- connexion (c'est la seule fenêtre où ces lignes existent encore) :
--
--   psql "$URL" -tAc "$(cat outils/capturer-baseline-recette-test.sql)" \
--     > /tmp/baseline-recette-test.sql
--
-- Puis, APRÈS reconstruire-base-test.sh, avec la même connexion :
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f /tmp/baseline-recette-test.sql
--
-- Si sites ou station_config n'a AUCUNE ligne pour nexus-station-test, le
-- `having count(*) > 0` ci-dessous fait renvoyer ZÉRO ligne à ce SELECT —
-- jamais une instruction `insert into ... () values ()` malformée. `psql
-- -tAc` n'écrit alors rien pour cette table : un fichier de capture plus
-- court que prévu (moins de 3 lignes non vides) est le signal explicite
-- qu'une table n'avait rien à capturer, pas une erreur silencieuse.
-- Vérifier le contenu de /tmp/baseline-recette-test.sql avant de le rejouer
-- s'il compte moins de 3 lignes.

-- 1) public.sites — la ligne nexus-station-test (au plus 1 ligne)
select format(
  'insert into public.sites (%s) values (%s) on conflict (site_id) do update set %s;',
  string_agg(quote_ident(cle), ', ' order by cle),
  string_agg(quote_nullable(valeur), ', ' order by cle),
  string_agg(format('%I = excluded.%I', cle, cle), ', ' order by cle) filter (where cle <> 'site_id')
)
from public.sites s, lateral jsonb_each_text(to_jsonb(s)) as kv(cle, valeur)
where s.site_id = 'nexus-station-test'
having count(*) > 0;

-- 2) public.station_config — la ligne nexus-station-test (au plus 1 ligne)
select format(
  'insert into public.station_config (%s) values (%s) on conflict (site) do update set %s;',
  string_agg(quote_ident(cle), ', ' order by cle),
  string_agg(quote_nullable(valeur), ', ' order by cle),
  string_agg(format('%I = excluded.%I', cle, cle), ', ' order by cle) filter (where cle <> 'site')
)
from public.station_config c, lateral jsonb_each_text(to_jsonb(c)) as kv(cle, valeur)
where c.site = 'nexus-station-test'
having count(*) > 0;

-- 3) public.employees — les comptes de recette du site (0 à N lignes,
--    typiquement 4 : manager-test, createur-test, employe-test-a,
--    employe-test-b). `id` est capturé et rejoué TEL QUEL : c'est l'UUID
--    auth.users qui n'a jamais bougé, la contrainte de clé étrangère
--    échouera bruyamment (pas silencieusement) si ce n'est plus vrai.
select string_agg(
  format(
    'insert into public.employees (%s) values (%s) on conflict (id) do update set %s;',
    cols, vals, upds
  ),
  E'\n' order by e.id
)
from public.employees e
cross join lateral (
  select
    string_agg(quote_ident(kv.cle), ', ' order by kv.cle) as cols,
    string_agg(quote_nullable(kv.valeur), ', ' order by kv.cle) as vals,
    string_agg(format('%I = excluded.%I', kv.cle, kv.cle), ', ' order by kv.cle)
      filter (where kv.cle <> 'id') as upds
  from jsonb_each_text(to_jsonb(e)) as kv(cle, valeur)
) x
where e.site_id = 'nexus-station-test' and e.compte_test = true;
