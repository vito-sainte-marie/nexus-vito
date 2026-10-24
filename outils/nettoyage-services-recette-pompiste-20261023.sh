#!/usr/bin/env bash
# NEXUS Test — nettoyage borné des services de recette pompiste (Lot 3, 23/10/2026).
#
# Retire UNIQUEMENT les services (public.shifts) créés pour Employé Test B pendant la
# recette du parcours pompiste, désignés par identifiant :
#   d4f52c83-d241-49c2-ae7b-f5a044f5cf06  pompiste soir  (22/10, clos_sans_pointage)
#   ed1cc859-0a4f-4214-aa99-11f1b71dfe63  pompiste matin (23/10, clos_sans_pointage par le changement de rôle)
#   8497d450-5637-4899-957a-fa9e97559b0c  renfort soir   (24/10 02:41 UTC, clos_sans_pointage ; pris pour constater l'écran Missions en Renfort)
#   a97e191d-4635-4633-8105-5943113db39a  pompiste soir  (24/10 02:45 UTC, en_cours ; repris pour constater « Disponibles » déplié sans mission obligatoire)
# Retire aussi, par identifiant, les deux validations de missions obligatoires faites au
# navigateur le 23/10 (public.mission_completions, sans lien de clé avec le service) :
#   2e8d8961-69d6-40ca-9220-5f8cce3d248a  Nettoyer les pompes (TST-001-station-test)
#   3c8f7316-90dd-48c3-a3ac-6c08c0a28cf8  Relevé d'index de prise de poste (TST-002-station-test)
# Retire aussi, car ils retiennent le service par clé étrangère, le quart d'inventaire rattaché
# à ces services (inventaire_quart_employes.shift_id, sans cascade), seulement si l'employé
# visé y est seul, ses comptages (cascade), et les deux plans de comptage générés avec eux :
#   e1871793-2a33-4ecd-8320-d54ad4d7a11c  (22/10 23:54 UTC, quart du soir)
#   a6e9554d-1cb7-42a8-aba9-c35dec3e56f7  (23/10 18:13 UTC, quart du soir)
# Retire aussi, sur GO de Frédéric (24/10), le relevé d'index fictif d30f2e6f-… (debut_q2 du 22/10,
# même auteur) avec ses valeurs carburant_index_valeurs.
# Garde-fous :
#   - REFUSE Production et tout projet autre que nexus-test ;
#   - SIMULATION par défaut (rollback) ; --executer pour valider ;
#   - bornes cumulées : site nexus-station-test, employé 755a2dc5-…, identifiants ci-dessus ;
#   - affiche d'abord les lignes exactes, puis les dépendants ; un service qui a des
#     dépendants n'est PAS retiré (le script le dit) ;
#   - ne touche aucun service d'un autre auteur (autres employés, caissières, CI).
# Rejouable : une seconde exécution ne trouve rien.
#
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
       array['d4f52c83-d241-49c2-ae7b-f5a044f5cf06','ed1cc859-0a4f-4214-aa99-11f1b71dfe63','8497d450-5637-4899-957a-fa9e97559b0c','a97e191d-4635-4633-8105-5943113db39a']::uuid[] as ids;

create temp table _shifts on commit drop as
select s.id from public.shifts s, _borne b
 where s.id = any(b.ids) and s.site_id = b.site and s.employee_id = b.emp;

create temp table _completions on commit drop as
select c.id from public.mission_completions c, _borne b
 where c.id in ('2e8d8961-69d6-40ca-9220-5f8cce3d248a','3c8f7316-90dd-48c3-a3ac-6c08c0a28cf8')
   and c.employee_id = b.emp and c.site_id = b.site and c.date = date '2026-10-23';

create temp table _quart_employes on commit drop as
select e.id, e.quart_id from public.inventaire_quart_employes e
 where e.shift_id in (select id from _shifts) and e.employee_id = (select emp from _borne);

-- un quart n'est retiré que si aucun autre employé n'y est rattaché
create temp table _quarts on commit drop as
select q.id from public.inventaire_quarts q, _borne b
 where q.site = b.site and q.id in (select quart_id from _quart_employes)
   and not exists (select 1 from public.inventaire_quart_employes x
                    where x.quart_id = q.id and x.id not in (select id from _quart_employes));

