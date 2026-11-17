#!/usr/bin/env bash
# Répétition locale COMPLÈTE de la procédure Test T3 : préinstallation (70), migration, postinstallation (71), comptes (80),
# recette authentifiée en trois phases avec le VRAI Supabase Auth (GoTrue v2.180.0) et PostgREST 12.2.3, désactivations (81, 82),
# bannissement (lot recette_t3), puis retour arrière (79). Base PostgreSQL 16 JETABLE ; ni Test ni Production.
# Preuves écrites dans preuves/local/ uniquement ; les preuves du vrai Supabase Test vont dans preuves/test/ (condition 7).
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"; T2="$ICI/../../t2"; T3D="$ICI/../decision_journal"; OUTILS="$ICI/../../outils"
RP="$ICI/preuves/local"; rm -rf "$RP"; mkdir -p "$RP"; OUT="$RP/resultat_repetition_locale.txt"
BIN=/usr/lib/postgresql/16/bin; DATA="$(mktemp -d)"; chown postgres "$DATA"; PORT=55434
GOTRUE_DIR="$OUTILS/gotrue"; GOTRUE="$GOTRUE_DIR/auth"; PGRST="$OUTILS/postgrest/postgrest"
run() { su postgres -s /bin/bash -c "$*"; }
ok() { echo "OK     $1" | tee -a "$OUT"; }; ko() { echo "ECHEC  $1" | tee -a "$OUT"; }
rm -f "$OUT"
pkill -f "outils/gotrue/auth serve" 2>/dev/null || true; pkill -f "relais_local_supabase.mjs" 2>/dev/null || true; pkill -f "outils/postgrest/postgrest" 2>/dev/null || true
run "$BIN/initdb -D $DATA -A trust -U supabase_admin >/dev/null"
run "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'pkill -f "outils/gotrue/auth serve" 2>/dev/null || true; pkill -f "relais_local_supabase.mjs" 2>/dev/null || true; pkill -f "outils/postgrest/postgrest" 2>/dev/null || true; run "$BIN/pg_ctl -D $DATA -m fast stop >/dev/null" || true; rm -rf "$DATA"' EXIT
PA="psql -h /tmp -p $PORT -U supabase_admin -X -q -v ON_ERROR_STOP=1"; PP="psql -h /tmp -p $PORT -U postgres -X -q -v ON_ERROR_STOP=1"
S="$DATA/sql"; mkdir -p "$S/origine"
cp "$T2"/recette/00_socle_catalogue_test_superadmin.sql "$T2"/recette/01_socle_catalogue_test_postgres.sql "$T2"/migrations/2026111810*.sql "$T3D"/20261119100000_tarif_decision_journal.sql "$ICI"/*.sql "$S/"
cp "$ICI"/*.sql "$S/origine/"; chown -R postgres "$S"
T2M="20261118100000_tarif_registres.sql 20261118100100_tarif_registres_controles_rls.sql 20261118100200_tarif_registres_vues.sql 20261118100300_tarif_registres_comptes_desactives.sql"
DB=t3
run "createdb -h /tmp -p $PORT -U supabase_admin $DB"
SYSID=$(run "$PA -d $DB -tAc 'select system_identifier from pg_control_system()'")
for f in $T2M 20261119100000_tarif_decision_journal.sql 70_preinstallation_t3_lecture_seule.sql 71_postinstallation_t3_lecture_seule.sql 79_retour_arriere_t3_decision_journal.sql 80_comptes_recette_t3_creation.sql 81_desactiver_gerant_sm_t3.sql 82_desactiver_comptes_recette_t3.sql; do
  sed -i "s/7678069749886157684/$SYSID/" "$S/$f"; done

# Socle Test avec le vrai schéma auth (migrations de GoTrue), comme la répétition T2 (scripts 180 et suivants).
grep -v -E "create table if not exists auth\.users|alter table auth\.users owner|grant select, insert, update, delete on auth\.users" "$S/00_socle_catalogue_test_superadmin.sql" > "$S/00b.sql"; chown postgres "$S/00b.sql"
run "$PA -d $DB -f $S/00b.sql" >/dev/null 2>&1
run "$PA -d $DB -c \"alter role supabase_auth_admin login; alter role supabase_auth_admin set search_path = auth; grant create on database $DB to supabase_auth_admin;\"" >/dev/null
SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48)
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:$PORT/$DB?sslmode=disable" GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_API_HOST=127.0.0.1 PORT_GOTRUE=9998 API_EXTERNAL_URL=http://127.0.0.1:9998 GOTRUE_SITE_URL=http://127.0.0.1 \
  GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_DISABLE_SIGNUP=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_LOG_LEVEL=warn GOTRUE_DB_MIGRATIONS_PATH="$GOTRUE_DIR/migrations"
(cd "$GOTRUE_DIR" && "$GOTRUE" migrate) > "$DATA/gotrue_migrate.log" 2>&1 && ok "L01 schéma auth créé par les migrations du vrai Supabase Auth" || { ko "L01 migrations GoTrue"; exit 1; }
run "$PA -d $DB -c \"create or replace function auth.uid() returns uuid language sql stable as \\\$f\\\$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid \\\$f\\\$; grant select, insert, update, delete on auth.users to postgres; grant usage on schema auth to postgres;\"" >/dev/null
run "$PP -d $DB -f $S/01_socle_catalogue_test_postgres.sql" >/dev/null
for f in $T2M; do run "$PP -d $DB -f $S/$f" >/dev/null 2>&1; done
# Historique des migrations comme sur Supabase, site SM, et un historique T2 sur SM (une décision sans lien, un prix décidé).
H=e0000000-0000-4000-8000-000000000001
run "$PA -d $DB -c \"insert into supabase_migrations.schema_migrations (version, name) values ('20261117020430','tarif_registres'),('20261117020652','tarif_registres_controles_rls'),('20261117020851','tarif_registres_vues'),('20261117021059','tarif_registres_comptes_desactives');
  grant usage on schema supabase_migrations to postgres; grant select, insert on supabase_migrations.schema_migrations to postgres;
  do \\\$\\\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if; end \\\$\\\$; grant anon, authenticated, service_role to authenticator;
  insert into sites (site_id, nom_entreprise, timezone) values ('vito-sainte-marie','SM','America/Martinique');
  insert into employees (id, username, nom, role, site_id, actif, compte_test) values ('$H','historique-t2','HistoriqueT2','gerant','vito-sainte-marie',false,true);
  insert into tarif_prix_decides (site, article, nature, prix_ttc, saisi_par) values ('vito-sainte-marie','Historique SM','changement',2.00,'$H');
  insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, saisi_par) values
   ('vito-sainte-marie','Historique SM','2026-10-05','2026-11-09','validee',2.00,'t1-v2',jsonb_build_object('cout',1,'pv_ht',2,'quantite',3,'taux',0.5,'fiabilite','fiable'),'$H');\"" >/dev/null

# 70. Préinstallation (lecture seule) : aucun écart attendu.
run "$PP -d $DB -A -F '|' -t -f $S/70_preinstallation_t3_lecture_seule.sql" > "$RP/70.txt"
E70=$(grep -c '|ECART$' "$RP/70.txt" || true); N70=$(grep -c '|OK$' "$RP/70.txt" || true)
[ "$E70" = "0" ] && [ "$N70" = "21" ] && ok "L02 contrôle 70 de préinstallation : $N70 OK, 0 écart" || ko "L02 contrôle 70 : $N70 OK, $E70 écart(s) : $(grep '|ECART$' "$RP/70.txt" | cut -d'|' -f2 | tr '\n' ';')"
V22=$(awk -F'|' '$1==22{print $4}' "$RP/70.txt"); V24=$(awk -F'|' '$1==24{print $4}' "$RP/70.txt"); V25=$(awk -F'|' '$1==25{print $4}' "$RP/70.txt")
if run "$PP -d $DB -f $S/origine/79_retour_arriere_t3_decision_journal.sql" >/dev/null 2>"$DATA/g.err" ; then ko "L03 79 d'origine accepté hors Test"; else ok "L03 garde : 79 d'origine refusé hors Test ($(grep -m1 -o 'garde_projet_test' "$DATA/g.err"))"; fi
for f in 80_comptes_recette_t3_creation.sql 81_desactiver_gerant_sm_t3.sql 82_desactiver_comptes_recette_t3.sql; do
  if run "$PP -d $DB -f $S/origine/$f" >/dev/null 2>"$DATA/g.err"; then ko "L03 $f d'origine accepté hors Test"; else ok "L03 garde : $f d'origine refusé hors Test ($(grep -m1 -o 'garde_projet_test' "$DATA/g.err"))"; fi
done

# 73. Empreintes des registres T2 de SM avant migration (condition 2).
cp "$ICI/73_empreintes_registres_t2_sm_lecture_seule.sql" "$S/73.sql"; chown postgres "$S/73.sql"
run "$PP -d $DB -A -F '|' -t -f $S/73.sql" > "$RP/73_avant.txt"
# Migration (rôle postgres, comme apply_migration) puis enregistrement dans l'historique, comme Supabase.
run "$PP -d $DB -f $S/20261119100000_tarif_decision_journal.sql" >/dev/null 2>&1 && ok "L04 migration appliquée par le rôle postgres" || ko "L04 migration"
run "$PA -d $DB -c \"insert into supabase_migrations.schema_migrations (version, name) values ('20261119100000','tarif_decision_journal')\"" >/dev/null
# 71. Postinstallation : valeurs attendues 13 à 16 reprises du 70 du jour (procédure prévue).
sed -i "s/'0 (actives 0)',/'$V22',/; s/(empreinte des colonnes T2)', 'vide'/(empreinte des colonnes T2)', '$V24'/; s/'1b75f1f3ca55c1282f87f47ca8822780'/'$V25'/" "$S/71_postinstallation_t3_lecture_seule.sql"
run "$PP -d $DB -A -F '|' -t -f $S/71_postinstallation_t3_lecture_seule.sql" > "$RP/71.txt"
E71=$(grep -c '|ECART$' "$RP/71.txt" || true); N71=$(grep -c '|OK$' "$RP/71.txt" || true)
[ "$E71" = "0" ] && [ "$N71" = "20" ] && ok "L05 contrôle 71 de postinstallation : 20 OK (objets, droits et privilèges effectifs, historique SM inchangé : $V22, empreintes identiques)" || ko "L05 contrôle 71 : $N71 OK, écarts : $(grep '|ECART$' "$RP/71.txt" | tr '\n' ';')"

run "$PP -d $DB -A -F '|' -t -f $S/73.sql" > "$RP/73_apres_migration.txt"
cmp -s "$RP/73_avant.txt" "$RP/73_apres_migration.txt" && ok "L05b empreintes des registres T2 de SM identiques avant et après migration ($(grep '^TOTAL' "$RP/73_avant.txt" | cut -d'|' -f2-3 | tr '|' '/') lignes actives/totales)" || ko "L05b registres T2 modifiés par la migration"
# Services : vrai Supabase Auth, PostgREST, relais /auth/v1 et /rest/v1.
PORT=9998 "$GOTRUE" serve > "$DATA/gotrue.log" 2>&1 &
cat > "$DATA/pgrst.conf" <<CONF
db-uri = "postgres://authenticator@/$DB?host=/tmp&port=$PORT"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 3313
CONF
chmod 644 "$DATA/pgrst.conf"; "$PGRST" "$DATA/pgrst.conf" > "$DATA/pgrst.log" 2>&1 &
node "$T2/recette/relais_local_supabase.mjs" 8712 9998 3313 &
for i in $(seq 1 60); do [ "$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8712/auth/v1/health)" = "200" ] && [ "$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8712/rest/v1/tarif_familles)" = "401" ] && break; sleep 0.5; done
jwt() { node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:process.argv[1],iss:'supabase',exp:Math.floor(Date.now()/1000)+3600});process.stdout.write(h+'.'+p+'.'+c.createHmac('sha256',process.argv[2]).update(h+'.'+p).digest('base64url'))" "$1" "$SECRET"; }
export NEXUS_MODE=local_auth NEXUS_LOCAL_URL=http://127.0.0.1:8712 NEXUS_TEST_SERVICE_ROLE_KEY=$(jwt service_role) NEXUS_TEST_ANON_KEY=$(jwt anon)
for k in GSM MSM GFA; do export NEXUS_RECETTE_T3_MDP_$k=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20); done
NB=0
for e in recette-t3-gerant-sm:GSM recette-t3-manager-sm:MSM recette-t3-gerant-fantome:GFA; do
  u=${e%%:*}; k=${e##*:}; v="NEXUS_RECETTE_T3_MDP_$k"
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8712/auth/v1/admin/users -H "apikey: $NEXUS_TEST_SERVICE_ROLE_KEY" -H "Authorization: Bearer $NEXUS_TEST_SERVICE_ROLE_KEY" -H 'Content-Type: application/json' -d "{\"email\":\"$u@vito-nexus.local\",\"password\":\"${!v}\",\"email_confirm\":true}")
  [ "$c" = "200" ] && NB=$((NB+1))
done
[ "$NB" = "3" ] && ok "L06 étape réservée simulée : trois identités créées dans le vrai Supabase Auth" || ko "L06 identités : $NB / 3"
run "$PP -d $DB -f $S/80_comptes_recette_t3_creation.sql" >/dev/null 2>"$DATA/80.err" && ok "L07 script 80 : trois comptes liés (gérant SM, manager SM, gérant fantôme)" || ko "L07 script 80 : $(grep -m1 ERROR "$DATA/80.err")"
run "$PP -d $DB -f $S/80_comptes_recette_t3_creation.sql" >/dev/null 2>"$DATA/80b.err" && ko "L08 rejeu du 80 accepté" || ok "L08 rejeu du 80 refusé ($(grep -m1 -o 'compte_deja_lie' "$DATA/80b.err")) : aucune réactivation implicite"

RT="$ICI/recette_t3_decision_journal.mjs"
for ph in 1 2 3; do
  [ $ph = 3 ] && { run "$PP -d $DB -f $S/81_desactiver_gerant_sm_t3.sql" >/dev/null 2>&1 && ok "L09 script 81 : gérant SM de recette désactivé, identité conservée" || ko "L09 script 81"; }
  if R=$(node "$RT" --phase $ph --sortie "$RP/t3_phase$ph.json" 2>&1); then ok "L1$ph phase $ph, connexions réelles : $R"; else ko "L1$ph phase $ph : $R"; fi
done
# Bilan base après recette (hors RLS, lecture seule) : aucune ligne de recette active, historique SM intact.
B=$(run "$PA -d $DB -tAc \"select (select count(*) from tarif_decisions where article like 'RECETTE T3 %') || '/' || (select count(*) from tarif_decisions where article like 'RECETTE T3 %' and annule_le is null) || '/' || (select count(*) from tarif_prix_decides where article like 'RECETTE T3 %' and annule_le is null) || '/' || (select count(*) from tarif_decisions where article like 'RECETTE T3 %' and prix_decide_id is not null)\"")
[ "$B" = "7/0/0/5" ] && ok "L15 bilan : 7 lignes de journal de recette (6 SM, 1 fantôme), toutes annulées, 5 liées ; aucun prix de recette actif" || ko "L15 bilan $B"
run "$PP -d $DB -A -F '|' -t -f $S/71_postinstallation_t3_lecture_seule.sql" > "$RP/71_apres_recette.txt"
H14=$(run "$PA -d $DB -tAc \"select md5(string_agg(concat_ws('|', id, site, article, code_barres, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, seuil_id, moteur_version, photo::text, saisi_par, saisi_le, annule_le, annule_par, motif_annulation), ';' order by id)) from tarif_decisions where site = 'vito-sainte-marie' and article not like 'RECETTE T3 %'\"")
[ "$H14" = "$V24" ] && ok "L16 la décision historique SM (sans lien) est identique après la recette" || ko "L16 historique modifié"
# Sensibilité : la phase 3 doit échouer si la vérification explicite du compte est retirée de la fonction.
run "$PA -d $DB -c \"update employees set actif = true where username = 'recette-t3-gerant-sm'\"" >/dev/null
if node "$RT" --phase 3 --sortie "$DATA/sens.json" >/dev/null 2>&1; then ko "L14 sensibilité : compte réactivé non détecté"; else ok "L14 sensibilité : avec le gérant réactivé, la phase 3 échoue ($(python3 -c "import json;print([c['id'] for c in json.load(open('$DATA/sens.json'))['cas'] if c['verdict']=='ECHEC'][0])"))"; fi
run "$PA -d $DB -c \"update employees set actif = false where username = 'recette-t3-gerant-sm';
  update tarif_decisions set annule_le = now(), annule_par = (select id from employees where username = 'recette-t3-gerant-sm'), motif_annulation = 'essai de sensibilite' where article = 'RECETTE T3 P' and annule_le is null;
  update tarif_prix_decides set annule_le = now(), annule_par = (select id from employees where username = 'recette-t3-gerant-sm'), motif_annulation = 'essai de sensibilite' where article = 'RECETTE T3 P' and annule_le is null;\"" >/dev/null
# Fin : 82, bannissement par l'API d'administration (lot recette_t3), reconnexion refusée.
run "$PP -d $DB -f $S/82_desactiver_comptes_recette_t3.sql" > "$DATA/82.out" 2>&1 && ok "L17 script 82 : trois comptes désactivés, lignes conservées" || ko "L17 script 82"
BAN="$ICI/bannir_identites_recette.mjs"
if R=$(node "$BAN" --lot recette_t3 --sortie "$RP/bannissement_t3.json" 2>&1); then ok "L18 bannissement lot recette_t3 : $R"; else ko "L18 $R"; fi
BB=$(run "$PA -d $DB -tAc \"select count(*) filter (where banned_until > now() + interval '50 years') || '/' || count(*) filter (where deleted_at is null) from auth.users where email like 'recette-t3-%'\"")
[ "$BB" = "3/3" ] && ok "L19 trois identités bannies (plus de 50 ans), aucune supprimée" || ko "L19 état auth $BB"
python3 - "$RP" <<'PY' && ok "L20 rapports sans secret : ni mot de passe, ni clé, ni jeton" || ko "L20 secret trouvé dans un rapport"
import os,sys,glob
sec=[os.environ[k] for k in os.environ if k.startswith('NEXUS_RECETTE_T3_MDP_')]+[os.environ['NEXUS_TEST_SERVICE_ROLE_KEY'],os.environ['NEXUS_TEST_ANON_KEY']]
for f in glob.glob(sys.argv[1]+'/*.json'):
    t=open(f).read(); assert not any(s in t for s in sec) and 'access_token' not in t, f
PY
run "$PP -d $DB -A -F '|' -t -f $S/73.sql" > "$RP/73_apres_recette.txt"
cmp -s "$RP/73_avant.txt" "$RP/73_apres_recette.txt" && ok "L25b empreintes des registres T2 de SM identiques après la recette (lignes RECETTE T3 exclues)" || ko "L25b registres T2 modifiés par la recette"
# 72. Bilan de fin de recette (lecture seule), valeurs attendues 1 et 2 reprises du 70 du jour.
cp "$ICI/72_bilan_recette_t3_lecture_seule.sql" "$S/72.sql"; chown postgres "$S/72.sql"
# Répétition seulement : l'essai de sensibilité L14 ajoute une ligne de recette SM (annulée), d'où 7/1 au lieu de 6/1 sur Test.
sed -i "s/(empreinte des colonnes T2)', 'vide'/(empreinte des colonnes T2)', '$V24'/; s/'1b75f1f3ca55c1282f87f47ca8822780'/'$V25'/; s/'6\\/1'/'7\\/1'/" "$S/72.sql"
run "$PP -d $DB -A -F '|' -t -f $S/72.sql" > "$RP/72.txt"
E72=$(grep -c '|ECART$' "$RP/72.txt" || true); N72=$(grep -c '|OK$' "$RP/72.txt" || true)
[ "$E72" = "0" ] && [ "$N72" = "9" ] && ok "L25 bilan 72 de fin de recette : 9 OK (historique SM intact, recette annulée, 1 journal par prix, comptes désactivés et bannis)" || ko "L25 bilan 72 : $N72 OK, écarts : $(grep '|ECART$' "$RP/72.txt" | tr '\n' ';')"
# Gardes du programme de recette en mode Test : seules la cible Test exacte et une clé publique sont admises.
for u in "https://uzhjpqpctpvxytxpxoqz.supabase.co" "https://exemple.supabase.co"; do
  if NEXUS_MODE=test NEXUS_TEST_URL="$u" node "$RT" --phase 1 --sortie "$DATA/x.json" >/dev/null 2>&1; then ko "L21 cible $u acceptée"; else ok "L21 garde : cible « $u » refusée avant tout appel"; fi
done
# Retour arrière (79) : liens archivés, objets T3 retirés, données tarifaires conservées.
NL=$(run "$PA -d $DB -tAc \"select count(*) from tarif_decisions where prix_decide_id is not null\""); NJ=$(run "$PA -d $DB -tAc \"select count(*) from tarif_decisions\""); NP=$(run "$PA -d $DB -tAc \"select count(*) from tarif_prix_decides\"")
run "$PP -d $DB -f $S/79_retour_arriere_t3_decision_journal.sql" > "$DATA/79.out" 2>&1 && ok "L22 retour arrière 79 exécuté (répétition)" || ko "L22 79 : $(grep -m1 ERROR "$DATA/79.out")"
ARCH=$(run "$PA -d $DB -tAc \"select nspname from pg_namespace where nspname like 'archive_tarif_t3_%'\"")
R79=$(run "$PA -d $DB -tAc \"select (select count(*) from $ARCH.tarif_decisions_liens) || '/' || (select count(*) from tarif_decisions) || '/' || (select count(*) from tarif_prix_decides) || '/' ||
  ((select count(*) from pg_proc where proname in ('tarif_enregistrer_decisions','tarif_controle_decision_lien')) + (select count(*) from pg_trigger where tgname = 'tarif_decisions_lien') + (select count(*) from pg_class where relname = 'tarif_decisions_prix_decide_uq') + (select count(*) from information_schema.columns where table_name = 'tarif_decisions' and column_name = 'prix_decide_id'))\"")
LA=$(run "$PA -d $DB -c \"set role authenticated; select count(*) from $ARCH.tarif_decisions_liens\"" >/dev/null 2>&1 && echo oui || echo non)
[ "$R79" = "$NL/$NJ/$NP/0" ] && [ "$LA" = "non" ] && ok "L23 retour arrière : $NL liens archivés dans $ARCH (fermé à authenticated), $NJ lignes de journal et $NP prix décidés conservés, aucun objet T3 restant" || ko "L23 retour arrière : $R79, lecture archive $LA"
run "$PP -d $DB -f $S/79_retour_arriere_t3_decision_journal.sql" > "$DATA/79b.out" 2>&1 && ko "L24 second retour arrière accepté" || ok "L24 second retour arrière refusé ($(grep -m1 -o 'retour_arriere_sans_objet' "$DATA/79b.out"))"
echo "---" | tee -a "$OUT"
echo "Bilan : $(grep -c '^OK' "$OUT") OK, $(grep -c '^ECHEC' "$OUT") ECHEC" | tee -a "$OUT"
