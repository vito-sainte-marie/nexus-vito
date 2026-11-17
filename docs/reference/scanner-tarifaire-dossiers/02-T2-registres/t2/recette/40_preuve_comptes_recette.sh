# Inclus par executer_recette_locale.sh : exerce les scripts de comptes de recette sur une base jetable.
run "createdb -h /tmp -p $PORT -U supabase_admin comptes"
socle_et_migrations comptes >/dev/null
run "$PA -d comptes -c \"insert into sites (site_id, nom_entreprise, timezone) values ('vito-sainte-marie','SM','America/Martinique');\"" >/dev/null
if run "$PP -d comptes -f $S2/40_comptes_gerants_recette_test_creation.sql" >/dev/null 2>"$DATA/c.err"; then ko "120 création refusée sans identités"; else ok "120 création refusée tant que les identités n'existent pas ($(grep -m1 -o 'garde_identites' "$DATA/c.err"))"; fi
run "$PA -d comptes -c \"insert into auth.users (id, email) values ('f0000000-0000-0000-0000-000000000001','recette-t2-gerant-sm@vito-nexus.local'),('f0000000-0000-0000-0000-000000000002','recette-t2-gerant-fantome@vito-nexus.local');\"" >/dev/null
run "$PP -d comptes -f $S2/40_comptes_gerants_recette_test_creation.sql" >/dev/null 2>&1 || true
E=$(run "$PA -d comptes -tAc \"select string_agg(username||':'||role||':'||site_id||':'||actif||':'||compte_test||':'||est_createur, ' ' order by username) from employees\"")
[ "$E" = "recette-t2-gerant-fantome:gerant:site-fantome-test:true:true:false recette-t2-gerant-sm:gerant:vito-sainte-marie:true:true:false" ] && ok "121 deux gérants de recette créés : rôle gerant, compte de test, non créateurs, un par site" || ko "121 comptes : $E"
SM="f0000000-0000-0000-0000-000000000001"; FA="f0000000-0000-0000-0000-000000000002"
Q="select set_config('request.jwt.claim.sub','$SM',false); set role authenticated;"
if run "$PA -d comptes -c \"$Q insert into tarif_familles (site, famille_code, libelle) values ('vito-sainte-marie','confiserie','Confiserie');\"" >/dev/null 2>&1; then ok "122 gérant de recette Sainte-Marie écrit sur son site, sous RLS"; else ko "122 écriture refusée"; fi
V=$(run "$PA -d comptes -tAc \"select set_config('request.jwt.claim.sub','$FA',false); set role authenticated; select count(*) from tarif_familles;\"" | tail -1)
[ "$V" = "0" ] && ok "123 gérant de recette fantôme ne voit rien de Sainte-Marie" || ko "123 fantôme voit $V lignes"
run "$PP -d comptes -f $S2/41_comptes_gerants_recette_test_desactivation.sql" >/dev/null 2>&1
if run "$PA -d comptes -c \"$Q select 1/count(*) from tarif_familles;\"" >/dev/null 2>&1; then ko "124 compte de recette désactivé lit encore"; else ok "124 après désactivation : le gérant de recette ne lit plus les registres, sa ligne employees est conservée"; fi
if run "$PP -d comptes -f $S2/origine/40_comptes_gerants_recette_test_creation.sql" >/dev/null 2>"$DATA/g.err"; then ko "128 script d'origine accepté hors Test"; else ok "128 garde : script de création d'origine refusé sur une base qui n'est pas Test ($(grep -m1 -o 'garde_projet_test : identifiant système' "$DATA/g.err"))"; fi
if run "$PP -d comptes -f $S2/origine/recette_test_donnees_sainte_marie_t2.sql" >/dev/null 2>&1; then ko "128b données de recette d'origine acceptées hors Test"; else ok "128b garde : données de recette d'origine refusées hors Test"; fi
# 129. Preuve d'accès Test (gérant actif, gérant désactivé, manager, deux sites), rejouée ici sur les comptes réactivés.
run "$PA -d comptes -c \"update employees set actif = true where username like 'recette-t2-%';\"" >/dev/null
AV=$(run "$PA -d comptes -tAc \"select (select count(*) from employees) || '/' || (select count(*) from tarif_familles) || '/' || (select count(*) from tarif_exceptions)\"")
run "$PP -d comptes -f $S2/50_preuve_acces_test.sql" >/dev/null 2>"$DATA/p.err" || true
AP=$(run "$PA -d comptes -tAc \"select (select count(*) from employees) || '/' || (select count(*) from tarif_familles) || '/' || (select count(*) from tarif_exceptions)\"")
RES=$(grep -m1 -o 'PREUVE_T2_TERMINEE.*' "$DATA/p.err")
echo "$RES" > "$ICI/preuve_acces_test_locale.txt"
case "$RES" in *"OK 16 / ECHEC 0"*) ok "129 preuve d'accès : 16 cas conformes (gérant actif, gérant désactivé, manager, deux sites, anon)";; *) ko "129 preuve d'accès : $RES";; esac
[ "$AV" = "$AP" ] && ok "130 preuve d'accès : aucune écriture conservée (employés/familles/exceptions $AP avant et après)" || ko "130 écritures conservées : $AV puis $AP"
# 131. Sensibilité : sans la politique restrictive sur tarif_familles, la preuve doit échouer (elle ne passe pas à vide).
run "$PA -d comptes -c \"drop policy compte_actif_obligatoire on tarif_familles;\"" >/dev/null
run "$PP -d comptes -f $S2/50_preuve_acces_test.sql" >/dev/null 2>"$DATA/p2.err" || true
R2=$(grep -m1 -o 'PREUVE_T2_TERMINEE.*' "$DATA/p2.err")
case "$R2" in *"ECHEC 0"*|"") ko "131 preuve insensible au retrait de la politique : $R2";; *) ok "131 sensibilité : politique retirée, la preuve le détecte ($(echo "$R2" | grep -o 'OK [0-9]* / ECHEC [0-9]*'), cas 13 en échec)";; esac
run "$PA -d comptes -c \"delete from sites where site_id = 'nexus-station-test';\"" >/dev/null
if run "$PP -d comptes -f $S2/40_comptes_gerants_recette_test_creation.sql" >/dev/null 2>"$DATA/c2.err"; then ko "125 garde projet Test inopérante"; else ok "125 garde : refus hors projet Test ($(grep -m1 -o 'garde_projet_test' "$DATA/c2.err"))"; fi
