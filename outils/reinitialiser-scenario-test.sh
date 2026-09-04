#!/usr/bin/env bash
# NEXUS Test — remettre les scénarios à zéro (04/09/2026).
#
# Efface les DONNÉES produites par les comptes de recette, sans jamais
# toucher aux IDENTITÉS. Les comptes d'authentification, leurs codes et
# leurs lignes `employees` survivent : recréer les comptes obligerait à
# redistribuer un code à chaque scénario, et ferait perdre tout l'intérêt
# d'un environnement stable.
#
# Le site sentinelle est vérifié à la fin : toute ligne métier qui y
# apparaîtrait révélerait un code oubliant de transmettre son `site_id`.
#
# Usage :
#   outils/reinitialiser-scenario-test.sh <project-ref>
#
# REFUSE de s'exécuter sur le projet de production.

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
SITE_TEST="nexus-station-test"
SENTINELLE="vito-sainte-marie"

# Domaine de synthèse des adresses de connexion. Ce n'est PAS une propriété
# d'environnement — c'est la convention interne de NEXUS-Login-v1.html, qui
# construit `<username>@vito-nexus.local` avant d'appeler Supabase Auth. Elle
# doit donc être la même en recette et en production.
#
# Le 04/09/2026, elle ne l'était pas : les comptes de `nexus-test` avaient été
# créés en `@nexus-test.local`, et ce script se contentait de les compter sous
# ce domaine-là. Résultat, aucune connexion ne pouvait aboutir sur la recette,
# et rien ne le signalait — le compte existait, l'écran demandait une adresse
# qui n'existait pas. Les contrôles de connexion n'avaient jamais pu être
# passés. D'où le contrôle explicite en fin de script.
DOMAINE_LOGIN="vito-nexus.local"
REF="${1:-}"

[ -n "$REF" ] || { echo "Usage : $0 <project-ref>" >&2; exit 2; }
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION." >&2; exit 3
fi

MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
[ -n "$MDP" ] || { echo "Mot de passe absent du trousseau (service « nexus-test-db »)." >&2; exit 4; }
export PGPASSWORD="$MDP"; unset MDP
URL="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require"

echo "Réinitialisation des scénarios de $SITE_TEST…"
echo

psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 <<SQL
begin;

-- Données de scénario, listées explicitement : on n'efface jamais « tout ce
-- qui traîne », on nomme ce qu'on supprime.
delete from public.mission_progress            where site_id = '$SITE_TEST';
delete from public.mission_completions         where site_id = '$SITE_TEST';
delete from public.mission_assignments         where site_id = '$SITE_TEST';
delete from public.shifts                      where site_id = '$SITE_TEST';
delete from public.pointages                   where site   = '$SITE_TEST';
delete from public.employee_indisponibilites   where site_id = '$SITE_TEST';
delete from public.planning_shifts             where site_id = '$SITE_TEST';
delete from public.audits_caisse               where site   = '$SITE_TEST';
delete from public.inventaire_comptages        where site   = '$SITE_TEST';
delete from public.inventaire_mouvements       where site   = '$SITE_TEST';
delete from public.nexus_paye_items            where site_id = '$SITE_TEST';
delete from public.nexus_paye_periodes         where site_id = '$SITE_TEST';
delete from public.nexus_paye_employee_settings where site_id = '$SITE_TEST';
delete from public.progression_points_ledger   where site_id = '$SITE_TEST';

commit;
SQL

echo "État après réinitialisation :"
psql "$URL" --quiet --no-psqlrc -t -A -F' · ' <<SQL
select 'identités conservées', count(*)::text
  from auth.users u join public.employees e on e.id = u.id
  where e.site_id = '$SITE_TEST';
select 'lignes employees conservées', count(*)::text from public.employees where site_id = '$SITE_TEST';
select 'services restants', count(*)::text from public.shifts where site_id = '$SITE_TEST';
select 'coches restantes', count(*)::text from public.mission_progress where site_id = '$SITE_TEST';
SQL

echo
echo "Contrôle de la convention de connexion :"
ECARTS=$(psql "$URL" --quiet --no-psqlrc -t -A -c "
select coalesce(string_agg(u.email, ', ' order by u.email), '')
from auth.users u
join public.employees e on e.id = u.id
where e.site_id = '$SITE_TEST'
  and u.email is distinct from e.username || '@$DOMAINE_LOGIN';
")

if [ -n "$ECARTS" ]; then
  echo "  ÉCHEC — ces identités ne suivent pas la convention de l'écran de" >&2
  echo "  connexion (<username>@$DOMAINE_LOGIN) : $ECARTS" >&2
  echo "  Aucune connexion ne pourra aboutir pour ces comptes." >&2
  exit 4
fi
echo "  OK — les identités suivent <username>@$DOMAINE_LOGIN."

echo
echo "Contrôle du site sentinelle :"
SENTINELLE_LIGNES=$(psql "$URL" --quiet --no-psqlrc -t -A -c "
select coalesce(sum(n),0) from (
  select count(*) n from public.shifts          where site_id = '$SENTINELLE'
  union all select count(*) from public.mission_progress  where site_id = '$SENTINELLE'
  union all select count(*) from public.pointages         where site   = '$SENTINELLE'
  union all select count(*) from public.audits_caisse     where site   = '$SENTINELLE'
  union all select count(*) from public.mission_completions where site_id = '$SENTINELLE'
) x;")

if [ "$SENTINELLE_LIGNES" != "0" ]; then
  echo "  ÉCHEC — $SENTINELLE_LIGNES ligne(s) métier sur le site sentinelle."
  echo "  Un code a écrit sans transmettre son site_id. C'est exactement ce que"
  echo "  ce site est là pour révéler : à corriger avant d'aller plus loin."
  exit 1
fi
echo "  OK — aucune ligne métier sur le site sentinelle."
