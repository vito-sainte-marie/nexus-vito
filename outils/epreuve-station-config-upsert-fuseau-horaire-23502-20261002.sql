-- Reproduction comportementale portable — anomalie terrain « Enregistrer les
-- prix du mois » (Carburants), issue #28, 02/10/2026.
--
-- NON EXÉCUTÉ depuis le canal qui a produit ce fichier (aucun accès Supabase
-- disponible dans un run `claude.yml` déclenché par commentaire GitHub —
-- `permissions: contents: read`, par conception). À exécuter par quiconque
-- dispose d'un accès réel à `nexus-test` (ou toute base portant le même
-- schéma `station_config`), via `psql` ou l'éditeur SQL Supabase.
--
-- Ce que ce fichier prouve, dans l'ordre :
--   PARTIE A — AVANT le correctif (migration
--     20261002000000_station_config_fuseau_horaire_nullable NON encore
--     appliquée) : l'upsert exact que fait l'application
--     (`NEXUS-App-v1.html` / `NEXUS-Parametres-Station-v1.html`,
--     `on_conflict=site`) échoue avec 23502 sur `fuseau_horaire` — AUSSI BIEN
--     pour un site qui n'a encore aucune ligne `station_config` QUE pour un
--     site qui en a déjà une (la ligne proposée est validée, NOT NULL
--     compris, avant même que PostgreSQL ne regarde s'il y a conflit).
--   PARTIE B — APRÈS application du correctif : le même upsert, à l'identique,
--     réussit dans les deux cas.
--
-- Chaque partie opère dans sa propre transaction, ROLLBACK en sortie : aucune
-- ligne fabriquée n'est jamais laissée en base, quel que soit le résultat.
-- `site` utilisé : une valeur manifestement de test, jamais un site réel.

-- VERBOSITÉ VERBEUSE — AJOUT DU 03/10/2026, ET CE N'EST PAS UN CONFORT.
-- À la verbosité par défaut, psql n'imprime PAS le SQLSTATE : une vraie
-- violation de non-nullité s'affiche
--     ERROR:  null value in column "horaires" of relation "station_config" ...
-- sans le code. Le garde-fou de l'étape 52 de `tests.yml` cherchait pourtant la
-- chaîne « 23502 » dans cette sortie : il était AVEUGLE au défaut qu'il est
-- censé détecter. Avec `VERBOSITY verbose`, la même erreur s'imprime
--     ERROR:  23502: null value in column "horaires" ...
-- et le code devient observable. Mesuré les deux fois, pas déduit.
\set VERBOSITY verbose

\set site_neuf 'nexus-test-repro-23502-neuf'
\set site_existant 'nexus-test-repro-23502-existant'

-- ============================================================================
-- PARTIE A — reproduction du défaut (AVANT le correctif)
-- ============================================================================

begin;

-- A1. Site SANS ligne station_config existante (chemin INSERT).
--     Payload strictement identique à NEXUS-App-v1.html::rappelSauvegarderPrix
--     (site, prix_carburants, horaires, updated_at — jamais fuseau_horaire).
insert into station_config (site, prix_carburants, horaires, updated_at)
values (
  :'site_neuf',
  '{"mois":"2026-10","sp":2.10,"go":1.95,"gnr":1.40,"maj_par":"Test repro","maj_le":"2026-10-02T00:00:00.000Z"}'::jsonb,
  '{"quart1":{"normal":"05:45","fin_normal":"12:45"},"quart2":{"normal":"12:45","fin_normal":"19:45"}}'::jsonb,
  now()
)
on conflict (site) do update set
  prix_carburants = excluded.prix_carburants,
  horaires = excluded.horaires,
  updated_at = excluded.updated_at;
-- ATTENDU avant correctif : ERREUR 23502 — null value in column
-- "fuseau_horaire" violates not-null constraint. Si cette instruction a
-- échoué, PostgreSQL a déjà annulé la transaction : passer directement à
-- `rollback;` ci-dessous (tout autre ordre lèverait « current transaction is
-- aborted »), puis reproduire le cas A2 dans une NOUVELLE transaction.

rollback;

begin;

-- A2. Site AVEC une ligne station_config déjà existante (chemin conflit réel)
--     — celui du terrain : un manager qui enregistre un nouveau prix sur une
--     station déjà configurée.
insert into station_config (site, horaires, fuseau_horaire, updated_at)
values (:'site_existant', '{"quart1":{"normal":"05:45","fin_normal":"12:45"}}'::jsonb, 'America/Martinique', now());

-- Même upsert que ci-dessus, sur un site qui a DÉJÀ une ligne : la croyance
-- naïve (« NOT NULL ne mord qu'à la création ») prédit un succès ici.
insert into station_config (site, prix_carburants, horaires, updated_at)
values (
  :'site_existant',
  '{"mois":"2026-10","sp":2.10,"go":1.95,"gnr":1.40}'::jsonb,
  '{"quart1":{"normal":"05:45","fin_normal":"12:45"}}'::jsonb,
  now()
)
on conflict (site) do update set
  prix_carburants = excluded.prix_carburants,
  horaires = excluded.horaires,
  updated_at = excluded.updated_at;
-- ATTENDU avant correctif : la MÊME ERREUR 23502, bien que la ligne existe
-- déjà — preuve que PostgreSQL valide la ligne PROPOSÉE (fuseau_horaire =
-- NULL, faute de défaut) avant de détecter le conflit, et non après.

rollback;

-- ============================================================================
-- PARTIE B — après application de la migration
-- 20261002000000_station_config_fuseau_horaire_nullable.sql
-- (alter table station_config alter column fuseau_horaire drop not null;)
-- ============================================================================

begin;

insert into station_config (site, prix_carburants, horaires, updated_at)
values (
  :'site_neuf',
  '{"mois":"2026-10","sp":2.10,"go":1.95,"gnr":1.40,"maj_par":"Test repro","maj_le":"2026-10-02T00:00:00.000Z"}'::jsonb,
  '{"quart1":{"normal":"05:45","fin_normal":"12:45"},"quart2":{"normal":"12:45","fin_normal":"19:45"}}'::jsonb,
  now()
)
on conflict (site) do update set
  prix_carburants = excluded.prix_carburants,
  horaires = excluded.horaires,
  updated_at = excluded.updated_at;
-- ATTENDU après correctif : SUCCÈS (INSERT 0 1 ou équivalent), fuseau_horaire
-- de la ligne créée vaut NULL — jamais une valeur devinée.
\echo ''
\echo 'REQUEST-20 CAS-1 — INSERT site neuf : ligne relue ci-dessous.'
select site, fuseau_horaire, prix_carburants is not null as a_un_prix
  from station_config where site = :'site_neuf';

insert into station_config (site, horaires, fuseau_horaire, updated_at)
values (:'site_existant', '{"quart1":{"normal":"05:45","fin_normal":"12:45"}}'::jsonb, 'America/Martinique', now());

insert into station_config (site, prix_carburants, horaires, updated_at)
values (
  :'site_existant',
  '{"mois":"2026-10","sp":2.10,"go":1.95,"gnr":1.40}'::jsonb,
  '{"quart1":{"normal":"05:45","fin_normal":"12:45"}}'::jsonb,
  now()
)
on conflict (site) do update set
  prix_carburants = excluded.prix_carburants,
  horaires = excluded.horaires,
  updated_at = excluded.updated_at;
-- ATTENDU après correctif : SUCCÈS. fuseau_horaire reste 'America/Martinique'
-- (valeur déjà en base, NON écrasée — l'upsert ne liste pas cette colonne
-- dans son SET, PostgREST/Supabase ne modifie que les colonnes du payload).
\echo ''
\echo 'REQUEST-20 CAS-2 — INSERT ... ON CONFLICT site existant : ligne relue ci-dessous.'
select site, fuseau_horaire, prix_carburants is not null as a_un_prix
  from station_config where site = :'site_existant';

rollback;

-- PARTIE D — APRÈS L'ANNULATION : AUCUNE DONNÉE SYNTHÉTIQUE NE SURVIT.
-- Ajoutée le 03/10/2026. Ce n'est pas une redite du `rollback` qui précède :
-- c'est la seule partie de l'épreuve qui MESURE son innocuité au lieu de la
-- supposer. Elle s'exécute hors transaction, donc elle voit l'état réel.
--
-- Les deux identifiants sont RÉÉCRITS EN CLAIR ici, et non repris de
-- :'site_neuf' / :'site_existant'. Mesuré le 03/10/2026, pas supposé : psql
-- n'interpole PAS ses variables dans une chaîne dollar-quotée —
--     do $x$ begin raise notice '%', :'site_neuf'; end $x$;
--     ERROR:  syntax error at or near ":"
-- Toute tentative de les factoriser ici casserait l'épreuve.
do $$
declare
  n integer;
begin
  select count(*) into n from station_config
    where site in ('nexus-test-repro-23502-neuf', 'nexus-test-repro-23502-existant');
  if n <> 0 then
    raise exception using errcode = 'P0001', message = format(
      'REQUEST-20 ÉCHEC : %s ligne(s) synthétique(s) ont survécu à l''épreuve — l''annulation n''a pas tenu.',
      n);
  end if;
  raise notice 'REQUEST-20 : aucune ligne synthétique résiduelle (0 sur les deux identifiants).';
end
$$;

-- MARQUEUR TERMINAL — LU PAR L'ÉTAPE 52 DE `tests.yml`, C'EST SON VERSANT POSITIF.
-- Avec `ON_ERROR_STOP=1`, atteindre cette ligne prouve que TOUTES les
-- instructions qui précèdent ont réussi : les deux `insert`, l'`on conflict`,
-- les trois `rollback` et le contrôle d'innocuité ci-dessus.
-- Pourquoi un versant positif est indispensable : une épreuve qui n'aurait rien
-- exécuté du tout rendrait une sortie vide, et une sortie vide ne contient aucun
-- « 23502 » — l'ancien garde-fou l'aurait donc déclarée VERTE.
\echo ''
\echo 'REQUEST-20 : ÉPREUVE MENÉE À TERME — les deux cas ont été joués, puis annulés.'


-- Aucune ligne de ce fichier ne survit à son exécution (ROLLBACK systématique
-- en fin de chaque partie) : aucune donnée fabriquée n'est laissée en base,
-- quel que soit le résultat obtenu.
