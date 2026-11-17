#!/usr/bin/env bash
# Recette T2 sur une base PostgreSQL 16 JETABLE, créée dans un dossier temporaire puis détruite.
# N'utilise ni le projet Test ni la Production. Usage : bash executer_recette_locale.sh
# Version 2 : socle reconstruit depuis le catalogue réel de Test ; migrations exécutées par le rôle postgres
# NON superutilisateur avec BYPASSRLS et les privilèges par défaut de Supabase, comme en Test.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"; MIG="$ICI/../migrations"; OUT="$ICI/resultat_recette_locale.txt"
BIN=/usr/lib/postgresql/16/bin
DATA="$(mktemp -d)"; chown postgres "$DATA"; PORT=55432
run() { su postgres -s /bin/bash -c "$*"; }
run "$BIN/initdb -D $DATA -A trust -U supabase_admin >/dev/null"
run "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $DATA -m fast stop >/dev/null" || true; rm -rf "$DATA"' EXIT
PA="psql -h /tmp -p $PORT -U supabase_admin -X -q -v ON_ERROR_STOP=1"   # plateforme (superutilisateur)
PP="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"         # propriétaire des migrations, comme en Test
rm -f "$OUT"; mkdir -p "$DATA/sql"; cp "$ICI"/*.sql "$MIG"/*.sql "$DATA/sql/"; chown -R postgres "$DATA/sql"; S2="$DATA/sql"
MIGS0="20261118100000_tarif_registres.sql 20261118100100_tarif_registres_controles_rls.sql 20261118100200_tarif_registres_vues.sql"
MIGS="$MIGS0 20261118100300_tarif_registres_comptes_desactives.sql"
socle_et_migrations() {
  local liste="${2:-$MIGS}"
  run "$PA -d $1 -f $S2/00_socle_catalogue_test_superadmin.sql"
  run "$PP -d $1 -f $S2/01_socle_catalogue_test_postgres.sql"
  for f in $liste; do echo "migration ($1, rôle postgres) : $f"; run "$PP -d $1 -f $S2/$f"; done
}
ok() { echo "OK     $1" | tee -a "$OUT"; }; ko() { echo "ECHEC  $1" | tee -a "$OUT"; }
# Garde du projet Test : la base jetable n'a pas l'identifiant système de Test. Les scripts d'origine sont gardés pour
# prouver le refus ; des copies où seule la valeur attendue est remplacée par celle de la base jetable servent aux essais.
CR="$ICI/../comptes_recette"; cp "$CR"/*.sql "$S2/"; mkdir -p "$S2/origine"; cp "$CR"/*.sql "$MIG"/*.sql "$S2/origine/"; chown -R postgres "$S2"
run "createdb -h /tmp -p $PORT -U supabase_admin recette"
LOCAL_SYSID=$(run "$PA -d recette -tAc 'select system_identifier from pg_control_system()'")
for f in 40_comptes_gerants_recette_test_creation.sql 41_comptes_gerants_recette_test_desactivation.sql 50_preuve_acces_test.sql recette_test_donnees_sainte_marie_t2.sql retour_arriere_base_jetable_t2.sql retour_arriere_avec_donnees_t2.sql $MIGS; do
  sed -i "s/7678069749886157684/$LOCAL_SYSID/" "$S2/$f"; done
socle_et_migrations recette
echo "rejeu des migrations (idempotence, ordre imposé)"
for f in 20261118100000_tarif_registres.sql 20261118100100_tarif_registres_controles_rls.sql 20261118100300_tarif_registres_comptes_desactives.sql; do run "$PP -d recette -f $S2/$f"; done
run "$PA -d recette -f '$S2/10_tests_registres.sql'" | tee -a "$OUT"
run "cd $S2 && $PA -d recette -f 20_donnees_recette.sql" | grep -E '^(OK|ECHEC)' | tee -a "$OUT"
if run "$PP -d recette -f $S2/20261118100200_tarif_registres_vues.sql" >/dev/null 2>"$DATA/o.err"; then ko "126 rejeu de 100200 après 100300 accepté"; else ok "126 ordre : 100200 refusée après 100300 ($(grep -m1 -o 'ordre_migrations' "$DATA/o.err")), la vue filtrée reste en place"; fi
run "createdb -h /tmp -p $PORT -U supabase_admin ordre"
socle_et_migrations ordre "20261118100000_tarif_registres.sql 20261118100100_tarif_registres_controles_rls.sql" >/dev/null
if run "$PP -d ordre -f $S2/20261118100300_tarif_registres_comptes_desactives.sql" >/dev/null 2>"$DATA/o2.err"; then ko "127 100300 acceptée avant 100200"; else ok "127 ordre : 100300 refusée tant que 100200 n'est pas appliquée ($(grep -m1 -o 'ordre_migrations' "$DATA/o2.err"))"; fi
# 49. Concurrence : deux saisies simultanées de la même clé. La seconde attend le verrou puis est refusée.
G="a0000000-0000-0000-0000-000000000001"
S="select set_config('request.jwt.claim.sub','$G',false); set role authenticated;"
run "$PA -d recette -c \"$S begin; insert into tarif_reglages (site, parametre, valeur) values ('site-a','palier_ttc',0.05); select pg_sleep(2); commit;\"" >/dev/null &
sleep 0.5
if run "$PA -d recette -c \"$S insert into tarif_reglages (site, parametre, valeur) values ('site-a','palier_ttc',0.10);\"" >/dev/null 2>"$DATA/conc.err"; then
  echo "ECHEC  49 concurrence : la seconde saisie a été acceptée" | tee -a "$OUT"
else
  echo "OK     49 concurrence : la seconde saisie simultanée est refusée ($(grep -m1 -o 'tarif_version_active_existante' "$DATA/conc.err"))" | tee -a "$OUT"
fi
wait
# 70. Retour arrière « base jetable » sur une base contenant des données : doit être refusé, rien ne change.
N0=$(run "$PA -d recette -tAc \"select count(*) from tarif_exceptions\"")
if run "$PP -d recette -f $S2/retour_arriere_base_jetable_t2.sql" >/dev/null 2>"$DATA/rb.err"; then ko "70 retour arrière jetable accepté malgré des données"
else N1=$(run "$PA -d recette -tAc \"select count(*) from tarif_exceptions\""); [ "$N0" = "$N1" ] && ok "70 retour arrière jetable refusé sur une base avec données ($(grep -m1 -o 'retour_arriere_refuse[^,]*' "$DATA/rb.err")), $N1 exceptions intactes" || ko "70 données modifiées"; fi
# 71. Retour arrière « avec données » : archive datée, comptes identiques, vues retirées, accès coupés.
TOT=$(run "$PA -d recette -tAc \"select sum(n) from (select count(*) n from tarif_familles union all select count(*) from tarif_exceptions union all select count(*) from tarif_prix_decides union all select count(*) from tarif_decisions) x\"")
run "$PP -d recette -f $S2/retour_arriere_avec_donnees_t2.sql" >/dev/null 2>"$DATA/arch.err" || { cat "$DATA/arch.err"; }
ARCH=$(run "$PA -d recette -tAc \"select nspname from pg_namespace where nspname like 'archive_tarif_t2_%'\"")
TOTA=$(run "$PA -d recette -tAc \"select sum(n) from (select count(*) n from $ARCH.tarif_familles union all select count(*) from $ARCH.tarif_exceptions union all select count(*) from $ARCH.tarif_prix_decides union all select count(*) from $ARCH.tarif_decisions) x\"")
VUES=$(run "$PA -d recette -tAc \"select count(*) from pg_views where viewname like 'v_tarif%'\"")
TABLES=$(run "$PA -d recette -tAc \"select count(*) from pg_tables where schemaname = 'public' and tablename like 'tarif%'\"")
if run "$PA -d recette -c \"select set_config('request.jwt.claim.sub','$G',false); set role authenticated; select count(*) from tarif_familles;\"" >/dev/null 2>&1; then LU=oui; else LU=non; fi
if run "$PA -d recette -c \"set role service_role; select count(*) from $ARCH.tarif_familles;\"" >/dev/null 2>&1; then LA=oui; else LA=non; fi
if [ -n "$ARCH" ] && [ "$TOT" = "$TOTA" ] && [ "$VUES" = "0" ] && [ "$TABLES" = "10" ] && [ "$LU" = "non" ] && [ "$LA" = "non" ]; then
  ok "71 retour arrière avec données : archive $ARCH ($TOTA lignes contrôlées = source), 0 vue, 10 tables conservées, accès coupé (authenticated et service_role)"
else ko "71 retour arrière avec données : archive '$ARCH' $TOTA/$TOT, vues $VUES, tables $TABLES, lecture authenticated $LU, archive service_role $LA"; fi
# 72. Retour arrière « base jetable » sur une base neuve sans données : tout disparaît, produits_appel intact.
run "createdb -h /tmp -p $PORT -U supabase_admin recette_vide"
socle_et_migrations recette_vide >/dev/null
run "$PA -d recette_vide -c \"insert into sites (site_id, nom_entreprise, timezone) values ('vito-sainte-marie','x','America/Martinique'); insert into produits_appel (article) values ('A'),('B'),('C');\"" >/dev/null
run "$PP -d recette_vide -f $S2/retour_arriere_base_jetable_t2.sql" >/dev/null
R=$(run "$PA -d recette_vide -tAc \"select count(*) from pg_class where relname like '%tarif%'\"")
F=$(run "$PA -d recette_vide -tAc \"select count(*) from pg_proc where proname like 'tarif%'\"")
A=$(run "$PA -d recette_vide -tAc \"select count(*) from produits_appel\"")
if [ "$R" = "0" ] && [ "$F" = "0" ] && [ "$A" = "3" ]; then ok "72 retour arrière jetable sur base vide : aucun objet T2 restant, produits_appel intact ($A lignes)"; else ko "72 retour arrière jetable : $R objets, $F fonctions, produits_appel $A"; fi
# 100-115. Comptes désactivés : preuve AVANT correction (v2 seule), puis APRÈS (avec 20261118100300).
run "createdb -h /tmp -p $PORT -U supabase_admin preuve_avant"
socle_et_migrations preuve_avant "$MIGS0" >/dev/null
run "$PA -d preuve_avant -f $S2/30_preuve_comptes_desactives.sql" > "$ICI/preuve_comptes_desactives_avant.txt"
run "$PP -d preuve_avant -f $S2/20261118100300_tarif_registres_comptes_desactives.sql" >/dev/null
run "createdb -h /tmp -p $PORT -U supabase_admin preuve_apres"
socle_et_migrations preuve_apres >/dev/null
run "$PA -d preuve_apres -f $S2/30_preuve_comptes_desactives.sql" > "$ICI/preuve_comptes_desactives_apres.txt"
NA=$(grep -cE '^[DMCT][0-9].*: ACCES' "$ICI/preuve_comptes_desactives_avant.txt" || true)
[ "$NA" = "11" ] && ok "100 faille démontrée sans correction : les 11 accès de comptes désactivés passent" || ko "100 avant correction : $NA accès sur 11"
while IFS= read -r l; do
  case "$l" in
    [DMCT][0-9]*': BLOQUE'*) ok "1${l}";;
    [DMCT][0-9]*': ACCES') ko "1${l} (compte désactivé non bloqué)";;
    [GR][0-9]*': ACCES') ok "1${l}";;
    [GR][0-9]*': BLOQUE'*) ko "1${l} (compte actif bloqué)";;
  esac
done < "$ICI/preuve_comptes_desactives_apres.txt"
. "$ICI/40_preuve_comptes_recette.sh"
. "$ICI/50_preuve_garde_migrations.sh"
. "$ICI/60_preuve_procedure_execution.sh"
echo "---"; echo "OK : $(grep -c '^OK' "$OUT")  ECHEC : $(grep -c '^ECHEC' "$OUT" || true)"
