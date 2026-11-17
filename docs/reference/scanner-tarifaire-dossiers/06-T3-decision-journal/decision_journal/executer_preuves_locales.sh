#!/usr/bin/env bash
# Preuves de la fonction décision-journal T3 sur une base PostgreSQL 16 JETABLE, créée puis détruite.
# N'utilise ni le projet Test ni la Production. Socle reconstruit depuis le catalogue réel de Test (recette T2).
# Migrations exécutées par le rôle postgres NON superutilisateur avec BYPASSRLS, comme en Test.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"; T2="$ICI/../../t2"; OUT="$ICI/resultat_preuves_locales.txt"
BIN=/usr/lib/postgresql/16/bin; DATA="$(mktemp -d)"; chown postgres "$DATA"; PORT=55433
run() { su postgres -s /bin/bash -c "$*"; }
run "$BIN/initdb -D $DATA -A trust -U supabase_admin >/dev/null"
run "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'run "$BIN/pg_ctl -D $DATA -m fast stop >/dev/null" || true; rm -rf "$DATA"' EXIT
PA="psql -h /tmp -p $PORT -U supabase_admin -X -q -v ON_ERROR_STOP=1"
PP="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"
ok() { echo "OK     $1" | tee -a "$OUT"; }; ko() { echo "ECHEC  $1" | tee -a "$OUT"; }
rm -f "$OUT"; S="$DATA/sql"; mkdir -p "$S/origine"
cp "$T2"/recette/00_socle_catalogue_test_superadmin.sql "$T2"/recette/01_socle_catalogue_test_postgres.sql "$T2"/migrations/2026111810*.sql "$ICI"/*.sql "$S/"
cp "$ICI"/20261119100000_tarif_decision_journal.sql "$S/origine/"; chown -R postgres "$S"
T2M="20261118100000_tarif_registres.sql 20261118100100_tarif_registres_controles_rls.sql 20261118100200_tarif_registres_vues.sql 20261118100300_tarif_registres_comptes_desactives.sql"
T3M="20261119100000_tarif_decision_journal.sql"
socle() { run "$PA -d $1 -f $S/00_socle_catalogue_test_superadmin.sql"; run "$PP -d $1 -f $S/01_socle_catalogue_test_postgres.sql"; }

run "createdb -h /tmp -p $PORT -U supabase_admin preuves"
SYSID=$(run "$PA -d preuves -tAc 'select system_identifier from pg_control_system()'")
# Copies où seule la valeur attendue de la garde est remplacée par l'identifiant de la base jetable ; l'original sert au refus.
for f in $T2M $T3M; do sed -i "s/7678069749886157684/$SYSID/" "$S/$f"; done
socle preuves

# G1. Garde : le fichier d'origine est refusé sur toute base qui n'est pas Test.
if run "$PP -d preuves -f $S/origine/$T3M" >/dev/null 2>"$DATA/g.err"; then ko "G1 garde : fichier d'origine accepté hors Test"
else ok "G1 garde : fichier d'origine refusé hors Test ($(grep -m1 -o 'garde_projet_test' "$DATA/g.err"))"; fi
# G2. Ordre : refusée tant que les migrations T2 ne sont pas en place.
if run "$PP -d preuves -f $S/$T3M" >/dev/null 2>"$DATA/o.err"; then ko "G2 ordre : acceptée sans T2"
else ok "G2 ordre : refusée sans les migrations T2 ($(grep -m1 -o 'ordre_migrations' "$DATA/o.err"))"; fi
for f in $T2M; do run "$PP -d preuves -f $S/$f"; done
run "$PP -d preuves -f $S/$T3M"; ok "G3 migration appliquée par le rôle postgres (non superutilisateur)"
run "$PP -d preuves -f $S/$T3M"; ok "G4 rejeu de la migration sans erreur (idempotence)"
DEF=$(run "$PA -d preuves -tAc \"select prosecdef::text from pg_proc where proname = 'tarif_enregistrer_decisions'\"")
[ "$DEF" = "false" ] && ok "G5 la fonction est SECURITY INVOKER (prosecdef = false)" || ko "G5 prosecdef = $DEF"
ACL=$(run "$PA -d preuves -tAc \"select string_agg(r, ',' order by r) from (select grantee::regrole::text r from pg_proc, aclexplode(proacl) where proname = 'tarif_enregistrer_decisions' and privilege_type = 'EXECUTE') x\"")
[ "$ACL" = "authenticated,postgres" ] && ok "G6 exécution réservée à authenticated (et au propriétaire postgres) : $ACL" || ko "G6 droits d'exécution : $ACL"

run "$PA -d preuves -f $S/10_preuves_decision_journal.sql" | grep -E '^(OK|ECHEC|---)' | tee -a "$OUT"

# D50. Concurrence : deux lots simultanés du gérant A sur la même référence. Le premier tient le verrou 2 s.
G="a0000000-0000-0000-0000-000000000001"; SA="select set_config('request.jwt.claim.sub','$G',false); set role authenticated;"
L="jsonb_build_array(t_ligne('Concurrence', 'validee', 3.00))"; L2="jsonb_build_array(t_ligne('Concurrence', 'validee', 3.10))"
run "$PA -d preuves -c \"$SA begin; select * from tarif_enregistrer_decisions($L); select pg_sleep(2); commit;\"" >/dev/null 2>"$DATA/c1.err" &
sleep 0.5
if run "$PA -d preuves -c \"$SA select * from tarif_enregistrer_decisions($L2);\"" >/dev/null 2>"$DATA/c2.err"; then C2=accepte; else C2=refuse; fi
wait
R=$(run "$PA -d preuves -tAc \"select (select count(*) from tarif_prix_decides where article = 'Concurrence') || '/' || (select count(*) from tarif_decisions where article = 'Concurrence')\"")
if [ "$C2" = "refuse" ] && [ "$R" = "1/1" ]; then ok "D50 concurrence : le second lot simultané est refusé ($(grep -m1 -o 'tarif_version_[a-z_]*' "$DATA/c2.err")), 1 prix et 1 journal"
else ko "D50 concurrence : second lot $C2, prix/journal $R ; $(head -c 200 "$DATA/c2.err")"; fi
# D51. Chaque prix décidé créé par la fonction a exactement une ligne de journal (les prix « Direct » sont les écritures directes de P01 à J08).
ORPH=$(run "$PA -d preuves -tAc \"select count(*) from tarif_prix_decides p where p.article not like 'Direct %' and (select count(*) from tarif_decisions d where d.prix_decide_id = p.id) <> 1\"")
[ "$ORPH" = "0" ] && ok "D51 chaque prix décidé créé par la fonction a exactement un journal" || ko "D51 $ORPH prix décidés de la fonction sans journal unique"

# H. Lignes historiques sans prix_decide_id : base séparée, journal T2 rempli AVANT la migration T3.
run "createdb -h /tmp -p $PORT -U supabase_admin historique"
socle historique; for f in $T2M; do run "$PP -d historique -f $S/$f" >/dev/null 2>&1; done
H="a0000000-0000-0000-0000-000000000001"; SH="select set_config('request.jwt.claim.sub','$H',false); set role authenticated;"
PH="jsonb_build_object('cout',1,'pv_ht',2,'quantite',3,'taux',0.5,'fiabilite','fiable')"
run "$PA -d historique -c \"insert into sites (site_id, nom_entreprise, timezone) values ('site-a','A','America/Martinique'); insert into employees (id, username, nom, role, site_id) values ('$H','ga','Gérant A','gerant','site-a');\"" >/dev/null
run "$PA -d historique -c \"$SH insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a','Histo 1','changement',2.00);
  insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, moteur_version, photo) values
  ('site-a','Histo 1','2026-10-05','2026-11-09','validee',2.00,null,'t1-v2',$PH),
  ('site-a','Histo 2','2026-10-05','2026-11-09','refusee',null,'non','t1-v2',$PH),
  ('site-a','Histo 3','2026-10-05','2026-11-09','autre_prix',3.10,'palier','t1-v2',$PH);\"" >/dev/null
EMP="select md5(string_agg(concat_ws('|', id, site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, seuil_id, moteur_version, photo::text, saisi_par, saisi_le, annule_le, annule_par, motif_annulation), ';' order by id)) from tarif_decisions"
EMP_P="select md5(string_agg(concat_ws('|', id, prix_ttc, nature, annule_le, remplace_id), ';' order by id)) from tarif_prix_decides"
H0=$(run "$PA -d historique -tAc \"$EMP\""); P0=$(run "$PA -d historique -tAc \"$EMP_P\"")
run "$PP -d historique -f $S/$T3M" >/dev/null 2>&1
H1=$(run "$PA -d historique -tAc \"$EMP\""); P1=$(run "$PA -d historique -tAc \"$EMP_P\"")
NUL=$(run "$PA -d historique -tAc \"select count(*) from tarif_decisions where prix_decide_id is null\"")
[ "$H0" = "$H1" ] && [ "$P0" = "$P1" ] && [ "$NUL" = "3" ] && ok "H1 migration : les 3 décisions historiques et le prix décidé historique sont inchangés (empreintes identiques), lien nul" || ko "H1 historique modifié : $H0/$H1 $P0/$P1 nuls $NUL"
CK=$(run "$PA -d historique -tAc \"select count(*) from pg_constraint where conrelid = 'tarif_decisions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%prix_decide_id%'\"")
[ "$CK" = "0" ] && ok "H2 aucune contrainte CHECK sur le lien : rien n'est contrôlé à l'annulation" || ko "H2 $CK contrainte(s) CHECK sur le lien"
if run "$PA -d historique -c \"$SH update tarif_decisions set annule_le = now(), annule_par = '$H', motif_annulation = 'recette' where article = 'Histo 1';\"" >/dev/null 2>"$DATA/h.err"; then
  ok "H3 une décision historique validée sans lien reste annulable par le gérant"; else ko "H3 annulation historique refusée : $(head -c 200 "$DATA/h.err")"; fi
if run "$PA -d historique -c \"$SH insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo) values ('site-a','Histo 4','2026-10-05','2026-11-09','validee',4.00,'politique-tarifaire-t2-v2',$PH);\"" >/dev/null 2>"$DATA/h4.err"; then
  ko "H4 nouvelle décision validée sans lien acceptée"; else ok "H4 après migration, une nouvelle décision validée sans lien est refusée ($(grep -m1 -o 'tarif_decision_lien_absent' "$DATA/h4.err"))"; fi
H2=$(run "$PA -d historique -tAc \"$EMP\"")
run "$PP -d historique -f $S/$T3M" >/dev/null 2>&1; run "$PP -d historique -f $S/$T3M" >/dev/null 2>&1
H3=$(run "$PA -d historique -tAc \"$EMP\"")
TRG=$(run "$PA -d historique -tAc \"select count(*) from pg_trigger where tgrelid = 'tarif_decisions'::regclass and tgname = 'tarif_decisions_lien'\"")
FK=$(run "$PA -d historique -tAc \"select count(*) from pg_constraint where conname = 'tarif_decisions_prix_meme_site_fk'\"")
IDX=$(run "$PA -d historique -tAc \"select count(*) from pg_indexes where indexname = 'tarif_decisions_prix_decide_uq'\"")
FN=$(run "$PA -d historique -tAc \"select count(*) || ':' || bool_or(prosecdef)::text from pg_proc where proname = 'tarif_enregistrer_decisions'\"")
[ "$H2" = "$H3" ] && [ "$TRG$FK$IDX" = "111" ] && [ "$FN" = "1:false" ] && ok "H5 deux rejeux : journal inchangé, 1 déclencheur, 1 clé étrangère, 1 index, 1 fonction SECURITY INVOKER" || ko "H5 rejeu : $H2/$H3 trg $TRG fk $FK idx $IDX fn $FN"
run "$PP -d historique -c \"alter table tarif_decisions add constraint tarif_decisions_lien_prix check ((decision = 'refusee') = (prix_decide_id is null)) not valid\"" >/dev/null
if run "$PA -d historique -c \"$SH update tarif_decisions set annule_le = now(), annule_par = '$H', motif_annulation = 'recette' where article = 'Histo 3';\"" >/dev/null 2>"$DATA/v1.err"; then
  ko "H6a avec la CHECK NOT VALID de la version 1, l'annulation historique passe : défaut non reproduit"
else ok "H6a défaut de la version 1 reproduit : avec la CHECK NOT VALID, l'annulation d'une décision historique est refusée ($(grep -m1 -o 'tarif_decisions_lien_prix' "$DATA/v1.err"))"; fi
run "$PP -d historique -f $S/$T3M" >/dev/null 2>&1
V1=$(run "$PA -d historique -tAc \"select count(*) from pg_constraint where conname = 'tarif_decisions_lien_prix'\"")
[ "$V1" = "0" ] && ok "H6 la contrainte CHECK de la version 1, si elle existait, est retirée par le rejeu" || ko "H6 contrainte version 1 encore présente"
echo "---" | tee -a "$OUT"
echo "Bilan : $(grep -c '^OK' "$OUT") OK, $(grep -c '^ECHEC' "$OUT") ECHEC" | tee -a "$OUT"
