#!/usr/bin/env bash
# NEXUS Test — nettoyage borné des services de recette pompiste (Lot 3, 23/10/2026).
#
# Retire UNIQUEMENT les services (public.shifts) créés pour Employé Test B pendant la
# recette du parcours pompiste, désignés par identifiant :
#   d4f52c83-d241-49c2-ae7b-f5a044f5cf06  pompiste soir  (22/10, clos_sans_pointage)
#   ed1cc859-0a4f-4214-aa99-11f1b71dfe63  pompiste matin (23/10, en_cours)
# Garde-fous :
#   - REFUSE Production et tout projet autre que nexus-test ;
#   - SIMULATION par défaut (rollback) ; --executer pour valider ;
#   - bornes cumulées : site nexus-station-test, employé 755a2dc5-…, identifiants ci-dessus ;
#   - affiche d'abord les lignes exactes, puis les dépendants ; un service qui a des
#     dépendants n'est PAS retiré (le script le dit) ;
#   - ne touche aucun service d'un autre auteur (autres employés, caissières, CI).
# Rejouable : une seconde exécution ne trouve rien.
#
# ATTENTION : ed1cc859 est le service de la mesure de performance de l'Inventaire (même
# compte, même quart) : ne pas l'exécuter avant la mesure « après ».
#
# Usage :
#   outils/nettoyage-services-recette-pompiste-20261023.sh <project-ref>             # simulation
#   outils/nettoyage-services-recette-pompiste-20261023.sh <project-ref> --executer  # commit

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

create temp table _borne on commit drop as
select 'nexus-station-test'::text as site,
       '755a2dc5-3390-4a29-a865-847cbebc1133'::uuid as emp,
       array['d4f52c83-d241-49c2-ae7b-f5a044f5cf06','ed1cc859-0a4f-4214-aa99-11f1b71dfe63']::uuid[] as ids;

create temp table _shifts on commit drop as
select s.id from public.shifts s, _borne b
 where s.id = any(b.ids) and s.site_id = b.site and s.employee_id = b.emp;

\echo '=== Lignes exactes visées (2 attendues au plus) ==='
select s.id, s.employee_id, s.site_id, s.role, s.quart, s.statut, s.created_at
  from public.shifts s where s.id in (select id from _shifts) order by s.created_at;

\echo
\echo '=== Dépendants (un service avec dépendants n est pas retiré) ==='
select s.id,
  (select count(*) from public.role_changes   where shift_id = s.id) as role_changes,
  (select count(*) from public.pointages      where service_id = s.id) as pointages,
  (select count(*) from public.mission_progress where shift_id = s.id) as mission_progress,
  (select count(*) from public.fdj_shifts     where prise_de_poste_id = s.id) as fdj_shifts
from _shifts s;

\echo
\echo '=== Retrait ($MODE) ==='
delete from public.shifts s
 where s.id in (select id from _shifts)
   and not exists (select 1 from public.role_changes   where shift_id = s.id)
   and not exists (select 1 from public.pointages      where service_id = s.id)
   and not exists (select 1 from public.mission_progress where shift_id = s.id)
   and not exists (select 1 from public.fdj_shifts     where prise_de_poste_id = s.id);

\echo '=== Restant (désignés) ==='
select count(*) as restants from public.shifts where id = any((select ids from _borne));
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Retrait VALIDÉ (commit)."; else echo "→ Simulation seulement : rien n'a été retiré (rollback). Relancer avec --executer."; fi
