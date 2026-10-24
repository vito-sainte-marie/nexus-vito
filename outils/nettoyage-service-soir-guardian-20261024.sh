#!/usr/bin/env bash
# NEXUS Test — nettoyage du service du soir ouvert par Claude Guardian (24/10/2026).
#
# Guardian a ouvert un quart du soir pour « Employé Test B » (pompiste) sur
# nexus-station-test pour mesurer l'Inventaire (mesure « avant » du lot
# INVENTAIRE-RELECTURES-20261024). Ce script supprime ce seul service et sa ligne `inventaire_quart_employes` (clé étrangère sans cascade).
# Borne : site nexus-station-test, employé 755a2dc5-…, shift 50175943-…, statut
# en_cours, créé le 24/10/2026 entre 19:30 et 19:50 UTC. Rejouable : une seconde
# exécution ne trouve rien. REFUSE Production et tout projet autre que nexus-test.
#
# Usage :
#   outils/nettoyage-service-soir-guardian-20261024.sh <project-ref>             # simulation (rollback)
#   outils/nettoyage-service-soir-guardian-20261024.sh <project-ref> --executer  # commit

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
select id::text, role, quart, statut, heure_debut from public.shifts
 where id='50175943-f21b-42ae-aba2-09479f940109' and site_id='nexus-station-test';

delete from public.inventaire_quart_employes where shift_id='50175943-f21b-42ae-aba2-09479f940109';
delete from public.shifts
 where id='50175943-f21b-42ae-aba2-09479f940109' and site_id='nexus-station-test'
   and employee_id='755a2dc5-3390-4a29-a865-847cbebc1133' and statut='en_cours'
   and created_at >= '2026-10-24 19:30:00+00' and created_at < '2026-10-24 19:50:00+00';

\echo '=== Après ($MODE) ==='
select count(*) as restant from public.shifts where id='50175943-f21b-42ae-aba2-09479f940109';
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Nettoyage VALIDÉ (commit)."; else echo "→ Simulation seulement (rollback). Relancer avec --executer."; fi
