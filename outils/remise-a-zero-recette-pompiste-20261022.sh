#!/usr/bin/env bash
# NEXUS Test — remise à zéro bornée de la recette pompiste du 22/10/2026.
#
# Retire ce que Claude Guardian a créé sur Test le 22/10/2026 entre 22:19 et
# 22:30 UTC (18:20 heure locale) pour Employé Test B : le service pompiste du
# soir, le relevé d'index `debut_q2` et l'inventaire d'ouverture. Ces lignes
# empêchent de rejouer C1/C2/C3 (l'ouverture est déjà faite).
#
# Borne stricte, toutes conditions réunies :
#   site = nexus-station-test · employé = 755a2dc5-… · date de service = 2026-10-22
#   created_at (ou cree_le) ∈ [22:19:00 ; 22:30:00) UTC
# Les événements CI de `nexus_live_events` ne sont PAS concernés (autre auteur).
#
# Rejouable : une seconde exécution ne trouve rien et ne retire rien.
#
# Usage :
#   outils/remise-a-zero-recette-pompiste-20261022.sh <project-ref>              # affiche seulement
#   outils/remise-a-zero-recette-pompiste-20261022.sh <project-ref> --executer   # affiche puis retire
#
# REFUSE de s'exécuter sur Production, et sur tout projet autre que nexus-test.

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
TEST_REF="udljdqxerrbbbajxubfn"
REF="${1:-}"
MODE="${2:-}"

[ -n "$REF" ] || { echo "Usage : $0 <project-ref> [--executer]" >&2; exit 2; }
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION." >&2; exit 3
fi
if [ "$REF" != "$TEST_REF" ]; then
  echo "REFUS : $REF n'est pas nexus-test ($TEST_REF)." >&2; exit 3
fi
case "$MODE" in ""|--executer) ;; *) echo "Option inconnue : $MODE" >&2; exit 2 ;; esac

MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
[ -n "$MDP" ] || { echo "Mot de passe absent du trousseau (service « nexus-test-db »)." >&2; exit 4; }
export PGPASSWORD="$MDP"; unset MDP
URL="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require&connect_timeout=12"

if [ "$MODE" = "--executer" ]; then FIN="commit;"; else FIN="rollback;"; fi

psql "$URL" --no-psqlrc -v ON_ERROR_STOP=1 2>&1 <<SQL | sed -E 's#postgres[^:]*:[^@]*@#postgres:***@#g'
begin;

create temp table _borne on commit drop as
select '$REF'::text as ref, 'nexus-station-test'::text as site,
       '755a2dc5-3390-4a29-a865-847cbebc1133'::uuid as emp,
       date '2026-10-22' as jour,
       timestamptz '2026-10-22 22:19:00+00' as t0,
       timestamptz '2026-10-22 22:30:00+00' as t1;

create temp table _shifts on commit drop as
select s.id from public.shifts s, _borne b
 where s.site_id = b.site and s.employee_id = b.emp
   and s.created_at >= b.t0 and s.created_at < b.t1;

create temp table _quarts on commit drop as
select q.id from public.inventaire_quarts q, _borne b
 where q.site = b.site and q.date = b.jour
   and q.created_at >= b.t0 and q.created_at < b.t1;

create temp table _quart_employes on commit drop as
select e.id from public.inventaire_quart_employes e, _borne b
 where e.employee_id = b.emp and e.quart_id in (select id from _quarts)
   and e.created_at >= b.t0 and e.created_at < b.t1;

create temp table _plans on commit drop as
select p.id from public.inventaire_plans_comptage p, _borne b
 where p.site = b.site and p.date = b.jour
   and p.genere_le >= b.t0 and p.genere_le < b.t1;

create temp table _releves on commit drop as
select r.id from public.carburant_index_releves r, _borne b
 where r.site = b.site and r.auteur = b.emp and r.date = b.jour
   and r.cree_le >= b.t0 and r.cree_le < b.t1;

\echo
\echo '=== Ce que le script retire (par table) ==='
select 'carburant_index_valeurs' as "table", count(*) as lignes from public.carburant_index_valeurs where releve_id in (select id from _releves)
union all select 'carburant_index_releves', count(*) from _releves
union all select 'inventaire_comptages', count(*) from public.inventaire_comptages where quart_id in (select id from _quarts)
union all select 'inventaire_plan_items', count(*) from public.inventaire_plan_items where plan_id in (select id from _plans)
union all select 'inventaire_plans_comptage', count(*) from _plans
union all select 'inventaire_quart_employes', count(*) from _quart_employes
union all select 'inventaire_quarts', count(*) from _quarts
union all select 'shifts', count(*) from _shifts;

\echo
\echo '=== Détail des lignes racines ==='
select 'shift' as t, s.id, s.role, s.quart, s.statut, s.created_at from public.shifts s where s.id in (select id from _shifts)
union all select 'quart', q.id, null, q.quart, q.statut, q.created_at from public.inventaire_quarts q where q.id in (select id from _quarts)
union all select 'index', r.id, null, r.moment, r.statut, r.cree_le from public.carburant_index_releves r where r.id in (select id from _releves);

\echo
\echo '=== Dépendants INATTENDUS (doivent être à 0, sinon la remise à zéro échouera) ==='
select 'role_changes' as "table", count(*) from public.role_changes where shift_id in (select id from _shifts)
union all select 'pointages', count(*) from public.pointages where service_id in (select id from _shifts)
union all select 'mission_progress', count(*) from public.mission_progress where shift_id in (select id from _shifts)
union all select 'fdj_shifts', count(*) from public.fdj_shifts where prise_de_poste_id in (select id from _shifts)
union all select 'inventaire_audit_log', count(*) from public.inventaire_audit_log where quart_id in (select id from _quarts)
union all select 'inventaire_mouvements', count(*) from public.inventaire_mouvements where quart_id in (select id from _quarts)
union all select 'inventaire_alertes', count(*) from public.inventaire_alertes where quart_id in (select id from _quarts)
union all select 'inventaire_rapprochements', count(*) from public.inventaire_rapprochements where quart_id in (select id from _quarts)
union all select 'inventaire_corrections', count(*) from public.inventaire_corrections where quart_id in (select id from _quarts)
union all select 'inventaire_production_recommendations', count(*) from public.inventaire_production_recommendations where quart_id in (select id from _quarts)
union all select 'inventaire_ventes_import', count(*) from public.inventaire_ventes_import where quart_id in (select id from _quarts)
union all select 'inventaire_decenium_snapshots', count(*) from public.inventaire_decenium_snapshots where quart_id_source in (select id from _quarts);

\echo
\echo '=== Retrait ($MODE) ==='
delete from public.carburant_index_valeurs where releve_id in (select id from _releves);
delete from public.carburant_index_releves where id in (select id from _releves);
delete from public.inventaire_plan_items where plan_id in (select id from _plans);
delete from public.inventaire_plans_comptage where id in (select id from _plans);
delete from public.inventaire_comptages where quart_id in (select id from _quarts);
delete from public.inventaire_quart_employes where id in (select id from _quart_employes);
delete from public.inventaire_quarts where id in (select id from _quarts);
delete from public.shifts where id in (select id from _shifts);

$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Retrait VALIDÉ (commit)."; else echo "→ Simulation seulement : rien n'a été retiré (rollback). Relancer avec --executer."; fi
