#!/usr/bin/env bash
# NEXUS Test : retire le quart d'inventaire du soir du 24/10/2026 et son plan, créés
# par la mesure « après » de Claude Guardian (ouverture du quart du soir, 22:50 UTC = 18:50 locale).
# Le service (shifts) est traité par outils/nettoyage-service-soir-guardian-20261024.sh. Le lien
# inventaire_quart_employes part avec le quart (ON DELETE CASCADE). Les lignes du plan partent avec le plan (CASCADE).
# Borne : site nexus-station-test, ces deux identifiants, créés entre 22:30 et 23:10 UTC,
# aucun comptage rattaché. REFUSE Production et tout projet autre que nexus-test.
#
# Usage :
#   outils/nettoyage-quart-soir-mesure-apres-20261024.sh <project-ref>             # simulation (rollback)
#   outils/nettoyage-quart-soir-mesure-apres-20261024.sh <project-ref> --executer  # commit

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
select 'quart' t, count(*) n from public.inventaire_quarts where id='80e30149-ef5a-45e6-807e-b4ba48fe7922'
union all select 'plan', count(*) from public.inventaire_plans_comptage where id='738c27db-7fbb-4991-a57c-dcd7a947f334'
union all select 'lignes de plan', count(*) from public.inventaire_plan_items where plan_id='738c27db-7fbb-4991-a57c-dcd7a947f334'
union all select 'lien quart-employe', count(*) from public.inventaire_quart_employes where quart_id='80e30149-ef5a-45e6-807e-b4ba48fe7922'
union all select 'service (non touche)', count(*) from public.shifts where id='50175943-f21b-42ae-aba2-09479f940109';

delete from public.inventaire_plans_comptage
 where id='738c27db-7fbb-4991-a57c-dcd7a947f334' and site='nexus-station-test' and date='2026-10-24' and quart='soir'
   and not exists (select 1 from public.inventaire_plan_items where plan_id='738c27db-7fbb-4991-a57c-dcd7a947f334'
                   and (comptage_id is not null or created_at < '2026-10-24 22:30:00+00' or created_at >= '2026-10-24 23:10:00+00'));
delete from public.inventaire_quarts
 where id='80e30149-ef5a-45e6-807e-b4ba48fe7922' and site='nexus-station-test' and date='2026-10-24' and quart='soir'
   and created_at >= '2026-10-24 22:30:00+00' and created_at < '2026-10-24 23:10:00+00'
   and not exists (select 1 from public.inventaire_comptages where quart_id='80e30149-ef5a-45e6-807e-b4ba48fe7922');

\echo '=== Après ($MODE) ==='
select 'quart' t, count(*) n from public.inventaire_quarts where id='80e30149-ef5a-45e6-807e-b4ba48fe7922'
union all select 'plan', count(*) from public.inventaire_plans_comptage where id='738c27db-7fbb-4991-a57c-dcd7a947f334'
union all select 'lignes de plan', count(*) from public.inventaire_plan_items where plan_id='738c27db-7fbb-4991-a57c-dcd7a947f334'
union all select 'lien quart-employe', count(*) from public.inventaire_quart_employes where quart_id='80e30149-ef5a-45e6-807e-b4ba48fe7922'
union all select 'service (non touche)', count(*) from public.shifts where id='50175943-f21b-42ae-aba2-09479f940109';
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Nettoyage VALIDÉ (commit)."; else echo "→ Simulation seulement (rollback). Relancer avec --executer."; fi
