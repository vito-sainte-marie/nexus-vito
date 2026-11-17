# Inclus par executer_recette_locale.sh. 160 à 169 : répétition de la procédure d'exécution Test sur le socle local.
EX="$ICI/../execution_test"; cp "$EX"/*.sql "$S2/"; chown postgres "$S2"/*.sql
run "createdb -h /tmp -p $PORT -U supabase_admin repetition"
socle_et_migrations repetition " " >/dev/null
AV=$(run "$PP -d repetition -tA -f $S2/10_preuve_avant.sql")
echo "$AV" > "$ICI/repetition_preuve_avant.json"
rm -f "$ICI/repetition_etats_intermediaires.txt"; i=0
for f in $MIGS; do
  if ! run "$PP -d repetition -v ON_ERROR_STOP=1 --single-transaction -f $S2/$f" >/dev/null 2>"$DATA/rep.err"; then ko "16$i $f : erreur, arrêt ($(grep -m1 -o 'ERROR:.*' "$DATA/rep.err"))"; break; fi
  E=$(run "$PP -d repetition -tA -f $S2/20_controle_apres_chaque_migration.sql" | python3 -c "import json,sys; d=json.load(sys.stdin); print(':'.join(str(d[k]) for k in ['tables_tarif','fonctions_tarif','declencheurs_tarif','politiques_tarif','vues_tarif','rls_forcee']))")
  echo "$((i+1)) $f $E" >> "$ICI/repetition_etats_intermediaires.txt"
  ok "16$i étape $((i+1)) $f appliquée seule, en transaction unique : état $E"
  i=$((i+1))
done
AP=$(run "$PP -d repetition -tA -f $S2/30_preuve_apres.sql"); echo "$AP" > "$ICI/repetition_preuve_apres.json"
python3 - "$ICI/repetition_preuve_avant.json" "$ICI/repetition_preuve_apres.json" > "$DATA/cmp.txt" <<'PY'
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2])); c=b['controles_t2']
ok = a['empreinte_hors_t2']==b['empreinte_hors_t2'] and a['objets_tarif_existants']==0 and c=={'tables':10,'rls_forcee':10,'vues_security_invoker':11,'fonctions_tarif':5,'fonctions_tarif_security_definer':0,'politiques_restrictives_compte_actif':10,'droits_anon':0,'droits_delete_update_truncate':0,'lignes_registres':0}
print(('OK' if ok else 'KO')+' empreinte hors T2 '+a['empreinte_hors_t2'][:12]+' -> '+b['empreinte_hors_t2'][:12]+' ; '+json.dumps(c))
PY
case "$(cat $DATA/cmp.txt)" in OK*) ok "164 preuves avant/après : rien d'autre que T2 n'a changé, état T2 conforme ($(cut -c4-60 $DATA/cmp.txt))";; *) ko "164 $(cat $DATA/cmp.txt)";; esac
# Arrêt immédiat : une migration volontairement fautive (erreur au milieu) ne laisse aucun objet partiel.
run "createdb -h /tmp -p $PORT -U supabase_admin repetition_erreur"
socle_et_migrations repetition_erreur " " >/dev/null
sed 's/^create table if not exists tarif_seuils (/select 1\/0;\ncreate table if not exists tarif_seuils (/' "$S2/20261118100000_tarif_registres.sql" > "$S2/fautive.sql"; chown postgres "$S2/fautive.sql"
E0=$(run "$PA -d repetition_erreur -tAc \"$EMPREINTE\"")
if run "$PP -d repetition_erreur -v ON_ERROR_STOP=1 --single-transaction -f $S2/fautive.sql" >/dev/null 2>&1; then ko "165 migration fautive acceptée"; else
  E1=$(run "$PA -d repetition_erreur -tAc \"$EMPREINTE\""); T=$(run "$PA -d repetition_erreur -tAc \"select count(*) from pg_class where relname like 'tarif%'\"")
  [ "$E0" = "$E1" ] && [ "$T" = "0" ] && ok "165 arrêt immédiat : erreur au milieu de 100000, aucune table T2 créée (tarif_familles et tarif_rattachements annulées), empreinte inchangée" || ko "165 objets partiels : $T"; fi
# Retours arrière gardés : refus sur base non autorisée, puis passage normal (copie adaptée) sur la répétition.
if run "$PP -d repetition -f $S2/origine/retour_arriere_base_jetable_t2.sql" >/dev/null 2>"$DATA/rb2.err"; then ko "166 retour arrière d'origine accepté hors Test"; else grep -q 'garde_projet_test' "$DATA/rb2.err" && ok "166 garde : retour arrière jetable d'origine refusé hors Test" || ko "166 refus sans garde"; fi
if run "$PP -d repetition -f $S2/origine/retour_arriere_avec_donnees_t2.sql" >/dev/null 2>"$DATA/rb3.err"; then ko "167 retour arrière avec données d'origine accepté hors Test"; else grep -q 'garde_projet_test' "$DATA/rb3.err" && ok "167 garde : retour arrière avec données d'origine refusé hors Test" || ko "167 refus sans garde"; fi
run "$PP -d repetition -v ON_ERROR_STOP=1 -f $S2/retour_arriere_base_jetable_t2.sql" >/dev/null 2>&1
R=$(run "$PA -d repetition -tAc \"select count(*) from pg_class where relname like '%tarif%'\"")
AR=$(run "$PP -d repetition -tA -f $S2/10_preuve_avant.sql" | python3 -c "import json,sys; print(json.load(sys.stdin)['empreinte_hors_t2'])")
[ "$R" = "0" ] && [ "$AR" = "$(python3 -c "import json; print(json.load(open('$ICI/repetition_preuve_avant.json'))['empreinte_hors_t2'])")" ] && ok "168 retour arrière jetable sur la répétition : plus aucun objet T2, empreinte hors T2 revenue à l'état avant" || ko "168 retour arrière : $R objets"
