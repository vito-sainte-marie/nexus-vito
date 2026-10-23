#!/usr/bin/env bash
# NEXUS Test — alignement des deux produits de recette « Huile moteur recette » et
# « Lave-glace recette » sur la Production (23/10/2026, lot CATEGORIES_FIL).
#
# En Production, les produits des catégories Huiles et Lave-glace & Liquide de
# refroidissement sont rangés dans la zone « boutique » : le pompiste (zone « piste »
# seulement) ne les compte pas. Sur Test, le jeu de recette les avait posés dans la
# zone « piste », d'où leur présence dans l'écran d'inventaire du pompiste.
# Ce script les range dans la zone « boutique » de nexus-station-test.
#
# Borne : site nexus-station-test, ces deux identifiants de produit, et seulement
# s'ils sont encore dans la zone « piste ». Aucun autre produit, aucune catégorie,
# aucun paramètre n'est touché. Rejouable : une seconde exécution ne trouve rien.
# REFUSE Production et tout projet autre que nexus-test.
#
# Usage :
#   outils/alignement-zones-recette-huile-laveglace-20261023.sh <project-ref>             # simulation (rollback)
#   outils/alignement-zones-recette-huile-laveglace-20261023.sh <project-ref> --executer  # commit

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
select p.id, p.designation, z.code as zone from public.inventaire_zone_produit p join public.inventaire_zones z on z.id=p.zone_id
 where p.site='nexus-station-test' and p.id in ('7775b1bc-e061-4d44-84ea-1c02231f8588','4ad5fc4b-482a-4c54-bd74-95ef8428cef0');

update public.inventaire_zone_produit p
   set zone_id = (select id from public.inventaire_zones where site='nexus-station-test' and code='boutique')
 where p.site='nexus-station-test'
   and p.id in ('7775b1bc-e061-4d44-84ea-1c02231f8588','4ad5fc4b-482a-4c54-bd74-95ef8428cef0')
   and p.zone_id = (select id from public.inventaire_zones where site='nexus-station-test' and code='piste');

\echo '=== Après ($MODE) ==='
select p.id, p.designation, z.code as zone from public.inventaire_zone_produit p join public.inventaire_zones z on z.id=p.zone_id
 where p.site='nexus-station-test' and p.id in ('7775b1bc-e061-4d44-84ea-1c02231f8588','4ad5fc4b-482a-4c54-bd74-95ef8428cef0');
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Alignement VALIDÉ (commit)."; else echo "→ Simulation seulement (rollback). Relancer avec --executer."; fi
