#!/usr/bin/env bash
# NEXUS Test : retire le quart d'inventaire du soir du 24/10/2026 et son plan, créés
# par la mesure « avant » de Claude Guardian (ouverture du quart du soir, ~19:40 UTC).
# GARDE le service (shifts) : il sert à la mesure « après ». Le lien
# inventaire_quart_employes part avec le quart (ON DELETE CASCADE) ; il se recrée à
# la prochaine ouverture. Les lignes du plan partent avec le plan (CASCADE).
# Borne : site nexus-station-test, ces deux identifiants, créés entre 19:30 et 19:50 UTC,
# aucun comptage rattaché. REFUSE Production et tout projet autre que nexus-test.
#
# Usage :
#   outils/nettoyage-quart-soir-mesure-avant-20261024.sh <project-ref>             # simulation (rollback)
#   outils/nettoyage-quart-soir-mesure-avant-20261024.sh <project-ref> --executer  # commit

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
TEST_REF="udljdqxerrbbbajxubfn"
REF="${1:-}"
MODE="${2:-}"

[ -n "$REF" ] || { echo "Usage : $0 <project-ref> [--executer]" >&2; exit 2; }
if [ "$REF" = "$PROD_REF" ]; then echo "REFUS : $REF est le projet de PRODUCTION." >&2; exit 3; fi
if [ "$REF" != "$TEST_REF" ]; then echo "REFUS : $REF n'est pas nexus-test ($TEST_REF)." >&2; exit 3; fi
case "$MODE" in ""|--executer) ;; *) echo "Option inconnue : $MODE" >&2; exit 2 ;; esac

MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
[ -n "$MDP" ] || { echo "Mot de passe absent du trousseau (service « nexus-test-db »)." >&2; exit 4; }
export PGPASSWORD="$MDP"; unset MDP
URL="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require&connect_timeout=12"

if [ "$MODE" = "--executer" ]; then FIN="commit;"; else FIN="rollback;"; fi

psql "$URL" --no-psqlrc -v ON_ERROR_STOP=1 2>&1 <<SQL | sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'
begin;
\echo '=== Avant ==='
select 'quart' t, count(*) n from public.inventaire_quarts where id='ecc4c248-9973-4b65-bef6-90588e7f3b30'
union all select 'plan', count(*) from public.inventaire_plans_comptage where id='bc2a1c50-0a4c-425f-b61d-082052a54271'
union all select 'lignes de plan', count(*) from public.inventaire_plan_items where plan_id='bc2a1c50-0a4c-425f-b61d-082052a54271'
union all select 'lien quart-employe', count(*) from public.inventaire_quart_employes where quart_id='ecc4c248-9973-4b65-bef6-90588e7f3b30'
union all select 'service conserve', count(*) from public.shifts where id='50175943-f21b-42ae-aba2-09479f940109';

delete from public.inventaire_plans_comptage
 where id='bc2a1c50-0a4c-425f-b61d-082052a54271' and site='nexus-station-test' and date='2026-10-24' and quart='soir'
   and not exists (select 1 from public.inventaire_plan_items where plan_id='bc2a1c50-0a4c-425f-b61d-082052a54271'
                   and (comptage_id is not null or created_at < '2026-10-24 19:30:00+00' or created_at >= '2026-10-24 19:50:00+00'));
delete from public.inventaire_quarts
 where id='ecc4c248-9973-4b65-bef6-90588e7f3b30' and site='nexus-station-test' and date='2026-10-24' and quart='soir'
   and created_at >= '2026-10-24 19:30:00+00' and created_at < '2026-10-24 19:50:00+00'
   and not exists (select 1 from public.inventaire_comptages where quart_id='ecc4c248-9973-4b65-bef6-90588e7f3b30');

\echo '=== Après ($MODE) ==='
select 'quart' t, count(*) n from public.inventaire_quarts where id='ecc4c248-9973-4b65-bef6-90588e7f3b30'
union all select 'plan', count(*) from public.inventaire_plans_comptage where id='bc2a1c50-0a4c-425f-b61d-082052a54271'
union all select 'lignes de plan', count(*) from public.inventaire_plan_items where plan_id='bc2a1c50-0a4c-425f-b61d-082052a54271'
union all select 'lien quart-employe', count(*) from public.inventaire_quart_employes where quart_id='ecc4c248-9973-4b65-bef6-90588e7f3b30'
union all select 'service conserve', count(*) from public.shifts where id='50175943-f21b-42ae-aba2-09479f940109';
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Nettoyage VALIDÉ (commit)."; else echo "→ Simulation seulement (rollback). Relancer avec --executer."; fi
