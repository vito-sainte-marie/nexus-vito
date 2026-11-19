#!/bin/bash
# Répétition COMPLÈTE sur une base jetable (Docker postgres:17, port local aléatoire). Ne touche ni Test ni Production.
# Limite : les tables public.products / stock_releves sont des SOUCHES (colonnes text) ; elles ne reproduisent pas les 130 règles T2 réelles.
# Le contrôle 73 réel n'est donc pas répété ici : il se joue sur Test, lecture seule, avant et après.
# Usage : bash repetition_locale.sh <dossier-export>
set -u
EXPORT="${1:?dossier export}"; ICI="$(cd "$(dirname "$0")" && pwd)"; W="$(mktemp -d)"; N="rehearsal_scanner_$$"
PSQL=/opt/homebrew/opt/libpq/bin/psql; [ -x "$PSQL" ] || PSQL=psql
docker run -d --rm --name "$N" -e POSTGRES_PASSWORD=x -p 127.0.0.1::5432 postgres:17 >/dev/null || exit 1
trap 'docker stop "$N" >/dev/null 2>&1; rm -rf "$W"' EXIT
PORT=$(docker port "$N" 5432/tcp | head -1 | sed 's/.*://')
export PGPASSWORD=x; P="$PSQL -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -X -q"
for i in $(seq 1 60); do $P -d postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
ID=$($P -d postgres -Atc "select system_identifier from pg_control_system()")
echo "== base jetable, identifiant système local $ID"
$P -d postgres -c "create role anon nologin; create role authenticated nologin; create table public.products(site text, article text, v text); create table public.stock_releves(site text, libelle text, v text); create table public.sites(site_id text primary key); insert into public.sites values ('site-fantome-test'),('nexus-station-test'); insert into public.products values ('vito-sainte-marie','a','1'); insert into public.stock_releves values ('vito-sainte-marie','b','2');"
ID_TEST=7678069749886157684
# Les fichiers portent l'identifiant de Test en dur. Pour jouer sur la base locale, on ne substitue que dans des COPIES.
sub() { sed "s/$ID_TEST/$ID/g" "$1" > "$2"; }
echo "== 1. garde : le fichier RÉEL (id de Test en dur) joué sur une base qui n'est pas Test → la migration doit échouer et ne rien écrire"
if $P -d postgres --single-transaction -f "$ICI/10_migration_recette_scanner_BROUILLON.sql" 2>&1 | tail -2; [ "${PIPESTATUS[0]}" -ne 0 ]; then echo "OK garde : refus"; else echo "ÉCHEC garde"; exit 1; fi
echo "schéma présent après refus : $($P -d postgres -Atc "select count(*) from pg_namespace where nspname='recette_scanner'") (attendu 0)"
echo "== 2. migration avec le bon identifiant"
sub "$ICI/10_migration_recette_scanner_BROUILLON.sql" "$W/m.sql"; $P -d postgres --single-transaction -f "$W/m.sql" && echo OK
echo "== 3. empreinte public AVANT"; $P -d postgres -A -f "$ICI/40_controle_public_inchange_lecture_seule.sql" > "$W/avant.txt"; cat "$W/avant.txt"
echo "== 4. import (vérifie SHA-256 et md5, génère le SQL, le joue)"
node "$ICI/20_import_lot.mjs" "$EXPORT" "$W/imp_test.sql" | tail -1 || exit 1
echo "taille du SQL d'import : $(wc -c < "$W/imp_test.sql") octets"
echo "-- import réel (id Test) refusé sur la base locale :"; $P -d postgres --single-transaction -f "$W/imp_test.sql" 2>&1 | tail -1
sub "$W/imp_test.sql" "$W/imp.sql"; $P -d postgres --single-transaction -f "$W/imp.sql" && echo OK
LOT=$($P -d postgres -Atc "select lot_id from recette_scanner.lots")
echo "== 5. relecture lecture seule (lot $LOT)"; $P -d postgres -A -v lot="$LOT" -f "$ICI/30_relecture_lecture_seule.sql" | tee "$W/relu.txt"
grep -q '|f$' "$W/relu.txt" && { echo "ÉCHEC : md5 différent"; exit 1; }
echo "== 5b. vues : colonnes dérivées"
$P -d postgres -Atc "select count(*), count(*) filter (where article <> ''), count(*) filter (where prix_vente <> '') from recette_scanner.v_ventes; select count(*), count(*) filter (where libelle <> '') from recette_scanner.v_stock_brut; select has_table_privilege('anon','recette_scanner.v_ventes','select')"
echo "== 6. ajout seul : UPDATE, DELETE, TRUNCATE doivent être refusés"
for r in "update recette_scanner.lots set note='x'" "delete from recette_scanner.ventes" "truncate recette_scanner.stock_brut"; do $P -d postgres -c "$r" >/dev/null 2>&1 && { echo "ÉCHEC : accepté ($r)"; exit 1; } || echo "OK refusé : $r"; done
echo "== 7. droits : anon / authenticated sans accès"
for r in anon authenticated; do $P -d postgres -Atc "select has_schema_privilege('$r','recette_scanner','usage'), has_table_privilege('$r','recette_scanner.ventes','select'), (select relrowsecurity from pg_class where oid='recette_scanner.ventes'::regclass)"; done
echo "== 8. second import : nouveau lot, l'ancien intact"
$P -d postgres --single-transaction -f "$W/imp.sql" && echo "lots : $($P -d postgres -Atc 'select count(*) from recette_scanner.lots')"
echo "== 9. retour arrière"; sub "$ICI/11_retour_arriere_recette_scanner.sql" "$W/r.sql"; $P -d postgres --single-transaction -f "$W/r.sql" && echo OK
echo "schéma présent : $($P -d postgres -Atc "select count(*) from pg_namespace where nspname='recette_scanner'") (attendu 0)"
echo "== 10. empreinte public APRÈS"; $P -d postgres -A -f "$ICI/40_controle_public_inchange_lecture_seule.sql" > "$W/apres.txt"; cat "$W/apres.txt"
diff "$W/avant.txt" "$W/apres.txt" && echo "public INCHANGÉ"
