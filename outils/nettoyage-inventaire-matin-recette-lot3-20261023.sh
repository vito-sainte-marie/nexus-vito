#!/usr/bin/env bash
# NEXUS Test — retrait borné du quart d'inventaire et du plan du matin du 23/10/2026
# (Employé Test B), pour mesurer la PREMIÈRE ouverture du jour (Lot 3).
#
# Retire UNIQUEMENT, par identifiant :
#   quart  7568f3b4-0a9f-47ad-a266-d72605e17cbf   (inventaire_quarts, matin, 2026-10-23)
#   rattachement employé 71edc336-6d4e-4c93-83cc-b1bacbaab552 (inventaire_quart_employes)
#   plan   22960f98-8245-4d3b-93f8-f3637f66847f   (inventaire_plans_comptage) et ses lignes
# GARDE le service (shifts) ed1cc859-0a4f-4214-aa99-11f1b71dfe63 : jamais touché.
# Bornes cumulées : site nexus-station-test, date 2026-10-23, identifiants ci-dessus, et le
# rattachement doit viser le quart ET l'employé 755a2dc5-… Un quart qui a des dépendants
# (comptages, audit, mouvements, alertes…) n'est PAS retiré. Rien d'un autre auteur.
# REFUSE Production et tout projet autre que nexus-test. Simulation par défaut.
#
# Usage : outils/nettoyage-inventaire-matin-recette-lot3-20261023.sh <project-ref> [--executer]

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
create temp table _b on commit drop as
select q.id as quart, p.id as plan, e.id as qe
  from public.inventaire_quarts q
  join public.inventaire_plans_comptage p on p.id='22960f98-8245-4d3b-93f8-f3637f66847f' and p.site=q.site and p.date=q.date
  join public.inventaire_quart_employes e on e.id='71edc336-6d4e-4c93-83cc-b1bacbaab552' and e.quart_id=q.id
                                          and e.employee_id='755a2dc5-3390-4a29-a865-847cbebc1133'
 where q.id='7568f3b4-0a9f-47ad-a266-d72605e17cbf' and q.site='nexus-station-test' and q.date=date '2026-10-23';

\echo '=== Lignes exactes visées (1 ligne attendue = les trois racines liées) ==='
select * from _b;
\echo '=== Lignes du plan (référence produits à comparer) ==='
select i.ordre, i.produit_id, i.raison_selection, i.obligatoire, i.statut from public.inventaire_plan_items i where i.plan_id in (select plan from _b) order by i.ordre;
\echo '=== Dépendants du quart (doivent être à 0) ==='
select 'comptages' t, count(*) from public.inventaire_comptages where quart_id in (select quart from _b)
union all select 'audit_log', count(*) from public.inventaire_audit_log where quart_id in (select quart from _b)
union all select 'mouvements', count(*) from public.inventaire_mouvements where quart_id in (select quart from _b)
union all select 'alertes', count(*) from public.inventaire_alertes where quart_id in (select quart from _b)
union all select 'rapprochements', count(*) from public.inventaire_rapprochements where quart_id in (select quart from _b)
union all select 'corrections', count(*) from public.inventaire_corrections where quart_id in (select quart from _b)
union all select 'production_recommendations', count(*) from public.inventaire_production_recommendations where quart_id in (select quart from _b)
union all select 'ventes_import', count(*) from public.inventaire_ventes_import where quart_id in (select quart from _b)
union all select 'decenium_snapshots', count(*) from public.inventaire_decenium_snapshots where quart_id_source in (select quart from _b);

\echo '=== Retrait ($MODE) ==='
delete from public.inventaire_plan_items where plan_id in (select plan from _b);
delete from public.inventaire_plans_comptage where id in (select plan from _b);
delete from public.inventaire_quart_employes where id in (select qe from _b);
delete from public.inventaire_quarts where id in (select quart from _b);
\echo '=== Service gardé (doit valoir 1) ==='
select count(*) as service_ed1cc859 from public.shifts where id='ed1cc859-0a4f-4214-aa99-11f1b71dfe63';
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Retrait VALIDÉ (commit)."; else echo "→ Simulation seulement : rien n'a été retiré (rollback). Relancer avec --executer."; fi