create temp table _plans on commit drop as
select p.id from public.inventaire_plans_comptage p, _borne b
 where p.site = b.site
   and p.id in ('e1871793-2a33-4ecd-8320-d54ad4d7a11c','a6e9554d-1cb7-42a8-aba9-c35dec3e56f7');

create temp table _releves on commit drop as
select r.id from public.carburant_index_releves r, _borne b
 where r.id = 'd30f2e6f-c344-4f95-8bdf-00534fe5c474' and r.site = b.site and r.auteur = b.emp;

\echo '=== Relevé d index visé ==='
select r.id, r.moment, r.statut, r.date, r.cree_le, (select count(*) from public.carburant_index_valeurs v where v.releve_id=r.id) valeurs
  from public.carburant_index_releves r where r.id in (select id from _releves);

\echo '=== Inventaire rattaché (quarts, comptages, plans) ==='
select 'quart' t, q.id::text, q.quart||' '||q.date||' '||q.statut d from public.inventaire_quarts q where q.id in (select id from _quarts)
union all select 'quart_employes', e.id::text, 'shift '||e.shift_id from public.inventaire_quart_employes e where e.id in (select id from _quart_employes)
union all select 'comptages', q.id::text, count(*)::text from public.inventaire_comptages c join _quarts q on q.id=c.quart_id group by q.id
union all select 'plan', p.id::text, p.date||' '||p.genere_le||' '||(select count(*) from public.inventaire_plan_items i where i.plan_id=p.id)||' lignes' from public.inventaire_plans_comptage p where p.id in (select id from _plans);

\echo '=== Dépendants INATTENDUS des quarts (à 0, sinon le script le dit et ne retire pas le quart) ==='
select q.id,
  (select count(*) from public.inventaire_audit_log where quart_id=q.id) audit_log,
  (select count(*) from public.inventaire_corrections where quart_id=q.id) corrections,
  (select count(*) from public.inventaire_decenium_snapshots where quart_id_source=q.id) snapshots
from _quarts q;

\echo '=== Validations de missions visées (2 attendues au plus) ==='
select c.id, c.mission_id, c.titre, c.date, c.created_at
  from public.mission_completions c where c.id in (select id from _completions) order by c.created_at;

\echo
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
delete from public.mission_completions where id in (select id from _completions);
delete from public.carburant_index_valeurs where releve_id in (select id from _releves);
delete from public.carburant_index_releves where id in (select id from _releves);
delete from public.inventaire_plans_comptage where id in (select id from _plans);
delete from public.inventaire_quart_employes where id in (select id from _quart_employes)
   and quart_id in (select id from _quarts);
delete from public.inventaire_quarts q where q.id in (select id from _quarts)
   and not exists (select 1 from public.inventaire_audit_log where quart_id=q.id)
   and not exists (select 1 from public.inventaire_corrections where quart_id=q.id)
   and not exists (select 1 from public.inventaire_decenium_snapshots where quart_id_source=q.id);
delete from public.shifts s
 where s.id in (select id from _shifts)
   and not exists (select 1 from public.role_changes   where shift_id = s.id)
   and not exists (select 1 from public.pointages      where service_id = s.id)
   and not exists (select 1 from public.mission_progress where shift_id = s.id)
   and not exists (select 1 from public.fdj_shifts     where prise_de_poste_id = s.id)
   and not exists (select 1 from public.inventaire_quart_employes where shift_id = s.id);

\echo '=== Restant (désignés) ==='
select (select count(*) from public.inventaire_quarts where id in (select id from _quarts)) as quarts_restants,
       (select count(*) from public.inventaire_plans_comptage where id in (select id from _plans)) as plans_restants,
       (select count(*) from public.carburant_index_releves where id in (select id from _releves)) as releves_restants,
       count(*) as services_restants from public.shifts where id in (select unnest(ids) from _borne);
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Retrait VALIDÉ (commit)."; else echo "→ Simulation seulement : rien n'a été retiré (rollback). Relancer avec --executer."; fi
