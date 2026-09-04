#!/usr/bin/env bash
# NEXUS — reconstruction complète d'une base à partir des migrations
# versionnées (04/09/2026).
#
# C'est l'épreuve de vérité du dépôt de migrations : si ce script ne
# reconstruit pas une base vide à l'identique, alors nos migrations ne sont
# pas une source de vérité, et la procédure de retour arrière n'en est pas
# une non plus.
#
# S'ARRÊTE À LA PREMIÈRE ERREUR, en nommant le fichier fautif — exigence de
# Frédéric : on ne poursuit jamais une reconstruction après un échec, sous
# peine de ne plus savoir ce qui est réellement en base.
#
# Le mot de passe n'est JAMAIS passé en argument (il serait visible dans la
# liste des processus) ni écrit dans le dépôt : il est lu dans le trousseau
# du Mac. Pour l'y déposer une fois :
#
#   security add-generic-password -a nexus -s nexus-test-db -w
#
# (la commande demande le mot de passe sans l'afficher)
#
# Usage :
#   outils/reconstruire-base-test.sh <project-ref>
#
# Ce script REFUSE de s'exécuter sur le projet de production.

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
REF="${1:-}"

if [ -z "$REF" ]; then
  echo "Usage : $0 <project-ref>" >&2; exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION. Ce script reconstruit une base depuis zéro." >&2
  exit 3
fi

MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
if [ -z "$MDP" ]; then
  echo "Mot de passe introuvable dans le trousseau (compte « nexus », service « nexus-test-db »)." >&2
  echo "Le déposer avec :  security add-generic-password -a nexus -s nexus-test-db -w" >&2
  exit 4
fi

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
export PGPASSWORD="$MDP"; unset MDP
# Connexion DIRECTE plutôt que par le pooler : le nom d'hôte du pooler
# dépend de la région ET de l'instance (aws-0, aws-1…), et une erreur dessus
# produit un « tenant not found » qu'on prend à tort pour un mauvais mot de
# passe. L'hôte direct, lui, se déduit de la seule référence du projet.
URL="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require"

# Remise à zéro FIDÈLE. Deux pièges découverts le 04/09/2026 :
#
#   1. `drop schema public cascade` emporte aussi les PRIVILÈGES PAR DÉFAUT
#      que Supabase pose à la création d'un projet. Sans eux, les tables
#      créées ensuite n'héritent d'aucun droit anon / authenticated, et la
#      base reconstruite se comporte autrement que la production — plus
#      restrictive, donc trompeuse.
#   2. Les reposer APRÈS coup par un `grant all` global est pire : cela
#      écrase les révocations que certaines migrations ont appliquées au fil
#      du temps, et rend la base de test plus PERMISSIVE que la production.
#      C'est le sens dangereux de l'erreur.
#
# On les repose donc AVANT de rejouer : chaque table naît avec les mêmes
# droits qu'en production, et les révocations des migrations s'appliquent
# ensuite dans le bon ordre.
if [ "${REINITIALISER:-oui}" = "oui" ]; then
  echo "Remise à zéro du schéma public…"
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 <<'REINIT'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
drop schema if exists supabase_migrations cascade;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text,
  created_by text, idempotency_key text unique, rollback text[]);

-- Storage vit HORS du schéma public : sans ce nettoyage, ses politiques
-- survivent à la remise à zéro et la migration qui les crée échoue au
-- rejeu avec « policy already exists ». On avait d'abord pris cet échec
-- pour un artefact sans importance — à tort : NEXUS stocke des photos de
-- missions et des justificatifs, et une reconstruction qui laisse tomber
-- Storage n'est pas une reconstruction.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects'
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;
-- Les buckets, eux, ne sont pas supprimés : storage.buckets est protégée
-- contre la suppression directe (trigger storage.protect_delete), et leurs
-- migrations de création sont idempotentes. Seules les politiques doivent
-- partir, car elles, ne le sont pas.
REINIT
fi

echo "Reconstruction de $REF depuis $(ls "$RACINE"/supabase/migrations/*.sql | wc -l | tr -d ' ') migrations."
echo

n=0
for f in "$RACINE"/supabase/migrations/*.sql; do
  n=$((n+1))
  nom="$(basename "$f")"
  printf "  [%02d] %-72s " "$n" "$nom"
  if sortie="$(psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$f" 2>&1)"; then
    v="${nom%%_*}"; libelle="${nom#*_}"; libelle="${libelle%.sql}"
    psql "$URL" --quiet --no-psqlrc -c \
      "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '$libelle') on conflict do nothing;" >/dev/null 2>&1
    echo "OK"
  else
    echo "ÉCHEC"
    echo
    echo "──────────────────────────────────────────────────────────────"
    echo "Migration en échec : $nom"
    echo "Cause :"
    echo "$sortie" | grep -E '^psql:|ERROR|ERREUR' | head -20 | sed 's/^/  /'
    echo "──────────────────────────────────────────────────────────────"
    echo "Reconstruction interrompue. Aucune migration suivante n'a été appliquée."
    exit 1
  fi
done

echo
echo "Les $n migrations se rejouent intégralement sur une base vide."
echo
echo "Volumes obtenus :"
psql "$URL" --quiet --no-psqlrc -t -c "
  select '  tables : '||count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
  union all select '  vues   : '||count(*) from information_schema.tables where table_schema='public' and table_type='VIEW'
  union all select '  RLS    : '||count(*)||' table(s) protégée(s)' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  union all select '  lignes sites : '||count(*) from public.sites;"
