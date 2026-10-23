#!/usr/bin/env bash
# NEXUS Test — correction du jeu de recette « Écailles » (23/10/2026).
#
# Les écailles sont un PRODUIT de la catégorie Glaçons, pas une catégorie
# (précision de Frédéric, 23/10). Le jeu de recette posé le 22/10 à 01:14 UTC sur
# nexus-station-test créait à tort une catégorie « Écailles ». Ce script :
#   1. range le produit b5cd05a3-… dans la catégorie Glaçons (3e133457-…) et le
#      nomme « Écailles » ;
#   2. supprime la catégorie 9ca1027e-… « Écailles », seulement si plus aucun
#      produit ne s'y rattache.
# Borne : site nexus-station-test, ces deux identifiants. Rejouable : une seconde
# exécution ne trouve rien. REFUSE Production et tout projet autre que nexus-test.
#
# Usage :
#   outils/correction-jeu-recette-ecailles-20261023.sh <project-ref>             # simulation (rollback)
#   outils/correction-jeu-recette-ecailles-20261023.sh <project-ref> --executer  # commit

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
select 'categorie' t, id::text, nom from public.inventaire_categories where site='nexus-station-test' and id in ('9ca1027e-b86a-4807-8b50-f8780905a771','3e133457-9dea-451f-95e1-937dc70f38f1')
union all select 'produit', id::text, designation||' / cat '||categorie_id::text from public.inventaire_zone_produit where id='b5cd05a3-0844-40ba-8774-89a33a35b8e7';

update public.inventaire_zone_produit set categorie_id='3e133457-9dea-451f-95e1-937dc70f38f1', designation='Écailles'
 where id='b5cd05a3-0844-40ba-8774-89a33a35b8e7' and site='nexus-station-test'
   and categorie_id='9ca1027e-b86a-4807-8b50-f8780905a771';
delete from public.inventaire_categories
 where id='9ca1027e-b86a-4807-8b50-f8780905a771' and site='nexus-station-test' and nom='Écailles'
   and not exists (select 1 from public.inventaire_zone_produit where categorie_id='9ca1027e-b86a-4807-8b50-f8780905a771');

\echo '=== Après ($MODE) ==='
select 'categorie' t, id::text, nom from public.inventaire_categories where site='nexus-station-test' and nom ilike '%caille%'
union all select 'produit', id::text, designation||' / cat '||categorie_id::text from public.inventaire_zone_produit where id='b5cd05a3-0844-40ba-8774-89a33a35b8e7';
$FIN
SQL

if [ "$MODE" = "--executer" ]; then echo "→ Correction VALIDÉE (commit)."; else echo "→ Simulation seulement (rollback). Relancer avec --executer."; fi
